import { readFileSync } from "node:fs";
import { buildCanonicalString, signRequest, generateTimestamp, generateExternalId, toPem } from "../packages/providers-dana/src/signature.js";

const env = Object.fromEntries(readFileSync(".env", "utf8").split("\n").filter(l => l.includes("=")).map(l => {
  const i = l.indexOf("=");
  return [l.slice(0, i).trim(), l.slice(i+1).trim().replace(/^"|"$/g, "")];
}));

const privateKeyPem = toPem(env.DANA_PRIVATE_KEY, "PRIVATE");

async function test(name: string, path: string, body: any) {
  const method = "POST";
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
  console.log(`[${name} -> ${path}] Status: ${res.status}`, await res.text());
}

async function main() {
  const ref = () => "D" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000);

  // Test /v1.0/emoney/topup vs /rest/v1.0/emoney/topup
  await test("v1.0 without rest", "/v1.0/emoney/topup", {
    partnerReferenceNo: ref(),
    customerNumber: "62811742234",
    amount: { value: "10.00", currency: "IDR" },
    feeAmount: { value: "0.00", currency: "IDR" }
  });

  // Test 0811742234 with channel id
  await test("0811742234 with channel id", "/rest/v1.0/emoney/topup", {
    partnerReferenceNo: ref(),
    customerNumber: "0811742234",
    amount: { value: "10.00", currency: "IDR" },
    feeAmount: { value: "0.00", currency: "IDR" }
  });

  // Test +62811742234 with channel id
  await test("+62811742234 with channel id", "/rest/v1.0/emoney/topup", {
    partnerReferenceNo: ref(),
    customerNumber: "+62811742234",
    amount: { value: "10.00", currency: "IDR" },
    feeAmount: { value: "0.00", currency: "IDR" }
  });
}

main().catch(console.error);
