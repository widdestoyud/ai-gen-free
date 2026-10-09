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

async function sendDanaCancel(payload: any) {
  const path = "/payment-gateway/v1.0/debit/cancel.htm";
  const bodyStr = JSON.stringify(payload);
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
      "CHANNEL-ID": "95221",
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

async function test() {
  console.log("=== Testing Cancel with various additionalInfo / mock keys ===");
  const variations = [
    { originalPartnerReferenceNo: "4045700", additionalInfo: { originalTransactionStatus: "REFUNDED" } },
    { originalPartnerReferenceNo: "4045700", additionalInfo: { transactionStatus: "REFUNDED" } },
    { originalPartnerReferenceNo: "4045700", reason: "REFUNDED" },
    { originalPartnerReferenceNo: "CANCEL_4045700", additionalInfo: {} },
    { originalPartnerReferenceNo: "REFUND_4045700", additionalInfo: {} },
  ];

  for (const v of variations) {
    const res = await sendDanaCancel({
      merchantId,
      subMerchantId: "",
      originalPartnerReferenceNo: v.originalPartnerReferenceNo,
      reason: v.reason || "Order already refunded",
      amount: { value: "10000.00", currency: "IDR" },
      additionalInfo: v.additionalInfo || {},
    });
    console.log(`Payload: ${JSON.stringify(v)} -> Status: ${res.status}, Code: ${res.body?.responseCode}, Msg: ${res.body?.responseMessage}`);
  }
}

test();
