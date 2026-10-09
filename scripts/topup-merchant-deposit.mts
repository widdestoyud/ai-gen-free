/**
 * Top-up Merchant Deposit Balance in DANA Sandbox via Simulated BNI VA
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function encrypt(data: Buffer, key: string): Buffer {
  const result = Buffer.alloc(data.length);
  const keyLen = key.length;
  for (let i = 0; i < data.length; i++) {
    const keyChar = key.charCodeAt((i + keyLen - 1) % keyLen);
    result[i] = (data[i]! + keyChar) % 128;
  }
  return result;
}

function doubleEncrypt(input: string, clientID: string, secretKey: string): string {
  const enc1 = encrypt(Buffer.from(input, "utf8"), clientID);
  const enc2 = encrypt(enc1, secretKey);
  return enc2
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function hashBNIData(jsonData: string, clientID: string, secretKey: string): string {
  let timeStr = Date.now().toString();
  if (timeStr.length > 10) timeStr = timeStr.slice(0, 10);
  const reversedTime = timeStr.split("").reverse().join("");
  const payload = reversedTime + "." + jsonData;
  return doubleEncrypt(payload, clientID, secretKey);
}

async function main() {
  const clientID = "910";
  const secretKey = "9546d5f69af2ed3bc603834446985628";
  const virtualAccount = "8512950056331595";

  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const HH = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());

  const trxID = `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
  const datetimePayment = `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`;
  const datetimePaymentISO = `${yyyy}-${MM}-${dd}T${HH}:${mm}:${ss}+07:00`;

  const integrationBody = {
    trx_amount: "1000",
    trx_id: trxID,
    virtual_account: virtualAccount,
    customer_name: "rudy",
    payment_amount: "100000000", // Topup 100 Juta IDR
    cumulative_payment_amount: "1000",
    payment_ntb: "233171",
    datetime_payment: datetimePayment,
    datetime_payment_iso8601: datetimePaymentISO,
  };

  console.log("1. Encrypting BNI TopUp Request Body...");
  const data = hashBNIData(JSON.stringify(integrationBody), clientID, secretKey);
  const payload = {
    client_id: clientID,
    data,
  };

  console.log("2. Sending BNI VA Merchant TopUp to DANA Sandbox...");
  const url = "https://api.sandbox.dana.id/ifcsupergw/bni/topup/merchant/request.htm";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const resText = await res.text();
  console.log("HTTP Status:", res.status);
  console.log("Response Body:", resText);
}

main().catch(console.error);
