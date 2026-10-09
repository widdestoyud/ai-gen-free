/**
 * DPoP (Demonstrating Proof-of-Possession) & Request Signing Layer (RFC 9449 compliant subset)
 * 
 * Memverifikasi tanda tangan digital kriptografi ECDSA P-256 yang dibuat oleh browser asli.
 * Mencegah token/cookie yang dicuri digunakan di Postman / Burp Suite karena penyerang
 * tidak memiliki non-extractable private key yang tersimpan di IndexedDB browser asli.
 */

import { createPublicKey, verify, createHash } from "node:crypto";

export interface DPoPProofHeader {
  typ: "dpop+jwt";
  alg: "ES256";
  jwk: {
    kty: "EC";
    crv: "P-256";
    x: string;
    y: string;
  };
}

export interface DPoPProofPayload {
  jti: string;
  htm: string; // HTTP Method (GET, POST, etc.)
  htu: string; // HTTP URI / Path
  iat: number; // Issued At timestamp (detik)
}

export interface DPoPVerificationResult {
  valid: boolean;
  thumbprint?: string;
  error?: string;
}

function base64UrlDecode(str: string): Buffer {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64");
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Menghitung thumbprint unik (SHA-256) dari JWK Public Key.
 */
export function calculateJwkThumbprint(jwk: { crv: string; kty: string; x: string; y: string }): string {
  // RFC 7638 standard JWK thumbprint format
  const json = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  return createHash("sha256").update(json).digest("hex");
}

/**
 * Konversi JWK Public Key ECDSA P-256 ke KeyObject node:crypto
 */
export function jwkToPublicKey(jwk: DPoPProofHeader["jwk"]) {
  const xBuf = base64UrlDecode(jwk.x);
  const yBuf = base64UrlDecode(jwk.y);

  // Uncompressed EC point format: 0x04 || X || Y (65 bytes)
  const ecPoint = Buffer.concat([Buffer.from([0x04]), xBuf, yBuf]);

  return createPublicKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: jwk.x,
      y: jwk.y,
    },
    format: "jwk",
  });
}

/**
 * Verifikasi DPoP Proof token dari header x-dpop-proof.
 */
export function verifyDPoPProof(
  proofToken: string | undefined | null,
  context: {
    method: string;
    urlOrPath: string;
    maxAgeSeconds?: number;
    expectedThumbprint?: string;
  },
): DPoPVerificationResult {
  if (!proofToken || typeof proofToken !== "string") {
    return { valid: false, error: "MISSING_DPOP_PROOF" };
  }

  const parts = proofToken.trim().split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "INVALID_DPOP_FORMAT" };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header: DPoPProofHeader;
  let payload: DPoPProofPayload;

  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString("utf-8"));
    payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf-8"));
  } catch {
    return { valid: false, error: "INVALID_DPOP_JSON" };
  }

  // 1. Validasi Algoritma dan Header
  if (header.typ !== "dpop+jwt" || header.alg !== "ES256" || !header.jwk || header.jwk.crv !== "P-256") {
    return { valid: false, error: "UNSUPPORTED_DPOP_ALGORITHM" };
  }

  // 2. Validasi Timestamp (Anti-Replay window, default 60 detik)
  const maxAge = context.maxAgeSeconds ?? 60;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.iat !== "number" || Math.abs(now - payload.iat) > maxAge) {
    return { valid: false, error: "DPOP_PROOF_EXPIRED" };
  }

  // 3. Validasi HTTP Method (HTM)
  if (payload.htm.toUpperCase() !== context.method.toUpperCase()) {
    return { valid: false, error: "DPOP_METHOD_MISMATCH" };
  }

  // 4. Validasi HTTP URI / Path (HTU)
  const cleanPath = context.urlOrPath.split("?")[0].toLowerCase();
  const cleanPayloadHtu = payload.htu.split("?")[0].toLowerCase();
  if (!cleanPayloadHtu.endsWith(cleanPath) && !cleanPath.endsWith(cleanPayloadHtu)) {
    return { valid: false, error: "DPOP_URI_MISMATCH" };
  }

  // 5. Validasi Thumbprint jika sebelumnya terikat
  const thumbprint = calculateJwkThumbprint(header.jwk);
  if (context.expectedThumbprint && context.expectedThumbprint !== thumbprint) {
    return { valid: false, error: "DPOP_KEY_MISMATCH", thumbprint };
  }

  // 6. Verifikasi Digital Signature ECDSA P-256 (IEEE P1363 / DER signature)
  try {
    const publicKey = jwkToPublicKey(header.jwk);
    const dataToVerify = Buffer.from(`${headerB64}.${payloadB64}`, "utf-8");
    const signatureBuffer = base64UrlDecode(signatureB64);

    // WebCrypto menghasilkan IEEE P1363 (R || S, 64 bytes).
    const isSignatureValid = verify(
      "SHA256",
      dataToVerify,
      {
        key: publicKey,
        dsaEncoding: signatureBuffer.length === 64 ? "ieee-p1363" : "der",
      },
      signatureBuffer,
    );

    if (!isSignatureValid) {
      return { valid: false, error: "INVALID_DPOP_SIGNATURE", thumbprint };
    }

    return { valid: true, thumbprint };
  } catch (err: any) {
    return { valid: false, error: `VERIFICATION_FAILED: ${err?.message}`, thumbprint };
  }
}
