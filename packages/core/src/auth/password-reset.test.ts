import test from "node:test";
import assert from "node:assert/strict";
import { hashSecret, randomToken } from "./crypto.js";
import { evaluatePasswordResetRequest } from "./password-reset.js";
import { RateLimitConfig, getPasswordResetTokenTtlMs } from "../config/rate-limit.config.js";
import { AuthResponses } from "../config/responses.config.js";
import { ErrorCodes } from "../errors.js";

const verifiedUser = {
  emailVerifiedAt: new Date("2026-01-01T00:00:00Z"),
  passwordHash: "salt:hash",
  bannedAt: null,
  passwordChangedAt: null,
};

test("evaluatePasswordResetRequest: unregistered / unverified / no password → EMAIL_NOT_FOUND", () => {
  assert.deepEqual(evaluatePasswordResetRequest({ user: null, pendingTokenCreatedAt: null }), {
    allowed: false,
    reason: "EMAIL_NOT_FOUND",
  });
  assert.equal(
    evaluatePasswordResetRequest({
      user: { ...verifiedUser, emailVerifiedAt: null },
      pendingTokenCreatedAt: null,
    }).allowed,
    false,
  );
  assert.equal(
    evaluatePasswordResetRequest({
      user: { ...verifiedUser, passwordHash: null },
      pendingTokenCreatedAt: null,
    }).allowed,
    false,
  );
});

test("evaluatePasswordResetRequest: banned → FORBIDDEN", () => {
  const gate = evaluatePasswordResetRequest({
    user: { ...verifiedUser, bannedAt: new Date() },
    pendingTokenCreatedAt: null,
  });
  assert.deepEqual(gate, { allowed: false, reason: "FORBIDDEN" });
});

test("evaluatePasswordResetRequest: pending token within config window → PASSWORD_RESET_PENDING", () => {
  const now = new Date("2026-09-09T12:00:00Z");
  const createdAt = new Date(now.getTime() - 10 * 60 * 1000);
  const gate = evaluatePasswordResetRequest({
    user: verifiedUser,
    pendingTokenCreatedAt: createdAt,
    now,
    pendingSeconds: RateLimitConfig.passwordResetPendingSeconds,
  });
  assert.deepEqual(gate, { allowed: false, reason: "PASSWORD_RESET_PENDING" });
});

test("evaluatePasswordResetRequest: pending window elapsed → allowed (old token may be replaced)", () => {
  const now = new Date("2026-09-09T12:00:00Z");
  const createdAt = new Date(now.getTime() - (RateLimitConfig.passwordResetPendingSeconds + 1) * 1000);
  const gate = evaluatePasswordResetRequest({
    user: verifiedUser,
    pendingTokenCreatedAt: createdAt,
    now,
    pendingSeconds: RateLimitConfig.passwordResetPendingSeconds,
  });
  assert.deepEqual(gate, { allowed: true });
});

test("evaluatePasswordResetRequest: after successful change within 24h → PASSWORD_RESET_COOLDOWN", () => {
  const now = new Date("2026-09-09T12:00:00Z");
  const changedAt = new Date(now.getTime() - 60 * 60 * 1000);
  const gate = evaluatePasswordResetRequest({
    user: { ...verifiedUser, passwordChangedAt: changedAt },
    pendingTokenCreatedAt: null,
    now,
    completedSeconds: RateLimitConfig.passwordResetCompletedSeconds,
  });
  assert.deepEqual(gate, { allowed: false, reason: "PASSWORD_RESET_COOLDOWN" });
});

test("evaluatePasswordResetRequest: 24h cooldown elapsed → allowed", () => {
  const now = new Date("2026-09-09T12:00:00Z");
  const changedAt = new Date(now.getTime() - (RateLimitConfig.passwordResetCompletedSeconds + 1) * 1000);
  const gate = evaluatePasswordResetRequest({
    user: { ...verifiedUser, passwordChangedAt: changedAt },
    pendingTokenCreatedAt: null,
    now,
    completedSeconds: RateLimitConfig.passwordResetCompletedSeconds,
  });
  assert.deepEqual(gate, { allowed: true });
});

test("evaluatePasswordResetRequest: registered verified user without pending/cooldown → allowed", () => {
  const gate = evaluatePasswordResetRequest({
    user: verifiedUser,
    pendingTokenCreatedAt: null,
  });
  assert.deepEqual(gate, { allowed: true });
});

test("password reset token is hashed; plaintext is not stored", () => {
  const secret = "test-session-secret-16";
  const token = randomToken();
  const tokenHash = hashSecret(secret, token);
  assert.notEqual(tokenHash, token);
  assert.equal(tokenHash.includes(token), false);
  assert.equal(tokenHash.length, 64);
});

test("password reset durations and IP limit live in RateLimitConfig", () => {
  assert.equal(RateLimitConfig.passwordResetTokenTtlSeconds, 60 * 60);
  assert.equal(RateLimitConfig.passwordResetPendingSeconds, 60 * 60);
  assert.equal(RateLimitConfig.passwordResetCompletedSeconds, 24 * 60 * 60);
  assert.equal(RateLimitConfig.passwordResetIp.maxAttempts, 3);
  assert.equal(RateLimitConfig.passwordResetIp.windowSeconds, 60 * 60);
  assert.equal(getPasswordResetTokenTtlMs(), 60 * 60 * 1000);
  assert.equal(getPasswordResetTokenTtlMs(0), 60 * 60 * 1000);
});

test("password reset response codes A018 A021 A022 A023", () => {
  assert.equal(AuthResponses.errors.EMAIL_NOT_FOUND.code, ErrorCodes.EMAIL_NOT_FOUND);
  assert.equal(AuthResponses.errors.EMAIL_NOT_FOUND.message, "Email belum terdaftar.");
  assert.equal(AuthResponses.errors.PASSWORD_RESET_PENDING.code, "A021");
  assert.equal(AuthResponses.errors.PASSWORD_RESET_COOLDOWN.code, "A022");
  assert.equal(AuthResponses.errors.PASSWORD_RESET_TOKEN_INVALID.code, "A023");
  assert.equal(ErrorCodes.PASSWORD_RESET_PENDING, "A021");
  assert.equal(ErrorCodes.PASSWORD_RESET_COOLDOWN, "A022");
  assert.equal(ErrorCodes.PASSWORD_RESET_TOKEN_INVALID, "A023");
  assert.ok(AuthResponses.success.PASSWORD_RESET_SENT.message.length > 0);
  assert.ok(AuthResponses.success.PASSWORD_RESET_VALID.message.length > 0);
  assert.ok(AuthResponses.success.PASSWORD_RESET_SUCCESS.message.length > 0);
});
