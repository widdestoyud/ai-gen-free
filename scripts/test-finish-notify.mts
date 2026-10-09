/**
 * DANA Sandbox Payment Gateway Testing: Finish Notify (TransactionSuccessNotify - 2005600)
 * Skenario: Acknowledge Transaction Success Notify (00 = Success)
 *
 * Flow:
 * 1. Create Order with amount "11011.00" and NOTIFICATION webhook URL
 * 2. Get paymentCode (VA Number)
 * 3. Pay Virtual Account via DANA Sandbox Tools
 * 4. DANA triggers webhook POST /v1.0/debit/notify (latestTransactionStatus: 00)
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
const notificationWebhookUrl = "https://n8n.automation.dana.id/webhook/3676a08f-b06e-416c-b6cd-bea04f71c4d5";

const privateKeyPem = toPem(privateKey, "PRIVATE");

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

async function payVirtualAccountSandbox(virtualAccountNo: string, retries = 5, delayMs = 2000): Promise<any> {
  const executeUrl = "https://dashboard-sandbox.dana.id/merchant-portal-app/api/sandbox-tools/execute";
  for (let i = 1; i <= retries; i++) {
    console.log(`[Sandbox Tools] Attempt ${i}/${retries}: Paying VA ${virtualAccountNo}...`);
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
        console.log(`[Sandbox Tools] ✅ VA Payment Successful! Payment status: ${resBody.responseBody?.virtualAccountData?.paymentFlagStatus}`);
        return resBody;
      } else {
        console.warn(`[Sandbox Tools] Attempt ${i} response: Status ${res.status}, Body: ${JSON.stringify(resBody)}`);
      }
    } catch (e: any) {
      console.warn(`[Sandbox Tools] Attempt ${i} error: ${e.message}`);
    }

    if (i < retries) {
      console.log(`[Sandbox Tools] Waiting ${delayMs}ms before retry...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error(`Failed to pay VA ${virtualAccountNo} after ${retries} attempts`);
}

async function main() {
  console.log("==========================================================");
  console.log(" DANA Sandbox: TransactionSuccessNotify (00 = Success)     ");
  console.log("==========================================================");

  const partnerRefNo = "NOTIF" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  const amount = "11011.00"; // Code 11011 triggers 00 = Success notify
  const validUpTo = generateTimestamp(new Date(Date.now() + 6 * 60 * 1000));

  console.log(`1️⃣ Creating Order for Notification Test (Amount: ${amount} IDR, Ref: ${partnerRefNo})...`);
  const createOrderPayload = {
    partnerReferenceNo: partnerRefNo,
    merchantId,
    amount: {
      value: amount,
      currency: "IDR",
    },
    externalStoreId: "",
    urlParams: [
      {
        url: "https://satulabs.id/payment/success",
        type: "PAY_RETURN",
        isDeeplink: "Y",
      },
      {
        url: notificationWebhookUrl,
        type: "NOTIFICATION",
        isDeeplink: "Y",
      },
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
      {
        payMethod: "VIRTUAL_ACCOUNT",
        payOption: "VIRTUAL_ACCOUNT_CIMB",
        transAmount: {
          value: amount,
          currency: "IDR",
        },
      },
    ],
  };

  const createRes = await sendDanaRequest(
    "/payment-gateway/v1.0/debit/payment-host-to-host.htm",
    createOrderPayload
  );

  console.log(`HTTP Status : ${createRes.status}`);
  console.log(`Response    : ${JSON.stringify(createRes.body, null, 2)}`);

  const paymentCode = createRes.body?.additionalInfo?.paymentCode;
  if (!paymentCode) {
    console.error("❌ paymentCode tidak ditemukan dalam createOrder response!");
    process.exit(1);
  }

  console.log(`\n2️⃣ Obtained VA Payment Code: ${paymentCode}`);
  console.log("Waiting 2 seconds before executing sandbox payment...");
  await new Promise((r) => setTimeout(r, 2000));

  console.log("\n3️⃣ Paying Virtual Account in Sandbox...");
  const payResult = await payVirtualAccountSandbox(paymentCode, 5, 2000);

  console.log("\n==========================================================");
  console.log("🎉 SUCCESS: Transaction Completed & Webhook Finish Notify Triggered!");
  console.log(`- Partner Reference No : ${partnerRefNo}`);
  console.log(`- VA Number            : ${paymentCode}`);
  console.log(`- Paid Amount          : ${amount} IDR`);
  console.log(`- Webhook URL          : ${notificationWebhookUrl}`);
  console.log(`- Expected Response    : {"responseCode": "2005600", "responseMessage": "Successful"}`);
  console.log("==========================================================\n");
}

main().catch(console.error);
