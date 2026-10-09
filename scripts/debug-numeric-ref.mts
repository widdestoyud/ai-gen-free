import { readFileSync } from "node:fs";
import { buildCanonicalString, signRequest, generateTimestamp, generateExternalId, toPem } from "../packages/providers-dana/src/signature.js";

const env = Object.fromEntries(readFileSync(".env", "utf8").split("\n").filter(l => l.includes("=")).map(l => {
  const i = l.indexOf("=");
  return [l.slice(0, i).trim(), l.slice(i+1).trim().replace(/^"|"$/g, "")];
}));

const privateKeyPem = toPem(env.DANA_PRIVATE_KEY, "PRIVATE");

async function test(name: string, body: any) {
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
      "CHANNEL-ID": "95221"
    },
    body: bodyStr
  });
  console.log(`[${name}] Status: ${res.status}`, await res.text());
}

async function main() {
  // Test numeric partnerReferenceNo (16 digits)
  const numericRef = "20261008" + Math.floor(10000000 + Math.random() * 90000000).toString();
  await test("Numeric Ref (16 digits)", {
    partnerReferenceNo: numericRef,
    customerNumber: "62811742234",
    amount: { value: "10.00", currency: "IDR" },
    feeAmount: { value: "0.00", currency: "IDR" }
  });

  // Test numeric partnerReferenceNo with 62817345544
  const numericRef2 = "20261008" + Math.floor(10000000 + Math.random() * 90000000).toString();
  await test("Numeric Ref with 62817345544", {
    partnerReferenceNo: numericRef2,
    customerNumber: "62817345544",
    amount: { value: "1.00", currency: "IDR" },
    feeAmount: { value: "0.00", currency: "IDR" }
  });

  // Test with amount 5.00
  const numericRef3 = "20261008" + Math.floor(10000000 + Math.random() * 90000000).toString();
  await test("Numeric Ref with amount 5.00", {
    partnerReferenceNo: numericRef3,
    customerNumber: "62817345545",
    amount: { value: "5.00", currency: "IDR" },
    feeAmount: { value: "0.00", currency: "IDR" }
  });
}

main().catch(console.error);
