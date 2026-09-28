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
  clientSecret: process.env.DANA_CLIENT_SECRET,
  env: "sandbox",
});

async function run() {
  const partnerReferenceNo = `QRIS${Date.now()}`;
  console.log("partnerReferenceNo:", partnerReferenceNo, "(len:", partnerReferenceNo.length, ")");

  const request = {
    partnerReferenceNo,
    merchantId: process.env.DANA_MERCHANT_ID!,
    externalStoreId: "669d7a2e",
    amount: {
      value: "10000.00",
      currency: "IDR",
    },
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
        payMethod: "NETWORK_PAY",
        payOption: "NETWORK_PAY_PG_QRIS",
        transAmount: {
          currency: "IDR",
          value: "10000.00",
        },
        feeAmount: {
          currency: "IDR",
          value: "0",
        },
        cardToken: "",
        merchantToken: "",
      },
    ],
  };

  console.log("Sending QRIS CreateOrder...");
  try {
    const res = await dana.paymentGatewayApi.createOrder(request as any);
    console.log("🎉 SUCCESS! Response:", JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.log("Status:", err.status);
    console.log("Code:", err.rawResponse?.responseCode);
    console.log("Msg:", err.rawResponse?.responseMessage);
    if (err.rawResponse) {
      console.log("Full rawResponse:", JSON.stringify(err.rawResponse, null, 2));
    }
  }
}

await run();
