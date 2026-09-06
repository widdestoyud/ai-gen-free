import type IORedis from "ioredis";
import type { RateLimitRule } from "@ai-gen-free/core";

export interface RateLimitResult {
  allowed: boolean;
  currentAttempts: number;
  remainingAttempts: number;
  retryAfterSeconds: number;
}

/**
 * Memeriksa batas laju request ke Redis berdasarkan RateLimitRule.
 * Mendukung window sliding / fixed expiry dan lockout period.
 */
export async function enforceRateLimit(
  redis: IORedis,
  key: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, rule.windowSeconds);
  }

  // Jika melebihi batas, pastikan durasi lockout minimal rule.lockoutSeconds
  if (current > rule.maxAttempts) {
    const ttl = await redis.ttl(key);
    if (ttl < rule.lockoutSeconds) {
      await redis.expire(key, rule.lockoutSeconds);
    }
  }

  const ttl = await redis.ttl(key);
  const allowed = current <= rule.maxAttempts;
  const remaining = Math.max(0, rule.maxAttempts - current);

  return {
    allowed,
    currentAttempts: current,
    remainingAttempts: remaining,
    retryAfterSeconds: Math.max(0, ttl),
  };
}

/** Legacy helper untuk kompatibilitas */
export async function hitLimit(
  redis: IORedis,
  key: string,
  max: number,
  ttlSeconds: number,
): Promise<boolean> {
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, ttlSeconds);
  return n > max;
}
