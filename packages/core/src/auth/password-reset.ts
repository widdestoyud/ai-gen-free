import { RateLimitConfig } from "../config/rate-limit.config.js";

export type PasswordResetDenial =
  | "EMAIL_NOT_FOUND"
  | "FORBIDDEN"
  | "PASSWORD_RESET_COOLDOWN"
  | "PASSWORD_RESET_PENDING";

export type PasswordResetUserSnapshot = {
  emailVerifiedAt: Date | null;
  passwordHash: string | null;
  bannedAt: Date | null;
  passwordChangedAt: Date | null;
};

export type PasswordResetGate =
  | { allowed: true }
  | { allowed: false; reason: PasswordResetDenial };

/**
 * Gerbang domain reset kata sandi. Durasi pending/cooldown dibaca dari RateLimitConfig
 * kecuali dipasok eksplisit (untuk tes).
 */
export function evaluatePasswordResetRequest(input: {
  user: PasswordResetUserSnapshot | null;
  pendingTokenCreatedAt: Date | null;
  now?: Date;
  pendingSeconds?: number;
  completedSeconds?: number;
}): PasswordResetGate {
  const now = input.now ?? new Date();
  const pendingSeconds = input.pendingSeconds ?? RateLimitConfig.passwordResetPendingSeconds;
  const completedSeconds = input.completedSeconds ?? RateLimitConfig.passwordResetCompletedSeconds;

  if (!input.user || !input.user.emailVerifiedAt || !input.user.passwordHash) {
    return { allowed: false, reason: "EMAIL_NOT_FOUND" };
  }

  if (input.user.bannedAt) {
    return { allowed: false, reason: "FORBIDDEN" };
  }

  if (input.user.passwordChangedAt) {
    const until = input.user.passwordChangedAt.getTime() + completedSeconds * 1000;
    if (now.getTime() < until) {
      return { allowed: false, reason: "PASSWORD_RESET_COOLDOWN" };
    }
  }

  if (input.pendingTokenCreatedAt) {
    const until = input.pendingTokenCreatedAt.getTime() + pendingSeconds * 1000;
    if (now.getTime() < until) {
      return { allowed: false, reason: "PASSWORD_RESET_PENDING" };
    }
  }

  return { allowed: true };
}
