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

async function testSingle(path: string, body: any, overrideHeaders?: any) {
  const method = "POST";
  const bodyStr = JSON.stringify(body);
  const timestamp = overrideHeaders?.["X-TIMESTAMP"] === null ? null : (overrideHeaders?.["X-TIMESTAMP"] || generateTimestamp());
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
  if (overrideHeaders?.["X-PARTNER-ID"] !== null) headers["X-PARTNER-ID"] = overrideHeaders?.["X-PARTNER-ID"] || partnerId;
  if (externalId) headers["X-EXTERNAL-ID"] = externalId;
  if (overrideHeaders?.["CHANNEL-ID"] !== null) headers["CHANNEL-ID"] = overrideHeaders?.["CHANNEL-ID"] || process.env.DANA_CHANNEL_ID || "95221";

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: bodyStr,
  });

  const text = await res.text();
  console.log(`[${path}] Status: ${res.status}, Headers: ${JSON.stringify(Object.fromEntries(res.headers.entries()))}, Body: ${text}`);
}

async function run() {
  const body = {
    partnerReferenceNo: "TRF_" + Date.now().toString().slice(-8),
    beneficiaryAccountNumber: "8121111111",
    beneficiaryBankCode: "014",
    amount: {
      value: "10000.00",
      currency: "IDR",
    },
    additionalInfo: {
      fundType: "MERCHANT_WITHDRAW_FOR_CORPORATE",
      needNotify: "false",
    },
  };

  await testSingle("/v1.0/emoney/transfer-bank.htm", body);
  await testSingle("/rest/v1.0/emoney/transfer-bank.htm", body);
  await testSingle("/v1.0/emoney/transfer-bank.htm", body, { "X-SIGNATURE": "invalid_signature" });
}

run();
