/**
 * Comprehensive Runner for the 3 remaining Refund Scenarios:
 * 1. Successfully requests Refund Order (2005800)
 * 2. Inconsistent Request (4045818)
 * 3. Refund Failed due to Order is Not Paid or Expired (4045800)
 *
 * Endpoint: POST /payment-gateway/v1.0/debit/refund.htm
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

if (!partnerId || !privateKey || !merchantId) {
  console.error("❌ Kredensial DANA belum lengkap di .env");
  process.exit(1);
}

const privateKeyPem = toPem(privateKey, "PRIVATE");

async function sendDanaRequest(
  path: string,
  body: any,
  overrideHeaders?: Record<string, string | null>
) {
  const method = "POST";
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  const timestamp = overrideHeaders?.["X-TIMESTAMP"] === null
    ? null
    : (overrideHeaders?.["X-TIMESTAMP"] || generateTimestamp());
  const externalId = overrideHeaders?.["X-EXTERNAL-ID"] || generateExternalId();

  let signature: string | null = null;
  if (overrideHeaders?.["X-SIGNATURE"] !== undefined) {
    signature = overrideHeaders["X-SIGNATURE"];
  } else if (timestamp) {
    const canonical = buildCanonicalString(method, path, bodyStr, timestamp);
    signature = signRequest(canonical, privateKeyPem);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ORIGIN": origin,
  };

  if (timestamp) headers["X-TIMESTAMP"] = timestamp;
  if (signature) headers["X-SIGNATURE"] = signature;
  if (overrideHeaders?.["X-PARTNER-ID"] !== null) {
    headers["X-PARTNER-ID"] = overrideHeaders?.["X-PARTNER-ID"] || partnerId;
  }
  if (externalId) headers["X-EXTERNAL-ID"] = externalId;
  if (overrideHeaders?.["CHANNEL-ID"] !== null) {
    headers["CHANNEL-ID"] = overrideHeaders?.["CHANNEL-ID"] || process.env.DANA_CHANNEL_ID || "95221";
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: bodyStr,
  });

  const text = await res.text();
  let resBody: any;
  try {
    resBody = JSON.parse(text);
  } catch {
    resBody = text;
  }
  return { status: res.status, body: resBody };
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
  const ref = "PAID" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100).toString().padStart(2, "0");
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
      order: { orderTitle: "Order Refund Test", scenario: "API", merchantTransType: "SPECIAL_MOVIE", buyer: {} },
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
    await new Promise((r) => setTimeout(r, 2000));
    await payVirtualAccountSandbox(paymentCode);
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { ref, originalRefNo, amount };
}

async function createUnpaidOrder(amount = "10000.00") {
  const ref = "UNPAID" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100).toString().padStart(2, "0");
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
      order: { orderTitle: "Unpaid Order Test", scenario: "API", merchantTransType: "SPECIAL_MOVIE", buyer: {} },
      mcc: "5732",
      envInfo: { sourcePlatform: "IPG", terminalType: "SYSTEM", orderTerminalType: "WEB" },
      extendInfo: "{\"key\":\"value\"}",
    },
    payOptionDetails: [
      { payMethod: "BALANCE", transAmount: { value: amount, currency: "IDR" } },
    ],
  });
  return { ref, originalRefNo: res.body?.referenceNo, amount };
}

async function run() {
  console.log("==========================================================");
  console.log("  DANA Sandbox: 3 Remaining Refund Scenarios Runner");
  console.log("==========================================================");
  console.log(`Base URL    : ${baseUrl}`);
  console.log(`Partner ID  : ${partnerId}`);
  console.log(`Merchant ID : ${merchantId}\n`);

  // -------------------------------------------------------------------------
  // SCENARIO 1: Successfully requests Refund Order (2005800)
  // -------------------------------------------------------------------------
  console.log("----------------------------------------------------------");
  console.log("[Scenario 1/3] Successfully requests Refund Order (2005800)");
  console.log("Endpoint : POST /payment-gateway/v1.0/debit/refund.htm");
  console.log("Expected : 2005800 (Successful / success)");
  console.log("----------------------------------------------------------");

  console.log("Membuat dan membayar order baru untuk pengujian refund...");
  const paidOrder1 = await createPaidOrder("10000.00");
  console.log(`Order berhasil dibuat & dibayar: ${paidOrder1.ref}`);

  const refundRef1 = "REF_" + Date.now().toString().slice(-8);
  const refundBody1 = {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: paidOrder1.ref,
    originalReferenceNo: paidOrder1.originalRefNo || "",
    originalExternalId: "",
    originalCaptureNo: "",
    partnerRefundNo: refundRef1,
    refundAmount: {
      value: "10000.00",
      currency: "IDR",
    },
    externalStoreId: "",
    reason: "Customer request refund",
    additionalInfo: {},
  };

  console.log("Mengirim request refund...");
  const res1 = await sendDanaRequest("/payment-gateway/v1.0/debit/refund.htm", refundBody1);
  console.log(`HTTP Status : ${res1.status}`);
  console.log(`Response    : ${JSON.stringify(res1.body, null, 2)}`);
  if (res1.body?.responseCode === "2005800") {
    console.log("Result      : ✅ LULUS (2005800 - Successful)");
  } else {
    console.log(`Result      : ❌ Belum 2005800 (Actual: ${res1.body?.responseCode} - ${res1.body?.responseMessage})`);
  }

  // -------------------------------------------------------------------------
  // SCENARIO 2: Inconsistent Request (4045818)
  // -------------------------------------------------------------------------
  console.log("\n----------------------------------------------------------");
  console.log("[Scenario 2/3] Inconsistent Request (4045818)");
  console.log("Endpoint : POST /payment-gateway/v1.0/debit/refund.htm");
  console.log("Expected : 4045818 (Inconsistent Request)");
  console.log("----------------------------------------------------------");

  console.log("Membuat dan membayar order untuk pengujian inconsistent request...");
  const paidOrder2 = await createPaidOrder("10000.00");
  console.log(`Order dibuat & dibayar: ${paidOrder2.ref}`);

  const inconsistentRefundNo = "REF_INCONS_" + Date.now().toString().slice(-6);

  console.log(`\n1️⃣ Mengirim request refund pertama (amount: 10000.00)...`);
  const res2_1 = await sendDanaRequest("/payment-gateway/v1.0/debit/refund.htm", {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: paidOrder2.ref,
    partnerRefundNo: inconsistentRefundNo,
    refundAmount: {
      value: "10000.00",
      currency: "IDR",
    },
    reason: "Inconsistent test 1st call",
    additionalInfo: {},
  });
  console.log(`HTTP Status 1st Call : ${res2_1.status}`);
  console.log(`Response 1st Call    : ${JSON.stringify(res2_1.body, null, 2)}`);

  await new Promise((r) => setTimeout(r, 2000));

  console.log(`\n2️⃣ Mengirim request refund kedua dengan partnerRefundNo SAMA tapi amount BERBEDA (amount: 20000.00)...`);
  const res2_2 = await sendDanaRequest("/payment-gateway/v1.0/debit/refund.htm", {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: paidOrder2.ref,
    partnerRefundNo: inconsistentRefundNo,
    refundAmount: {
      value: "20000.00",
      currency: "IDR",
    },
    reason: "Inconsistent test 2nd call",
    additionalInfo: {},
  });
  console.log(`HTTP Status 2nd Call : ${res2_2.status}`);
  console.log(`Response 2nd Call    : ${JSON.stringify(res2_2.body, null, 2)}`);
  if (res2_2.body?.responseCode === "4045818") {
    console.log("Result      : ✅ LULUS (4045818 - Inconsistent Request)");
  } else {
    console.log(`Result      : ❌ Belum 4045818 (Actual: ${res2_2.body?.responseCode} - ${res2_2.body?.responseMessage})`);
  }

  // -------------------------------------------------------------------------
  // SCENARIO 3: Refund Failed due to Order is Not Paid or Expired (4045800)
  // -------------------------------------------------------------------------
  console.log("\n----------------------------------------------------------");
  console.log("[Scenario 3/3] Refund Failed due to Order is Not Paid or Expired (4045800)");
  console.log("Endpoint : POST /payment-gateway/v1.0/debit/refund.htm");
  console.log("Expected : 4045800 (Invalid Transaction Status)");
  console.log("----------------------------------------------------------");

  console.log("Membuat order BELUM DIBAYAR (Status INIT)...");
  const unpaidOrder = await createUnpaidOrder("10000.00");
  console.log(`Unpaid order dibuat di DANA: ${unpaidOrder.ref}`);

  console.log("Mengirim request refund pada order yang BELUM DIBAYAR...");
  const res3 = await sendDanaRequest("/payment-gateway/v1.0/debit/refund.htm", {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: unpaidOrder.ref,
    originalReferenceNo: unpaidOrder.originalRefNo || "",
    partnerRefundNo: "REF_NOTPAID_" + Date.now().toString().slice(-6),
    refundAmount: {
      value: "10000.00",
      currency: "IDR",
    },
    reason: "Refund unpaid order test",
    additionalInfo: {},
  });
  console.log(`HTTP Status : ${res3.status}`);
  console.log(`Response    : ${JSON.stringify(res3.body, null, 2)}`);
  if (res3.body?.responseCode === "4045800") {
    console.log("Result      : ✅ LULUS (4045800 - Invalid Transaction Status)");
  } else {
    console.log(`Result      : ❌ Belum 4045800 (Actual: ${res3.body?.responseCode} - ${res3.body?.responseMessage})`);
  }

  console.log("\n==========================================================");
  console.log("   Pengujian Selesai");
  console.log("==========================================================\n");
}

run().catch(console.error);
