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
  const text = await res.text();
  console.log(`[${name}] Status: ${res.status}`);
  console.log(`Response: ${text}\n`);
  return { status: res.status, text };
}

async function main() {
  const ref = (p = "T") => p + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000).toString().padStart(3, "0");

  // Permutation 1: additionalInfo with envInfo & order
  await test("Permutation 1: additionalInfo with envInfo", {
    partnerReferenceNo: ref("P1"),
    customerNumber: "62811742234",
    amount: { value: "10.00", currency: "IDR" },
    feeAmount: { value: "0.00", currency: "IDR" },
    additionalInfo: {
      envInfo: {
        terminalType: "SYSTEM"
      }
    }
  });

  // Permutation 2: additionalInfo with mcc
  await test("Permutation 2: additionalInfo with mcc", {
    partnerReferenceNo: ref("P2"),
    customerNumber: "62811742234",
    amount: { value: "10.00", currency: "IDR" },
    feeAmount: { value: "0.00", currency: "IDR" },
    additionalInfo: {
      mcc: "7999"
    }
  });

  // Permutation 3: customerNumber without country code 811742234
  await test("Permutation 3: 811742234", {
    partnerReferenceNo: ref("P3"),
    customerNumber: "811742234",
    amount: { value: "10.00", currency: "IDR" },
    feeAmount: { value: "0.00", currency: "IDR" }
  });

  // Permutation 4: integer amount "10" without decimal
  await test("Permutation 4: integer amount 10", {
    partnerReferenceNo: ref("P4"),
    customerNumber: "62811742234",
    amount: { value: "10", currency: "IDR" },
    feeAmount: { value: "0", currency: "IDR" }
  });

  // Permutation 5: amount value 1.00 to 62817345544
  await test("Permutation 5: 62817345544 with 1.00", {
    partnerReferenceNo: ref("P5"),
    customerNumber: "62817345544",
    amount: { value: "1.00", currency: "IDR" },
    feeAmount: { value: "0.00", currency: "IDR" }
  });

  // Permutation 6: amount value 5.00 to 62817345545
  await test("Permutation 6: 62817345545 with 5.00", {
    partnerReferenceNo: ref("P6"),
    customerNumber: "62817345545",
    amount: { value: "5.00", currency: "IDR" },
    feeAmount: { value: "0.00", currency: "IDR" }
  });

  // Permutation 7: with validUpTo & remarks in root or additionalInfo
  await test("Permutation 7: with remarks & validUpTo", {
    partnerReferenceNo: ref("P7"),
    customerNumber: "62811742234",
    amount: { value: "10.00", currency: "IDR" },
    feeAmount: { value: "0.00", currency: "IDR" },
    remarks: "Topup Test",
    validUpTo: generateTimestamp(new Date(Date.now() + 3600000))
  });
}

main().catch(console.error);
