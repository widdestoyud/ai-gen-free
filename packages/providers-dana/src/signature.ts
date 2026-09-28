import crypto from "node:crypto";

/**
 * Builds the canonical string for signature generation and verification.
 * String-to-Sign: HTTP_METHOD + ":" + ENDPOINT_PATH + ":" + SHA256_HEX(REQUEST_BODY) + ":" + X-TIMESTAMP
 */
export function buildCanonicalString(
  method: string,
  endpointPath: string,
  body: string | object,
  timestamp: string
): string {
  const bodyString = typeof body === "string" ? body : JSON.stringify(body);
  const minifiedBody = JSON.stringify(JSON.parse(bodyString));
  const sha256Hex = crypto.createHash("sha256").update(minifiedBody).digest("hex").toLowerCase();
  
  return `${method}:${endpointPath}:${sha256Hex}:${timestamp}`;
}

/**
 * Signs the canonical string using RSA-SHA256 and the merchant's private key.
 */
export function signRequest(canonicalString: string, privateKeyPem: string): string {
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(canonicalString);
  sign.end();
  return sign.sign(privateKeyPem, "base64");
}

/**
 * Verifies the webhook signature using DANA's public key.
 */
export function verifyWebhookSignature(
  canonicalString: string,
  signature: string,
  danaPublicKeyPem: string
): boolean {
  const verify = crypto.createVerify("RSA-SHA256");
  verify.update(canonicalString);
  verify.end();
  return verify.verify(danaPublicKeyPem, signature, "base64");
}

/**
 * Formats a raw key into a PEM formatted string.
 */
export function toPem(rawKey: string, type: "PRIVATE" | "PUBLIC"): string {
  if (rawKey.includes("BEGIN")) return rawKey;
  
  const header = `-----BEGIN ${type} KEY-----`;
  const footer = `-----END ${type} KEY-----`;
  const chunks = rawKey.match(/.{1,64}/g) || [];
  
  return `${header}\n${chunks.join("\n")}\n${footer}`;
}

/**
 * Generates an ISO 8601 timestamp with +07:00 timezone (GMT+7).
 */
export function generateTimestamp(date: Date = new Date()): string {
  const utcMillis = date.getTime();
  const gmt7Millis = utcMillis + (7 * 60 * 60 * 1000);
  const gmt7Date = new Date(gmt7Millis);
  
  const iso = gmt7Date.toISOString();
  return iso.replace(/\.\d{3}Z$/, "") + "+07:00";
}

/**
 * Generates a unique external ID for requests.
 */
export function generateExternalId(): string {
  return crypto.randomUUID();
}
