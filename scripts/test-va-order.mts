import { Dana } from "dana-node";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { toPem } from "../packages/providers-dana/src/signature.js";

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

const dana = new Dana({
  partnerId: process.env.DANA_PARTNER_ID!,
  privateKey: toPem(process.env.DANA_PRIVATE_KEY!, "PRIVATE"),
  origin: "https://satulabs.id",
  env: "sandbox",
});

async function run() {
  const partnerReferenceNo = `REF${Date.now()}`;
  const request = {
    partnerReferenceNo,
    merchantId: process.env.DANA_MERCHANT_ID!,
    amount: { value: "15000.00", currency: "IDR" },
    urlParams: [
      { url: "https://satulabs.id/payment/success", type: "PAY_RETURN", isDeeplink: "Y" },
      { url: "https://satulabs.id/api/webhooks/dana", type: "NOTIFICATION", isDeeplink: "Y" },
    ],
    validUpTo: new Date(Date.now() + 15 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "") + "+07:00",
    additionalInfo: {
      order: {
        orderTitle: "Paket Tinknet 10Mb",
        scenario: "API",
        merchantTransType: "SPECIAL_MOVIE",
      },
      mcc: "5732",
      envInfo: {
        sourcePlatform: "IPG",
        terminalType: "SYSTEM",
      },
    },
    payOptionDetails: [
      {
        payMethod: "VIRTUAL_ACCOUNT",
        payOption: "VIRTUAL_ACCOUNT_CIMB",
        transAmount: { value: "15000.00", currency: "IDR" },
      },
    ],
  };

  console.log(`Testing VA Bank Order: ${partnerReferenceNo}...`);
  try {
    const res = await dana.paymentGatewayApi.createOrder(request as any);
    console.log("🎉 SUCCESS! Response:", JSON.stringify(res, null, 2));
  } catch (e: any) {
    console.log("Status:", e.status);
    console.log("Code:", e.rawResponse?.responseCode);
    console.log("Message:", e.rawResponse?.responseMessage);
  }
}

await run();
