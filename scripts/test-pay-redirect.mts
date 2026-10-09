import { spawn } from "node:child_process";
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

const privateKeyPem = toPem(privateKey, "PRIVATE");

async function sendDanaRequest(path: string, body: any) {
  const method = "POST";
  const bodyStr = JSON.stringify(body);
  const timestamp = generateTimestamp();
  const externalId = generateExternalId();
  const canonical = buildCanonicalString(method, path, bodyStr, timestamp);
  const signature = signRequest(canonical, privateKeyPem);

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-TIMESTAMP": timestamp,
      "X-SIGNATURE": signature,
      "X-PARTNER-ID": partnerId,
      "X-EXTERNAL-ID": externalId,
      "CHANNEL-ID": "95221",
      "ORIGIN": origin,
    },
    body: bodyStr,
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function payViaAutomation(webRedirectUrl: string): Promise<any> {
  console.log(`[Automation] Automating payment for redirect URL: ${webRedirectUrl}`);
  const params = {
    phoneNumber: "083811223355",
    pin: "181818",
    redirectUrl: webRedirectUrl,
    maxRetries: 3,
    retryDelay: 2000,
    headless: true,
  };

  return new Promise((resolve) => {
    const scriptPath = "/home/ubuntu/scratch_dana_uat/test/node/automate-payment.js";
    const child = spawn("node", [scriptPath, JSON.stringify(params)], {
      cwd: "/home/ubuntu/scratch_dana_uat/test/node",
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
      console.log(`[Automation stdout] ${d.toString().trim()}`);
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
      console.error(`[Automation stderr] ${d.toString().trim()}`);
    });
    child.on("close", (code) => {
      console.log(`[Automation] Process exited with code ${code}`);
      resolve({ code, stdout, stderr });
    });
  });
}

async function main() {
  const partnerRef = "PAIDTEST" + Date.now().toString().slice(-6);
  console.log(`Creating order redirect: ${partnerRef}`);

  const expiryDate = new Date(Date.now() + 15 * 60 * 1000);
  const createOrderBody = {
    partnerReferenceNo: partnerRef,
    merchantId,
    amount: { value: "1.00", currency: "IDR" },
    validUpTo: generateTimestamp(expiryDate),
    urlParams: [
      { url: "https://satulabs.id/payment/success", type: "PAY_RETURN", isDeeplink: "Y" },
      { url: "https://satulabs.id/api/webhooks/dana", type: "NOTIFICATION", isDeeplink: "Y" },
    ],
    payOptionDetails: [
      { payMethod: "BALANCE", payOption: "BALANCE", transAmount: { value: "1.00", currency: "IDR" } },
    ],
    additionalInfo: {
      mcc: "5732",
      envInfo: { sourcePlatform: "IPG", terminalType: "SYSTEM", orderTerminalType: "WEB" },
      order: { orderTitle: "Testing Order DANA Sandbox", scenario: "API", merchantTransType: "SPECIAL_MOVIE", buyer: {} },
      extendInfo: "{\"key\":\"value\"}",
    },
  };

  const orderRes = await sendDanaRequest("/payment-gateway/v1.0/debit/payment-host-to-host.htm", createOrderBody);
  console.log("Create Order response:", JSON.stringify(orderRes, null, 2));

  if (orderRes.webRedirectUrl) {
    await payViaAutomation(orderRes.webRedirectUrl);
  }

  // Poll status
  for (let i = 1; i <= 6; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await sendDanaRequest("/payment-gateway/v1.0/debit/status.htm", {
      originalPartnerReferenceNo: partnerRef,
      originalReferenceNo: null,
      serviceCode: "54",
      merchantId,
    });
    console.log(`Status poll ${i}: latestTransactionStatus = ${statusRes.latestTransactionStatus} (${statusRes.transactionStatusDesc})`);
    if (statusRes.latestTransactionStatus === "00") {
      console.log("🎉 SUCCESS! Status is 00");
      break;
    }
  }
}

main().catch(console.error);
