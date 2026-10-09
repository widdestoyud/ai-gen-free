/**
 * DANA Sandbox Mandatory API Testing: Disbursement TopUp
 * Endpoint: POST /rest/v1.0/emoney/topup
 * 
 * Scenarios:
 * 1. Successfully requests Disbursement Top Up (2003800, customerNumber: 62811742234, amount: 10 IDR)
 * 2. Error Insufficient Fund (4033814, customerNumber: 6281298055129, amount: 50000000000 IDR)
 * 3. Error Do Not Honor (4033805, customerNumber: 628996647679, amount: 10 IDR)
 * 4. Error Invalid Mandatory Field (4003802, Remove param customerNumber)
 * 5. Error Inconsistent Request (4043818, retry with same partnerReferenceNo but different amount)
 * 6. Error Internal Server Error (Already verified or test with specific param)
 * 7. Error General Error (5003800, customerNumber: 628121111111)
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

interface RequestOptions {
  path: string;
  body: any;
  overrideHeaders?: Record<string, string | null>;
}

async function sendDanaRequest(opts: RequestOptions): Promise<{ status: number; body: any; headers: any }> {
  const method = "POST";
  const bodyStr = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  const timestamp = opts.overrideHeaders?.["X-TIMESTAMP"] === null
    ? null
    : (opts.overrideHeaders?.["X-TIMESTAMP"] || generateTimestamp());
  const externalId = opts.overrideHeaders?.["X-EXTERNAL-ID"] || generateExternalId();

  let signature: string | null = null;
  if (opts.overrideHeaders?.["X-SIGNATURE"] !== undefined) {
    signature = opts.overrideHeaders["X-SIGNATURE"];
  } else if (timestamp) {
    const canonical = buildCanonicalString(method, opts.path, bodyStr, timestamp);
    signature = signRequest(canonical, privateKeyPem);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ORIGIN": origin,
  };

  if (timestamp) headers["X-TIMESTAMP"] = timestamp;
  if (signature) headers["X-SIGNATURE"] = signature;
  if (opts.overrideHeaders?.["X-PARTNER-ID"] !== null) {
    headers["X-PARTNER-ID"] = opts.overrideHeaders?.["X-PARTNER-ID"] || partnerId;
  }
  if (externalId) headers["X-EXTERNAL-ID"] = externalId;
  if (opts.overrideHeaders?.["CHANNEL-ID"] !== null) {
    headers["CHANNEL-ID"] = opts.overrideHeaders?.["CHANNEL-ID"] || process.env.DANA_CHANNEL_ID || "95221";
  }

  const url = `${baseUrl}${opts.path}`;
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
    return { status: res.status, body: resBody, headers: Object.fromEntries(res.headers.entries()) };
  } catch (err: any) {
    return { status: 500, body: { error: err.message }, headers: {} };
  }
}

function generateRefNo(prefix = "TOPUP"): string {
  const ts = Date.now().toString();
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${prefix}${ts}${rand}`;
}

async function runScenario(
  scenarioNum: number,
  title: string,
  expectedCode: string,
  expectedMessage: string,
  payload: any,
  overrideHeaders?: any,
) {
  console.log(`[Scenario ${scenarioNum}] ${title}`);
  console.log(`Endpoint: POST /rest/v1.0/emoney/topup`);
  console.log(`Payload :`, JSON.stringify(payload, null, 2));

  const res = await sendDanaRequest({
    path: "/rest/v1.0/emoney/topup",
    body: payload,
    overrideHeaders,
  });

  console.log(`Response HTTP Status: ${res.status}`);
  console.log(`Response Body       :`, JSON.stringify(res.body, null, 2));

  const actualCode = res.body?.responseCode || "UNKNOWN";
  const actualMessage = res.body?.responseMessage || "";

  const isSuccess = actualCode === expectedCode;
  if (isSuccess) {
    console.log(`✅ LULUS - responseCode: ${actualCode} (${actualMessage})\n`);
  } else {
    console.log(`❌ GAGAL - Diperkirakan: ${expectedCode} (${expectedMessage}), Didapat: ${actualCode} (${actualMessage})\n`);
  }
  return { isSuccess, response: res.body };
}

async function main() {
  // Scenario 1: Successfully requests Disbursement Top Up
  const refNo1 = generateRefNo("SUCC");
  await runScenario(
    1,
    "Successfully requests Disbursement Top Up",
    "2003800",
    "Successful",
    {
      partnerReferenceNo: refNo1,
      customerNumber: "62811742234",
      amount: {
        value: "10.00",
        currency: "IDR",
      },
      feeAmount: {
        value: "0.00",
        currency: "IDR",
      },
      additionalInfo: {},
    },
  );

  // Scenario 2: Error Insufficient Fund
  const refNo2 = generateRefNo("INSUFF");
  await runScenario(
    2,
    "Error Insufficient Fund when request Disbursement Top Up",
    "4033814",
    "Insufficient Fund",
    {
      partnerReferenceNo: refNo2,
      customerNumber: "6281298055129",
      amount: {
        value: "50000000000.00",
        currency: "IDR",
      },
      feeAmount: {
        value: "0.00",
        currency: "IDR",
      },
      additionalInfo: {},
    },
  );

  // Scenario 3: Error Do Not Honor
  const refNo3 = generateRefNo("DONOTHONOR");
  await runScenario(
    3,
    "Error Do Not Honor when request Disbursement Top Up",
    "4033805",
    "Do Not Honor",
    {
      partnerReferenceNo: refNo3,
      customerNumber: "628996647679",
      amount: {
        value: "10.00",
        currency: "IDR",
      },
      feeAmount: {
        value: "0.00",
        currency: "IDR",
      },
      additionalInfo: {},
    },
  );

  // Scenario 4: Error Invalid Mandatory Field (Remove customerNumber)
  const refNo4 = generateRefNo("INVMAND");
  await runScenario(
    4,
    "Error Invalid Mandatory Field when request Disbursement Top Up",
    "4003802",
    "Invalid Mandatory Field",
    {
      partnerReferenceNo: refNo4,
      amount: {
        value: "10.00",
        currency: "IDR",
      },
      feeAmount: {
        value: "0.00",
        currency: "IDR",
      },
      additionalInfo: {},
    },
  );

  // Scenario 5: Error Inconsistent Request
  // First send initial request (which succeeds), then retry same partnerReferenceNo with different amount
  const refNo5 = generateRefNo("INCONS");
  console.log("Preparing Scenario 5: Sending initial request first...");
  const initRes = await sendDanaRequest({
    path: "/rest/v1.0/emoney/topup",
    body: {
      partnerReferenceNo: refNo5,
      customerNumber: "62811742234",
      amount: {
        value: "10.00",
        currency: "IDR",
      },
      feeAmount: {
        value: "0.00",
        currency: "IDR",
      },
      additionalInfo: {},
    },
  });
  console.log("Initial request status:", initRes.status, JSON.stringify(initRes.body));

  // Now retry with different amount
  await runScenario(
    5,
    "Error Inconsistent Request when retrying Disbursement Top Up",
    "4043818",
    "Inconsistent Request",
    {
      partnerReferenceNo: refNo5,
      customerNumber: "62811742234",
      amount: {
        value: "20.00",
        currency: "IDR",
      },
      feeAmount: {
        value: "0.00",
        currency: "IDR",
      },
      additionalInfo: {},
    },
  );

  // Scenario 7: Error General Error
  const refNo7 = generateRefNo("GENERR");
  await runScenario(
    7,
    "Error General Error when request Disbursement Top Up",
    "5003800",
    "General Error",
    {
      partnerReferenceNo: refNo7,
      customerNumber: "628121111111",
      amount: {
        value: "10.00",
        currency: "IDR",
      },
      feeAmount: {
        value: "0.00",
        currency: "IDR",
      },
      additionalInfo: {},
    },
  );
}

main().catch(console.error);
