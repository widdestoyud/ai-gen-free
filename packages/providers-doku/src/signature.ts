/**
 * DOKU Non-SNAP Signature Generator & Validator
 *
 * Implements DOKU HMAC-SHA256 signature specification:
 * - Request component order: Client-Id, Request-Id, Request-Timestamp, Request-Target, (optional Digest)
 * - Digest calculation: Base64(SHA256(RawBody))
 * - Signature: HMACSHA256=Base64(HMAC-SHA256(ComponentString, SecretKey))
 *
 * @see https://developers.doku.com/get-started-with-doku-api/signature-component/non-snap
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export interface GenerateDokuSignatureParams {
  clientId: string;
  requestId: string;
  requestTimestamp: string;
  requestTarget: string;
  digest?: string;
  rawBody?: string | object;
  secretKey: string;
}

export interface VerifyDokuSignatureParams {
  clientId?: string;
  requestId?: string;
  requestTimestamp?: string;
  requestTarget: string;
  incomingSignature?: string;
  rawBody?: string | object;
  secretKey: string;
}

/**
 * Calculates Base64 encoded SHA-256 Digest from request body.
 */
export function generateDokuDigest(body: string | object): string {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return createHash("sha256").update(raw, "utf8").digest("base64");
}

/**
 * Generates DOKU Signature header value for POST or GET requests.
 * Returns format: `HMACSHA256=<base64-signature>`
 */
export function generateDokuSignature(params: GenerateDokuSignatureParams): string {
  const { clientId, requestId, requestTimestamp, requestTarget, secretKey } = params;

  let digest = params.digest;
  if (!digest && params.rawBody !== undefined && params.rawBody !== null) {
    digest = generateDokuDigest(params.rawBody);
  }

  const lines: string[] = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${requestTimestamp}`,
    `Request-Target:${requestTarget}`,
  ];

  if (digest) {
    lines.push(`Digest:${digest}`);
  }

  const componentString = lines.join("\n");
  const signatureBase64 = createHmac("sha256", secretKey)
    .update(componentString, "utf8")
    .digest("base64");

  return `HMACSHA256=${signatureBase64}`;
}

/**
 * Normalizes signature by removing HMACSHA256= or HMAC-SHA256= prefixes
 */
export function normalizeSignature(signature: string): string {
  return signature.replace(/^HMAC-?SHA256=/i, "").trim();
}

/**
 * Verifies DOKU webhook / notification signature using constant-time comparison.
 */
export function verifyDokuNotificationSignature(params: VerifyDokuSignatureParams): boolean {
  const {
    clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    incomingSignature,
    rawBody,
    secretKey,
  } = params;

  if (!incomingSignature || !secretKey || !clientId || !requestId || !requestTimestamp) {
    return false;
  }

  try {
    const rawExpectedSignature = generateDokuSignature({
      clientId,
      requestId,
      requestTimestamp,
      requestTarget,
      rawBody,
      secretKey,
    });

    const expectedNormalized = normalizeSignature(rawExpectedSignature);
    const incomingNormalized = normalizeSignature(incomingSignature);

    const a = Buffer.from(incomingNormalized, "utf8");
    const b = Buffer.from(expectedNormalized, "utf8");

    if (a.length !== b.length) {
      return false;
    }

    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
