import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import crypto from "node:crypto";
import { signRequest, generateTimestamp, toPem } from "../packages/providers-dana/src/signature.js";

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
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const partnerId = process.env.DANA_PARTNER_ID!;
const merchantId = process.env.DANA_MERCHANT_ID!;
const privateKey = process.env.DANA_PRIVATE_KEY!;
const baseUrl = process.env.DANA_BASE_URL || "https://api.sandbox.dana.id";
const origin = process.env.DANA_ORIGIN || "https://satulabs.id";

const path = "/payment-gateway/v1.0/debit/payment-host-to-host.htm";
const partnerRefNo = `REF_${Date.now()}`;
const timestamp = generateTimestamp();
const externalId = crypto.randomUUID();

const body = {
  partnerReferenceNo: partnerRefNo,
  merchantId: merchantId,
  subMerchantId: "",
  amount: {
    value: "10000.00",
    currency: "IDR"
  },
  externalStoreId: "",
  urlParams: [
    {
      url: "https://satulabs.id/payment/success",
      type: "PAY_RETURN",
      isDeeplink: "Y"
    },
    {
      url: "https://satulabs.id/api/webhooks/dana",
      type: "NOTIFICATION",
      isDeeplink: "Y"
    }
  ],
  validUpTo: generateTimestamp(new Date(Date.now() + 15 * 60 * 1000)),
  additionalInfo: {
    order: {
      orderTitle: "Payment Gateway Order",
      scenario: "REDIRECT",
      merchantTransType: "SPECIAL_MOVIE",
      buyer: {}
    },
    mcc: "5732",
    envInfo: {
      sourcePlatform: "IPG",
      terminalType: "SYSTEM",
      orderTerminalType: "WEB"
    },
    extendInfo: "{\"key\":\"value\"}"
  }
};

const bodyStr = JSON.stringify(body);
const sha256Hex = crypto.createHash("sha256").update(bodyStr).digest("hex").toLowerCase();
const canonical = `POST:${path}:${sha256Hex}:${timestamp}`;
const signature = signRequest(canonical, toPem(privateKey, "PRIVATE"));

console.log("Request Canonical String:", canonical);
console.log("Sending CreateOrderRedirect...");

const res = await fetch(`${baseUrl}${path}`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-TIMESTAMP": timestamp,
    "X-SIGNATURE": signature,
    "X-PARTNER-ID": partnerId,
    "X-EXTERNAL-ID": externalId,
    "CHANNEL-ID": "95221"
  },
  body: bodyStr
});

console.log("HTTP Status:", res.status);
const resText = await res.text();
console.log("Response Body:", resText);
