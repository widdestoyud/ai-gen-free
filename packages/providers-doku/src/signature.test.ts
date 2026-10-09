import test from "node:test";
import assert from "node:assert/strict";
import {
  generateDokuDigest,
  generateDokuSignature,
  verifyDokuNotificationSignature,
  normalizeSignature,
} from "./signature.js";

test("generateDokuDigest: creates correct SHA256 base64 digest", () => {
  const body = JSON.stringify({ amount: 20000, invoice_number: "INV-001" });
  const digest = generateDokuDigest(body);
  assert.ok(typeof digest === "string");
  assert.ok(digest.length > 0);

  // Digest should be deterministic
  const digest2 = generateDokuDigest(body);
  assert.equal(digest, digest2);
});

test("generateDokuSignature: generates valid POST signature format with HMACSHA256= prefix", () => {
  const secretKey = "test_secret_key_123456";
  const signature = generateDokuSignature({
    clientId: "MCH-0001-10791114622547",
    requestId: "cc682442-6c22-493e-8121-b9ef6b3fa728",
    requestTimestamp: "2020-08-11T08:45:42Z",
    requestTarget: "/checkout/v1/payment",
    rawBody: { amount: 20000 },
    secretKey,
  });

  assert.ok(signature.startsWith("HMACSHA256="));
  assert.ok(signature.length > 12);
});

test("generateDokuSignature: generates valid GET signature format without Digest", () => {
  const secretKey = "test_secret_key_123456";
  const signature = generateDokuSignature({
    clientId: "MCH-0001-10791114622547",
    requestId: "d895fb53-479c-4f77-a76a-ab81b40d77cb",
    requestTimestamp: "2020-08-11T08:45:42Z",
    requestTarget: "/orders/v1/status/INV-123",
    secretKey,
  });

  assert.ok(signature.startsWith("HMACSHA256="));
});

test("verifyDokuNotificationSignature: correctly verifies valid signatures", () => {
  const secretKey = "shared_secret_key";
  const clientId = "MCH-0001-10791114622547";
  const requestId = "479b663f-5c9d-400d-8e80-3e548a8f7639";
  const requestTimestamp = "2020-08-11T08:45:42Z";
  const requestTarget = "/webhooks/doku";
  const rawBody = JSON.stringify({
    service: { id: "VIRTUAL_ACCOUNT" },
    order: { invoice_number: "INV-001", amount: 150000 },
    transaction: { status: "SUCCESS" },
  });

  const validSignature = generateDokuSignature({
    clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    rawBody,
    secretKey,
  });

  // Test with HMACSHA256= prefix
  const isValidWithPrefix = verifyDokuNotificationSignature({
    clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    incomingSignature: validSignature,
    rawBody,
    secretKey,
  });
  assert.equal(isValidWithPrefix, true);

  // Test with raw base64 (without prefix)
  const isValidWithoutPrefix = verifyDokuNotificationSignature({
    clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    incomingSignature: normalizeSignature(validSignature),
    rawBody,
    secretKey,
  });
  assert.equal(isValidWithoutPrefix, true);
});

test("verifyDokuNotificationSignature: rejects invalid or tampered signatures", () => {
  const secretKey = "shared_secret_key";
  const clientId = "MCH-0001-10791114622547";
  const requestId = "479b663f-5c9d-400d-8e80-3e548a8f7639";
  const requestTimestamp = "2020-08-11T08:45:42Z";
  const requestTarget = "/webhooks/doku";
  const rawBody = JSON.stringify({
    order: { invoice_number: "INV-001", amount: 150000 },
  });

  const validSignature = generateDokuSignature({
    clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    rawBody,
    secretKey,
  });

  // Tampered body
  const isTamperedBody = verifyDokuNotificationSignature({
    clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    incomingSignature: validSignature,
    rawBody: JSON.stringify({ order: { invoice_number: "INV-001", amount: 50000 } }),
    secretKey,
  });
  assert.equal(isTamperedBody, false);

  // Wrong secret key
  const isWrongKey = verifyDokuNotificationSignature({
    clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    incomingSignature: validSignature,
    rawBody,
    secretKey: "wrong_secret_key",
  });
  assert.equal(isWrongKey, false);

  // Missing fields
  assert.equal(
    verifyDokuNotificationSignature({
      requestTarget,
      secretKey,
    }),
    false,
  );
});
