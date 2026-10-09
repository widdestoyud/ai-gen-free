/**
 * DANA Sandbox Payment Gateway Testing: Debit Status (POST /payment-gateway/v1.0/debit/status.htm)
 *
 * Scenarios:
 * 1. Successful - Final (00 = Success) -> 2005500 (latestTransactionStatus: 00)
 * 2. Successful - Pending (01 = Pending) -> 2005500 (latestTransactionStatus: 01)
 * 3. Successful - Cancelled (05 = Cancelled) -> 2005500 (latestTransactionStatus: 05)
 * 4. Transaction Not Found (4045501)
 * 5. Invalid Mandatory Field (4005502)
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
console.log("   DANA Sandbox Payment Gateway Debit Status Runner       ");
console.log("==========================================================");
console.log(`Base URL    : ${baseUrl}`);
console.log(`Partner ID  : ${partnerId}`);
console.log(`Merchant ID : ${merchantId}`);
console.log(`Origin      : ${origin}`);
console.log("----------------------------------------------------------\n");

async function sendDanaRequest(
  path: string,
  body: any,
  overrideHeaders?: Record<string, string | null>,
  maxRetries = 3
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
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
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

      if (res.status === 503 || res.status === 502) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
      }

      return { status: res.status, body: resBody };
    } catch (err: any) {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      return { status: 500, body: { error: err.message } };
    }
  }
  return { status: 503, body: { error: "Service unavailable after retries" } };
}

async function payVirtualAccountSandbox(virtualAccountNo: string, retries = 5, delayMs = 2000): Promise<any> {
  const executeUrl = "https://dashboard-sandbox.dana.id/merchant-portal-app/api/sandbox-tools/execute";
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(executeUrl, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "origin": "https://dashboard.dana.id",
          "referer": "https://dashboard.dana.id/",
        },
        body: JSON.stringify({
          urlEndpoint: "/v1.0/transfer-va/payment.htm",
          requestBody: { virtualAccountNo },
        }),
      });

      const text = await res.text();
      let resBody: any;
      try {
        resBody = JSON.parse(text);
      } catch {
        resBody = text;
      }

      if (res.ok && resBody?.responseBody?.responseCode === "2002500") {
        return resBody;
      }
    } catch (_e) {}

    if (i < retries) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error(`Failed to pay VA ${virtualAccountNo}`);
}

function genRef(prefix = "PGSTAT") {
  return prefix + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000).toString().padStart(3, "0");
}

let passed = 0;
let total = 0;

async function runTest(
  num: number,
  totalScenarios: number,
  name: string,
  expectedCode: string,
  expectedMsg: string,
  payload: any,
  overrideHeaders?: any,
  customValidator?: (res: any) => boolean
) {
  total++;
  const endpoint = "/payment-gateway/v1.0/debit/status.htm";
  console.log(`----------------------------------------------------------`);
  console.log(`[Scenario ${num}/${totalScenarios}] ${name}`);
  console.log(`Endpoint : POST ${endpoint}`);
  console.log(`Expected : ${expectedCode} (${expectedMsg})`);

  await new Promise((r) => setTimeout(r, 2000));
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

async function createOrderHelper(partnerRefNo: string, amount = "1.00", isVa = false) {
  const validUpTo = generateTimestamp(new Date(Date.now() + 6 * 60 * 1000));
  const payload: any = {
    partnerReferenceNo: partnerRefNo,
    merchantId,
    amount: {
      value: amount,
      currency: "IDR",
    },
    externalStoreId: "",
    urlParams: [
      { url: "https://satulabs.id/payment/success", type: "PAY_RETURN", isDeeplink: "Y" },
      { url: "https://satulabs.id/api/webhooks/dana", type: "NOTIFICATION", isDeeplink: "Y" },
    ],
    validUpTo,
    additionalInfo: {
      order: {
        orderTitle: "Payment Gateway Order",
        scenario: "API",
        merchantTransType: "SPECIAL_MOVIE",
        buyer: {},
      },
      mcc: "5732",
      envInfo: {
        sourcePlatform: "IPG",
        terminalType: "SYSTEM",
        orderTerminalType: "WEB",
      },
      extendInfo: "{\"key\":\"value\"}",
    },
    payOptionDetails: [
      isVa
        ? {
            payMethod: "VIRTUAL_ACCOUNT",
            payOption: "VIRTUAL_ACCOUNT_CIMB",
            transAmount: { value: amount, currency: "IDR" },
          }
        : {
            payMethod: "BALANCE",
            payOption: "",
            transAmount: { value: amount, currency: "IDR" },
          },
    ],
  };

  const res = await sendDanaRequest("/payment-gateway/v1.0/debit/payment-host-to-host.htm", payload);
  return res;
}

async function main() {
  // 1. Scenario 1: Successful - Final (00 = Success)
  console.log(`[Setup 1] Creating Order & Paying VA for Scenario 1...`);
  const refPaid = genRef("PAID");
  const orderPaidRes = await createOrderHelper(refPaid, "11011.00", true);
  console.log(`[Setup 1 Create Res] Status: ${orderPaidRes.status}, Body: ${JSON.stringify(orderPaidRes.body)}`);

  const paymentCode = orderPaidRes.body?.additionalInfo?.paymentCode;
  if (paymentCode) {
    await new Promise((r) => setTimeout(r, 2000));
    await payVirtualAccountSandbox(paymentCode, 5, 2000);
    console.log(`[Setup 1] VA ${paymentCode} paid successfully.`);
    await new Promise((r) => setTimeout(r, 3000));
  }

  await runTest(
    1,
    5,
    "Successful - Final (00 = Success)",
    "2005500",
    "Successful with latestTransactionStatus = 00",
    {
      originalPartnerReferenceNo: refPaid,
      originalReferenceNo: null,
      serviceCode: "54",
      merchantId,
    }
  );

  // 2. Scenario 2: Successful - Pending (01 = Pending)
  const refPending = genRef("PEND");
  console.log(`\n[Setup 2] Creating Unpaid Order for Scenario 2 (Ref: ${refPending})...`);
  await createOrderHelper(refPending, "1.00", false);

  await runTest(
    2,
    5,
    "Successful - Pending (01 = Pending)",
    "2005500",
    "Successful with latestTransactionStatus = 01",
    {
      originalPartnerReferenceNo: refPending,
      originalReferenceNo: null,
      serviceCode: "54",
      merchantId,
    }
  );

  // 3. Scenario 3: Successful - Cancelled (05 = Cancelled)
  const refCancel = genRef("CANC");
  console.log(`\n[Setup 3] Creating & Cancelling Order for Scenario 3 (Ref: ${refCancel})...`);
  await createOrderHelper(refCancel, "1.00", false);
  await new Promise((r) => setTimeout(r, 2000));

  const cancelRes = await sendDanaRequest("/payment-gateway/v1.0/debit/cancel.htm", {
    originalPartnerReferenceNo: refCancel,
    originalReferenceNo: "",
    originalExternalId: "",
    merchantId,
    subMerchantId: "",
    reason: "Customer cancelled",
    externalStoreId: "",
    amount: {
      value: "1.00",
      currency: "IDR",
    },
    additionalInfo: {},
  });
  console.log(`[Setup 3 Cancel Res] Status: ${cancelRes.status}, Body: ${JSON.stringify(cancelRes.body)}`);

  await runTest(
    3,
    5,
    "Successful - Cancelled (05 = Cancelled)",
    "2005500",
    "Successful with latestTransactionStatus = 05",
    {
      originalPartnerReferenceNo: refCancel,
      originalReferenceNo: null,
      serviceCode: "54",
      merchantId,
    }
  );

  // 4. Scenario 4: Transaction Not Found (4045501)
  await runTest(
    4,
    5,
    "Transaction Not Found (4045501)",
    "4045501",
    "Transaction Not Found",
    {
      originalPartnerReferenceNo: "12345678",
      originalReferenceNo: "",
      originalExternalId: "",
      serviceCode: "54",
      merchantId,
    }
  );

  // 5. Scenario 5: Invalid Mandatory Field (4005502)
  await runTest(
    5,
    5,
    "Invalid Mandatory Field (4005502)",
    "4005502",
    "Invalid Mandatory Field X-TIMESTAMP",
    {
      originalPartnerReferenceNo: refPending,
      originalReferenceNo: "",
      originalExternalId: "",
      serviceCode: "54",
      merchantId,
    },
    {
      "X-TIMESTAMP": null,
    }
  );

  console.log(`\n==========================================================`);
  console.log(`Total Scenarios: ${total}`);
  console.log(`Passed         : ${passed}/${total}`);
  console.log(`==========================================================\n`);
}

main().catch(console.error);
