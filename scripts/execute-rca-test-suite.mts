/**
 * Comprehensive Test Execution & RCA Logger for DANA Sandbox:
 * 1. POST /payment-gateway/v1.0/debit/refund.htm -> Target 2005800 (Success Refund)
 * 2. POST /payment-gateway/v1.0/debit/refund.htm -> Target 4045818 (Inconsistent Request)
 * 3. POST /payment-gateway/v1.0/debit/cancel.htm -> Target 4045700 (Cancel Refunded Order)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildCanonicalString,
  signRequest,
  generateTimestamp,
  generateExternalId,
  toPem,
} from "../packages/providers-dana/src/signature.js";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (val.startsWith("\"") && val.endsWith("\"")) val = val.slice(1, -1);
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const partnerId = process.env.DANA_PARTNER_ID!;
const merchantId = process.env.DANA_MERCHANT_ID!;
const privateKey = process.env.DANA_PRIVATE_KEY!;
const baseUrl = process.env.DANA_BASE_URL || "https://api.sandbox.dana.id";
const origin = process.env.DANA_ORIGIN || "https://satulabs.id";
const privateKeyPem = toPem(privateKey, "PRIVATE");

async function sendDanaRequest(path: string, body: any) {
  const method = "POST";
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  const timestamp = generateTimestamp();
  const externalId = generateExternalId();
  const canonical = buildCanonicalString(method, path, bodyStr, timestamp);
  const signature = signRequest(canonical, privateKeyPem);

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "ORIGIN": origin,
      "X-TIMESTAMP": timestamp,
      "X-SIGNATURE": signature,
      "X-PARTNER-ID": partnerId,
      "X-EXTERNAL-ID": externalId,
      "CHANNEL-ID": process.env.DANA_CHANNEL_ID || "95221",
    },
    body: bodyStr,
  });

  const text = await res.text();
  try {
    return { status: res.status, headers: { timestamp, signature, externalId }, body: JSON.parse(text) };
  } catch {
    return { status: res.status, headers: { timestamp, signature, externalId }, body: text };
  }
}

async function payVirtualAccountSandbox(virtualAccountNo: string): Promise<any> {
  const executeUrl = "https://dashboard-sandbox.dana.id/merchant-portal-app/api/sandbox-tools/execute";
  const res = await fetch(executeUrl, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "origin": "https://dashboard.dana.id",
      "referer": "https://dashboard.dana.id/",
    },
    body: JSON.stringify({
      urlEndpoint: "/v1.0/transfer-va/payment.htm",
      requestBody: { virtualAccountNo },
    }),
  });
  return res.json();
}

async function createPaidOrder(amount = "10000.00") {
  const ref = "RCA_" + Date.now().toString().slice(-8);
  const validUpTo = generateTimestamp(new Date(Date.now() + 6 * 60 * 1000));
  const res = await sendDanaRequest("/payment-gateway/v1.0/debit/payment-host-to-host.htm", {
    partnerReferenceNo: ref,
    merchantId,
    amount: { value: amount, currency: "IDR" },
    externalStoreId: "",
    urlParams: [
      { url: "https://satulabs.id/payment/success", type: "PAY_RETURN", isDeeplink: "Y" },
      { url: "https://n8n.automation.dana.id/webhook/3676a08f-b06e-416c-b6cd-bea04f71c4d5", type: "NOTIFICATION", isDeeplink: "Y" },
    ],
    validUpTo,
    additionalInfo: {
      order: { orderTitle: "RCA Order Test", scenario: "API", merchantTransType: "SPECIAL_MOVIE", buyer: {} },
      mcc: "5732",
      envInfo: { sourcePlatform: "IPG", terminalType: "SYSTEM", orderTerminalType: "WEB" },
      extendInfo: "{\"key\":\"value\"}",
    },
    payOptionDetails: [
      { payMethod: "VIRTUAL_ACCOUNT", payOption: "VIRTUAL_ACCOUNT_CIMB", transAmount: { value: amount, currency: "IDR" } },
    ],
  });

  const paymentCode = res.body?.additionalInfo?.paymentCode;
  const originalRefNo = res.body?.referenceNo;
  if (paymentCode) {
    await new Promise((r) => setTimeout(r, 1500));
    await payVirtualAccountSandbox(paymentCode);
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { ref, originalRefNo, amount };
}

async function main() {
  console.log("================================================================================");
  console.log("               DANA SANDBOX COMPLIANCE RUNNER & RCA RECORDER                    ");
  console.log("================================================================================");
  console.log(`Execution Time : ${new Date().toISOString()}`);
  console.log(`Merchant ID    : ${merchantId}`);
  console.log(`Partner ID     : ${partnerId}`);
  console.log(`Base URL       : ${baseUrl}\n`);

  // STEP 1: CREATE & PAY ORDER
  console.log(">>> [SETUP] Creating Paid Transaction via CIMB Virtual Account...");
  const order = await createPaidOrder("10000.00");
  console.log(`>>> [SETUP] Order created: ${order.ref}, DANA ReferenceNo: ${order.originalRefNo}`);

  // Query payment status to verify 00 SUCCESS
  const statusRes = await sendDanaRequest("/payment-gateway/v1.0/debit/status.htm", {
    merchantId,
    serviceCode: "54",
    originalPartnerReferenceNo: order.ref,
    additionalInfo: {},
  });
  console.log(`>>> [SETUP] Order Payment Status: ${statusRes.body?.latestTransactionStatus} (${statusRes.body?.transactionStatusDesc})\n`);

  // =========================================================================
  // TEST CASE 1: Successfully requests Refund Order (2005800)
  // =========================================================================
  console.log("================================================================================");
  console.log("TEST CASE 1: Successfully requests Refund Order (2005800)");
  console.log("Endpoint   : POST /payment-gateway/v1.0/debit/refund.htm");
  console.log("Expected   : responseCode: 2005800, responseMessage: success / Successful");
  console.log("================================================================================");

  const refundNo1 = "REF_" + Date.now().toString().slice(-8);
  const refundPayload1 = {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: order.ref,
    originalReferenceNo: order.originalRefNo || "",
    originalExternalId: "",
    originalCaptureNo: "",
    partnerRefundNo: refundNo1,
    refundAmount: {
      value: "10000.00",
      currency: "IDR",
    },
    externalStoreId: "",
    reason: "Customer request refund",
    additionalInfo: {},
  };

  const res1 = await sendDanaRequest("/payment-gateway/v1.0/debit/refund.htm", refundPayload1);
  console.log("HTTP Status :", res1.status);
  console.log("Headers     :", JSON.stringify(res1.headers, null, 2));
  console.log("Payload     :", JSON.stringify(refundPayload1, null, 2));
  console.log("Response    :", JSON.stringify(res1.body, null, 2));
  console.log("Outcome     :", res1.body?.responseCode === "2005800" ? "✅ PASSED" : `❌ FAILED (Received ${res1.body?.responseCode} - ${res1.body?.responseMessage})`);

  // =========================================================================
  // TEST CASE 2: Inconsistent Request (4045818)
  // =========================================================================
  console.log("\n================================================================================");
  console.log("TEST CASE 2: Inconsistent Request (4045818)");
  console.log("Endpoint   : POST /payment-gateway/v1.0/debit/refund.htm");
  console.log("Expected   : responseCode: 4045818, responseMessage: Inconsistent Request");
  console.log("================================================================================");

  console.log("Sub-step 1: Mengirim panggilan refund pertama dengan partnerRefundNo:", order.ref);
  const res2_1 = await sendDanaRequest("/payment-gateway/v1.0/debit/refund.htm", {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: order.ref,
    partnerRefundNo: order.ref,
    refundAmount: {
      value: "10000.00",
      currency: "IDR",
    },
    reason: "Inconsistent 1st call",
    additionalInfo: {},
  });
  console.log("HTTP Status 1st Call :", res2_1.status);
  console.log("Response 1st Call    :", JSON.stringify(res2_1.body, null, 2));

  await new Promise((r) => setTimeout(r, 2000));

  console.log("\nSub-step 2: Mengirim panggilan refund kedua dengan partnerRefundNo SAMA tapi refundAmount BERBEDA (value: 435815.00)...");
  const res2_2 = await sendDanaRequest("/payment-gateway/v1.0/debit/refund.htm", {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: order.ref,
    partnerRefundNo: order.ref,
    refundAmount: {
      value: "435815.00",
      currency: "IDR",
    },
    reason: "Inconsistent 2nd call",
    additionalInfo: {},
  });
  console.log("HTTP Status 2nd Call :", res2_2.status);
  console.log("Response 2nd Call    :", JSON.stringify(res2_2.body, null, 2));
  console.log("Outcome              :", res2_2.body?.responseCode === "4045818" ? "✅ PASSED" : `❌ FAILED (Received ${res2_2.body?.responseCode} - ${res2_2.body?.responseMessage})`);

  // =========================================================================
  // TEST CASE 3: Cancel Failed due to Order has been Refunded (4045700)
  // =========================================================================
  console.log("\n================================================================================");
  console.log("TEST CASE 3: Cancel Failed due to Order has been Refunded (4045700)");
  console.log("Endpoint   : POST /payment-gateway/v1.0/debit/cancel.htm");
  console.log("Expected   : responseCode: 4045700, responseMessage: Invalid Transaction Status");
  console.log("================================================================================");

  const cancelPayload = {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: order.ref,
    originalReferenceNo: order.originalRefNo || "",
    originalExternalId: "",
    reason: "Order has already been refunded",
    amount: {
      value: "10000.00",
      currency: "IDR",
    },
    additionalInfo: {},
  };

  const res3 = await sendDanaRequest("/payment-gateway/v1.0/debit/cancel.htm", cancelPayload);
  console.log("HTTP Status :", res3.status);
  console.log("Headers     :", JSON.stringify(res3.headers, null, 2));
  console.log("Payload     :", JSON.stringify(cancelPayload, null, 2));
  console.log("Response    :", JSON.stringify(res3.body, null, 2));
  console.log("Outcome     :", res3.body?.responseCode === "4045700" ? "✅ PASSED" : `❌ FAILED (Received ${res3.body?.responseCode} - ${res3.body?.responseMessage})`);

  console.log("\n================================================================================");
  console.log("                        EXECUTION RUN COMPLETED                                 ");
  console.log("================================================================================");
}

main().catch(console.error);
