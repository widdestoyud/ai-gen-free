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
  return { status: res.status, body: await res.json().catch(() => res.text()) };
}

async function main() {
  const refNo = "INCONS" + Date.now();

  console.log("Step 1: First request with Do Not Honor number (628996647679) and amount 10.00");
  const res1 = await send({
    partnerReferenceNo: refNo,
    customerNumber: "628996647679",
    amount: { value: "10.00", currency: "IDR" },
    feeAmount: { value: "0.00", currency: "IDR" }
  });
  console.log("Res 1:", res1);

  console.log("\nStep 2: Retry with same partnerReferenceNo (" + refNo + ") but amount 20.00");
  const res2 = await send({
    partnerReferenceNo: refNo,
    customerNumber: "628996647679",
    amount: { value: "20.00", currency: "IDR" },
    feeAmount: { value: "0.00", currency: "IDR" }
  });
  console.log("Res 2:", res2);

  const refNoB = "INCONSB" + Date.now();
  console.log("\nStep 3: First request with Insufficient Fund number (6281298055129) and amount 50000000000.00");
  const res3 = await send({
    partnerReferenceNo: refNoB,
    customerNumber: "6281298055129",
    amount: { value: "50000000000.00", currency: "IDR" },
    feeAmount: { value: "0.00", currency: "IDR" }
  });
  console.log("Res 3:", res3);

  console.log("\nStep 4: Retry with same partnerReferenceNo (" + refNoB + ") but amount 1000.00");
  const res4 = await send({
    partnerReferenceNo: refNoB,
    customerNumber: "6281298055129",
    amount: { value: "1000.00", currency: "IDR" },
    feeAmount: { value: "0.00", currency: "IDR" }
  });
  console.log("Res 4:", res4);
}

main().catch(console.error);
