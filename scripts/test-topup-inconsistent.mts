import { readFileSync } from "node:fs";
import { buildCanonicalString, signRequest, generateTimestamp, generateExternalId, toPem } from "../packages/providers-dana/src/signature.js";

const env = Object.fromEntries(readFileSync(".env", "utf8").split("\n").filter(l => l.includes("=")).map(l => {
  const i = l.indexOf("=");
  return [l.slice(0, i).trim(), l.slice(i+1).trim().replace(/^"|"$/g, "")];
}));

const privateKeyPem = toPem(env.DANA_PRIVATE_KEY, "PRIVATE");

async function send(body: any) {
  const method = "POST";
  const path = "/rest/v1.0/emoney/topup";
  const timestamp = generateTimestamp();
  const externalId = generateExternalId();
  const bodyStr = JSON.stringify(body);
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

  return { status: res.status, body: await res.json().catch(() => res.text()) };
}

async function main() {
  const refNo = "INCONS" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000).toString().padStart(3, "0");

  console.log("Step 1: Send initial topup request with partnerReferenceNo:", refNo, "and amount 1.00");
  const res1 = await send({
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
  });
  console.log("Res 1 Status:", res1.status, "Body:", JSON.stringify(res1.body, null, 2));

  console.log("\nStep 2: Retry with SAME partnerReferenceNo:", refNo, "but DIFFERENT amount (5.00)");
  const res2 = await send({
    partnerReferenceNo: refNo,
    customerNumber: "62811742234",
    amount: {
      value: "5.00",
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
  });
  console.log("Res 2 Status:", res2.status, "Body:", JSON.stringify(res2.body, null, 2));
}

main().catch(console.error);
