import test from "node:test";
import assert from "node:assert/strict";
import {
  AuthResponses,
  RateLimitConfig,
  getOtpTtlMs,
  isAllowedEmailDomain,
  validatePassword,
  hashPassword,
  verifyPassword,
} from "@ai-gen-free/core";
import { enforceRateLimit } from "./rate-limit.js";

// Mock Redis untuk testing rate-limit di memory
class MockRedis {
  private store = new Map<string, { value: number; expireAt: number }>();

  async incr(key: string): Promise<number> {
    const entry = this.store.get(key);
    const now = Date.now();
    if (entry && entry.expireAt > now) {
      entry.value += 1;
      return entry.value;
    }
    this.store.set(key, { value: 1, expireAt: now + 3600 * 1000 });
    return 1;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (entry) {
      entry.expireAt = Date.now() + seconds * 1000;
      return 1;
    }
    return 0;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return -2;
    const remaining = Math.max(0, Math.ceil((entry.expireAt - Date.now()) / 1000));
    return remaining;
  }
}

test("Domain Whitelist: only allows gmail, yahoo, ymail", () => {
  assert.equal(isAllowedEmailDomain("budi@gmail.com"), true);
  assert.equal(isAllowedEmailDomain("ani@yahoo.com"), true);
  assert.equal(isAllowedEmailDomain("joko@yahoo.co.id"), true);
  assert.equal(isAllowedEmailDomain("siti@ymail.com"), true);

  // Rejected domains
  assert.equal(isAllowedEmailDomain("test@test.com"), false);
  assert.equal(isAllowedEmailDomain("fake@outlook.com"), false);
  assert.equal(isAllowedEmailDomain("dummy@hotmail.com"), false);
  assert.equal(isAllowedEmailDomain("hacker@mailinator.com"), false);
});

test("Password Rule: min 8 chars, 1 uppercase, 1 digit", () => {
  assert.equal(validatePassword("short1A").valid, false);
  assert.equal(validatePassword("nouppercase123").valid, false);
  assert.equal(validatePassword("NODIGITHERE!").valid, false);
  assert.equal(validatePassword("ValidPass123").valid, true);
});

test("Rate Limit OTP Request: max 3 attempts per 30 minutes, 4th is locked", async () => {
  const redis = new MockRedis();
  const key = "ratelimit:otp:request:user@gmail.com";
  const rule = RateLimitConfig.otpRequest;

  // Attempt 1
  const r1 = await enforceRateLimit(redis as any, key, rule);
  assert.equal(r1.allowed, true);
  assert.equal(r1.currentAttempts, 1);
  assert.equal(r1.remainingAttempts, 2);

  // Attempt 2
  const r2 = await enforceRateLimit(redis as any, key, rule);
  assert.equal(r2.allowed, true);
  assert.equal(r2.currentAttempts, 2);
  assert.equal(r2.remainingAttempts, 1);

  // Attempt 3
  const r3 = await enforceRateLimit(redis as any, key, rule);
  assert.equal(r3.allowed, true);
  assert.equal(r3.currentAttempts, 3);
  assert.equal(r3.remainingAttempts, 0);

  // Attempt 4 -> HARUS DITOLAK (harus tunggu 30 menit)
  const r4 = await enforceRateLimit(redis as any, key, rule);
  assert.equal(r4.allowed, false);
  assert.equal(r4.currentAttempts, 4);
  assert.equal(r4.remainingAttempts, 0);
  assert.ok(r4.retryAfterSeconds > 0);
});

test("Rate Limit OTP Validation: max 3 wrong attempts rule", () => {
  assert.equal(RateLimitConfig.otpValidation.maxAttempts, 3);
  assert.equal(RateLimitConfig.otpValidation.windowSeconds, 15 * 60);
});

test("Centralized Response Configuration Integrity", () => {
  assert.equal(AuthResponses.errors.INVALID_EMAIL_DOMAIN.code, "A010");
  assert.equal(AuthResponses.errors.WEAK_PASSWORD.code, "A011");
  assert.equal(AuthResponses.errors.INVALID_CREDENTIALS.code, "A012");
  assert.equal(AuthResponses.errors.EMAIL_NOT_VERIFIED.code, "A013");
  assert.equal(AuthResponses.errors.EMAIL_ALREADY_REGISTERED.code, "A014");
  assert.equal(AuthResponses.errors.VERIFICATION_TOKEN_INVALID.code, "A015");
  assert.equal(AuthResponses.errors.EMAIL_NOT_FOUND.code, "A018");
  assert.equal(AuthResponses.errors.ALREADY_LOGGED_IN.code, "A019");
  assert.equal(AuthResponses.errors.OTP_ACTIVE_EXISTING.code, "A020");
  assert.equal(AuthResponses.errors.OTP_ACTIVE_EXISTING.status, 429);
  assert.equal(AuthResponses.errors.OTP_LOCKED.code, "A004");
  assert.ok(AuthResponses.success.REGISTER.message.length > 0);
  assert.ok(AuthResponses.success.EMAIL_VERIFIED.message.length > 0);
  assert.ok(AuthResponses.success.LOGIN_SUCCESS.message.length > 0);
  assert.ok(AuthResponses.success.PROFILE_UPDATED.message.length > 0);
});

test("OTP TTL Configuration & Fallback", () => {
  // Configured default (10 min = 600,000 ms)
  assert.equal(RateLimitConfig.otpTtlSeconds, 600);
  assert.equal(getOtpTtlMs(), 600000);

  // Custom configured value
  assert.equal(getOtpTtlMs(300), 300000); // 5 min

  // Fallback to 15 min (900,000 ms) if unconfigured/invalid
  assert.equal(getOtpTtlMs(0), 900000);
  assert.equal(getOtpTtlMs(-10), 900000);
});
