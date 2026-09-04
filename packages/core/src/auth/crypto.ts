import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export function hashSecret(secret: string, value: string): string {
  return createHash("sha256").update(`${secret}:${value}`).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function randomOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}
