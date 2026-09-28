import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { verifyXenditCallbackToken } from "./signature.js";

describe("Xendit Callback Token Verification", () => {
  const validToken = "xnd_webhook_test_abc123XYZ";

  it("should verify valid callback token successfully", () => {
    const result = verifyXenditCallbackToken(validToken, validToken);
    assert.equal(result, true);
  });

  it("should reject mismatched callback token", () => {
    const result = verifyXenditCallbackToken("wrong_token", validToken);
    assert.equal(result, false);
  });

  it("should reject empty incoming token", () => {
    const result = verifyXenditCallbackToken("", validToken);
    assert.equal(result, false);
  });

  it("should reject null incoming token", () => {
    const result = verifyXenditCallbackToken(null, validToken);
    assert.equal(result, false);
  });

  it("should reject undefined incoming token", () => {
    const result = verifyXenditCallbackToken(undefined, validToken);
    assert.equal(result, false);
  });

  it("should reject when expected token is empty", () => {
    const result = verifyXenditCallbackToken(validToken, "");
    assert.equal(result, false);
  });

  it("should reject tokens with different lengths", () => {
    const result = verifyXenditCallbackToken("short", validToken);
    assert.equal(result, false);
  });

  it("should be case-sensitive", () => {
    const result = verifyXenditCallbackToken(
      validToken.toUpperCase(),
      validToken,
    );
    assert.equal(result, false);
  });
});

describe("Xendit verifyNotification integration", async () => {
  const { XenditPaymentProvider } = await import("./xendit-payment.js");
  const webhookToken = "2j276jDyABDMFDmfuJGzdsIismpyI6fmI4fOoWUFFqz36lX5";
  const provider = new XenditPaymentProvider({
    apiKey: "xnd_development_dummy",
    webhookToken,
  });

  it("should correctly parse Invoice Paid payload", async () => {
    const invoicePayload = {
      id: "579c8d61f23fa4ca35e52da4",
      external_id: "invoice_123124123",
      user_id: "5781d19b2e2385880609791c",
      is_high: true,
      payment_method: "BANK_TRANSFER",
      status: "PAID",
      merchant_name: "Xendit",
      amount: 50000,
      paid_amount: 50000,
      bank_code: "PERMATA",
      paid_at: "2016-10-12T08:15:03.404Z",
      currency: "IDR",
      payment_channel: "PERMATA",
    };

    const res = await provider.verifyNotification(invoicePayload, {
      "x-callback-token": webhookToken,
    });

    assert.equal(res.valid, true);
    assert.equal(res.invoiceNumber, "invoice_123124123");
    assert.equal(res.status, "SUCCESS");
    assert.equal(res.amount, 50000);
    assert.equal(res.paymentChannel, "PERMATA");
  });

  it("should correctly parse Payment Session payload", async () => {
    const sessionPayload = {
      event: "payment_session.completed",
      business_id: "5781d19b2e2385880609791c",
      data: {
        id: "ps-579c8d61f23fa4ca35e52da4",
        amount: 100000,
        currency: "IDR",
        reference_id: "test_session",
        status: "COMPLETED",
      },
    };

    const res = await provider.verifyNotification(sessionPayload, {
      "x-callback-token": webhookToken,
    });

    assert.equal(res.valid, true);
    assert.equal(res.invoiceNumber, "test_session");
    assert.equal(res.amount, 100000);
  });

  it("should reject payload with invalid callback token", async () => {
    const res = await provider.verifyNotification({}, {
      "x-callback-token": "wrong_token",
    });

    assert.equal(res.valid, false);
    assert(res.error?.includes("Invalid x-callback-token"));
  });
});
