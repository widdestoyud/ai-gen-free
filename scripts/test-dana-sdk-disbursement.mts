import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Dana } from "dana-node";
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
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const partnerId = process.env.DANA_PARTNER_ID!;
const merchantId = process.env.DANA_MERCHANT_ID!;
const clientSecret = process.env.DANA_CLIENT_SECRET!;
const privateKey = process.env.DANA_PRIVATE_KEY!;
const danaPublicKey = process.env.DANA_PUBLIC_KEY!;

const dana = new Dana({
  partnerId,
  merchantId,
  clientSecret,
  privateKey: toPem(privateKey, "PRIVATE"),
  danaPublicKey: toPem(danaPublicKey, "PUBLIC"),
  isProduction: false,
});

async function main() {
  console.log("1. Querying Merchant Info...");
  try {
    const merchantInfo = await dana.merchantManagementApi.queryMerchantInfo({
      merchantId,
      userLoginId: merchantId,
      loginType: "ROLE",
      roleId: merchantId,
    } as any);
    console.log("Merchant Info:", JSON.stringify(merchantInfo, null, 2));
  } catch (err: any) {
    console.log("Query Merchant Info error:", err?.response?.data || err.message);
  }

  console.log("\n2. Querying Asset Card List (for BNI VA)...");
  try {
    const assetCards = await dana.merchantManagementApi.queryAssetCardList({
      merchantId,
      memberId: merchantId,
      assetTypeList: ["VA_ACCOUNT"],
      enableOnly: "true",
    } as any);
    console.log("Asset Cards:", JSON.stringify(assetCards, null, 2));
  } catch (err: any) {
    console.log("Query Asset Cards error:", err?.response?.data || err.message);
  }

  console.log("\n3. Testing transferToDana with customerNumber 62811742234...");
  const refNo = "SUCC" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  try {
    const res = await dana.disbursementApi.transferToDana({
      partnerReferenceNo: refNo,
      customerNumber: "62811742234",
      amount: {
        value: "1.00",
        currency: "IDR",
      },
      feeAmount: {
        value: "1.00",
        currency: "IDR",
      },
      transactionDate: new Date().toISOString().replace(/\.\d{3}Z$/, "") + "+07:00",
      additionalInfo: {
        fundType: "AGENT_TOPUP_FOR_USER_SETTLE",
      },
    } as any);
    console.log("transferToDana Success:", JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.log("transferToDana Response:", err?.response?.status, JSON.stringify(err?.response?.data || err.message, null, 2));
  }
}

main().catch(console.error);
