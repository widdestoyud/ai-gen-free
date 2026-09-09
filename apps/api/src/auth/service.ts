import type { SessionKind } from "@prisma/client";
import {
  AuthResponses,
  ErrorCodes,
  hashSecret,
  isAllowedEmailDomain,
  isDisposableEmail,
  isEmailFormat,
  normalizeEmail,
  randomOtp,
  randomToken,
  safeEqualHex,
  validatePassword,
  hashPassword,
  verifyPassword,
  RateLimitConfig,
  getOtpTtlMs,
  getPasswordResetTokenTtlMs,
  evaluatePasswordResetRequest,
  type PasswordResetDenial,
} from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";
import type IORedis from "ioredis";
import { enforceRateLimit, hitLimit } from "./rate-limit.js";

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 jam
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
    throw new AuthError(AuthResponses.errors.INVALID_EMAIL.code, AuthResponses.errors.INVALID_EMAIL.message);
  }
  const email = normalizeEmail(raw);
  if (!isEmailFormat(email) || isDisposableEmail(email)) {
    throw new AuthError(AuthResponses.errors.INVALID_EMAIL.code, AuthResponses.errors.INVALID_EMAIL.message);
  }
  return email;
}

/**
 * Helper terpakai-ulang (reusable) untuk memastikan user dengan email terdaftar di database.
 * Melempar AuthError EMAIL_NOT_FOUND (A018, HTTP 404) jika email tidak ditemukan.
 */
export async function findUserOrThrow(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AuthError(
      AuthResponses.errors.EMAIL_NOT_FOUND.code,
      AuthResponses.errors.EMAIL_NOT_FOUND.message,
      AuthResponses.errors.EMAIL_NOT_FOUND.status,
    );
  }
  return user;
}

/**
 * A019 hanya jika request ini sudah membawa token/cookie sesi yang masih hidup.
 * Sesi lama di DB tanpa token pada request bukan "sudah login" — login baru akan
 * mengganti sesi itu (satu sesi). lastDeviceId kosong tidak boleh dianggap perangkat sama:
 * itu yang membuat login admin pertama gagal setelah percobaan Fastify sebelumnya.
 */
export async function ensureNotLoggedIn(
  optsOrUserId?:
    | string
    | {
        userId?: string;
        currentSessionToken?: string;
        kind?: SessionKind;
        deviceId?: string;
        lastDeviceId?: string;
      },
  currentSessionToken?: string,
  kindParam: SessionKind = "user",
  deviceIdParam?: string,
) {
  let token: string | undefined;
  let kind: SessionKind = kindParam;

  if (typeof optsOrUserId === "object" && optsOrUserId !== null) {
    token = optsOrUserId.currentSessionToken;
    kind = optsOrUserId.kind ?? "user";
  } else {
    token = currentSessionToken;
    kind = kindParam;
  }

  if (token) {
    const session = await userFromCookie(token, kind);
    if (session) {
      throw new AuthError(
        AuthResponses.errors.ALREADY_LOGGED_IN.code,
        AuthResponses.errors.ALREADY_LOGGED_IN.message,
        AuthResponses.errors.ALREADY_LOGGED_IN.status,
      );
    }
  }
}

/**
 * Registrasi user baru:
 * - Email wajib domain resmi (@gmail, @yahoo, @ymail)
 * - Password minimal 8 karakter, 1 huruf kapital, 1 angka
 * - Mengirim tautan verifikasi email ke user
 */
export async function registerUser(opts: {
  emailRaw: unknown;
  passwordRaw: unknown;
  ip: string;
  redis: IORedis;
  mailer: import("@ai-gen-free/core").EmailPort;
}): Promise<{ message: string; email: string }> {
  const email = parseEmailOrThrow(opts.emailRaw);

  // Validasi domain whitelist
  if (!isAllowedEmailDomain(email)) {
    throw new AuthError(
      AuthResponses.errors.INVALID_EMAIL_DOMAIN.code,
      AuthResponses.errors.INVALID_EMAIL_DOMAIN.message,
      AuthResponses.errors.INVALID_EMAIL_DOMAIN.status,
    );
  }

  // Validasi kekuatan password
  const passCheck = validatePassword(opts.passwordRaw);
  if (!passCheck.valid) {
    throw new AuthError(
      AuthResponses.errors.WEAK_PASSWORD.code,
      passCheck.message ?? AuthResponses.errors.WEAK_PASSWORD.message,
      AuthResponses.errors.WEAK_PASSWORD.status,
    );
  }

  // Rate limit registrasi per IP
  const rl = await enforceRateLimit(opts.redis, `ratelimit:register:ip:${opts.ip}`, RateLimitConfig.register);
  if (!rl.allowed) {
    throw new AuthError(AuthResponses.errors.RATE_LIMITED.code, RateLimitConfig.register.message, 429);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.emailVerifiedAt) {
    throw new AuthError(
      AuthResponses.errors.EMAIL_ALREADY_REGISTERED.code,
      AuthResponses.errors.EMAIL_ALREADY_REGISTERED.message,
      AuthResponses.errors.EMAIL_ALREADY_REGISTERED.status,
    );
  }

  const passwordHash = await hashPassword(opts.passwordRaw as string);

  let userId: string;
  if (existing) {
    // User pernah daftar tapi belum verifikasi email -> perbarui password
    userId = existing.id;
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash },
    });
  } else {
    // User baru
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "user",
        emailVerifiedAt: null,
        wallet: { create: {} },
      },
    });
    userId = created.id;
  }

  // Generate verification token (24 jam)
  const token = randomToken();
  const tokenHash = hashSecret(appSecret(), token);

  await prisma.$transaction([
    prisma.emailVerificationToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      },
    }),
  ]);

  try {
    await opts.mailer.sendVerificationEmail(email, token);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    console.error("verification mail failed", raw);
    throw new AuthError(
      AuthResponses.errors.EMAIL_UNAVAILABLE.code,
      AuthResponses.errors.EMAIL_UNAVAILABLE.message,
      503,
    );
  }

  return {
    message: AuthResponses.success.REGISTER.message,
    email,
  };
}

/**
 * Validasi token email setelah mendaftar.
 */
export async function validateEmailToken(tokenRaw: unknown): Promise<{ message: string }> {
  if (typeof tokenRaw !== "string" || !tokenRaw.trim()) {
    throw new AuthError(
      AuthResponses.errors.VERIFICATION_TOKEN_INVALID.code,
      AuthResponses.errors.VERIFICATION_TOKEN_INVALID.message,
      400,
    );
  }

  const token = tokenRaw.trim();
  const tokenHash = hashSecret(appSecret(), token);

  const record = await prisma.emailVerificationToken.findFirst({
    where: {
      tokenHash,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record) {
    throw new AuthError(
      AuthResponses.errors.VERIFICATION_TOKEN_INVALID.code,
      AuthResponses.errors.VERIFICATION_TOKEN_INVALID.message,
      400,
    );
  }

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);

  return { message: AuthResponses.success.EMAIL_VERIFIED.message };
}

/**
 * Login user menggunakan email dan password:
 * - Menolak bila belum verifikasi email
 * - Deteksi ganti device / first login -> kirim OTP ke email
 * - Sesi tunggal (login sukses mencabut sesi lama)
 */
export async function loginUser(opts: {
  emailRaw: unknown;
  passwordRaw: unknown;
  deviceIdRaw?: unknown;
  sessionTokenRaw?: string;
  ip: string;
  userAgent?: string;
  redis: IORedis;
  mailer: import("@ai-gen-free/core").EmailPort;
}): Promise<
  | { requiresOtp: true; deviceId: string; message: string; email: string }
  | { requiresOtp: false; token: string; user: { id: string; email: string; role: "user" | "admin" }; message: string }
> {
  const email = parseEmailOrThrow(opts.emailRaw);
  if (typeof opts.passwordRaw !== "string" || !opts.passwordRaw) {
    throw new AuthError(AuthResponses.errors.INVALID_CREDENTIALS.code, AuthResponses.errors.INVALID_CREDENTIALS.message, 401);
  }

  // Mencegah login jika request membawa session token aktif
  await ensureNotLoggedIn({ currentSessionToken: opts.sessionTokenRaw, kind: "user" });

  const user = await findUserOrThrow(email);

  // Rate limit login attempt per email + IP
  const rl = await enforceRateLimit(opts.redis, `ratelimit:login:${email}:${opts.ip}`, RateLimitConfig.login);
  if (!rl.allowed) {
    throw new AuthError(AuthResponses.errors.RATE_LIMITED.code, RateLimitConfig.login.message, 429);
  }

  if (!user.passwordHash) {
    throw new AuthError(
      AuthResponses.errors.INVALID_CREDENTIALS.code,
      AuthResponses.errors.INVALID_CREDENTIALS.message,
      AuthResponses.errors.INVALID_CREDENTIALS.status,
    );
  }

  const validPassword = await verifyPassword(opts.passwordRaw, user.passwordHash);
  if (!validPassword) {
    throw new AuthError(
      AuthResponses.errors.INVALID_CREDENTIALS.code,
      AuthResponses.errors.INVALID_CREDENTIALS.message,
      AuthResponses.errors.INVALID_CREDENTIALS.status,
    );
  }

  if (!user.emailVerifiedAt) {
    throw new AuthError(AuthResponses.errors.EMAIL_NOT_VERIFIED.code, AuthResponses.errors.EMAIL_NOT_VERIFIED.message, 403);
  }

  if (user.bannedAt) {
    throw new AuthError(AuthResponses.errors.FORBIDDEN.code, AuthResponses.errors.FORBIDDEN.message, 403);
  }

  // Tentukan identifier device
  const deviceId =
    typeof opts.deviceIdRaw === "string" && opts.deviceIdRaw.trim().length > 0
      ? opts.deviceIdRaw.trim()
      : hashSecret(appSecret(), `${opts.userAgent ?? "default-agent"}:${opts.ip}`);

  // Mencegah login jika user sudah dalam posisi login pada perangkat ini
  await ensureNotLoggedIn({
    userId: user.id,
    currentSessionToken: opts.sessionTokenRaw,
    kind: "user",
    deviceId,
    lastDeviceId: user.lastDeviceId ?? undefined,
  });

  const isFirstLogin = !user.lastDeviceId || !user.lastLoginAt;
  const isDeviceChanged = user.lastDeviceId !== deviceId;

  // Jika login pertama kali ATAU ganti device -> kirim OTP untuk verifikasi perangkat
  if (isFirstLogin || isDeviceChanged) {
    const activeChallenge = await prisma.otpChallenge.findFirst({
      where: {
        email,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (activeChallenge) {
      return {
        requiresOtp: true,
        deviceId,
        email,
        message: "Login dari perangkat baru terdeteksi. Kode OTP sebelumnya masih berlaku dan telah dikirim ke email Anda.",
      };
    }

    // Rate limit pengiriman OTP (maks 3x per 30 menit)
    const otpRl = await enforceRateLimit(opts.redis, `ratelimit:otp:request:${email}`, RateLimitConfig.otpRequest);
    if (!otpRl.allowed) {
      throw new AuthError(AuthResponses.errors.RATE_LIMITED.code, RateLimitConfig.otpRequest.message, 429);
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
        expiresAt: new Date(Date.now() + getOtpTtlMs()),
        ip: opts.ip,
        attempts: 0,
      },
    });

    try {
      await opts.mailer.sendOtp(email, code);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      console.error("otp mail failed", raw);
      throw new AuthError(
        AuthResponses.errors.EMAIL_UNAVAILABLE.code,
        AuthResponses.errors.EMAIL_UNAVAILABLE.message,
        503,
      );
    }

    return {
      requiresOtp: true,
      deviceId,
      email,
      message: AuthResponses.errors.NEW_DEVICE_OTP_REQUIRED.message,
    };
  }

  // Jika device sama -> langsung masuk, cabut semua sesi lama (single session)
  const token = randomToken();
  const tokenHash = hashSecret(appSecret(), token);

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: user.id, kind: "user" } }),
    prisma.session.create({
      data: {
        userId: user.id,
        kind: "user",
        tokenHash,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        ip: opts.ip,
        userAgent: opts.userAgent,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
  ]);

  return {
    requiresOtp: false,
    token,
    user: { id: user.id, email: user.email, role: user.role },
    message: AuthResponses.success.LOGIN_SUCCESS.message,
  };
}

/**
 * Permintaan kirim ulang OTP (/auth/otp):
 * - Dibatasi maksimal 3x per 30 menit.
 */
export async function resendOtp(opts: {
  emailRaw: unknown;
  sessionTokenRaw?: string;
  ip: string;
  redis: IORedis;
  mailer: import("@ai-gen-free/core").EmailPort;
}): Promise<{ message: string }> {
  const email = parseEmailOrThrow(opts.emailRaw);

  const user = await findUserOrThrow(email);
  if (user.bannedAt) {
    throw new AuthError(AuthResponses.errors.FORBIDDEN.code, AuthResponses.errors.FORBIDDEN.message, 403);
  }

  // Mencegah request OTP jika akun sudah dalam posisi login
  await ensureNotLoggedIn(user.id, opts.sessionTokenRaw);

  const activeChallenge = await prisma.otpChallenge.findFirst({
    where: {
      email,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (activeChallenge) {
    throw new AuthError(
      AuthResponses.errors.OTP_ACTIVE_EXISTING.code,
      AuthResponses.errors.OTP_ACTIVE_EXISTING.message,
      AuthResponses.errors.OTP_ACTIVE_EXISTING.status,
    );
  }

  // Rate limit: 3x per 30 menit
  const rl = await enforceRateLimit(opts.redis, `ratelimit:otp:request:${email}`, RateLimitConfig.otpRequest);
  if (!rl.allowed) {
    throw new AuthError(AuthResponses.errors.RATE_LIMITED.code, RateLimitConfig.otpRequest.message, 429);
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
      expiresAt: new Date(Date.now() + getOtpTtlMs()),
      ip: opts.ip,
      attempts: 0,
    },
  });

  try {
    await opts.mailer.sendOtp(email, code);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    console.error("otp mail failed", raw);
    throw new AuthError(
      AuthResponses.errors.EMAIL_UNAVAILABLE.code,
      AuthResponses.errors.EMAIL_UNAVAILABLE.message,
      503,
    );
  }

  return { message: AuthResponses.success.OTP_SENT.message };
}

/**
 * Validasi OTP (/auth/otp-validation):
 * - Jika 3x salah input OTP -> kode OTP dikunci permanen
 * - Sukses validasi -> update lastDeviceId, cabut sesi lama (single session)
 */
export async function validateOtp(opts: {
  emailRaw: unknown;
  codeRaw: unknown;
  deviceIdRaw?: unknown;
  sessionTokenRaw?: string;
  ip: string;
  userAgent?: string;
  kind?: SessionKind;
}): Promise<{ token: string; user: { id: string; email: string; role: "user" | "admin" }; message: string }> {
  const email = parseEmailOrThrow(opts.emailRaw);
  const kind: SessionKind = opts.kind ?? "user";

  const user = await findUserOrThrow(email);
  if (user.bannedAt) {
    throw new AuthError(AuthResponses.errors.FORBIDDEN.code, AuthResponses.errors.FORBIDDEN.message, 403);
  }

  // Mencegah validasi OTP jika akun sudah dalam posisi login
  await ensureNotLoggedIn(user.id, opts.sessionTokenRaw);

  if (typeof opts.codeRaw !== "string" || !/^\d{6}$/.test(opts.codeRaw)) {
    throw new AuthError(AuthResponses.errors.OTP_INVALID.code, AuthResponses.errors.OTP_INVALID.message);
  }

  const challenge = await prisma.otpChallenge.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) {
    throw new AuthError(AuthResponses.errors.OTP_INVALID.code, AuthResponses.errors.OTP_INVALID.message);
  }

  if (challenge.expiresAt.getTime() < Date.now()) {
    throw new AuthError(AuthResponses.errors.OTP_EXPIRED.code, AuthResponses.errors.OTP_EXPIRED.message);
  }

  // Jika sudah 3x salah sebelumnya, tolak langsung
  if (challenge.attempts >= RateLimitConfig.otpValidation.maxAttempts) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    throw new AuthError(AuthResponses.errors.OTP_LOCKED.code, RateLimitConfig.otpValidation.message, 429);
  }

  const expected = hashSecret(appSecret(), `${email}:${opts.codeRaw}`);
  if (!safeEqualHex(expected, challenge.codeHash)) {
    const newAttempts = challenge.attempts + 1;
    if (newAttempts >= RateLimitConfig.otpValidation.maxAttempts) {
      // Kunci permanen
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: newAttempts, consumedAt: new Date() },
      });
      throw new AuthError(AuthResponses.errors.OTP_LOCKED.code, RateLimitConfig.otpValidation.message, 429);
    } else {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: newAttempts },
      });
      const remaining = RateLimitConfig.otpValidation.maxAttempts - newAttempts;
      throw new AuthError(
        AuthResponses.errors.OTP_INVALID.code,
        `Kode OTP salah. Sisa percobaan: ${remaining}x.`,
        400,
      );
    }
  }

  // OTP Benar -> Burn challenge
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });
  await prisma.otpChallenge.updateMany({
    where: { email, consumedAt: null },
    data: { consumedAt: new Date() },
  });


  const deviceId =
    typeof opts.deviceIdRaw === "string" && opts.deviceIdRaw.trim().length > 0
      ? opts.deviceIdRaw.trim()
      : hashSecret(appSecret(), `${opts.userAgent ?? "default-agent"}:${opts.ip}`);

  // Sesi tunggal: cabut semua sesi lama
  const token = randomToken();
  const tokenHash = hashSecret(appSecret(), token);

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: user.id, kind } }),
    prisma.session.create({
      data: {
        userId: user.id,
        kind,
        tokenHash,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        ip: opts.ip,
        userAgent: opts.userAgent,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        lastDeviceId: deviceId,
        lastLoginAt: new Date(),
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      },
    }),
  ]);

  return {
    token,
    user: { id: user.id, email: user.email, role: user.role },
    message: AuthResponses.success.OTP_VALIDATED.message,
  };
}

/**
 * Ambil data profil user saat ini (IDOR SAFE: identitas dari session.userId).
 */
export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      phoneNumber: true,
      ktp: true,
      address: true,
      role: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) {
    throw new AuthError(AuthResponses.errors.UNAUTHENTICATED.code, AuthResponses.errors.UNAUTHENTICATED.message, 401);
  }
  return user;
}

/**
 * Update data profil user (IDOR SAFE: identitas mutlak dari session.userId).
 * Parameter userId dari request body atau query sengaja diabaikan.
 */
export async function updateUserProfile(
  userId: string,
  data: {
    displayName?: unknown;
    phoneNumber?: unknown;
    ktp?: unknown;
    address?: unknown;
  },
) {
  const updateData: {
    displayName?: string;
    phoneNumber?: string;
    ktp?: string;
    address?: string;
  } = {};

  if (typeof data.displayName === "string") updateData.displayName = data.displayName.trim();
  if (typeof data.phoneNumber === "string") updateData.phoneNumber = data.phoneNumber.trim();
  if (typeof data.ktp === "string") updateData.ktp = data.ktp.trim();
  if (typeof data.address === "string") updateData.address = data.address.trim();

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      displayName: true,
      phoneNumber: true,
      ktp: true,
      address: true,
      role: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    user,
    message: AuthResponses.success.PROFILE_UPDATED.message,
  };
}

/**
 * Legacy requestOtp (kompatibilitas admin & flow lama)
 */
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
    throw new AuthError(AuthResponses.errors.RATE_LIMITED.code, AuthResponses.errors.RATE_LIMITED.message, 429);
  }

  if (opts.adminOnly) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== "admin" || user.bannedAt) {
      return;
    }
  }

  const activeChallenge = await prisma.otpChallenge.findFirst({
    where: {
      email,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (activeChallenge) {
    throw new AuthError(
      AuthResponses.errors.OTP_ACTIVE_EXISTING.code,
      AuthResponses.errors.OTP_ACTIVE_EXISTING.message,
      AuthResponses.errors.OTP_ACTIVE_EXISTING.status,
    );
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
      expiresAt: new Date(Date.now() + getOtpTtlMs()),
      ip: opts.ip,
      attempts: 0,
    },
  });
  try {
    await opts.mailer.sendOtp(email, code);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    console.error("otp mail failed", raw);
    const credits = /insufficient credits/i.test(raw);
    throw new AuthError(
      AuthResponses.errors.EMAIL_UNAVAILABLE.code,
      credits
        ? "Kuota email SMTP habis. Isi kredit penyedia email, lalu coba lagi."
        : AuthResponses.errors.EMAIL_UNAVAILABLE.message,
      503,
    );
  }
}

/**
 * Legacy verifyOtp (kompatibilitas admin & flow lama)
 */
export async function verifyOtp(opts: {
  emailRaw: unknown;
  codeRaw: unknown;
  ip: string;
  userAgent: string | undefined;
  kind: SessionKind;
}): Promise<{ token: string; user: { id: string; email: string; role: "user" | "admin" } }> {
  const email = parseEmailOrThrow(opts.emailRaw);
  if (typeof opts.codeRaw !== "string" || !/^\d{6}$/.test(opts.codeRaw)) {
    throw new AuthError(AuthResponses.errors.OTP_INVALID.code, AuthResponses.errors.OTP_INVALID.message);
  }

  const challenge = await prisma.otpChallenge.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) {
    throw new AuthError(AuthResponses.errors.OTP_INVALID.code, AuthResponses.errors.OTP_INVALID.message);
  }
  if (challenge.expiresAt.getTime() < Date.now()) {
    throw new AuthError(AuthResponses.errors.OTP_EXPIRED.code, AuthResponses.errors.OTP_EXPIRED.message);
  }
  if (challenge.attempts >= RateLimitConfig.otpValidation.maxAttempts) {
    throw new AuthError(AuthResponses.errors.OTP_LOCKED.code, RateLimitConfig.otpValidation.message, 429);
  }

  const expected = hashSecret(appSecret(), `${email}:${opts.codeRaw}`);
  if (!safeEqualHex(expected, challenge.codeHash)) {
    const newAttempts = challenge.attempts + 1;
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: newAttempts },
    });
    if (newAttempts >= RateLimitConfig.otpValidation.maxAttempts) {
      throw new AuthError(AuthResponses.errors.OTP_LOCKED.code, RateLimitConfig.otpValidation.message, 429);
    }
    throw new AuthError(AuthResponses.errors.OTP_INVALID.code, AuthResponses.errors.OTP_INVALID.message);
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
      throw new AuthError(AuthResponses.errors.FORBIDDEN.code, AuthResponses.errors.FORBIDDEN.message, 403);
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
    throw new AuthError(AuthResponses.errors.FORBIDDEN.code, AuthResponses.errors.FORBIDDEN.message, 403);
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

export function parseAdminIdentifier(raw: unknown): { identifier: string; internalEmail: string } {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new AuthError(AuthResponses.errors.INVALID_EMAIL.code, "Username atau email wajib diisi.");
  }
  const clean = raw.trim();
  if (clean.includes("@")) {
    const email = normalizeEmail(clean);
    if (!isEmailFormat(email)) {
      throw new AuthError(AuthResponses.errors.INVALID_EMAIL.code, AuthResponses.errors.INVALID_EMAIL.message);
    }
    return { identifier: email, internalEmail: email };
  } else {
    if (clean.length < 3) {
      throw new AuthError(AuthResponses.errors.INVALID_EMAIL.code, "Username minimal 3 karakter.");
    }
    const cleanUser = clean.toLowerCase();
    return { identifier: cleanUser, internalEmail: `${cleanUser}@admin.local` };
  }
}

/**
 * Login admin menggunakan username (atau email) dan password (tanpa OTP & verifikasi email):
 * - Memastikan user.role === "admin"
 * - Membuat sesi kind "admin" dan mengembalikan token
 */
export async function loginAdmin(opts: {
  usernameRaw?: unknown;
  emailRaw?: unknown;
  passwordRaw: unknown;
  deviceIdRaw?: unknown;
  sessionTokenRaw?: string;
  ip: string;
  userAgent?: string;
  redis: IORedis;
}): Promise<{ token: string; user: { id: string; username: string; role: "admin" }; message: string }> {
  // Mencegah login jika request membawa session token admin aktif
  await ensureNotLoggedIn({ currentSessionToken: opts.sessionTokenRaw, kind: "admin" });

  const { identifier, internalEmail } = parseAdminIdentifier(opts.usernameRaw ?? opts.emailRaw);
  if (typeof opts.passwordRaw !== "string" || !opts.passwordRaw) {
    throw new AuthError(AuthResponses.errors.INVALID_CREDENTIALS.code, AuthResponses.errors.INVALID_CREDENTIALS.message, 401);
  }

  // Rate limit admin login per IP + identifier
  const rl = await enforceRateLimit(opts.redis, `ratelimit:admin:login:${identifier}:${opts.ip}`, RateLimitConfig.login);
  if (!rl.allowed) {
    throw new AuthError(AuthResponses.errors.RATE_LIMITED.code, RateLimitConfig.login.message, 429);
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: internalEmail }, { email: identifier }],
    },
  });

  if (!user) {
    throw new AuthError(AuthResponses.errors.INVALID_CREDENTIALS.code, AuthResponses.errors.INVALID_CREDENTIALS.message, 401);
  }

  if (user.role !== "admin") {
    throw new AuthError(AuthResponses.errors.FORBIDDEN.code, "Akun Anda tidak memiliki hak akses sebagai admin.", 403);
  }

  if (user.bannedAt) {
    throw new AuthError(AuthResponses.errors.FORBIDDEN.code, AuthResponses.errors.FORBIDDEN.message, 403);
  }

  if (!user.passwordHash) {
    throw new AuthError(AuthResponses.errors.INVALID_CREDENTIALS.code, AuthResponses.errors.INVALID_CREDENTIALS.message, 401);
  }

  const validPassword = await verifyPassword(opts.passwordRaw, user.passwordHash);
  if (!validPassword) {
    throw new AuthError(AuthResponses.errors.INVALID_CREDENTIALS.code, AuthResponses.errors.INVALID_CREDENTIALS.message, 401);
  }

  const deviceId =
    typeof opts.deviceIdRaw === "string" && opts.deviceIdRaw.trim().length > 0
      ? opts.deviceIdRaw.trim()
      : hashSecret(appSecret(), `${opts.userAgent ?? "default-agent"}:${opts.ip}`);

  // Mencegah login jika admin sudah dalam posisi login pada perangkat ini
  await ensureNotLoggedIn({
    userId: user.id,
    currentSessionToken: opts.sessionTokenRaw,
    kind: "admin",
    deviceId,
    lastDeviceId: user.lastDeviceId ?? undefined,
  });

  const token = randomToken();
  const tokenHash = hashSecret(appSecret(), token);

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: user.id, kind: "admin" } }),
    prisma.session.create({
      data: {
        userId: user.id,
        kind: "admin",
        tokenHash,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        ip: opts.ip,
        userAgent: opts.userAgent,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastDeviceId: deviceId },
    }),
  ]);

  return {
    token,
    user: { id: user.id, username: identifier, role: "admin" },
    message: AuthResponses.success.ADMIN_LOGIN_SUCCESS.message,
  };
}

/**
 * Registrasi admin baru via username (atau email) & password:
 * - role: "admin", emailVerifiedAt: new Date() (tanpa OTP/verifikasi email)
 */
export async function registerAdmin(opts: {
  usernameRaw?: unknown;
  emailRaw?: unknown;
  passwordRaw: unknown;
  ip: string;
  redis: IORedis;
}): Promise<{ message: string; user: { id: string; username: string; role: string } }> {
  const { identifier, internalEmail } = parseAdminIdentifier(opts.usernameRaw ?? opts.emailRaw);

  if (internalEmail.includes("@") && !internalEmail.endsWith("@admin.local")) {
    if (!isAllowedEmailDomain(internalEmail)) {
      throw new AuthError(
        AuthResponses.errors.INVALID_EMAIL_DOMAIN.code,
        AuthResponses.errors.INVALID_EMAIL_DOMAIN.message,
        AuthResponses.errors.INVALID_EMAIL_DOMAIN.status,
      );
    }
  }

  const passCheck = validatePassword(opts.passwordRaw);
  if (!passCheck.valid) {
    throw new AuthError(
      AuthResponses.errors.WEAK_PASSWORD.code,
      passCheck.message ?? AuthResponses.errors.WEAK_PASSWORD.message,
      AuthResponses.errors.WEAK_PASSWORD.status,
    );
  }

  const rl = await enforceRateLimit(opts.redis, `ratelimit:register:ip:${opts.ip}`, RateLimitConfig.register);
  if (!rl.allowed) {
    throw new AuthError(AuthResponses.errors.RATE_LIMITED.code, RateLimitConfig.register.message, 429);
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: internalEmail }, { email: identifier }],
    },
  });
  if (existing) {
    throw new AuthError(
      AuthResponses.errors.EMAIL_ALREADY_REGISTERED.code,
      "Username atau email ini sudah terdaftar.",
      AuthResponses.errors.EMAIL_ALREADY_REGISTERED.status,
    );
  }

  const passwordHash = await hashPassword(opts.passwordRaw as string);

  const created = await prisma.user.create({
    data: {
      email: internalEmail,
      passwordHash,
      role: "admin",
      emailVerifiedAt: new Date(),
      wallet: { create: {} },
    },
  });

  return {
    message: AuthResponses.success.ADMIN_REGISTER_SUCCESS.message,
    user: {
      id: created.id,
      username: identifier,
      role: created.role,
    },
  };
}

function throwPasswordResetDenied(reason: PasswordResetDenial): never {
  if (reason === "EMAIL_NOT_FOUND") {
    throw new AuthError(
      AuthResponses.errors.EMAIL_NOT_FOUND.code,
      AuthResponses.errors.EMAIL_NOT_FOUND.message,
      AuthResponses.errors.EMAIL_NOT_FOUND.status,
    );
  }
  if (reason === "FORBIDDEN") {
    throw new AuthError(
      AuthResponses.errors.FORBIDDEN.code,
      AuthResponses.errors.FORBIDDEN.message,
      AuthResponses.errors.FORBIDDEN.status,
    );
  }
  if (reason === "PASSWORD_RESET_COOLDOWN") {
    throw new AuthError(
      AuthResponses.errors.PASSWORD_RESET_COOLDOWN.code,
      AuthResponses.errors.PASSWORD_RESET_COOLDOWN.message,
      AuthResponses.errors.PASSWORD_RESET_COOLDOWN.status,
    );
  }
  throw new AuthError(
    AuthResponses.errors.PASSWORD_RESET_PENDING.code,
    AuthResponses.errors.PASSWORD_RESET_PENDING.message,
    AuthResponses.errors.PASSWORD_RESET_PENDING.status,
  );
}

function parseResetTokenOrThrow(tokenRaw: unknown): string {
  if (typeof tokenRaw !== "string" || !tokenRaw.trim()) {
    throw new AuthError(
      AuthResponses.errors.PASSWORD_RESET_TOKEN_INVALID.code,
      AuthResponses.errors.PASSWORD_RESET_TOKEN_INVALID.message,
      AuthResponses.errors.PASSWORD_RESET_TOKEN_INVALID.status,
    );
  }
  return tokenRaw.trim();
}

async function findLivePasswordResetToken(token: string) {
  const tokenHash = hashSecret(appSecret(), token);
  const record = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!record) {
    throw new AuthError(
      AuthResponses.errors.PASSWORD_RESET_TOKEN_INVALID.code,
      AuthResponses.errors.PASSWORD_RESET_TOKEN_INVALID.message,
      AuthResponses.errors.PASSWORD_RESET_TOKEN_INVALID.status,
    );
  }
  return record;
}

/**
 * Permintaan reset kata sandi:
 * - Email belum terdaftar / belum verifikasi / tanpa password → A018
 * - Rate limit per IP (default 3x / jam) dari RateLimitConfig.passwordResetIp
 * - Token pending belum dikonfirmasi → A021 (1 jam, config)
 * - Password baru saja diganti → A022 (24 jam, config)
 */
export async function requestPasswordReset(opts: {
  emailRaw: unknown;
  ip: string;
  redis: IORedis;
  mailer: import("@ai-gen-free/core").EmailPort;
}): Promise<{ message: string; email: string }> {
  const email = parseEmailOrThrow(opts.emailRaw);

  const rl = await enforceRateLimit(
    opts.redis,
    `ratelimit:password-reset:ip:${opts.ip}`,
    RateLimitConfig.passwordResetIp,
  );
  if (!rl.allowed) {
    throw new AuthError(
      AuthResponses.errors.RATE_LIMITED.code,
      RateLimitConfig.passwordResetIp.message,
      AuthResponses.errors.RATE_LIMITED.status,
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const pending = user
    ? await prisma.passwordResetToken.findFirst({
        where: { userId: user.id, consumedAt: null },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const gate = evaluatePasswordResetRequest({
    user: user
      ? {
          emailVerifiedAt: user.emailVerifiedAt,
          passwordHash: user.passwordHash,
          bannedAt: user.bannedAt,
          passwordChangedAt: user.passwordChangedAt,
        }
      : null,
    pendingTokenCreatedAt: pending?.createdAt ?? null,
    pendingSeconds: RateLimitConfig.passwordResetPendingSeconds,
    completedSeconds: RateLimitConfig.passwordResetCompletedSeconds,
  });
  if (!gate.allowed) {
    throwPasswordResetDenied(gate.reason);
  }
  if (!user) {
    throwPasswordResetDenied("EMAIL_NOT_FOUND");
  }

  const token = randomToken();
  const tokenHash = hashSecret(appSecret(), token);
  const created = await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + getPasswordResetTokenTtlMs(RateLimitConfig.passwordResetTokenTtlSeconds)),
        ip: opts.ip,
      },
    });
  });

  try {
    await opts.mailer.sendPasswordResetEmail(email, token);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    console.error("password reset mail failed", raw);
    await prisma.passwordResetToken.update({
      where: { id: created.id },
      data: { consumedAt: new Date() },
    });
    throw new AuthError(
      AuthResponses.errors.EMAIL_UNAVAILABLE.code,
      AuthResponses.errors.EMAIL_UNAVAILABLE.message,
      AuthResponses.errors.EMAIL_UNAVAILABLE.status,
    );
  }

  return {
    message: AuthResponses.success.PASSWORD_RESET_SENT.message,
    email,
  };
}

/**
 * Validasi tautan reset (tidak consume token). Dipakai setelah klik email.
 */
export async function validatePasswordResetToken(tokenRaw: unknown): Promise<{ message: string }> {
  const token = parseResetTokenOrThrow(tokenRaw);
  await findLivePasswordResetToken(token);
  return { message: AuthResponses.success.PASSWORD_RESET_VALID.message };
}

/**
 * Konfirmasi password baru. Token sekali pakai. Mencabut seluruh sesi.
 */
export async function confirmPasswordReset(opts: {
  tokenRaw: unknown;
  passwordRaw: unknown;
}): Promise<{ message: string }> {
  const passCheck = validatePassword(opts.passwordRaw);
  if (!passCheck.valid) {
    throw new AuthError(
      AuthResponses.errors.WEAK_PASSWORD.code,
      passCheck.message ?? AuthResponses.errors.WEAK_PASSWORD.message,
      AuthResponses.errors.WEAK_PASSWORD.status,
    );
  }

  const token = parseResetTokenOrThrow(opts.tokenRaw);
  const record = await findLivePasswordResetToken(token);
  const passwordHash = await hashPassword(opts.passwordRaw as string);
  const now = new Date();

  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { consumedAt: now },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, consumedAt: null, id: { not: record.id } },
      data: { consumedAt: now },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, passwordChangedAt: now },
    }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);

  return { message: AuthResponses.success.PASSWORD_RESET_SUCCESS.message };
}


