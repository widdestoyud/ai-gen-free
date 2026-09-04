import type { SessionKind } from "@prisma/client";
import {
  ErrorCodes,
  hashSecret,
  isDisposableEmail,
  isEmailFormat,
  normalizeEmail,
  randomOtp,
  randomToken,
  safeEqualHex,
} from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";
import type IORedis from "ioredis";
import { hitLimit } from "./rate-limit.js";

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function appSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET must be set (min 16 chars)");
  }
  return s;
}

export function parseEmailOrThrow(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new AuthError(ErrorCodes.INVALID_EMAIL, "Email tidak valid");
  }
  const email = normalizeEmail(raw);
  if (!isEmailFormat(email) || isDisposableEmail(email)) {
    throw new AuthError(ErrorCodes.INVALID_EMAIL, "Email tidak valid");
  }
  return email;
}

export async function requestOtp(opts: {
  emailRaw: unknown;
  ip: string;
  redis: IORedis;
  mailer: import("@ai-gen-free/core").EmailPort;
  adminOnly: boolean;
}): Promise<void> {
  const email = parseEmailOrThrow(opts.emailRaw);
  const overEmail = await hitLimit(opts.redis, `otp:email:${email}`, 3, 15 * 60);
  const overIp = await hitLimit(opts.redis, `otp:ip:${opts.ip}`, 10, 60 * 60);
  if (overEmail || overIp) {
    throw new AuthError(ErrorCodes.RATE_LIMITED, "Terlalu banyak permintaan", 429);
  }

  if (opts.adminOnly) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== "admin" || user.bannedAt) {
      return;
    }
  }

  const code = randomOtp();
  const codeHash = hashSecret(appSecret(), `${email}:${code}`);
  await prisma.otpChallenge.updateMany({
    where: { email, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await prisma.otpChallenge.create({
    data: {
      email,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      ip: opts.ip,
    },
  });
  await opts.mailer.sendOtp(email, code);
}

export async function verifyOtp(opts: {
  emailRaw: unknown;
  codeRaw: unknown;
  ip: string;
  userAgent: string | undefined;
  kind: SessionKind;
}): Promise<{ token: string; user: { id: string; email: string; role: "user" | "admin" } }> {
  const email = parseEmailOrThrow(opts.emailRaw);
  if (typeof opts.codeRaw !== "string" || !/^\d{6}$/.test(opts.codeRaw)) {
    throw new AuthError(ErrorCodes.OTP_INVALID, "Kode OTP salah");
  }

  const challenge = await prisma.otpChallenge.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) {
    throw new AuthError(ErrorCodes.OTP_INVALID, "Kode OTP salah");
  }
  if (challenge.expiresAt.getTime() < Date.now()) {
    throw new AuthError(ErrorCodes.OTP_EXPIRED, "Kode OTP kedaluwarsa");
  }
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AuthError(ErrorCodes.OTP_LOCKED, "Kode OTP terkunci", 429);
  }

  const expected = hashSecret(appSecret(), `${email}:${opts.codeRaw}`);
  if (!safeEqualHex(expected, challenge.codeHash)) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AuthError(ErrorCodes.OTP_INVALID, "Kode OTP salah");
  }

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });
  await prisma.otpChallenge.updateMany({
    where: { email, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  let user = await prisma.user.findUnique({ where: { email } });
  if (opts.kind === "admin") {
    if (!user || user.role !== "admin" || user.bannedAt) {
      throw new AuthError(ErrorCodes.FORBIDDEN, "Tidak diizinkan", 403);
    }
  } else if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        role: "user",
        emailVerifiedAt: new Date(),
        wallet: { create: {} },
      },
    });
  } else if (user.bannedAt) {
    throw new AuthError(ErrorCodes.FORBIDDEN, "Akun dinonaktifkan", 403);
  } else if (!user.emailVerifiedAt) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
  }

  await prisma.wallet.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  const token = randomToken();
  const tokenHash = hashSecret(appSecret(), token);
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: user.id, kind: opts.kind } }),
    prisma.session.create({
      data: {
        userId: user.id,
        kind: opts.kind,
        tokenHash,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        ip: opts.ip,
        userAgent: opts.userAgent,
      },
    }),
  ]);

  return {
    token,
    user: { id: user.id, email: user.email, role: user.role },
  };
}

export async function userFromCookie(token: string | undefined, kind: SessionKind) {
  if (!token) return null;
  const tokenHash = hashSecret(appSecret(), token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!session || session.kind !== kind || session.expiresAt.getTime() < Date.now()) {
    return null;
  }
  if (session.user.bannedAt) return null;
  return session;
}

export async function logout(token: string | undefined, kind: SessionKind) {
  if (!token) return;
  const tokenHash = hashSecret(appSecret(), token);
  await prisma.session.deleteMany({ where: { tokenHash, kind } });
}
