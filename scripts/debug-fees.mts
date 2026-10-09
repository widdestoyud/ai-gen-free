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
  const text = await res.text();
  console.log(`[${name}] Status: ${res.status} -> ${text}`);
}

async function main() {
  const ref = () => "D" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000).toString().padStart(3, "0");

  const numbers = ["62811742234", "62817345544", "62817345545"];
  const fees = ["0.00", "0", "1.00", "500.00", "1000.00"];

  for (const n of numbers) {
    for (const f of fees) {
      await test(`Num: ${n}, Amount: 1.00, Fee: ${f}`, {
        partnerReferenceNo: ref(),
        customerNumber: n,
        amount: { value: "1.00", currency: "IDR" },
        feeAmount: { value: f, currency: "IDR" }
      });
    }
  }
}

main().catch(console.error);
