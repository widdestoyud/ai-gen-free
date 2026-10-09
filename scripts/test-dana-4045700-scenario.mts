import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildCanonicalString,
  signRequest,
  generateTimestamp,
  generateExternalId,
  toPem,
} from "../packages/providers-dana/src/signature.js";

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
const privateKeyPem = toPem(privateKey, "PRIVATE");

async function sendDanaRequest(path: string, body: any) {
  const method = "POST";
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  const timestamp = generateTimestamp();
  const externalId = generateExternalId();
  const canonical = buildCanonicalString(method, path, bodyStr, timestamp);
  const signature = signRequest(canonical, privateKeyPem);

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "ORIGIN": origin,
      "X-TIMESTAMP": timestamp,
      "X-SIGNATURE": signature,
      "X-PARTNER-ID": partnerId,
      "X-EXTERNAL-ID": externalId,
      "CHANNEL-ID": process.env.DANA_CHANNEL_ID || "95221",
    },
    body: bodyStr,
  });

  const text = await res.text();
  try {
    return { status: res.status, headers: { timestamp, signature, externalId }, body: JSON.parse(text) };
  } catch {
    return { status: res.status, headers: { timestamp, signature, externalId }, body: text };
  }
}

async function payVirtualAccountSandbox(virtualAccountNo: string): Promise<any> {
  const executeUrl = "https://dashboard-sandbox.dana.id/merchant-portal-app/api/sandbox-tools/execute";
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
  return res.json();
}

async function main() {
  console.log("================================================================================");
  console.log("       DANA TEST SCENARIO: Cancel Failed due to Refund (4045700)                ");
  console.log("================================================================================");
  console.log("Endpoint : POST /payment-gateway/v1.0/debit/cancel.htm");
  console.log("Expected : responseCode: 4045700, responseMessage: Invalid Transaction Status\n");

  // Step 1: Create a Paid Transaction
  console.log(">>> [Step 1] Creating new transaction and paying via Sandbox Virtual Account...");
  const ref = "TEST4045700_" + Date.now().toString().slice(-8);
  const createRes = await sendDanaRequest("/payment-gateway/v1.0/debit/payment-host-to-host.htm", {
    partnerReferenceNo: ref,
    merchantId,
    amount: { value: "10000.00", currency: "IDR" },
    externalStoreId: "",
    urlParams: [
      { url: "https://satulabs.id/payment/success", type: "PAY_RETURN", isDeeplink: "Y" },
      { url: "https://satulabs.id/api/webhooks/dana", type: "NOTIFICATION", isDeeplink: "Y" },
    ],
    validUpTo: generateTimestamp(new Date(Date.now() + 6 * 60 * 1000)),
    additionalInfo: {
      order: { orderTitle: "4045700 Test Order", scenario: "API", merchantTransType: "SPECIAL_MOVIE", buyer: {} },
      mcc: "5732",
      envInfo: { sourcePlatform: "IPG", terminalType: "SYSTEM", orderTerminalType: "WEB" },
      extendInfo: "{\"key\":\"value\"}",
    },
    payOptionDetails: [
      { payMethod: "VIRTUAL_ACCOUNT", payOption: "VIRTUAL_ACCOUNT_CIMB", transAmount: { value: "10000.00", currency: "IDR" } },
    ],
  });

  const paymentCode = createRes.body?.additionalInfo?.paymentCode;
  const danaRefNo = createRes.body?.referenceNo;
  console.log(`Order created: ${ref}, DANA Ref: ${danaRefNo}, Payment Code: ${paymentCode}`);

  if (paymentCode) {
    await new Promise((r) => setTimeout(r, 1500));
    await payVirtualAccountSandbox(paymentCode);
    await new Promise((r) => setTimeout(r, 1500));
    console.log("Payment completed via VA Sandbox.");
  }

  // Step 2: Attempt Refund (as per documentation instruction)
  console.log("\n>>> [Step 2] Attempting refund on the paid transaction...");
  const refundRes = await sendDanaRequest("/payment-gateway/v1.0/debit/refund.htm", {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: ref,
    originalReferenceNo: danaRefNo || "",
    partnerRefundNo: "REF_" + ref,
    refundAmount: { value: "10000.00", currency: "IDR" },
    reason: "Refund before cancel",
    additionalInfo: {},
  });
  console.log("Refund Response:", JSON.stringify(refundRes.body, null, 2));

  // Step 3: Call Cancel Order API (Target: 4045700)
  console.log("\n>>> [Step 3] Sending Cancel Request with originalPartnerReferenceNo: " + ref);
  const cancelPayload = {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: ref,
    originalReferenceNo: danaRefNo || "",
    originalExternalId: "",
    reason: "Cancel order after refund attempt",
    amount: { value: "10000.00", currency: "IDR" },
    additionalInfo: {},
  };

  const cancelRes = await sendDanaRequest("/payment-gateway/v1.0/debit/cancel.htm", cancelPayload);
  console.log("HTTP Status :", cancelRes.status);
  console.log("Request Payload:\n", JSON.stringify(cancelPayload, null, 2));
  console.log("Cancel Response:\n", JSON.stringify(cancelRes.body, null, 2));

  const isPassed = cancelRes.body?.responseCode === "4045700";
  console.log("\n>>> RESULT :", isPassed ? "✅ VERIFIED (4045700 Invalid Transaction Status)" : `❌ FAILED (Received ${cancelRes.body?.responseCode} - ${cancelRes.body?.responseMessage})`);

  // Step 4: Testing variations if direct call returned error
  if (!isPassed) {
    console.log("\n>>> [Step 4] Testing Sandbox Mock Amount & Header Variations for 4045700...");
    const variations = [
      { name: "Mock Amount 445700.00", amount: "445700.00" },
      { name: "Mock Amount 4045700.00", amount: "4045700.00" },
      { name: "Mock Amount 40457.00", amount: "40457.00" },
      { name: "Without ReferenceNo", originalReferenceNo: "" },
      { name: "Reason: INVALID_STATUS", reason: "INVALID_STATUS" },
      { name: "Reason: REFUNDED", reason: "REFUNDED" },
    ];

    for (const v of variations) {
      const payload: any = {
        merchantId,
        subMerchantId: "",
        originalPartnerReferenceNo: ref,
        originalReferenceNo: v.originalReferenceNo !== undefined ? v.originalReferenceNo : (danaRefNo || ""),
        reason: v.reason || "Order has been refunded",
        amount: { value: v.amount || "10000.00", currency: "IDR" },
        additionalInfo: {},
      };
      const res = await sendDanaRequest("/payment-gateway/v1.0/debit/cancel.htm", payload);
      console.log(`[Variation: ${v.name}] -> HTTP ${res.status}, Code: ${res.body?.responseCode}, Msg: ${res.body?.responseMessage}`);
      if (res.body?.responseCode === "4045700") {
        console.log("🎯 SUCCESS VARIATION FOUND:", JSON.stringify(payload, null, 2));
        break;
      }
    }
  }

  console.log("\n================================================================================");
  console.log("                           TEST RUN FINISHED                                    ");
  console.log("================================================================================");
}

main();
