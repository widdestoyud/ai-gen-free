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
  const variations = [
    { sub: "", store: "669d7a2e", name: "External Shop ID" },
    { sub: "", store: "216660000003261812075", name: "Shop ID numeric" },
    { sub: "032ba0e3", store: "669d7a2e", name: "Division + Shop ID" },
    { sub: "216650000003261811075", store: "216660000003261812075", name: "Numeric Division + Numeric Shop" },
  ];

  for (const v of variations) {
    const partnerReferenceNo = `REF${Date.now()}`;
    const request = {
      partnerReferenceNo,
      merchantId: process.env.DANA_MERCHANT_ID!,
      subMerchantId: v.sub,
      amount: { value: "10000.00", currency: "IDR" },
      externalStoreId: v.store,
      urlParams: [
        { url: "https://satulabs.id/", type: "PAY_RETURN", isDeeplink: "Y" },
        { url: "https://satulabs.id/", type: "NOTIFICATION", isDeeplink: "Y" },
      ],
      validUpTo: new Date(Date.now() + 15 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "") + "+07:00",
      additionalInfo: {
        order: { orderTitle: "Order", scenario: "REDIRECT", merchantTransType: "SPECIAL_MOVIE" },
        mcc: "5732",
        envInfo: { sourcePlatform: "IPG", terminalType: "SYSTEM", orderTerminalType: "WEB" },
      },
    };

    console.log(`\nTesting variation: ${v.name} (sub="${v.sub}", store="${v.store}")`);
    try {
      const res = await dana.paymentGatewayApi.createOrder(request as any);
      console.log(`🎉 SUCCESS for ${v.name}:`, JSON.stringify(res, null, 2));
      return;
    } catch (e: any) {
      console.log(`Result: ${e.status} | Code: ${e.rawResponse?.responseCode} | Msg: ${e.rawResponse?.responseMessage}`);
    }
  }
}

await run();
