import { readFileSync } from "node:fs";
import { buildCanonicalString, signRequest, generateTimestamp, generateExternalId, toPem } from "../packages/providers-dana/src/signature.js";

const env = Object.fromEntries(readFileSync(".env", "utf8").split("\n").filter(l => l.includes("=")).map(l => {
  const i = l.indexOf("=");
  return [l.slice(0, i).trim(), l.slice(i+1).trim().replace(/^"|"$/g, "")];
}));

const privateKeyPem = toPem(env.DANA_PRIVATE_KEY, "PRIVATE");

async function test(name: string, body: any, headersOverride: any = {}) {
  const method = "POST";
  const path = "/rest/v1.0/emoney/topup";
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
      "CHANNEL-ID": "95221",
      ...headersOverride
    },
    body: bodyStr
  });
  console.log(`[${name}] Status: ${res.status}`, await res.text());
}

async function main() {
  const ref = () => "D" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000);

  // Test 1: customerNumber empty string ""
  await test("customerNumber empty string", {
    partnerReferenceNo: ref(),
    customerNumber: "",
    amount: { value: "10.00", currency: "IDR" }
  });

  // Test 2: customerNumber null
  await test("customerNumber null", {
    partnerReferenceNo: ref(),
    customerNumber: null,
    amount: { value: "10.00", currency: "IDR" }
  });

  // Test 3: missing amount
  await test("missing amount", {
    partnerReferenceNo: ref(),
    customerNumber: "62811742234"
  });

  // Test 4: missing partnerReferenceNo
  await test("missing partnerReferenceNo", {
    customerNumber: "62811742234",
    amount: { value: "10.00", currency: "IDR" }
  });

  // Test 5: missing CHANNEL-ID header
  await test("missing CHANNEL-ID header", {
    partnerReferenceNo: ref(),
    customerNumber: "62811742234",
    amount: { value: "10.00", currency: "IDR" }
  }, { "CHANNEL-ID": undefined });
}

main().catch(console.error);
