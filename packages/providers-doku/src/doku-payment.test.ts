import test from "node:test";
import assert from "node:assert/strict";
import { DokuPaymentProvider } from "./doku-payment.js";
import { generateDokuSignature } from "./signature.js";

const TEST_CONFIG = {
  clientId: "MCH-0001-TEST",
  secretKey: "secret_key_12345",
  isProduction: false,
};

test("DokuPaymentProvider: constructor sets properties and throws if missing credentials", () => {
  const provider = new DokuPaymentProvider(TEST_CONFIG);
  assert.equal(provider.provider, "doku");

  assert.throws(
    () => new DokuPaymentProvider({ clientId: "", secretKey: "abc" }),
    /clientId/,
  );
  assert.throws(
    () => new DokuPaymentProvider({ clientId: "abc", secretKey: "" }),
    /secretKey/,
  );
});

test("DokuPaymentProvider: createPayment returns payment URL and tokens upon success", async () => {
  const provider = new DokuPaymentProvider(TEST_CONFIG);

  // Mock global fetch
  // Mock global fetch
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).includes("/checkout/v1/payment"));
    assert.equal(init?.method, "POST");
    const headers = init?.headers as Record<string, string>;
    assert.equal(headers["Client-Id"], TEST_CONFIG.clientId);
    assert.ok(headers.Signature.startsWith("HMACSHA256="));

    const parsedBody = JSON.parse(String(init?.body));
    assert.equal(parsedBody.order.callback_url, "https://myapp.com/app/order");
    assert.equal(parsedBody.order.callback_url_result, "https://myapp.com/payment/success");
    assert.equal(parsedBody.order.disable_retry_payment, true);

    return new Response(
      JSON.stringify({
        message: ["SUCCESS"],
        response: {
          order: {
            amount: "50000",
            invoice_number: "INV-TEST-001",
            session_id: "sess_123",
          },
          payment: {
            url: "https://sandbox.doku.com/checkout-link-v2/tok_123",
            token_id: "tok_123",
            expired_date: "20240712104711",
          },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  try {
    const result = await provider.createPayment({
      invoiceNumber: "INV-TEST-001",
      amount: 50000,
      customerEmail: "user@example.com",
      customerName: "Test User",
      customerPhone: "08123456789",
      callbackUrl: "https://myapp.com/app/order",
      cancelRedirectUrl: "https://myapp.com/app/order",
      successRedirectUrl: "https://myapp.com/payment/success",
    });

    assert.equal(result.success, true);
    assert.equal(result.paymentUrl, "https://sandbox.doku.com/checkout-link-v2/tok_123");
    assert.equal(result.tokenId, "tok_123");
    assert.equal(result.sessionId, "sess_123");
    assert.ok(result.expiredDate instanceof Date);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("DokuPaymentProvider: verifyNotification validates valid and invalid webhook requests", async () => {
  const provider = new DokuPaymentProvider(TEST_CONFIG);

  const payload = {
    service: { id: "VIRTUAL_ACCOUNT" },
    channel: { id: "VIRTUAL_ACCOUNT_BCA" },
    transaction: { status: "SUCCESS", date: "2024-08-23T06:11:52Z" },
    order: { invoice_number: "INV-999", amount: 100000 },
  };

  const clientId = TEST_CONFIG.clientId;
  const requestId = "req-12345";
  const requestTimestamp = "2024-08-23T06:11:52Z";
  const requestTarget = "/webhooks/doku";

  const signature = generateDokuSignature({
    clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    rawBody: payload,
    secretKey: TEST_CONFIG.secretKey,
  });

  // Valid notification
  const validResult = await provider.verifyNotification(payload, {
    "Client-Id": clientId,
    "Request-Id": requestId,
    "Request-Timestamp": requestTimestamp,
    Signature: signature,
  });

  assert.equal(validResult.valid, true);
  assert.equal(validResult.invoiceNumber, "INV-999");
  assert.equal(validResult.amount, 100000);
  assert.equal(validResult.status, "SUCCESS");
  assert.equal(validResult.paymentChannel, "VIRTUAL_ACCOUNT_BCA");
  assert.equal(validResult.paymentMethod, "VIRTUAL_ACCOUNT");

  // Invalid signature notification
  const invalidResult = await provider.verifyNotification(payload, {
    "Client-Id": clientId,
    "Request-Id": requestId,
    "Request-Timestamp": requestTimestamp,
    Signature: "HMACSHA256=invalid_sig",
  });

  assert.equal(invalidResult.valid, false);
  assert.ok(invalidResult.error);
});

test("DokuPaymentProvider: checkStatus polls order status via GET endpoint", async () => {
  const provider = new DokuPaymentProvider(TEST_CONFIG);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).includes("/orders/v1/status/INV-STATUS-001"));
    assert.equal(init?.method, "GET");

    return new Response(
      JSON.stringify({
        order: {
          invoice_number: "INV-STATUS-001",
          amount: 75000,
        },
        transaction: {
          status: "SUCCESS",
          date: "2024-08-23T06:11:52Z",
        },
        channel: {
          id: "QRIS_DOKU",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  try {
    const result = await provider.checkStatus("INV-STATUS-001");
    assert.equal(result.found, true);
    assert.equal(result.invoiceNumber, "INV-STATUS-001");
    assert.equal(result.amount, 75000);
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.paymentChannel, "QRIS_DOKU");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
