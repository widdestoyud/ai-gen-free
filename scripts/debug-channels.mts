import { readFileSync } from "node:fs";
import { buildCanonicalString, signRequest, generateTimestamp, generateExternalId, toPem } from "../packages/providers-dana/src/signature.js";

const env = Object.fromEntries(readFileSync(".env", "utf8").split("\n").filter(l => l.includes("=")).map(l => {
  const i = l.indexOf("=");
  return [l.slice(0, i).trim(), l.slice(i+1).trim().replace(/^"|"$/g, "")];
}));

const privateKeyPem = toPem(env.DANA_PRIVATE_KEY, "PRIVATE");

async function test(name: string, channelId: string) {
  const method = "POST";
  const path = "/rest/v1.0/emoney/topup";
  const body = {
    partnerReferenceNo: "D" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000),
    customerNumber: "62811742234",
    amount: { value: "10.00", currency: "IDR" },
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
      "CHANNEL-ID": channelId
    },
    body: bodyStr
  });
  console.log(`[Channel ${channelId}] Status: ${res.status}`, await res.text());
}

async function main() {
  const channels = ["95221", "95222", "95220", "95223", "95211", "95212", "0001", "1", "95200"];
  for (const c of channels) {
    await test(c, c);
  }
}

main().catch(console.error);
