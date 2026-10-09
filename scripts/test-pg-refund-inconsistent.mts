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
      if (!process.env[key]) process.env[key] = val;
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
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text };
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

async function createPaidOrder(amount: string) {
  const ref = "INCONS" + Date.now().toString().slice(-8);
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
      order: { orderTitle: "Inconsistent Test", scenario: "API", merchantTransType: "SPECIAL_MOVIE", buyer: {} },
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

async function test() {
  console.log("=== Testing Refund Inconsistent Request (4045818) ===");
  const paidRef = await createPaidOrder("20000.00");
  console.log("Created & Paid Order with amount 20000.00:", paidRef);

  console.log("\n1️⃣ Call 1: partnerRefundNo = paidRef, amount = 20000.00");
  const res1 = await sendDanaRequest("/payment-gateway/v1.0/debit/refund.htm", {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: paidRef,
    partnerRefundNo: paidRef,
    refundAmount: { value: "20000.00", currency: "IDR" },
    reason: "Call 1",
    additionalInfo: {},
  });
  console.log("Status 1:", res1.status, "Body 1:", JSON.stringify(res1.body));

  await new Promise((r) => setTimeout(r, 2000));

  console.log("\n2️⃣ Call 2: same partnerRefundNo = paidRef, different amount = 10000.00");
  const res2 = await sendDanaRequest("/payment-gateway/v1.0/debit/refund.htm", {
    merchantId,
    subMerchantId: "",
    originalPartnerReferenceNo: paidRef,
    partnerRefundNo: paidRef,
    refundAmount: { value: "10000.00", currency: "IDR" },
    reason: "Call 2 different amount",
    additionalInfo: {},
  });
  console.log("Status 2:", res2.status, "Body 2:", JSON.stringify(res2.body));
}

test();
