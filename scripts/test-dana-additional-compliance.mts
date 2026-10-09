/**
 * DANA Sandbox Additional API Testing Suite
 * Endpoints:
 * 1. POST /rest/v1.0/emoney/account-inquiry
 * 2. POST /rest/v1.0/emoney/topup-status
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
const privateKey = process.env.DANA_PRIVATE_KEY!;
const baseUrl = process.env.DANA_BASE_URL || "https://api.sandbox.dana.id";
const origin = process.env.DANA_ORIGIN || "https://satulabs.id";

if (!partnerId || !privateKey || !merchantId) {
  console.error("❌ Kredensial DANA belum lengkap di .env");
  process.exit(1);
}

const privateKeyPem = toPem(privateKey, "PRIVATE");

console.log("==========================================================");
console.log("   DANA Sandbox Additional API Testing Suite Runner       ");
console.log("==========================================================");
console.log(`Base URL    : ${baseUrl}`);
console.log(`Partner ID  : ${partnerId}`);
console.log(`Merchant ID : ${merchantId}`);
console.log(`Origin      : ${origin}`);
console.log("----------------------------------------------------------\n");

async function sendDanaRequest(
  path: string,
  body: any,
  overrideHeaders?: Record<string, string | null>
) {
  const method = "POST";
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

    const text = await res.text();
    let resBody: any;
    try {
      resBody = JSON.parse(text);
    } catch {
      resBody = text;
    }
    return { status: res.status, body: resBody };
  } catch (err: any) {
    return { status: 500, body: { error: err.message } };
  }
}

function genRef(prefix = "ADD") {
  return prefix + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000).toString().padStart(3, "0");
}

let passed = 0;
let total = 0;

async function runTest(
  num: number,
  totalScenarios: number,
  endpoint: string,
  name: string,
  expectedCode: string,
  expectedMsg: string,
  payload: any,
  overrideHeaders?: any,
  customValidator?: (res: any) => boolean
) {
  total++;
  console.log(`----------------------------------------------------------`);
  console.log(`[Scenario ${num}/${totalScenarios}] ${name}`);
  console.log(`Endpoint : POST ${endpoint}`);
  console.log(`Expected : ${expectedCode} (${expectedMsg})`);

  const res = await sendDanaRequest(endpoint, payload, overrideHeaders);
  const actualCode = res.body?.responseCode || "UNKNOWN";
  const actualMsg = res.body?.responseMessage || "";

  console.log(`HTTP Status : ${res.status}`);
  console.log(`Response    : ${JSON.stringify(res.body, null, 2)}`);

  let isPass = actualCode === expectedCode;
  if (customValidator) {
    isPass = isPass && customValidator(res);
  }

  if (isPass) {
    passed++;
    console.log(`Result      : ✅ LULUS (${actualCode} - ${actualMsg})`);
  } else {
    console.log(`Result      : ❌ GAGAL (${actualCode} - ${actualMsg})`);
  }
}

async function main() {
  console.log("=== SECTION 1: Dana Disbursement TopUp Inquiry (/rest/v1.0/emoney/account-inquiry) ===\n");

  // Scenario 1: Successfully requests account inquiry
  await runTest(
    1,
    8,
    "/rest/v1.0/emoney/account-inquiry",
    "Successfully requests account inquiry",
    "2003700",
    "Successful",
    {
      partnerReferenceNo: genRef("INQ"),
      customerNumber: "62811742234",
      amount: {
        value: "1.00",
        currency: "IDR",
      },
      transactionDate: generateTimestamp(),
      additionalInfo: {
        fundType: "AGENT_TOPUP_FOR_USER_SETTLE",
      },
    }
  );

  // Scenario 2: Error Do Not Honor when request account inquiry
  await runTest(
    2,
    8,
    "/rest/v1.0/emoney/account-inquiry",
    "Error Do Not Honor when request account inquiry",
    "4033705",
    "Do Not Honor",
    {
      partnerReferenceNo: genRef("INQ_HONOR"),
      customerNumber: "628123456667",
      amount: {
        value: "1.00",
        currency: "IDR",
      },
      transactionDate: generateTimestamp(),
      additionalInfo: {
        fundType: "AGENT_TOPUP_FOR_USER_SETTLE",
      },
    }
  );

  // Scenario 3: Failed to make an account inquiry on an account that has exceeded the limit
  await runTest(
    3,
    8,
    "/rest/v1.0/emoney/account-inquiry",
    "Failed to make an account inquiry on an account that has exceeded the limit",
    "4033702",
    "Exceeds Top Up Amount Limit",
    {
      partnerReferenceNo: genRef("INQ_LIMIT"),
      customerNumber: "62811742234",
      amount: {
        value: "21000000.00",
        currency: "IDR",
      },
      transactionDate: generateTimestamp(),
      additionalInfo: {
        fundType: "AGENT_TOPUP_FOR_USER_SETTLE",
      },
    }
  );

  // Scenario 4: Unauthorized Signature
  await runTest(
    4,
    8,
    "/rest/v1.0/emoney/account-inquiry",
    "Unauthorized Signature",
    "4013700",
    "Unauthorized. Invalid Signature",
    {
      partnerReferenceNo: genRef("INQ_UNAUTH"),
      customerNumber: "62811742234",
      amount: {
        value: "1.00",
        currency: "IDR",
      },
      transactionDate: generateTimestamp(),
      additionalInfo: {
        fundType: "AGENT_TOPUP_FOR_USER_SETTLE",
      },
    },
    {
      "X-SIGNATURE": "85be817c55b2c135157c7e89f52499bf0c25ad6eeebe04a986e8c862561b19a5",
    }
  );

  console.log("\n=== SECTION 2: Dana Disbursement TopUp Status Inquiry (/rest/v1.0/emoney/topup-status) ===\n");

  // Setup for Scenario 5: Create a successful topup first
  const refSuccessTopup = genRef("TOPUP_PAID");
  console.log(`[Setup] Creating prerequisite successful TopUp (ref: ${refSuccessTopup})...`);
  const setupPaidRes = await sendDanaRequest("/rest/v1.0/emoney/topup", {
    partnerReferenceNo: refSuccessTopup,
    customerNumber: "62811742234",
    amount: { value: "1.00", currency: "IDR" },
    feeAmount: { value: "1.00", currency: "IDR" },
    transactionDate: generateTimestamp(),
    additionalInfo: {
      fundType: "AGENT_TOPUP_FOR_USER_SETTLE",
    },
  });
  console.log(`[Setup Response] Status: ${setupPaidRes.status}, Body: ${JSON.stringify(setupPaidRes.body)}`);

  // Scenario 5: Successfully inquire Disbursement Top Up successful transaction
  await runTest(
    5,
    8,
    "/rest/v1.0/emoney/topup-status",
    "Successfully inquire Disbursement Top Up successful transaction",
    "2003900",
    "Successful (latestTransactionStatus: 00)",
    {
      originalPartnerReferenceNo: refSuccessTopup,
      serviceCode: "38",
    },
    undefined,
    (res) => res.body?.latestTransactionStatus === "00"
  );

  // Setup for Scenario 6: Create failed topup with customerNumber 6281298055138
  const refFailedTopup = genRef("TOPUP_FAIL");
  console.log(`[Setup] Creating prerequisite failed TopUp (ref: ${refFailedTopup}) with customerNumber 6281298055138...`);
  for (let i = 1; i <= 5; i++) {
    const tryRes = await sendDanaRequest("/rest/v1.0/emoney/topup", {
      partnerReferenceNo: refFailedTopup,
      customerNumber: "6281298055138",
      amount: { value: "1.00", currency: "IDR" },
      feeAmount: { value: "1.00", currency: "IDR" },
      transactionDate: generateTimestamp(),
      additionalInfo: {
        fundType: "AGENT_TOPUP_FOR_USER_SETTLE",
      },
    });
    console.log(`[Setup Retry ${i}/5] Status: ${tryRes.status}, Body: ${JSON.stringify(tryRes.body)}`);
  }

  // Scenario 6: Successfully inquire Disbursement Top Up failed transaction
  await runTest(
    6,
    8,
    "/rest/v1.0/emoney/topup-status",
    "Successfully inquire Disbursement Top Up failed transaction",
    "2003900",
    "Successful (latestTransactionStatus: 06)",
    {
      originalPartnerReferenceNo: refFailedTopup,
      serviceCode: "38",
    },
    undefined,
    (res) => res.body?.latestTransactionStatus === "06"
  );

  // Scenario 7: Top Up Not Found
  const refNotFound = genRef("NOTFOUND");
  await runTest(
    7,
    8,
    "/rest/v1.0/emoney/topup-status",
    "Top Up Not Found",
    "4043901",
    "Top Up Not Found / Transaction Not Found",
    {
      originalPartnerReferenceNo: refNotFound,
      serviceCode: "38",
    }
  );

  // Scenario 8: Invalid Field Format
  await runTest(
    8,
    8,
    "/rest/v1.0/emoney/topup-status",
    "Invalid Field Format",
    "4003901",
    "Invalid Field Format (serviceCode: XX)",
    {
      originalPartnerReferenceNo: refSuccessTopup,
      serviceCode: "XX",
    }
  );

  console.log(`\n==========================================================`);
  console.log(`Total Scenarios: ${total}`);
  console.log(`Passed         : ${passed}/${total}`);
  console.log(`==========================================================\n`);
}

main().catch(console.error);
