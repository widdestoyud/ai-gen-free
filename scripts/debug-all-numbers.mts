import { readFileSync } from "node:fs";
import { buildCanonicalString, signRequest, generateTimestamp, generateExternalId, toPem } from "../packages/providers-dana/src/signature.js";

const env = Object.fromEntries(readFileSync(".env", "utf8").split("\n").filter(l => l.includes("=")).map(l => {
  const i = l.indexOf("=");
  return [l.slice(0, i).trim(), l.slice(i+1).trim().replace(/^"|"$/g, "")];
}));

const privateKeyPem = toPem(env.DANA_PRIVATE_KEY, "PRIVATE");

async function test(name: string, customerNumber: string, amountVal: string) {
  const method = "POST";
  const path = "/rest/v1.0/emoney/topup";
  const body = {
    partnerReferenceNo: "D" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000),
    customerNumber,
    amount: { value: amountVal, currency: "IDR" },
    feeAmount: { value: "0.00", currency: "IDR" }
  };
  const bodyStr = JSON.stringify(body);
  const timestamp = generateTimestamp();
  const externalId = generateExternalId();
  const canonical = buildCanonicalString(method, path, bodyStr, timestamp);
  const signature = signRequest(canonical, privateKeyPem);
  const res = await fetch("https://api.sandbox.dana.id" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "ORIGIN": env.DANA_ORIGIN || "https://satulabs.id",
      "X-TIMESTAMP": timestamp,
      "X-SIGNATURE": signature,
      "X-PARTNER-ID": env.DANA_PARTNER_ID,
      "X-EXTERNAL-ID": externalId,
      "CHANNEL-ID": "95221"
    },
    body: bodyStr
  });
  console.log(`[${name} | ${customerNumber} | ${amountVal}] Status: ${res.status}`, await res.text());
}

async function main() {
  const successNumbers = ["62811742234", "62817345544", "62817345545"];
  const amounts = ["1.00", "2.00", "5.00", "10.00", "100.00", "1000.00"];

  for (const num of successNumbers) {
    for (const amt of amounts) {
      await test("Test Success", num, amt);
    }
  }

  const doNotHonorNumbers = ["628996647679", "628123456667", "628152768647"];
  for (const num of doNotHonorNumbers) {
    await test("Test Do Not Honor", num, "10.00");
  }
}

main().catch(console.error);
