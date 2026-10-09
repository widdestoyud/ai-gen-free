/**
 * Exhaustive tester for Successfully requests Refund Order (2005800)
 * Trying different payment methods (BNI, BRI, Mandiri, CIMB) & payload configurations
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
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text };
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

async function createAndPayOrder(payOption: string, amount = "10000.00") {
  const ref = "REFUNDTEST" + Date.now().toString().slice(-6);
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
      { payMethod: "VIRTUAL_ACCOUNT", payOption, transAmount: { value: amount, currency: "IDR" } },
    ],
  });

  const paymentCode = res.body?.additionalInfo?.paymentCode;
  const originalRefNo = res.body?.referenceNo;
  console.log(`[Order ${payOption}] Created: ${ref}, Code: ${paymentCode}`);
  if (paymentCode) {
    await new Promise((r) => setTimeout(r, 1500));
    const payRes = await payVirtualAccountSandbox(paymentCode);
    console.log(`[Order ${payOption}] Pay status:`, payRes?.responseBody?.responseCode);
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { ref, originalRefNo, amount };
}

async function run() {
  console.log("==========================================================");
  console.log("   DANA Sandbox: Testing Refund Success (2005800)");
  console.log("==========================================================");

  const vaOptions = [
    "VIRTUAL_ACCOUNT_BNI",
    "VIRTUAL_ACCOUNT_BRI",
    "VIRTUAL_ACCOUNT_MANDIRI",
    "VIRTUAL_ACCOUNT_CIMB",
  ];

  for (const option of vaOptions) {
    console.log(`\n--- Testing VA Option: ${option} ---`);
    try {
      const order = await createAndPayOrder(option, "10000.00");
      
      // Attempt 1: Standard refund
      const partnerRefundNo = "REF_" + Date.now().toString().slice(-6);
      const res1 = await sendDanaRequest("/payment-gateway/v1.0/debit/refund.htm", {
        merchantId,
        subMerchantId: "",
        originalPartnerReferenceNo: order.ref,
        originalReferenceNo: order.originalRefNo || "",
        originalExternalId: "",
        originalCaptureNo: "",
        partnerRefundNo,
        refundAmount: {
          value: "10000.00",
          currency: "IDR",
        },
        externalStoreId: "",
        reason: "Customer request refund",
        additionalInfo: {},
      });
      console.log(`Standard Refund Status: ${res1.status}, Code: ${res1.body?.responseCode}, Msg: ${res1.body?.responseMessage}`);

      // Attempt 2: DANA doc format with partnerRefundNo formatted as 2020102900000000000001
      const res2 = await sendDanaRequest("/payment-gateway/v1.0/debit/refund.htm", {
        merchantId,
        originalPartnerReferenceNo: order.ref,
        partnerRefundNo: "2020102900000000000001",
        refundAmount: {
          value: "10000.00",
          currency: "IDR",
        },
        reason: "Customer request refund",
      });
      console.log(`Doc Format Refund Status: ${res2.status}, Code: ${res2.body?.responseCode}, Msg: ${res2.body?.responseMessage}`);

      if (res1.body?.responseCode === "2005800" || res2.body?.responseCode === "2005800") {
        console.log("🎉 SUCCESS! 2005800 obtained!");
        break;
      }
    } catch (e: any) {
      console.log("Error in option:", e.message);
    }
  }

  console.log("\n==========================================================");
  console.log("   Pengujian Selesai");
  console.log("==========================================================");
}

run();
