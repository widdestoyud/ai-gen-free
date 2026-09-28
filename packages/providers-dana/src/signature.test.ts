import { describe, it } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import { buildCanonicalString, signRequest, verifyWebhookSignature, toPem, generateTimestamp } from "./signature.js";

describe("DANA Signature Utilities", () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem"
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem"
    }
  });

  it("should build canonical string correctly", () => {
    const method = "POST";
    const endpoint = "/payment/v1.0";
    const body = { test: 123 };
    const timestamp = "2026-09-25T14:30:00+07:00";
    
    const canonical = buildCanonicalString(method, endpoint, body, timestamp);
    const minifiedBody = '{"test":123}';
    const sha = crypto.createHash("sha256").update(minifiedBody).digest("hex").toLowerCase();
    
    assert.strictEqual(canonical, `POST:/payment/v1.0:${sha}:${timestamp}`);
  });

  it("should sign and verify round-trip", () => {
    const canonical = "POST:/test:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855:2026-09-25T14:30:00+07:00";
    
    const signature = signRequest(canonical, privateKey);
    assert.ok(signature);
    
    const isValid = verifyWebhookSignature(canonical, signature, publicKey);
    assert.strictEqual(isValid, true);
  });

  it("should format raw key to PEM", () => {
    const rawKey = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA".repeat(4);
    const pem = toPem(rawKey, "PUBLIC");
    
    assert.ok(pem.startsWith("-----BEGIN PUBLIC KEY-----"));
    assert.ok(pem.endsWith("-----END PUBLIC KEY-----"));
    assert.ok(pem.includes("\n"));
  });

  it("should return existing PEM as is", () => {
    const existingPem = "-----BEGIN PUBLIC KEY-----\nTest\n-----END PUBLIC KEY-----";
    assert.strictEqual(toPem(existingPem, "PUBLIC"), existingPem);
  });

  it("should generate timestamp with +07:00 timezone", () => {
    const timestamp = generateTimestamp(new Date("2026-09-25T07:30:00Z"));
    assert.strictEqual(timestamp, "2026-09-25T14:30:00+07:00");
  });
});
