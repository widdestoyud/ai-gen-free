/**
 * E2E Diagnostic Script: Test Xendit Payment Request API creation & Status Check
 * Jalankan: npx tsx scripts/test-xendit-live.mts
 */

import { createXenditProvider } from "../packages/providers-xendit/src/index.js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const apiKey = process.env.XENDIT_API_KEY;
const publicKey = process.env.XENDIT_PUB_KEY;
const webhookToken = process.env.XENDIT_WEBHOOK_TOKEN;
const isProduction = process.env.XENDIT_IS_PRODUCTION === "true";

if (!apiKey) {
  console.error("❌ XENDIT_API_KEY belum diisi di .env");
  process.exit(1);
}

console.log("========================================");
console.log("    Xendit E2E Live Diagnostic Test     ");
console.log("========================================");
console.log(`- Mode          : ${isProduction ? "PRODUCTION" : "DEVELOPMENT / TEST"}`);
console.log(`- Public Key    : ${publicKey ? publicKey.slice(0, 15) + "..." : "(not set)"}`);
console.log(`- Secret Key    : ${apiKey.slice(0, 15)}...`);
console.log(`- Webhook Token : ${webhookToken ? "Configured (" + webhookToken.slice(0, 8) + "...)" : "(not set)"}`);

const provider = createXenditProvider({
  apiKey,
  publicKey,
  webhookToken,
  isProduction,
});

const invoiceNumber = `INV-${Date.now()}`;
console.log(`\n1️⃣ Menguji createPayment (Payment Request API v3) untuk ${invoiceNumber}...`);

try {
  const result = await provider.createPayment({
    invoiceNumber,
    amount: 25000,
    customerName: "Test Customer",
    customerEmail: "customer@example.com",
    customerPhone: "+6281234567890",
    paymentDueMinutes: 60,
    callbackUrl: "http://localhost:3000/app/billing",
    lineItems: [
      {
        name: "Top Up 250 Poin",
        price: 25000,
        quantity: 1,
      },
    ],
  });

  if (result.success) {
    console.log("   ✅ SUCCESS createPayment!");
    console.log(`   - Payment Request ID : ${result.tokenId}`);
    console.log(`   - Payment URL        : ${result.paymentUrl ?? "(Action redirect / QR provided)"}`);
    console.log(`   - Expired At         : ${result.expiredDate?.toISOString()}`);
  } else {
    console.log(`   ❌ FAILED createPayment: ${result.error}`);
  }

  console.log(`\n2️⃣ Menguji checkStatus (List/Get Payment Request) untuk invoice yang baru dibuat...`);
  const statusResult = await provider.checkStatus(invoiceNumber);
  console.log("   - Hasil query status Xendit:", statusResult);

  console.log("\n========================================");
  console.log("          KESIMPULAN PENGUJIAN          ");
  console.log("========================================");
  if (result.success) {
    console.log("✅ Kredensial Xendit API Key VALID.");
    console.log("✅ API Payment Request v3 Xendit berhasil terhubung.");
    if (result.paymentUrl) {
      console.log(`\n👉 URL Pembayaran: ${result.paymentUrl}`);
    }
  } else {
    console.log("⚠️ Ada kendala pada createPayment Xendit.");
  }
} catch (err) {
  console.error("\n❌ Error exception:", err);
}
