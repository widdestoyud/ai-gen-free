import { Dana } from "dana-node";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import crypto from "node:crypto";
import { toPem } from "../packages/providers-dana/src/signature.js";

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
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const partnerId = process.env.DANA_PARTNER_ID!;
const merchantId = process.env.DANA_MERCHANT_ID!;
const privateKeyRaw = process.env.DANA_PRIVATE_KEY!;
const origin = process.env.DANA_ORIGIN || "https://satulabs.id";

const privKeyPem = toPem(privateKeyRaw, "PRIVATE");

console.log("Initializing official dana-node SDK...");
const dana = new Dana({
  partnerId,
  privateKey: privKeyPem,
  origin,
  env: "sandbox",
});

async function run() {


  const partnerReferenceNo = `REF${Date.now()}`;
  console.log("Partner Reference No:", partnerReferenceNo, "(len:", partnerReferenceNo.length, ")");

  const request = {
    partnerReferenceNo,
    merchantId,
    subMerchantId: "032ba0e3",
    amount: {
      value: "10000.00",
      currency: "IDR",
    },
    externalStoreId: "669d7a2e",
    urlParams: [
      {
        url: "https://satulabs.id/payment/success",
        type: "PAY_RETURN",
        isDeeplink: "Y",
      },
      {
        url: "https://satulabs.id/api/webhooks/dana",
        type: "NOTIFICATION",
        isDeeplink: "Y",
      },
    ],
    validUpTo: new Date(Date.now() + 15 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "") + "+07:00",
    additionalInfo: {
      order: {
        orderTitle: "Payment Gateway Order",
        scenario: "REDIRECT",
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
  };

  try {
    console.log("Calling dana.paymentGatewayApi.createOrder()...");
    const response = await dana.paymentGatewayApi.createOrder(request as any);
    console.log("SUCCESS! Response:", JSON.stringify(response, null, 2));
  } catch (err: any) {
    console.error("SDK Error status:", err.status);
    console.error("SDK Error message:", err.message);
    if (err.rawResponse) {
      console.error("SDK rawResponse:", JSON.stringify(err.rawResponse, null, 2));
    }
  }
}

await run();
