import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  verifyDPoPProof,
  calculateJwkThumbprint,
  type DPoPProofHeader,
  type DPoPProofPayload,
} from "./dpop.js";

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

test("DPoP verification verifies valid ECDSA P-256 proof token", () => {
  // Generate test ECDSA keypair
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });

  const jwk = publicKey.export({ format: "jwk" }) as { crv: string; kty: string; x: string; y: string };

  const header: DPoPProofHeader = {
    typ: "dpop+jwt",
    alg: "ES256",
    jwk: {
      kty: "EC",
      crv: "P-256",
      x: jwk.x,
      y: jwk.y,
    },
  };

  const payload: DPoPProofPayload = {
    jti: "test-jti-12345",
    htm: "POST",
    htu: "/api/admin/models",
    iat: Math.floor(Date.now() / 1000),
  };

  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signInput = Buffer.from(`${headerB64}.${payloadB64}`);

  const signature = sign("SHA256", signInput, {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });
  const sigB64 = base64UrlEncode(signature);

  const proofToken = `${headerB64}.${payloadB64}.${sigB64}`;

  // 1. Valid verification
  const result = verifyDPoPProof(proofToken, {
    method: "POST",
    urlOrPath: "/api/admin/models",
  });

  assert.equal(result.valid, true);
  assert.ok(result.thumbprint);

  // 2. Reject method mismatch (e.g. Attacker tries to use GET proof for DELETE)
  const methodMismatch = verifyDPoPProof(proofToken, {
    method: "DELETE",
    urlOrPath: "/api/admin/models",
  });
  assert.equal(methodMismatch.valid, false);
  assert.equal(methodMismatch.error, "DPOP_METHOD_MISMATCH");

  // 3. Reject URL mismatch (e.g. Attacker tries to use public endpoint proof for payment)
  const uriMismatch = verifyDPoPProof(proofToken, {
    method: "POST",
    urlOrPath: "/api/payment/checkout",
  });
  assert.equal(uriMismatch.valid, false);
  assert.equal(uriMismatch.error, "DPOP_URI_MISMATCH");

  // 4. Reject tampered payload signature
  const tamperedProof = `${headerB64}.${base64UrlEncode(Buffer.from(JSON.stringify({ ...payload, htm: "DELETE" })))}.${sigB64}`;
  const tamperedResult = verifyDPoPProof(tamperedProof, {
    method: "DELETE",
    urlOrPath: "/api/admin/models",
  });
  assert.equal(tamperedResult.valid, false);
});
