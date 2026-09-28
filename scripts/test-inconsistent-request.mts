/**
 * Script khusus untuk menguji skenario DANA Sandbox: Inconsistent Request (4045418)
 *
 * Cara Replikasi:
 * 1st Order:
 * {
 *   "partnerReferenceNo": "2020102900000000000001",
 *   "amount": { "value": "100000.00", "currency": "IDR" }
 * }
 *
 * 2nd Order:
 * {
 *   "partnerReferenceNo": "2020102900000000000001",
 *   "amount": { "value": "200000.00", "currency": "IDR" }
 * }
 *
 * Expected Response:
 * responseCode: 4045418, responseMessage: "Inconsistent Request"
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
      let val = trimmed.slice(eqIdx + 1).trim();
      if (val.startsWith("\"") && val.endsWith("\"")) val = val.slice(1, -1);
      process.env[trimmed.slice(0, eqIdx).trim()] = val;
    }
  }
}

async function runScenario(partnerId: string, merchantId: string, privRaw: string, label: string) {
  console.log("===============================================================");
  console.log(`Pengujian Skenario: Inconsistent Request (4045418) - ${label}`);
  console.log("===============================================================");
  console.log(`- Partner ID  : ${partnerId}`);
  console.log(`- Merchant ID : ${merchantId}`);

  const privPem = toPem(privRaw, "PRIVATE");
  const path = "/payment-gateway/v1.0/debit/payment-host-to-host.htm";
  const partnerRefNo = "2020102900000000000001";

  const expiryDate = new Date(Date.now() + 15 * 60 * 1000);
  const validUpTo = generateTimestamp(expiryDate);

  // 1st Order (100,000.00)
  const order1 = {
    partnerReferenceNo: partnerRefNo,
    merchantId,
    amount: {
      value: "100000.00",
      currency: "IDR",
    },
    validUpTo,
    urlParams: [
      { url: "https://satulabs.id/payment/success", type: "PAY_RETURN", isDeeplink: "false" },
      { url: "https://satulabs.id/api/webhooks/dana", type: "NOTIFICATION", isDeeplink: "false" },
    ],
    additionalInfo: {
      mcc: "4814",
      envInfo: { terminalType: "WEB" },
    },
  };

  const timestamp1 = generateTimestamp();
  const bodyStr1 = JSON.stringify(order1);
  const canonical1 = buildCanonicalString("POST", path, bodyStr1, timestamp1);
  const signature1 = signRequest(canonical1, privPem);

  console.log("\n1️⃣ Mengirimkan 1st Order (100.000,00 IDR)...");
  try {
    const res1 = await fetch(`https://api.sandbox.dana.id${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-TIMESTAMP": timestamp1,
        "X-SIGNATURE": signature1,
        "X-PARTNER-ID": partnerId,
        "X-EXTERNAL-ID": generateExternalId(),
        "CHANNEL-ID": process.env.DANA_CHANNEL_ID || "95221",
        "ORIGIN": "https://satulabs.id",
      },
      body: bodyStr1,
    });
    console.log(`Status 1st Order : ${res1.status}`);
    const text1 = await res1.text();
    console.log(`Response 1st Order: ${text1}`);
  } catch (err: any) {
    console.error("Error 1st order:", err.message);
  }

  // 2nd Order with SAME partnerReferenceNo, but DIFFERENT amount (200,000.00)
  const order2 = {
    ...order1,
    amount: {
      value: "200000.00",
      currency: "IDR",
    },
  };

  const timestamp2 = generateTimestamp();
  const bodyStr2 = JSON.stringify(order2);
  const canonical2 = buildCanonicalString("POST", path, bodyStr2, timestamp2);
  const signature2 = signRequest(canonical2, privPem);

  console.log("\n2️⃣ Mengirimkan 2nd Order dengan partnerReferenceNo yang sama tetapi amount berbeda (200.000,00 IDR)...");
  try {
    const res2 = await fetch(`https://api.sandbox.dana.id${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-TIMESTAMP": timestamp2,
        "X-SIGNATURE": signature2,
        "X-PARTNER-ID": partnerId,
        "X-EXTERNAL-ID": generateExternalId(),
        "CHANNEL-ID": process.env.DANA_CHANNEL_ID || "95221",
        "ORIGIN": "https://satulabs.id",
      },
      body: bodyStr2,
    });
    console.log(`Status 2nd Order : ${res2.status}`);
    const text2 = await res2.text();
    console.log(`Response 2nd Order: ${text2}`);

    if (text2.includes("4045418")) {
      console.log("\n🎉 [LULUS/PASS] DANA Sandbox berhasil mengembalikan 4045418 (Inconsistent Request)!");
    } else {
      console.log(`\n⚠️ Hasil belum 4045418, respons: ${text2}`);
    }
  } catch (err: any) {
    console.error("Error 2nd order:", err.message);
  }
}

async function main() {
  // Test with current credentials in .env
  await runScenario(
    process.env.DANA_PARTNER_ID!,
    process.env.DANA_MERCHANT_ID!,
    process.env.DANA_PRIVATE_KEY!,
    "Kredensial Aktif (.env)"
  );
}

main().catch(console.error);
