/**
 * Midtrans Signature Generation and Verification
 * Formula: SHA512(order_id + status_code + gross_amount + ServerKey)
 */
import { createHash, timingSafeEqual } from "node:crypto";

export interface GenerateSignatureParams {
  orderId: string;
  statusCode: string;
  grossAmount: string | number;
  serverKey: string;
}

/**
 * Normalizes grossAmount to Midtrans string representation if numeric
 */
export function formatGrossAmount(amount: string | number): string {
  if (typeof amount === "string") {
    return amount.trim();
  }
  // Midtrans often formats gross_amount with 2 decimal places or plain integer
  return amount.toFixed(2);
}

/**
 * Generates SHA-512 signature key for Midtrans notification/status
 */
export function generateMidtransSignature(params: GenerateSignatureParams): string {
  const { orderId, statusCode, grossAmount, serverKey } = params;
  const rawString = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  return createHash("sha512").update(rawString, "utf8").digest("hex").toLowerCase();
}

/**
 * Verifies if incoming signature matches expected signature using constant-time comparison
 */
export function verifyMidtransSignature(
  incomingSignature: string,
  params: GenerateSignatureParams,
): boolean {
  if (!incomingSignature || !params.serverKey || !params.orderId) {
    return false;
  }

  // Calculate signature with exact grossAmount as received
  const expectedSignature = generateMidtransSignature(params);

  try {
    const a = Buffer.from(incomingSignature.toLowerCase(), "utf8");
    const b = Buffer.from(expectedSignature, "utf8");
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
