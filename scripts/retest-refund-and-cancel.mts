/**
 * Re-testing DANA Sandbox Refund and Cancel Endpoints
 * 1. POST /payment-gateway/v1.0/debit/refund.htm (Target: 2005800)
 * 2. POST /payment-gateway/v1.0/debit/cancel.htm (Target: 4045700)
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

async function createAndPayOrder(amount = "10000.00") {
  const ref = "ORD" + Date.now().toString().slice(-8);
  const validUpTo = generateTimestamp(new Date(Date.now() + 6 * 60 * 1000));
  
  console.log(`\n1️⃣ Membuat order baru di DANA (Ref: ${ref}, Amount: ${amount} IDR)...`);
  const createRes = await sendDanaRequest("/payment-gateway/v1.0/debit/payment-host-to-host.htm", {
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

  console.log(`HTTP Status : ${createRes.status}`);
  console.log(`Response    : ${JSON.stringify(createRes.body, null, 2)}`);

  const paymentCode = createRes.body?.additionalInfo?.paymentCode;
  const originalRefNo = createRes.body?.referenceNo;

  if (paymentCode) {
    console.log(`\n2️⃣ Melakukan simulasi pembayaran VA: ${paymentCode}...`);
    await new Promise((r) => setTimeout(r, 2000));
    const payRes = await payVirtualAccountSandbox(paymentCode);
    console.log(`Hasil Pembayaran VA:`, JSON.stringify(payRes?.responseBody || payRes, null, 2));
    await new Promise((r) => setTimeout(r, 2000));
  }

  return { ref, originalRefNo, amount };
}

async function main() {
  console.log("==========================================================");
  console.log("   DANA Sandbox: Eksekusi Ulang Refund & Cancel Test");
  console.log("==========================================================");
  console.log(`Base URL    : ${baseUrl}`);
  console.log(`Partner ID  : ${partnerId}`);
  console.log(`Merchant ID : ${merchantId}`);

  // Step 1: Buat dan bayar order
  const { ref, originalRefNo, amount } = await createAndPayOrder("10000.00");

  // Step 2: Cek status transaksi pembayaran
  console.log(`\n3️⃣ Memeriksa status transaksi pembayaran via /status.htm...`);
  const statusRes = await sendDanaRequest("/payment-gateway/v1.0/debit/status.htm", {
    merchantId,
    serviceCode: "54",
    originalPartnerReferenceNo: ref,
    additionalInfo: {},
  });
  console.log(`HTTP Status : ${statusRes.status}`);
  console.log(`Response    : ${JSON.stringify(statusRes.body, null, 2)}`);

  // Step 3: Eksekusi Refund
  console.log(`\n==========================================================`);
  console.log(`4️⃣ Menguji: Successfully requests Refund Order (2005800)`);
  console.log(`Endpoint : POST /payment-gateway/v1.0/debit/refund.htm`);
  console.log(`Target   : responseCode 2005800 (Successful)`);
  console.log(`==========================================================`);

  const partnerRefundNo = "REFUND_" + Date.now().toString().slice(-8);
  const refundPayload = {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: ref,
    originalReferenceNo: originalRefNo || "",
    originalExternalId: "",
    originalCaptureNo: "",
    partnerRefundNo,
    refundAmount: {
      value: amount,
      currency: "IDR",
    },
    externalStoreId: "",
    reason: "Customer request refund",
    additionalInfo: {},
  };

  console.log(`Request Payload:\n${JSON.stringify(refundPayload, null, 2)}`);
  const refundRes = await sendDanaRequest("/payment-gateway/v1.0/debit/refund.htm", refundPayload);
  console.log(`\nHTTP Status : ${refundRes.status}`);
  console.log(`Response    : ${JSON.stringify(refundRes.body, null, 2)}`);

  // Step 4: Eksekusi Cancel Order pada transaksi yang di-refund
  console.log(`\n==========================================================`);
  console.log(`5️⃣ Menguji: Cancel Failed due to Order has been Refunded (4045700)`);
  console.log(`Endpoint : POST /payment-gateway/v1.0/debit/cancel.htm`);
  console.log(`Target   : responseCode 4045700 (Invalid Transaction Status)`);
  console.log(`==========================================================`);

  const cancelPayload = {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: ref,
    originalReferenceNo: originalRefNo || "",
    originalExternalId: "",
    reason: "Order has already been refunded",
    amount: {
      value: amount,
      currency: "IDR",
    },
    additionalInfo: {},
  };

  console.log(`Request Payload:\n${JSON.stringify(cancelPayload, null, 2)}`);
  const cancelRes = await sendDanaRequest("/payment-gateway/v1.0/debit/cancel.htm", cancelPayload);
  console.log(`\nHTTP Status : ${cancelRes.status}`);
  console.log(`Response    : ${JSON.stringify(cancelRes.body, null, 2)}`);

  console.log("\n==========================================================");
  console.log("   Pengujian Selesai");
  console.log("==========================================================\n");
}

main().catch(console.error);
