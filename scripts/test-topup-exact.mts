import { readFileSync } from "node:fs";
import { buildCanonicalString, signRequest, generateTimestamp, generateExternalId, toPem } from "../packages/providers-dana/src/signature.js";

const env = Object.fromEntries(readFileSync(".env", "utf8").split("\n").filter(l => l.includes("=")).map(l => {
  const i = l.indexOf("=");
  return [l.slice(0, i).trim(), l.slice(i+1).trim().replace(/^"|"$/g, "")];
}));

const privateKeyPem = toPem(env.DANA_PRIVATE_KEY, "PRIVATE");

async function main() {
  const method = "POST";
  const path = "/rest/v1.0/emoney/topup";
  const timestamp = generateTimestamp();
  const externalId = generateExternalId();
  const refNo = "SUCC" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000).toString().padStart(3, "0");

  const body = {
    partnerReferenceNo: refNo,
    customerNumber: "62811742234",
    amount: {
      value: "1.00",
      currency: "IDR"
    },
    feeAmount: {
      value: "1.00",
      currency: "IDR"
    },
    transactionDate: generateTimestamp(),
    sessionId: null,
    categoryId: null,
    notes: null,
    additionalInfo: {
      extendInfo: null,
      accountType: null,
      fundType: "AGENT_TOPUP_FOR_USER_SETTLE",
      externalDivisionId: null,
      chargeTarget: null,
      accessToken: null,
      customerId: null
    }
  };

  const bodyStr = JSON.stringify(body);
  const canonical = buildCanonicalString(method, path, bodyStr, timestamp);
  const signature = signRequest(canonical, privateKeyPem);

  console.log("Sending TopUp Request...");
  console.log("Payload:", JSON.stringify(body, null, 2));

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

  const resText = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", resText);
}

main().catch(console.error);
