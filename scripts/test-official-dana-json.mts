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

const dana = new Dana({
  partnerId,
  privateKey: privKeyPem,
  origin,
  env: "sandbox",
});

// Load official PaymentGateway.json
const jsonPath = "/home/ubuntu/scratch_dana_uat/resource/request/components/PaymentGateway.json";
const json = JSON.parse(readFileSync(jsonPath, "utf8"));

async function testScenario(caseName: string) {
  console.log(`\n========================================`);
  console.log(`Testing Case: ${caseName}`);
  console.log(`========================================`);
  const template = json.CreateOrder[caseName]?.request;
  if (!template) {
    console.error("Case not found in JSON!");
    return;
  }

  const partnerReferenceNo = `REF${Date.now()}`;
  let str = JSON.stringify(template);
  str = str.replace(/\$\{MERCHANT_ID\}/g, merchantId);
  str = str.replace(/\$\{partnerReferenceNo\}/g, partnerReferenceNo);
  const req = JSON.parse(str);

  // Set validUpTo to 15 mins in future in GMT+7
  req.validUpTo = new Date(Date.now() + 15 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "") + "+07:00";

  console.log("Payload:", JSON.stringify(req, null, 2));

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`Attempt ${attempt} calling createOrder...`);
      const res = await dana.paymentGatewayApi.createOrder(req);
      console.log(`✅ SUCCESS on attempt ${attempt}!`);
      console.log("Response:", JSON.stringify(res, null, 2));
      return res;
    } catch (err: any) {
      console.log(`❌ Attempt ${attempt} failed:`, err.status, err.message);
      if (err.rawResponse) {
        console.log("Raw Response:", JSON.stringify(err.rawResponse));
      }
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
}

async function run() {
  await testScenario("CreateOrderRedirect");
  await testScenario("CreateOrderApi");
  await testScenario("CreateOrderBalance");
}

await run();
