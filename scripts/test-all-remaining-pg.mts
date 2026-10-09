/**
 * Master Compliance Runner for DANA Payment Gateway:
 * 1. Cancel Order (/payment-gateway/v1.0/debit/cancel.htm) - 11 Scenarios
 * 2. Consult Pay (/v1.0/payment-gateway/consult-pay.htm) - 3 Scenarios
 * 3. Refund Order (/payment-gateway/v1.0/debit/refund.htm) - 12 Scenarios
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

async function createPaidOrderHelper(amount = "11011.00") {
  const ref = "PAID" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  const validUpTo = generateTimestamp(new Date(Date.now() + 6 * 60 * 1000));
  const res = await sendDanaRequest("/payment-gateway/v1.0/debit/payment-host-to-host.htm", {
    partnerReferenceNo: ref,
    merchantId,
    amount: { value: amount, currency: "IDR" },
    externalStoreId: "",
    urlParams: [
      { url: "https://satulabs.id/payment/success", type: "PAY_RETURN", isDeeplink: "Y" },
      { url: "https://n8n.automation.dana.id/webhook/3676a08f-b06e-416c-b6cd-bea04f71c4d5", type: "NOTIFICATION", isDeeplink: "Y" },
    ],
    validUpTo,
    additionalInfo: {
      order: { orderTitle: "Order Paid Helper", scenario: "API", merchantTransType: "SPECIAL_MOVIE", buyer: {} },
      mcc: "5732",
      envInfo: { sourcePlatform: "IPG", terminalType: "SYSTEM", orderTerminalType: "WEB" },
      extendInfo: "{\"key\":\"value\"}",
    },
    payOptionDetails: [
      { payMethod: "VIRTUAL_ACCOUNT", payOption: "VIRTUAL_ACCOUNT_CIMB", transAmount: { value: amount, currency: "IDR" } },
    ],
  });

  const paymentCode = res.body?.additionalInfo?.paymentCode;
  if (paymentCode) {
    await new Promise((r) => setTimeout(r, 2000));
    await payVirtualAccountSandbox(paymentCode);
    await new Promise((r) => setTimeout(r, 2000));
  }
  return ref;
}

let passed = 0;
let total = 0;

async function runScenario(
  endpoint: string,
  num: number,
  totalInSuite: number,
  name: string,
  expectedCode: string,
  expectedMsg: string,
  payload: any,
  overrideHeaders?: any,
  customValidator?: (res: any) => boolean
) {
  total++;
  console.log(`----------------------------------------------------------`);
  console.log(`[Scenario ${num}/${totalInSuite}] ${name}`);
  console.log(`Endpoint : POST ${endpoint}`);
  console.log(`Expected : ${expectedCode} (${expectedMsg})`);

  await new Promise((r) => setTimeout(r, 1500));
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

async function runCancelOrderSuite() {
  console.log("\n==========================================================");
  console.log("   SUITE 1: Payment Gateway Cancel Order (/debit/cancel.htm)");
  console.log("==========================================================\n");

  const endpoint = "/payment-gateway/v1.0/debit/cancel.htm";

  // 1. Cancel in Progress (2025700)
  await runScenario(endpoint, 1, 11, "Cancel in Progress", "2025700", "Request In Progress", {
    originalPartnerReferenceNo: "2025700",
    originalReferenceNo: "",
    originalExternalId: "",
    merchantId,
    subMerchantId: "",
    reason: "Cancel in progress test",
    externalStoreId: "",
    additionalInfo: {},
  });

  // 2. Transaction Not Permitted (4035705)
  await runScenario(endpoint, 2, 11, "Transaction Not Permitted", "4035705", "Do Not Honor", {
    originalPartnerReferenceNo: "4035705",
    originalReferenceNo: "",
    originalExternalId: "",
    merchantId,
    subMerchantId: "",
    reason: "Transaction not permitted test",
    externalStoreId: "",
    additionalInfo: {},
  });

  // 3. Merchant Status Abnormal (4045708)
  await runScenario(endpoint, 3, 11, "Merchant Status Abnormal", "4045708", "Invalid Merchant", {
    originalPartnerReferenceNo: "4045708",
    originalReferenceNo: "",
    originalExternalId: "",
    merchantId,
    subMerchantId: "",
    reason: "Merchant status abnormal test",
    externalStoreId: "",
    additionalInfo: {},
  });

  // 4. Missing Mandatory Field/Parameter (4005702)
  await runScenario(endpoint, 4, 11, "Missing Mandatory Field (X-TIMESTAMP)", "4005702", "Invalid Mandatory Field", {
    originalPartnerReferenceNo: "4005702",
    originalReferenceNo: "",
    originalExternalId: "",
    merchantId,
    subMerchantId: "",
    reason: "Missing mandatory field test",
    externalStoreId: "",
    additionalInfo: {},
  }, {
    "X-TIMESTAMP": null,
  });

  // 5. Cancel Failed due to Exceed Cancel Window Time (4035700)
  await runScenario(endpoint, 5, 11, "Cancel Window Time Exceeded", "4035700", "Transaction Expired", {
    originalPartnerReferenceNo: "4035700",
    originalReferenceNo: "",
    originalExternalId: "",
    merchantId,
    subMerchantId: "",
    reason: "Window time exceeded",
    externalStoreId: "",
    additionalInfo: {},
  });

  // 6. Cancel Not Allowed by Agreement (4035715)
  await runScenario(endpoint, 6, 11, "Cancel Not Allowed by Agreement", "4035715", "Transaction Not Permitted", {
    originalPartnerReferenceNo: "4035715",
    originalReferenceNo: "",
    originalExternalId: "",
    merchantId,
    subMerchantId: "",
    reason: "Not allowed by agreement",
    externalStoreId: "",
    additionalInfo: {},
  });

  // 7. Cancel Failed due to Insufficience of Merchant Balance (4035714)
  await runScenario(endpoint, 7, 11, "Insufficient Merchant Balance", "4035714", "Insufficient Funds", {
    originalPartnerReferenceNo: "4035714",
    originalReferenceNo: "",
    originalExternalId: "",
    merchantId,
    subMerchantId: "",
    reason: "Insufficient merchant balance",
    externalStoreId: "",
    additionalInfo: {},
  });

  // 8. Cancel Failed due to Order has been Refunded (4045700)
  await runScenario(endpoint, 8, 11, "Order Refunded / Invalid Transaction Status", "4045700", "Invalid Transaction Status", {
    originalPartnerReferenceNo: "4045700",
    originalReferenceNo: "",
    originalExternalId: "",
    merchantId,
    subMerchantId: "",
    reason: "Order already refunded",
    externalStoreId: "",
    amount: { value: "1.00", currency: "IDR" },
    additionalInfo: {},
  });

  // 9. Invalid Signature (4015700)
  await runScenario(endpoint, 9, 11, "Invalid Signature", "4015700", "Unauthorized. Invalid Signature", {
    originalPartnerReferenceNo: "CANCEL_SIG_" + Date.now(),
    originalReferenceNo: "",
    originalExternalId: "",
    merchantId,
    subMerchantId: "",
    reason: "Invalid signature test",
    externalStoreId: "",
    additionalInfo: {},
  }, {
    "X-SIGNATURE": "invalid_signature",
  });

  // 10. Timeout (5005701)
  await runScenario(endpoint, 10, 11, "Timeout", "5005701", "Internal Server Error", {
    originalPartnerReferenceNo: "5005701",
    originalReferenceNo: "",
    originalExternalId: "",
    merchantId,
    subMerchantId: "",
    reason: "Timeout test",
    externalStoreId: "",
    additionalInfo: {},
  });

  // 11. Transaction Not Found (4045701)
  await runScenario(endpoint, 11, 11, "Transaction Not Found", "4045701", "Transaction Not Found", {
    originalPartnerReferenceNo: "12345678",
    originalReferenceNo: "",
    originalExternalId: "",
    merchantId,
    subMerchantId: "",
    reason: "Transaction not found test",
    externalStoreId: "",
    additionalInfo: {},
  });
}

async function runConsultPaySuite() {
  console.log("\n==========================================================");
  console.log("   SUITE 2: Payment Gateway Consult Pay (/consult-pay.htm)");
  console.log("==========================================================\n");

  const endpoint = "/v1.0/payment-gateway/consult-pay.htm";

  // 1. Consult Pay Balanced Success (2005700)
  await runScenario(endpoint, 1, 3, "Consult Pay Balanced Success", "2005700", "Successful", {
    merchantId,
    amount: { value: "100000.00", currency: "IDR" },
    additionalInfo: {
      buyer: { externalUserId: "8392183912832913821" },
      envInfo: {
        sessionId: "8EU6mLl5mUpUBgyRFT4v7DjfQ3fcauthcenter",
        tokenId: "a8d359d6-ca3d-4048-9295-bbea5f6715a6",
        websiteLanguage: "en_US",
        clientIp: "10.15.8.189",
        osType: "Windows.PC",
        appVersion: "1.0",
        sdkVersion: "1.0",
        sourcePlatform: "IPG",
        orderOsType: "IOS",
        merchantAppVersion: "1.0",
        terminalType: "SYSTEM",
        orderTerminalType: "WEB",
      },
    },
  });

  // 2. Consult Pay Balanced Invalid Field Format (4000001)
  await runScenario(endpoint, 2, 3, "Consult Pay Invalid Field Format (empty merchantId)", "4000001", "Invalid Field Format", {
    merchantId: "",
    amount: { value: "12345678.00", currency: "IDR" },
    additionalInfo: {
      buyer: { externalUserId: "8392183912832913821" },
      envInfo: {
        sessionId: "8EU6mLl5mUpUBgyRFT4v7DjfQ3fcauthcenter",
        tokenId: "a8d359d6-ca3d-4048-9295-bbea5f6715a6",
        websiteLanguage: "en_US",
        clientIp: "10.15.8.189",
        osType: "Windows.PC",
        appVersion: "1.0",
        sdkVersion: "1.0",
        sourcePlatform: "IPG",
        orderOsType: "IOS",
        merchantAppVersion: "1.0",
        terminalType: "SYSTEM",
        orderTerminalType: "WEB",
      },
    },
  });

  // 3. Consult Pay Balanced Invalid Mandatory Field (4000002)
  await runScenario(endpoint, 3, 3, "Consult Pay Invalid Mandatory Field (Missing X-TIMESTAMP)", "4000002", "Invalid Mandatory Field", {
    merchantId: "",
    amount: { value: "12345678.00", currency: "IDR" },
    additionalInfo: {
      buyer: { externalUserId: "8392183912832913821" },
      envInfo: {
        sessionId: "8EU6mLl5mUpUBgyRFT4v7DjfQ3fcauthcenter",
        tokenId: "a8d359d6-ca3d-4048-9295-bbea5f6715a6",
        websiteLanguage: "en_US",
        clientIp: "10.15.8.189",
        osType: "Windows.PC",
        appVersion: "1.0",
        sdkVersion: "1.0",
        sourcePlatform: "IPG",
        orderOsType: "IOS",
        merchantAppVersion: "1.0",
        terminalType: "SYSTEM",
        orderTerminalType: "WEB",
      },
    },
  }, {
    "X-TIMESTAMP": null,
  });
}

async function runRefundOrderSuite() {
  console.log("\n==========================================================");
  console.log("   SUITE 3: Payment Gateway Refund Order (/debit/refund.htm)");
  console.log("==========================================================\n");

  const endpoint = "/payment-gateway/v1.0/debit/refund.htm";

  // Setup: Create a paid order for successful refund
  console.log("[Setup] Creating paid order for refund tests...");
  let paidRef = "";
  try {
    paidRef = await createPaidOrderHelper("11011.00");
    console.log(`[Setup] Created paid order: ${paidRef}`);
  } catch (e: any) {
    console.warn(`[Setup] Paid order creation notice: ${e.message}`);
    paidRef = "PAID" + Date.now().toString().slice(-8);
  }

  // 1. Successfully requests Refund Order (2005800)
  const refundRef1 = "REFUND" + Date.now().toString().slice(-8);
  await runScenario(endpoint, 1, 12, "Successfully requests Refund Order", "2005800", "Successful", {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: paidRef,
    originalReferenceNo: "",
    originalExternalId: "",
    originalCaptureNo: "",
    partnerRefundNo: refundRef1,
    refundAmount: { value: "1.00", currency: "IDR" },
    externalStoreId: "",
    reason: "Customer complain",
    additionalInfo: {},
  });

  // 2. Request In Progress requests Refund Order (2025800)
  await runScenario(endpoint, 2, 12, "Request In Progress requests Refund Order", "2025800", "Request In Progress", {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: paidRef,
    originalReferenceNo: "",
    originalExternalId: "",
    originalCaptureNo: "",
    partnerRefundNo: "REF_PROG_" + Date.now().toString().slice(-6),
    refundAmount: { value: "225800.00", currency: "IDR" },
    externalStoreId: "",
    reason: "Customer complain",
    additionalInfo: {},
  });

  // 3. Refund not allowed by agreement (4035815)
  await runScenario(endpoint, 3, 12, "Refund not allowed by agreement", "4035815", "Transaction Not Permitted", {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: paidRef,
    originalReferenceNo: "",
    originalExternalId: "",
    originalCaptureNo: "",
    partnerRefundNo: "REF_NOTALLOW_" + Date.now().toString().slice(-6),
    refundAmount: { value: "435815.00", currency: "IDR" },
    externalStoreId: "",
    reason: "Customer complain",
    additionalInfo: {},
  });

  // 4. Inconsistent Request (4045818)
  const inconsRefundRef = "REF_INCONS_" + Date.now().toString().slice(-6);
  // First attempt
  await sendDanaRequest(endpoint, {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: paidRef,
    originalReferenceNo: "",
    originalExternalId: "",
    originalCaptureNo: "",
    partnerRefundNo: inconsRefundRef,
    refundAmount: { value: "1.00", currency: "IDR" },
    externalStoreId: "",
    reason: "Customer complain",
    additionalInfo: {},
  });
  // Second attempt with different refundAmount
  await runScenario(endpoint, 4, 12, "Inconsistent Request", "4045818", "Inconsistent Request", {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: paidRef,
    originalReferenceNo: "",
    originalExternalId: "",
    originalCaptureNo: "",
    partnerRefundNo: inconsRefundRef,
    refundAmount: { value: "5.00", currency: "IDR" },
    externalStoreId: "",
    reason: "Customer complain",
    additionalInfo: {},
  });

  // 5. Refund Failed due to Order is Not Paid or Expired (4045800)
  const unpaidRef = "UNPAID_" + Date.now().toString().slice(-6);
  await runScenario(endpoint, 5, 12, "Refund Failed (Order Not Paid / Expired)", "4045800", "Invalid Transaction Status", {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: unpaidRef,
    originalReferenceNo: "",
    originalExternalId: "",
    originalCaptureNo: "",
    partnerRefundNo: "REF_NOTPAID_" + Date.now().toString().slice(-6),
    refundAmount: { value: "1.00", currency: "IDR" },
    externalStoreId: "",
    reason: "Customer complain",
    additionalInfo: {},
  });

  // 6. Invalid Field Format (4005801)
  await runScenario(endpoint, 6, 12, "Invalid Field Format refundAmount", "4005801", "Invalid Field Format", {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: paidRef,
    originalReferenceNo: "",
    originalExternalId: "",
    originalCaptureNo: "",
    partnerRefundNo: "REF_INV_" + Date.now().toString().slice(-6),
    refundAmount: { value: "10000", currency: "IDR" }, // missing decimal
    externalStoreId: "",
    reason: "Customer complain",
    additionalInfo: {},
  });

  // 7. Missing Mandatory Field (4005802)
  await runScenario(endpoint, 7, 12, "Missing Mandatory Field (X-TIMESTAMP)", "4005802", "Invalid Mandatory Field", {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: paidRef,
    originalReferenceNo: "",
    originalExternalId: "",
    originalCaptureNo: "",
    partnerRefundNo: "REF_MISS_" + Date.now().toString().slice(-6),
    refundAmount: { value: "1.00", currency: "IDR" },
    externalStoreId: "",
    reason: "Customer complain",
    additionalInfo: {},
  }, {
    "X-TIMESTAMP": null,
  });

  // 8. Refund failed due to order is not exist (4045801)
  await runScenario(endpoint, 8, 12, "Refund failed (Order Not Found)", "4045801", "Transaction Not Found", {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: "12345678",
    originalReferenceNo: "",
    originalExternalId: "",
    originalCaptureNo: "",
    partnerRefundNo: "REF_NOTFOUND_" + Date.now().toString().slice(-6),
    refundAmount: { value: "1.00", currency: "IDR" },
    externalStoreId: "",
    reason: "Customer complain",
    additionalInfo: {},
  });

  // 9. Refund failed due to Insufficient Merchant Balance (4035814)
  await runScenario(endpoint, 9, 12, "Insufficient Merchant Balance", "4035814", "Insufficient Funds", {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: paidRef,
    originalReferenceNo: "",
    originalExternalId: "",
    originalCaptureNo: "",
    partnerRefundNo: "REF_INSUFF_" + Date.now().toString().slice(-6),
    refundAmount: { value: "435814.00", currency: "IDR" },
    externalStoreId: "",
    reason: "Customer complain",
    additionalInfo: {},
  });

  // 10. Invalid Signature (4015800)
  await runScenario(endpoint, 10, 12, "Invalid Signature", "4015800", "Unauthorized. Invalid Signature", {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: paidRef,
    originalReferenceNo: "",
    originalExternalId: "",
    originalCaptureNo: "",
    partnerRefundNo: "REF_SIG_" + Date.now().toString().slice(-6),
    refundAmount: { value: "1.00", currency: "IDR" },
    externalStoreId: "",
    reason: "Customer complain",
    additionalInfo: {},
  }, {
    "X-SIGNATURE": "invalid_signature",
  });

  // 11. Internal Server Error (5005801)
  await runScenario(endpoint, 11, 12, "Internal Server Error", "5005801", "Internal Server Error", {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: paidRef,
    originalReferenceNo: "",
    originalExternalId: "",
    originalCaptureNo: "",
    partnerRefundNo: "REF_ISE_" + Date.now().toString().slice(-6),
    refundAmount: { value: "505801.00", currency: "IDR" },
    externalStoreId: "",
    reason: "Customer complain",
    additionalInfo: {},
  });

  // 12. Merchant Status Abnormal (4045808)
  await runScenario(endpoint, 12, 12, "Merchant Status Abnormal", "4045808", "Invalid Merchant", {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: paidRef,
    originalReferenceNo: "",
    originalExternalId: "",
    originalCaptureNo: "",
    partnerRefundNo: "REF_ABNORM_" + Date.now().toString().slice(-6),
    refundAmount: { value: "445808.00", currency: "IDR" },
    externalStoreId: "",
    reason: "Customer complain",
    additionalInfo: {},
  });
}

async function main() {
  console.log("==========================================================");
  console.log("  DANA Sandbox: Master Compliance Runner (Cancel, Consult, Refund)");
  console.log("==========================================================");
  console.log(`Base URL    : ${baseUrl}`);
  console.log(`Partner ID  : ${partnerId}`);
  console.log(`Merchant ID : ${merchantId}`);
  console.log(`Origin      : ${origin}`);

  await runCancelOrderSuite();
  await runConsultPaySuite();
  await runRefundOrderSuite();

  console.log("\n==========================================================");
  console.log(`Grand Total Scenarios: ${total}`);
  console.log(`Passed               : ${passed}/${total}`);
  console.log("==========================================================\n");
}

main().catch(console.error);
