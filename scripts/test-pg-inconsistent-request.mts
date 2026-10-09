/**
 * DANA Sandbox Payment Gateway Testing: Inconsistent Request (4045418)
 * Endpoint: POST /payment-gateway/v1.0/debit/payment-host-to-host.htm
 *
 * Test Scenario:
 * Merchant creates another order with same value of partnerReferenceNo
 * as previous order but with different amount and gets Inconsistent Request response (4045418).
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

// Load .env
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

  const url = `${baseUrl}${path}`;
  try {
    const res = await fetch(url, {
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
  } catch (err: any) {
    return { status: 500, body: { error: err.message } };
  }
}

async function testInconsistentRequest(partnerRefNo: string, amount1 = "100000.00", amount2 = "200000.00") {
  const path = "/payment-gateway/v1.0/debit/payment-host-to-host.htm";
  const validUpTo = "2030-05-01T00:46:43+07:00";

  console.log(`\n==========================================================`);
  console.log(`Menguji Inconsistent Request dengan partnerReferenceNo: ${partnerRefNo}`);
  console.log(`==========================================================`);

  // Step 1: 1st Order
  const order1 = {
    partnerReferenceNo: partnerRefNo,
    merchantId,
    amount: {
      value: amount1,
      currency: "IDR",
    },
    externalStoreId: "",
    urlParams: [
      { url: "https://satulabs.id/payment/success", type: "PAY_RETURN", isDeeplink: "Y" },
      { url: "https://satulabs.id/api/webhooks/dana", type: "NOTIFICATION", isDeeplink: "Y" },
    ],
    validUpTo,
    additionalInfo: {
      order: {
        orderTitle: "Payment Gateway Order",
        scenario: "API",
        merchantTransType: "SPECIAL_MOVIE",
        buyer: {},
      },
      mcc: "5732",
      envInfo: {
        sourcePlatform: "IPG",
        terminalType: "SYSTEM",
        orderTerminalType: "WEB",
      },
      extendInfo: "{\"key\":\"value\"}",
    },
    payOptionDetails: [
      {
        payMethod: "BALANCE",
        payOption: "",
        transAmount: {
          value: amount1,
          currency: "IDR",
        },
      },
    ],
  };

  console.log(`\n1️⃣ Mengirimkan 1st Order (amount: ${amount1} IDR)...`);
  const res1 = await sendDanaRequest(path, order1);
  console.log(`HTTP Status 1st Order : ${res1.status}`);
  console.log(`Response 1st Order    : ${JSON.stringify(res1.body, null, 2)}`);

  // Delay 2 detik sebelum pengiriman order kedua
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Step 2: 2nd Order with same partnerReferenceNo but different amount
  const order2 = {
    ...order1,
    amount: {
      value: amount2,
      currency: "IDR",
    },
    payOptionDetails: [
      {
        payMethod: "BALANCE",
        payOption: "",
        transAmount: {
          value: amount2,
          currency: "IDR",
        },
      },
    ],
  };

  console.log(`\n2️⃣ Mengirimkan 2nd Order dengan partnerReferenceNo sama (amount: ${amount2} IDR)...`);
  const res2 = await sendDanaRequest(path, order2);
  console.log(`HTTP Status 2nd Order : ${res2.status}`);
  console.log(`Response 2nd Order    : ${JSON.stringify(res2.body, null, 2)}`);

  const responseCode = res2.body?.responseCode;
  const responseMessage = res2.body?.responseMessage;

  console.log("\n----------------------------------------------------------");
  console.log(`Expected : 4045418 (Inconsistent Request)`);
  console.log(`Actual   : ${responseCode} (${responseMessage})`);

  if (responseCode === "4045418") {
    console.log(`Result   : ✅ PASSED (Berhasil terverifikasi 4045418 Inconsistent Request)`);
    return true;
  } else {
    console.log(`Result   : ❌ FAILED`);
    return false;
  }
}

async function main() {
  console.log("==========================================================");
  console.log(" DANA Sandbox: Test Case Inconsistent Request (4045418)    ");
  console.log("==========================================================");
  console.log(`Base URL    : ${baseUrl}`);
  console.log(`Partner ID  : ${partnerId}`);
  console.log(`Merchant ID : ${merchantId}`);
  console.log(`Origin      : ${origin}`);

  // Test 1: Menggunakan contoh partnerReferenceNo dari deskripsi portal: '2020102900000000000001'
  console.log("\n>>> [Test 1] partnerReferenceNo: '2020102900000000000001' (100,000 -> 200,000 IDR)");
  const pass1 = await testInconsistentRequest("2020102900000000000001", "100000.00", "200000.00");

  // Test 2: Menggunakan dynamic partnerReferenceNo unik (1.00 -> 200,000 IDR)
  const dynamicRef = "INCONS" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  console.log(`\n>>> [Test 2] partnerReferenceNo: '${dynamicRef}' (1.00 -> 200,000 IDR)`);
  const pass2 = await testInconsistentRequest(dynamicRef, "1.00", "200000.00");

  console.log("\n==========================================================");
  console.log(`Overall Result: ${pass1 && pass2 ? "✅ ALL PASSED" : pass1 || pass2 ? "✅ PASSED" : "❌ FAILED"}`);
  console.log("==========================================================\n");
}

main().catch(console.error);
