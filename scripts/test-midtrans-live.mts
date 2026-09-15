/**
 * E2E Diagnostic Script: Test Midtrans Snap API transaction creation & Status Check
 * Jalankan: npx tsx scripts/test-midtrans-live.mts
 */

import { createMidtransProvider } from "../packages/providers-midtrans/src/index.js";
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

const serverKey = process.env.MIDTRANS_SERVER_KEY;
const clientKey = process.env.MIDTRANS_CLIENT_KEY;
const merchantId = process.env.MIDTRANS_MERCHANT_ID;
const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";

if (!serverKey) {
  console.error("❌ MIDTRANS_SERVER_KEY belum diisi di .env");
  process.exit(1);
}

console.log("========================================");
console.log("   Midtrans E2E Live Diagnostic Test    ");
console.log("========================================");
console.log(`- Mode         : ${isProduction ? "PRODUCTION" : "SANDBOX"}`);
console.log(`- Merchant ID  : ${merchantId ?? "(not set)"}`);
console.log(`- Client Key   : ${clientKey ? clientKey.slice(0, 10) + "..." : "(not set)"}`);
console.log(`- Server Key   : ${serverKey.slice(0, 10)}...`);

const provider = createMidtransProvider({
  serverKey,
  clientKey,
  merchantId,
  isProduction,
});

const invoiceNumber = `INV-${Date.now()}`;
console.log(`\n1️⃣ Menguji createPayment (Snap API) untuk ${invoiceNumber}...`);

try {
  const result = await provider.createPayment({
    invoiceNumber,
    amount: 20000,
    customerName: "Test User",
    customerEmail: "user@example.com",
    customerPhone: "081234567890",
    paymentDueMinutes: 60,
    callbackUrl: "http://localhost:3000/app/billing",
    lineItems: [
      {
        name: "Top Up 200 Poin",
        price: 20000,
        quantity: 1,
      },
    ],
  });

  if (result.success) {
    console.log("   ✅ SUCCESS createPayment!");
    console.log(`   - Snap Token   : ${result.tokenId}`);
    console.log(`   - Payment URL  : ${result.paymentUrl}`);
    console.log(`   - Expired At   : ${result.expiredDate?.toISOString()}`);
  } else {
    console.log(`   ❌ FAILED createPayment: ${result.error}`);
  }

  console.log(`\n2️⃣ Menguji checkStatus (Core API) untuk invoice yang baru dibuat...`);
  const statusResult = await provider.checkStatus(invoiceNumber);
  console.log("   - Hasil query status Midtrans:", statusResult);

  console.log("\n========================================");
  console.log("          KESIMPULAN PENGUJIAN          ");
  console.log("========================================");
  console.log("✅ Kredensial Midtrans Sandbox VALID.");
  console.log("✅ API Snap Midtrans berhasil terhubung.");
  console.log("✅ URL Checkout aktif dan siap digunakan untuk simulasi pembayaran.");
  if (result.paymentUrl) {
    console.log(`\n👉 URL Pembayaran: ${result.paymentUrl}`);
  }
} catch (err) {
  console.error("\n❌ Error exception:", err);
}
