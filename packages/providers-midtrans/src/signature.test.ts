import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateMidtransSignature, verifyMidtransSignature } from "./signature.js";
import { createHash } from "node:crypto";

describe("Midtrans Signature", () => {
  const testServerKey = "SB-Mid-server-TESTKEY12345";
  const orderId = "INV-20260915-0001";
  const statusCode = "200";
  const grossAmount = "50000.00";

  it("should generate valid SHA-512 signature hash", () => {
    const rawExpected = `${orderId}${statusCode}${grossAmount}${testServerKey}`;
    const expectedHash = createHash("sha512").update(rawExpected, "utf8").digest("hex").toLowerCase();

    const result = generateMidtransSignature({
      orderId,
      statusCode,
      grossAmount,
      serverKey: testServerKey,
    });

    assert.equal(result, expectedHash);
    assert.equal(result.length, 128); // SHA-512 hex is 128 chars
  });

  it("should verify valid signature successfully", () => {
    const signature = generateMidtransSignature({
      orderId,
      statusCode,
      grossAmount,
      serverKey: testServerKey,
    });

    const isValid = verifyMidtransSignature(signature, {
      orderId,
      statusCode,
      grossAmount,
      serverKey: testServerKey,
    });

    assert.equal(isValid, true);
  });

  it("should reject tampered signature", () => {
    const signature = generateMidtransSignature({
      orderId,
      statusCode,
      grossAmount,
      serverKey: testServerKey,
    });

    const tampered = signature.slice(0, -1) + (signature.endsWith("0") ? "1" : "0");

    const isValid = verifyMidtransSignature(tampered, {
      orderId,
      statusCode,
      grossAmount,
      serverKey: testServerKey,
    });

    assert.equal(isValid, false);
  });

  it("should reject signature when gross amount differs", () => {
    const signature = generateMidtransSignature({
      orderId,
      statusCode,
      grossAmount: "50000.00",
      serverKey: testServerKey,
    });

    const isValid = verifyMidtransSignature(signature, {
      orderId,
      statusCode,
      grossAmount: "100000.00",
      serverKey: testServerKey,
    });

    assert.equal(isValid, false);
  });

  it("should reject signature when server key differs", () => {
    const signature = generateMidtransSignature({
      orderId,
      statusCode,
      grossAmount,
      serverKey: testServerKey,
    });

    const isValid = verifyMidtransSignature(signature, {
      orderId,
      statusCode,
      grossAmount,
      serverKey: "WRONG_SERVER_KEY",
    });

    assert.equal(isValid, false);
  });
});
