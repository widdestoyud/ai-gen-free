import type IORedis from "ioredis";
import type { RateLimitRule } from "@ai-gen-free/core";

export interface RateLimitResult {
  allowed: boolean;
  currentAttempts: number;
  remainingAttempts: number;
  retryAfterSeconds: number;
}

/**
 * Lua Script untuk evaluasi rate-limit secara atomik dalam 1 round-trip ke Redis:
 * 1. Menjalankan INCR pada key
 * 2. Jika key baru dibuat (atau tersisa tanpa TTL dari crash sebelumnya), set EXPIRE windowSeconds
 * 3. Jika current > maxAttempts dan sisa TTL kurang dari lockoutSeconds, set EXPIRE lockoutSeconds
 * 4. Mengembalikan [current, ttl]
 */
const ATOMIC_RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
local ttl = redis.call('TTL', KEYS[1])
if ttl == -1 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
    ttl = tonumber(ARGV[1])
end
if current > tonumber(ARGV[2]) then
    local lockout = tonumber(ARGV[3])
    if ttl < lockout then
        redis.call('EXPIRE', KEYS[1], lockout)
        ttl = lockout
    end
end
return { current, ttl }
`;

/**
 * Memeriksa batas laju request ke Redis berdasarkan RateLimitRule.
 * Mendukung window sliding / fixed expiry dan lockout period secara atomik.
 */
export async function enforceRateLimit(
  redis: IORedis,
  key: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  let current: number;
  let ttl: number;

  if (typeof (redis as any).eval === "function") {
    // Jalur atomik production (IORedis dengan Lua script)
    const result = (await (redis as any).eval(
      ATOMIC_RATE_LIMIT_LUA,
      1,
      key,
      String(rule.windowSeconds),
      String(rule.maxAttempts),
      String(rule.lockoutSeconds),
    )) as [number, number];
    current = Number(result[0]);
    ttl = Number(result[1]);
  } else {
    // Jalur fallback kompatibilitas unit test (untuk MockRedis tanpa dukungan eval)
    current = await redis.incr(key);
    const existingTtl = await redis.ttl(key);
    if (existingTtl === -1 || current === 1) {
      await redis.expire(key, rule.windowSeconds);
    }
    if (current > rule.maxAttempts) {
      const currentTtl = await redis.ttl(key);
      if (currentTtl < rule.lockoutSeconds) {
        await redis.expire(key, rule.lockoutSeconds);
      }
    }
    ttl = await redis.ttl(key);
  }

  const allowed = current <= rule.maxAttempts;
  const remaining = Math.max(0, rule.maxAttempts - current);

  return {
    allowed,
    currentAttempts: current,
    remainingAttempts: remaining,
    retryAfterSeconds: Math.max(0, ttl),
  };
}
