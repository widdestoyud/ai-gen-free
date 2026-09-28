import crypto from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { toPem } from "../packages/providers-dana/src/signature.js";

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

const publicKey = process.env.DANA_PUBLIC_KEY!;
const privateKey = process.env.DANA_PRIVATE_KEY!;

const sampleBodyMin = JSON.stringify({
  partnerReferenceNo: "9bae3daa-21d7-4c39-bd38-12732d872925",
  customerNumber: "62811742234",
  amount: {
    value: "10000.00",
    currency: "IDR"
  },
  feeAmount: {
    value: "2000.00",
    currency: "IDR"
  },
  additionalInfo: {
    fundType: "AGENT_TOPUP_FOR_USER_SETTLE"
  }
});

const sampleBodyRaw = `{
  "partnerReferenceNo": "9bae3daa-21d7-4c39-bd38-12732d872925",
  "customerNumber": "62811742234",
  "amount": {
    "value": "10000.00",
    "currency": "IDR"
  },
  "feeAmount": {
    "value": "2000.00",
    "currency": "IDR"
  },
  "additionalInfo": {
    "fundType": "AGENT_TOPUP_FOR_USER_SETTLE"
  }
}`;

const timestamp = "2026-09-25T14:16:12+07:00";
const path = "/rest/v1.0/emoney/topup";
const sampleSig = "YRokKk4iBQ/FgB9n1I9yV5TWj6VZog4bcjkT1+ZTebSkT2mGQaBoGwoPV8QSAkacIZpctTjzbJ1KqrsW2rbhBkKbqmJfDlgmU2ICfWdRYPII4QOVojJv4yeQ/3FK5q5nlraRaz2mt7PXYCASyEcxyYK5Vi/6enxSeqsFLQPIyNBJWNuiuJrAqY6ZcegKQxYf7R/Jz5ZruJJcVxO1VTDbSGiYZCtaZM2Kq6Tm0RLDw+jJVSVnnaxn0xhxTvsSSHzhHOVaaIH5UpN9cRA++C6DsQtUdLa2LGp3t9QPIgRWCIulBgjVrCy4v66UZ2+OKwBzJ88freZ61PhdCmFFYlypew==";

function sha256Hex(str: string) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex").toLowerCase();
}

console.log("=== Signature Verification Test ===");
for (const [name, b] of [["minified JSON", sampleBodyMin], ["raw prompt JSON", sampleBodyRaw]]) {
  const hash = sha256Hex(b);
  const canon = `POST:${path}:${hash}:${timestamp}`;
  const verify = crypto.createVerify("SHA256");
  verify.update(canon, "utf8");
  const ok = verify.verify(toPem(publicKey, "PUBLIC"), sampleSig, "base64");
  console.log(`With ${name}:`, ok ? "VALID ✅" : "INVALID ❌", `(hash: ${hash})`);
}

// Also test sample 3: transfer-bank
const sampleBankRaw = `{
  "partnerReferenceNo": "ff5bbb67-8541-4d2d-9030-ad95938df9e1",
  "beneficiaryAccountNumber": "2460888509",
  "beneficiaryBankCode": "014",
  "amount": {
    "value": "10000.00",
    "currency": "IDR"
  },
  "additionalInfo": {
    "fundType": "MERCHANT_WITHDRAW_FOR_CORPORATE",
    "needNotify": "false"
  }
}`;
const sampleBankMin = JSON.stringify({
  partnerReferenceNo: "ff5bbb67-8541-4d2d-9030-ad95938df9e1",
  beneficiaryAccountNumber: "2460888509",
  beneficiaryBankCode: "014",
  amount: {
    value: "10000.00",
    currency: "IDR"
  },
  additionalInfo: {
    fundType: "MERCHANT_WITHDRAW_FOR_CORPORATE",
    needNotify: "false"
  }
});
const bankTimestamp = "2026-09-25T14:16:45+07:00";
const bankPath = "/v1.0/emoney/transfer-bank.htm";
const bankSig = "1N8jImIFpAVJfwT1h9J3y+9CT9J7vO6Ezn6j9fy+EgL3LIvKmo5Mu7xcyPYMsUk5lAPFpgnWVgRCshwPKwbaB/ovY/C1ILrRJIF8iwGbPkvPhrHbs0F+l388IslrGfOxIiyib4KB4mgUQ9KEAtECtpM1wCI8PGumVR0sa3LwS6jSTV16GzEuzSoxCRMgP5GItvW7fTzueVl5TojEUQShJAlArDoZ4dccAsbW6SlKRc0yA2XcC6unnudxvaqkFzXraLhrcvYlFebw3FqVS6V2CSLAx3h/B8rTqjb1PbnbyXzGnXJ+QKCkymoOqQwHQDqNz6bEpZI17QjoIZtOY71NLQ==";

for (const [name, b] of [["bank minified JSON", sampleBankMin], ["bank raw prompt JSON", sampleBankRaw]]) {
  const hash = sha256Hex(b);
  const canon = `POST:${bankPath}:${hash}:${bankTimestamp}`;
  const verify = crypto.createVerify("SHA256");
  verify.update(canon, "utf8");
  const ok = verify.verify(toPem(publicKey, "PUBLIC"), bankSig, "base64");
  console.log(`With ${name}:`, ok ? "VALID ✅" : "INVALID ❌", `(hash: ${hash})`);
}

async function testDisbursementApi() {
  console.log("\n=== Testing Live API Call to /rest/v1.0/emoney/topup ===");
  const testPath = "/rest/v1.0/emoney/topup";
  const nowTs = new Date(Date.now() + 7 * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, "") + "+07:00";
  const body = {
    partnerReferenceNo: crypto.randomUUID(),
    customerNumber: "62817345544",
    amount: { value: "10000.00", currency: "IDR" },
    feeAmount: { value: "2000.00", currency: "IDR" },
    additionalInfo: { fundType: "AGENT_TOPUP_FOR_USER_SETTLE" }
  };
  const bodyStr = JSON.stringify(body);
  const hash = sha256Hex(bodyStr);
  const canon = `POST:${testPath}:${hash}:${nowTs}`;
  const sig = crypto.createSign("RSA-SHA256").update(canon).sign(toPem(privateKey, "PRIVATE"), "base64");

  const res = await fetch(`https://api.sandbox.dana.id${testPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-TIMESTAMP": nowTs,
      "X-SIGNATURE": sig,
      "X-PARTNER-ID": process.env.DANA_PARTNER_ID!,
      "X-EXTERNAL-ID": crypto.randomUUID(),
      "CHANNEL-ID": "95221"
    },
    body: bodyStr
  });

  console.log("Status:", res.status);
  console.log("Response:", await res.text());
}

await testDisbursementApi();

