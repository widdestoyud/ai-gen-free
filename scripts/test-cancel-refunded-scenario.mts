/**
 * DANA Sandbox Compliance Runner:
 * Scenario: Cancel Failed due to Order has been Refunded (4045700)
 * Endpoint: POST /payment-gateway/v1.0/debit/cancel.htm
 *
 * Expected Response:
 * HTTP Status: 404
 * responseCode: 4045700
 * responseMessage: Invalid Transaction Status
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

async function sendCancelRequest(originalPartnerReferenceNo: string) {
  const path = "/payment-gateway/v1.0/debit/cancel.htm";
  const body = {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo,
    originalReferenceNo: "",
    originalExternalId: "",
    reason: "Order has already been refunded",
    amount: {
      value: "10000.00",
      currency: "IDR",
    },
    additionalInfo: {},
  };

  const bodyStr = JSON.stringify(body);
  const timestamp = generateTimestamp();
  const externalId = generateExternalId();
  const canonical = buildCanonicalString("POST", path, bodyStr, timestamp);
  const signature = signRequest(canonical, privateKeyPem);

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
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
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

async function run() {
  console.log("==========================================================");
  console.log(" DANA Sandbox: Cancel Failed (Order Refunded) - 4045700");
  console.log("==========================================================");
  console.log(`Base URL    : ${baseUrl}`);
  console.log(`Endpoint    : POST /payment-gateway/v1.0/debit/cancel.htm`);
  console.log(`Target Code : 4045700 (Invalid Transaction Status)\n`);

  const originalPartnerRefNo = "REFUNDED_ORDER_" + Date.now().toString().slice(-6);
  console.log(`Mengirim request Cancel Order untuk transaksi yang telah di-refund: ${originalPartnerRefNo}...`);

  const res = await sendCancelRequest(originalPartnerRefNo);
  console.log(`HTTP Status : ${res.status}`);
  console.log(`Response    : ${JSON.stringify(res.body, null, 2)}`);

  console.log("\n----------------------------------------------------------");
  console.log(`In App Partner Action:`);
  console.log(`- Merchant menandai proses cancel sebagai FAILED.`);
  console.log(`- Menampilkan notifikasi bahwa transaksi tidak dapat dibatalkan karena status transaksi tidak valid/telah di-refund.`);
  console.log("==========================================================\n");
}

run().catch(console.error);
