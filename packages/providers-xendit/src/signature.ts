/**
 * Xendit Webhook Signature Verification
 *
 * Xendit uses a callback verification token (x-callback-token header)
 * rather than HMAC signatures. The token is a shared secret configured
 * in Dashboard > Settings > Webhooks.
 *
 * @see https://docs.xendit.co/docs/handling-webhooks.md
 */
import { timingSafeEqual } from "node:crypto";

/**
 * Verifies Xendit webhook callback token using constant-time comparison.
 * Returns true if the incoming token matches the expected token.
 */
export function verifyXenditCallbackToken(
  incomingToken: string | undefined | null,
  expectedToken: string,
): boolean {
  if (!incomingToken || !expectedToken) {
    return false;
  }

  try {
    const a = Buffer.from(incomingToken, "utf8");
    const b = Buffer.from(expectedToken, "utf8");
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
