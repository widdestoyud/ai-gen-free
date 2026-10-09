/**
 * DANA Sandbox Mandatory API Testing: Disbursement TopUp
 * Endpoint: POST /rest/v1.0/emoney/topup
 * 
 * Skenario Pengujian:
 * 1. Successfully requests Disbursement Top Up (2003800)
 * 2. Error Insufficient Fund (4033814)
 * 3. Error Do Not Honor (4033805)
 * 4. Error Invalid Mandatory Field (4003802)
 * 5. Error Inconsistent Request (4043818)
 * 6. Error Internal Server Error (5003801 / 5003800)
 * 7. Error General Error (5003800)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildCanonicalString,
  signRequest,
  generateTimestamp,
  generateExternalId,
  toPem,
} from "../packages/providers-dana/src/signature.js";

// Load .env
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (val.startsWith("\"") && val.endsWith("\"")) val = val.slice(1, -1);
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const partnerId = process.env.DANA_PARTNER_ID!;
const merchantId = process.env.DANA_MERCHANT_ID!;
const clientSecret = process.env.DANA_CLIENT_SECRET!;
const privateKey = process.env.DANA_PRIVATE_KEY!;
const baseUrl = process.env.DANA_BASE_URL || "https://api.sandbox.dana.id";
const origin = process.env.DANA_ORIGIN || "https://satulabs.id";

if (!partnerId || !privateKey || !merchantId) {
  console.error("❌ Kredensial DANA belum lengkap di .env");
  process.exit(1);
}

const privateKeyPem = toPem(privateKey, "PRIVATE");

console.log("==========================================================");
console.log("   DANA Sandbox TopUp / Disbursement Compliance Runner    ");
console.log("==========================================================");
console.log(`Base URL    : ${baseUrl}`);
console.log(`Partner ID  : ${partnerId}`);
console.log(`Merchant ID : ${merchantId}`);
console.log(`Origin      : ${origin}`);
console.log("----------------------------------------------------------\n");

async function sendDanaRequest(body: any, overrideHeaders?: Record<string, string | null>) {
  const method = "POST";
  const path = "/rest/v1.0/emoney/topup";
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  const timestamp = overrideHeaders?.["X-TIMESTAMP"] === null
    ? null
    : (overrideHeaders?.["X-TIMESTAMP"] || generateTimestamp());
  const externalId = overrideHeaders?.["X-EXTERNAL-ID"] || generateExternalId();

  let signature: string | null = null;
  if (overrideHeaders?.["X-SIGNATURE"] !== undefined) {
    signature = overrideHeaders["X-SIGNATURE"];
  } else if (timestamp) {
    const canonical = buildCanonicalString(method, path, bodyStr, timestamp);
    signature = signRequest(canonical, privateKeyPem);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ORIGIN": origin,
  };

  if (timestamp) headers["X-TIMESTAMP"] = timestamp;
  if (signature) headers["X-SIGNATURE"] = signature;
  if (overrideHeaders?.["X-PARTNER-ID"] !== null) {
    headers["X-PARTNER-ID"] = overrideHeaders?.["X-PARTNER-ID"] || partnerId;
  }
  if (externalId) headers["X-EXTERNAL-ID"] = externalId;
  if (overrideHeaders?.["CHANNEL-ID"] !== null) {
    headers["CHANNEL-ID"] = overrideHeaders?.["CHANNEL-ID"] || process.env.DANA_CHANNEL_ID || "95221";
  }

  const url = `${baseUrl}${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: bodyStr,
    });

    let resBody: any;
    try {
      resBody = await res.json();
    } catch {
      resBody = await res.text();
    }
    return { status: res.status, body: resBody };
  } catch (err: any) {
    return { status: 500, body: { error: err.message } };
  }
}

function genRef(prefix = "TOPUP") {
  return prefix + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000).toString().padStart(3, "0");
}

let passed = 0;
let total = 0;

async function runTest(
  num: number,
  name: string,
  expectedCode: string,
  expectedMsg: string,
  payload: any,
  overrideHeaders?: any
) {
  total++;
  console.log(`----------------------------------------------------------`);
  console.log(`[Scenario ${num}/7] ${name}`);
  console.log(`Expected : ${expectedCode} (${expectedMsg})`);

  const res = await sendDanaRequest(payload, overrideHeaders);
  const actualCode = res.body?.responseCode || "UNKNOWN";
  const actualMsg = res.body?.responseMessage || "";

  console.log(`HTTP Status : ${res.status}`);
  console.log(`Response    : ${JSON.stringify(res.body)}`);

  if (actualCode === expectedCode) {
    passed++;
    console.log(`Result      : ✅ LULUS (${actualCode} - ${actualMsg})`);
  } else {
    console.log(`Result      : ❌ GAGAL (${actualCode} - ${actualMsg})`);
  }
}

async function main() {
  // Scenario 1: Successfully requests Disbursement Top Up
  await runTest(
    1,
    "Successfully requests Disbursement Top Up",
    "2003800",
    "Successful",
    {
      partnerReferenceNo: genRef("SUCC"),
      customerNumber: "62811742234",
      amount: {
        value: "1.00",
        currency: "IDR",
      },
      feeAmount: {
        value: "1.00",
        currency: "IDR",
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
        customerId: null,
      },
    }
  );

  // Scenario 2: Error Insufficient Fund
  await runTest(
    2,
    "Error Insufficient Fund when request Disbursement Top Up",
    "4033814",
    "Insufficient Fund",
    {
      partnerReferenceNo: genRef("INSUFF"),
      customerNumber: "6281298055129",
      amount: { value: "50000000000.00", currency: "IDR" },
      feeAmount: { value: "1.00", currency: "IDR" },
      transactionDate: generateTimestamp(),
      additionalInfo: {
        fundType: "AGENT_TOPUP_FOR_USER_SETTLE",
      },
    }
  );

  // Scenario 3: Error Do Not Honor
  await runTest(
    3,
    "Error Do Not Honor when request Disbursement Top Up",
    "4033805",
    "Do Not Honor",
    {
      partnerReferenceNo: genRef("HONOR"),
      customerNumber: "628996647679",
      amount: { value: "1.00", currency: "IDR" },
      feeAmount: { value: "1.00", currency: "IDR" },
      transactionDate: generateTimestamp(),
      additionalInfo: {
        fundType: "AGENT_TOPUP_FOR_USER_SETTLE",
      },
    }
  );

  // Scenario 4: Error Invalid Mandatory Field (missing partnerReferenceNo)
  await runTest(
    4,
    "Error Invalid Mandatory Field when request Disbursement Top Up",
    "4003802",
    "Invalid Mandatory Field",
    {
      customerNumber: "62811742234",
      amount: { value: "1.00", currency: "IDR" },
      feeAmount: { value: "1.00", currency: "IDR" },
      transactionDate: generateTimestamp(),
    }
  );

  // Scenario 5: Error Inconsistent Request
  const ref5 = genRef("INCONS");
  // 1. Initial success request
  await sendDanaRequest({
    partnerReferenceNo: ref5,
    customerNumber: "62811742234",
    amount: { value: "1.00", currency: "IDR" },
    feeAmount: { value: "1.00", currency: "IDR" },
    transactionDate: generateTimestamp(),
    additionalInfo: {
      fundType: "AGENT_TOPUP_FOR_USER_SETTLE",
    },
  });
  // 2. Retry with same partnerReferenceNo but different amount
  await runTest(
    5,
    "Error Inconsistent Request when retrying Disbursement Top Up",
    "4043818",
    "Inconsistent Request",
    {
      partnerReferenceNo: ref5,
      customerNumber: "62811742234",
      amount: { value: "5.00", currency: "IDR" },
      feeAmount: { value: "1.00", currency: "IDR" },
      transactionDate: generateTimestamp(),
      additionalInfo: {
        fundType: "AGENT_TOPUP_FOR_USER_SETTLE",
      },
    }
  );

  // Scenario 6: Error Internal Server Error
  await runTest(
    6,
    "Error Internal Server Error when request Disbursement Top Up",
    "5003801",
    "Internal Server Error",
    {
      partnerReferenceNo: genRef("ISE"),
      customerNumber: "62811742234",
      amount: { value: "1.00", currency: "IDR" },
      // Tanpa additionalInfo fundType memicu internal server error sandbox
    }
  );

  // Scenario 7: Error General Error
  await runTest(
    7,
    "Error General Error when request Disbursement Top Up",
    "5003800",
    "General Error",
    {
      partnerReferenceNo: genRef("GENERR"),
      customerNumber: "628121111111",
      amount: { value: "1.00", currency: "IDR" },
      feeAmount: { value: "1.00", currency: "IDR" },
      transactionDate: generateTimestamp(),
      additionalInfo: {
        fundType: "AGENT_TOPUP_FOR_USER_SETTLE",
      },
    }
  );

  console.log(`\n==========================================================`);
  console.log(`Total Scenarios: ${total}`);
  console.log(`Passed         : ${passed}/${total}`);
  console.log(`==========================================================\n`);
}

main().catch(console.error);
