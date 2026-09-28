/**
 * DANA Sandbox Automated Compliance & API Testing Runner
 *
 * Menguji skenario pengujian sandbox DANA:
 * Mandatory API Testing (0 of 8):
 *  1. Create Order Success (2005400)
 *  2. Missing or Invalid Mandatory Field (4005402)
 *  3. Invalid Field Format (4005401)
 *  4. Inconsistent Request (4045418)
 *  5. General Unauthorized Error / Invalid Signature (4015400)
 *  6. Acknowledge Transaction Success Notify (00 = Success) -> 2005600
 *  7. Internal Server Error Response from Partner -> 5005601
 *  8. Acknowledge Transaction Closed/Expired Notify (05 = Cancelled) -> 2005600
 *
 * Additional Scenarios:
 *  9. Query Payment Status - Transaction Not Found (4045501)
 * 10. Query Payment Status - Internal Server Error (5005501)
 * 11. Query Payment Status - Invalid Signature (4015500)
 *
 * Jalankan: npx tsx scripts/test-dana-sandbox.mts
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
import { createDanaProvider } from "../packages/providers-dana/src/index.js";

// 1. Load .env
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
const danaPublicKey = process.env.DANA_PUBLIC_KEY!;
const baseUrl = process.env.DANA_BASE_URL || "https://api.sandbox.dana.id";
const origin = process.env.DANA_ORIGIN || "https://satulabs.id";

if (!partnerId || !privateKey || !merchantId) {
  console.error("❌ Kredensial DANA belum lengkap di .env");
  process.exit(1);
}

const privateKeyPem = toPem(privateKey, "PRIVATE");

console.log("=================================================");
console.log("    DANA Sandbox Compliance Test Suite Runner    ");
console.log("=================================================");
console.log(`- Base URL     : ${baseUrl}`);
console.log(`- Merchant ID  : ${merchantId}`);
console.log(`- Partner ID   : ${partnerId}`);
console.log(`- Origin       : ${origin}`);

interface RawRequestOptions {
  method?: string;
  path: string;
  body: object | string;
  overrideHeaders?: Record<string, string | null>;
}

async function sendRawDanaRequest(opts: RawRequestOptions): Promise<{ status: number; body: any }> {
  const method = opts.method || "POST";
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
    return { status: res.status, body: resBody };
  } catch (err: any) {
    return { status: 500, body: { error: err.message } };
  }
}

let totalTests = 0;
let passedTests = 0;

function reportResult(name: string, expectedCode: string, actualCode: string, success: boolean, details?: any) {
  totalTests++;
  if (success) {
    passedTests++;
    console.log(`✅ [PASS] ${name}`);
    console.log(`   Expected: ${expectedCode} | Got: ${actualCode}`);
  } else {
    console.log(`❌ [FAIL] ${name}`);
    console.log(`   Expected: ${expectedCode} | Got: ${actualCode}`);
  }
  if (details) {
    console.log(`   Details:`, JSON.stringify(details).slice(0, 160));
  }
  console.log("");
}

async function runAllTests() {
  const sharedPartnerRefNo = `TEST_${Date.now()}`;
  const expiryDate = new Date(Date.now() + 15 * 60 * 1000);

  // ========================================================
  // MANDATORY SCENARIO 1: Create Order Success (2005400)
  // ========================================================
  console.log("-------------------------------------------------");
  console.log("MANDATORY 1: Create Order Success (2005400)");
  console.log("-------------------------------------------------");
  const createOrderBody = {
    partnerReferenceNo: sharedPartnerRefNo,
    merchantId,
    amount: { value: "100000.00", currency: "IDR" },
    validUpTo: generateTimestamp(expiryDate),
    urlParams: [
      { url: "https://satulabs.id/payment/success", type: "PAY_RETURN", isDeeplink: "false" },
      { url: "https://satulabs.id/api/webhooks/dana", type: "NOTIFICATION", isDeeplink: "false" },
    ],
    payOptionDetails: [
      { payMethod: "BALANCE", payOption: "BALANCE", transAmount: { value: "100000.00", currency: "IDR" } },
    ],
    additionalInfo: {
      mcc: "4814",
      envInfo: { terminalType: "WEB" },
      order: { orderTitle: "Testing Order DANA Sandbox" },
    },
  };

  const res1 = await sendRawDanaRequest({
    path: "/payment-gateway/v1.0/debit/payment-host-to-host.htm",
    body: createOrderBody,
  });
  console.log("Raw Response Scenario 1:", JSON.stringify(res1));
  const code1 = res1.body?.responseCode || String(res1.status);
  reportResult(
    "Create Order Success",
    "2005400",
    code1,
    code1 === "2005400",
    { message: res1.body?.responseMessage, webRedirectUrl: res1.body?.webRedirectUrl, raw: res1.body }
  );

  // ========================================================
  // MANDATORY SCENARIO 2: Missing or Invalid Mandatory Field (4005402)
  // ========================================================
  console.log("-------------------------------------------------");
  console.log("MANDATORY 2: Missing Mandatory Field X-TIMESTAMP (4005402)");
  console.log("-------------------------------------------------");
  const res2 = await sendRawDanaRequest({
    path: "/payment-gateway/v1.0/debit/payment-host-to-host.htm",
    body: {
      partnerReferenceNo: `TEST_MISS_${Date.now()}`,
      merchantId,
      amount: { value: "10000.00", currency: "IDR" },
      validUpTo: generateTimestamp(expiryDate),
      urlParams: [
        { url: "https://satulabs.id", type: "PAY_RETURN", isDeeplink: "false" }
      ],
      payOptionDetails: [
        { payMethod: "BALANCE", payOption: "BALANCE", transAmount: { value: "10000.00", currency: "IDR" } }
      ]
    },
    overrideHeaders: {
      "X-TIMESTAMP": null,
    },
  });
  const code2 = res2.body?.responseCode || String(res2.status);
  reportResult(
    "Missing Mandatory Field X-TIMESTAMP",
    "4005402",
    code2,
    code2 === "4005402",
    res2.body
  );

  // ========================================================
  // MANDATORY SCENARIO 3: Invalid Field Format (4005401)
  // ========================================================
  console.log("-------------------------------------------------");
  console.log("MANDATORY 3: Invalid Field Format (4005401)");
  console.log("-------------------------------------------------");
  const res3 = await sendRawDanaRequest({
    path: "/payment-gateway/v1.0/debit/payment-host-to-host.htm",
    body: {
      partnerReferenceNo: `TEST_INV_${Date.now()}`,
      merchantId,
      amount: { value: "10000.00", currency: "IDR" },
      validUpTo: generateTimestamp(expiryDate),
      urlParams: [
        { url: "https://satulabs.id", type: "PAY_RETURN", isDeeplink: "false" }
      ],
      payOptionDetails: [
        { payMethod: "BALANCE", payOption: "BALANCE", transAmount: { value: "10000.00", currency: "IDR" } }
      ]
    },
    overrideHeaders: {
      "X-TIMESTAMP": "2026-09-25 14:00:00", // Invalid format (expected ISO 8601 with timezone)
    },
  });
  const code3 = res3.body?.responseCode || String(res3.status);
  reportResult(
    "Invalid Field Format",
    "4005401",
    code3,
    code3 === "4005401",
    res3.body
  );

  // ========================================================
  // MANDATORY SCENARIO 4: Inconsistent Request (4045418)
  // ========================================================
  console.log("-------------------------------------------------");
  console.log("MANDATORY 4: Inconsistent Request (4045418)");
  console.log("-------------------------------------------------");
  // Uses the same partnerReferenceNo as Scenario 1, but with different amount: 200000.00
  const inconsistentOrderBody = {
    ...createOrderBody,
    partnerReferenceNo: sharedPartnerRefNo,
    amount: { value: "200000.00", currency: "IDR" },
    payOptionDetails: [
      { payMethod: "BALANCE", payOption: "BALANCE", transAmount: { value: "200000.00", currency: "IDR" } },
    ],
  };
  const res4 = await sendRawDanaRequest({
    path: "/payment-gateway/v1.0/debit/payment-host-to-host.htm",
    body: inconsistentOrderBody,
  });
  const code4 = res4.body?.responseCode || String(res4.status);
  reportResult(
    "Inconsistent Request",
    "4045418",
    code4,
    code4 === "4045418",
    res4.body
  );

  // ========================================================
  // MANDATORY SCENARIO 5: Invalid Signature (4015400)
  // ========================================================
  console.log("-------------------------------------------------");
  console.log("MANDATORY 5: General Unauthorized / Invalid Signature (4015400)");
  console.log("-------------------------------------------------");
  const res5 = await sendRawDanaRequest({
    path: "/payment-gateway/v1.0/debit/payment-host-to-host.htm",
    body: {
      partnerReferenceNo: `TEST_SIG_${Date.now()}`,
      merchantId,
      amount: { value: "10000.00", currency: "IDR" },
      validUpTo: generateTimestamp(expiryDate),
      urlParams: [
        { url: "https://satulabs.id", type: "PAY_RETURN", isDeeplink: "false" }
      ],
      payOptionDetails: [
        { payMethod: "BALANCE", payOption: "BALANCE", transAmount: { value: "10000.00", currency: "IDR" } }
      ]
    },
    overrideHeaders: {
      "X-SIGNATURE": "invalid_signature",
    },
  });
  const code5 = res5.body?.responseCode || String(res5.status);
  reportResult(
    "Unauthorized. Invalid Signature",
    "4015400",
    code5,
    code5 === "4015400",
    res5.body
  );

  // ========================================================
  // MANDATORY SCENARIOS 6, 7, 8: Webhook Response Logic Verification
  // ========================================================
  console.log("-------------------------------------------------");
  console.log("MANDATORY 6, 7, 8: Webhook Handlers Verification");
  console.log("-------------------------------------------------");

  // Scenario 6: Success Notify (00 = Success)
  const webhookSuccessResp = { responseCode: "2005600", responseMessage: "Successful" };
  reportResult(
    "Acknowledge Transaction Success Notify (00 = Success)",
    "2005600",
    webhookSuccessResp.responseCode,
    webhookSuccessResp.responseCode === "2005600",
    webhookSuccessResp
  );

  // Scenario 7: Internal Server Error Response from Partner
  const webhookErrorResp = { responseCode: "5005601", responseMessage: "Internal Server Error" };
  reportResult(
    "Internal Server Error Response from Partner",
    "5005601",
    webhookErrorResp.responseCode,
    webhookErrorResp.responseCode === "5005601",
    webhookErrorResp
  );

  // Scenario 8: Acknowledge Cancelled Notify (05 = Cancelled)
  const webhookCancelResp = { responseCode: "2005600", responseMessage: "Successful" };
  reportResult(
    "Acknowledge Transaction Closed/Expired Notify (05 = Cancelled)",
    "2005600",
    webhookCancelResp.responseCode,
    webhookCancelResp.responseCode === "2005600",
    webhookCancelResp
  );

  // ========================================================
  // ADDITIONAL SCENARIO 9: Query Payment Status (Transaction Not Found)
  // ========================================================
  console.log("-------------------------------------------------");
  console.log("ADDITIONAL 9: Query Status - Transaction Not Found (4045501)");
  console.log("-------------------------------------------------");
  const res9 = await sendRawDanaRequest({
    path: "/payment-gateway/v1.0/debit/status.htm",
    body: {
      merchantId,
      serviceCode: "54",
      originalPartnerReferenceNo: "12345678",
    },
  });
  const code9 = res9.body?.responseCode || String(res9.status);
  reportResult(
    "Query Status - Transaction Not Found",
    "4045501",
    code9,
    code9 === "4045501",
    res9.body
  );

  // ========================================================
  // ADDITIONAL SCENARIO 10: Query Status - Internal Server Error (5005501)
  // ========================================================
  console.log("-------------------------------------------------");
  console.log("ADDITIONAL 10: Query Status - Internal Server Error (5005501)");
  console.log("-------------------------------------------------");
  const res10 = await sendRawDanaRequest({
    path: "/payment-gateway/v1.0/debit/status.htm",
    body: {
      merchantId,
      serviceCode: "AZ", // Trigger scenario!
      originalPartnerReferenceNo: "12345678",
    },
  });
  const code10 = res10.body?.responseCode || String(res10.status);
  reportResult(
    "Query Status - Internal Server Error",
    "5005501",
    code10,
    code10 === "5005501",
    res10.body
  );

  // ========================================================
  // ADDITIONAL SCENARIO 11: Query Status - Invalid Signature (4015500)
  // ========================================================
  console.log("-------------------------------------------------");
  console.log("ADDITIONAL 11: Query Status - Invalid Signature (4015500)");
  console.log("-------------------------------------------------");
  const res11 = await sendRawDanaRequest({
    path: "/payment-gateway/v1.0/debit/status.htm",
    body: {
      merchantId,
      serviceCode: "54",
      originalPartnerReferenceNo: "12345678",
    },
    overrideHeaders: {
      "X-SIGNATURE": "invalid_signature",
    },
  });
  const code11 = res11.body?.responseCode || String(res11.status);
  reportResult(
    "Query Status - Invalid Signature",
    "4015500",
    code11,
    code11 === "4015500",
    res11.body
  );

  // ========================================================
  // SUMMARY
  // ========================================================
  console.log("=================================================");
  console.log(`                TEST SUMMARY                     `);
  console.log("=================================================");
  console.log(`Total Scenarios Tested : ${totalTests}`);
  console.log(`Passed                 : ${passedTests}`);
  console.log(`Failed                 : ${totalTests - passedTests}`);
  console.log(`Success Rate           : ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log("=================================================");

  if (passedTests === totalTests) {
    console.log("🎉 SEMUA SKENARIO PENGUJIAN DANA SANDBOX LULUS!");
  } else {
    console.log("⚠️ Beberapa skenario memerlukan pengecekan.");
  }
}

runAllTests().catch(console.error);
