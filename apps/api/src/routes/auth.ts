import type { FastifyInstance } from "fastify";
import { AuthResponses, ErrorCodes } from "@ai-gen-free/core";
import {
  AuthError,
  confirmPasswordReset,
  getUserProfile,
  loginUser,
  logout,
  registerUser,
  requestOtp,
  requestPasswordReset,
  resendOtp,
  updateUserProfile,
  userFromCookie,
  validateEmailToken,
  validateOtp,
  validatePasswordResetToken,
  verifyOtp,
} from "../auth/service.js";
import { basicAuthorized } from "../auth/basic.js";
import type { EmailPort } from "@ai-gen-free/core";
import type IORedis from "ioredis";

const cookieSecure = process.env.COOKIE_SECURE === "true";
const cookieOpts = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: cookieSecure,
  maxAge: 7 * 24 * 60 * 60,
};

function clientIp(req: { ip: string; headers: Record<string, unknown> }): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]!.trim();
  }
  return req.ip;
}

function sendAuthError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: unknown,
  req?: { id?: string },
) {
  if (err instanceof AuthError) {
    const txid = req?.id;
    return reply.status(err.status).send({
      ...(txid ? { transaction_id: txid } : {}),
      error: { code: err.code, message: err.message },
    });
  }
  throw err;
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  deps: { redis: IORedis; mailer: EmailPort },
) {
  // -------------------------------------------------------------
  // 1. REGISTRASI USER BARU (/user/register & /api/user/register)
  // Input: email, password
  // -------------------------------------------------------------
  const handleRegister = async (req: any, reply: any) => {
    try {
      const body = (req.body ?? {}) as { email?: unknown; password?: unknown };
      const result = await registerUser({
        emailRaw: body.email,
        passwordRaw: body.password,
        ip: clientIp(req),
        redis: deps.redis,
        mailer: deps.mailer,
      });
      return reply.status(201).send({
        ok: true,
        message: result.message,
        email: result.email,
      });
    } catch (err) {
      return sendAuthError(reply, err, req);
    }
  };
  app.post("/user/register", handleRegister);
  app.post("/api/user/register", handleRegister);

  // -------------------------------------------------------------
  // 2. VALIDASI EMAIL TOKEN (/auth/email-validation & /api/auth/email-validation)
  // Input: token
  // -------------------------------------------------------------
  const handleEmailValidation = async (req: any, reply: any) => {
    try {
      const body = (req.body ?? {}) as { token?: unknown };
      const result = await validateEmailToken(body.token);
      return { ok: true, message: result.message };
    } catch (err) {
      return sendAuthError(reply, err, req);
    }
  };
  app.post("/auth/email-validation", handleEmailValidation);
  app.post("/api/auth/email-validation", handleEmailValidation);

  // -------------------------------------------------------------
  // 3. LOGIN USER (/user/login & /api/user/login)
  // Input: email, password, deviceId?
  // -------------------------------------------------------------
  const handleLogin = async (req: any, reply: any) => {
    try {
      const body = (req.body ?? {}) as {
        email?: unknown;
        password?: unknown;
        deviceId?: unknown;
        token?: unknown;
        sessionToken?: unknown;
      };
      const deviceIdHeader = req.headers["x-device-id"];
      const deviceId = body.deviceId ?? deviceIdHeader;
      const sessionToken =
        (typeof body.token === "string" && body.token.trim().length > 0 ? body.token.trim() : undefined) ??
        (typeof body.sessionToken === "string" && body.sessionToken.trim().length > 0 ? body.sessionToken.trim() : undefined) ??
        req.cookies?.sid ??
        (typeof req.headers["x-session-token"] === "string" ? req.headers["x-session-token"] : undefined);

      const result = await loginUser({
        emailRaw: body.email,
        passwordRaw: body.password,
        deviceIdRaw: deviceId,
        sessionTokenRaw: sessionToken,
        ip: clientIp(req),
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
        redis: deps.redis,
        mailer: deps.mailer,
      });

      if (result.requiresOtp) {
        return reply.status(200).send({
          ok: true,
          requiresOtp: true,
          deviceId: result.deviceId,
          email: result.email,
          message: result.message,
        });
      }

      reply.setCookie("sid", result.token, cookieOpts);
      return reply.status(200).send({
        ok: true,
        user: result.user,
        sessionToken: result.token,
        message: result.message,
      });
    } catch (err) {
      return sendAuthError(reply, err, req);
    }
  };
  app.post("/user/login", handleLogin);
  app.post("/api/user/login", handleLogin);

  // -------------------------------------------------------------
  // 4. REQUEST / RESEND OTP (/auth/otp & /api/auth/otp)
  // Input: email
  // Maksimal 3x per 30 menit
  // -------------------------------------------------------------
  const handleResendOtp = async (req: any, reply: any) => {
    try {
      const body = (req.body ?? {}) as { email?: unknown };
      const sessionToken = req.cookies?.sid ?? req.headers["x-session-token"];
      const result = await resendOtp({
        emailRaw: body.email,
        sessionTokenRaw: sessionToken,
        ip: clientIp(req),
        redis: deps.redis,
        mailer: deps.mailer,
      });
      return { ok: true, message: result.message };
    } catch (err) {
      return sendAuthError(reply, err, req);
    }
  };
  app.post("/auth/otp", handleResendOtp);
  app.post("/api/auth/otp", handleResendOtp);
  // Alias legacy endpoint
  app.post("/api/auth/otp/request", handleResendOtp);

  // -------------------------------------------------------------
  // 5. VALIDASI OTP (/auth/otp-validation & /api/auth/otp-validation)
  // Input: email, code, deviceId?
  // 3x salah input -> OTP terkunci
  // -------------------------------------------------------------
  const handleOtpValidation = async (req: any, reply: any) => {
    try {
      const body = (req.body ?? {}) as { email?: unknown; code?: unknown; deviceId?: unknown };
      const deviceIdHeader = req.headers["x-device-id"];
      const deviceId = body.deviceId ?? deviceIdHeader;
      const sessionToken = req.cookies?.sid ?? req.headers["x-session-token"];

      const result = await validateOtp({
        emailRaw: body.email,
        codeRaw: body.code,
        deviceIdRaw: deviceId,
        sessionTokenRaw: sessionToken,
        ip: clientIp(req),
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
        kind: "user",
      });

      reply.setCookie("sid", result.token, cookieOpts);
      return reply.status(200).send({
        ok: true,
        user: result.user,
        sessionToken: result.token,
        message: result.message,
      });
    } catch (err) {
      return sendAuthError(reply, err, req);
    }
  };
  app.post("/auth/otp-validation", handleOtpValidation);
  app.post("/api/auth/otp-validation", handleOtpValidation);
  // Alias legacy endpoint
  app.post("/api/auth/otp/verify", handleOtpValidation);

  // -------------------------------------------------------------
  // 6. PROFIL USER (/user/profile & /api/user/profile)
  // IDOR SAFE: Identitas diambil secara mutlak dari cookie sesi sid
  // Input update: displayName, phoneNumber, ktp, address
  // -------------------------------------------------------------
  const handleGetProfile = async (req: any, reply: any) => {
    const session = await userFromCookie(req.cookies.sid, "user");
    if (!session) {
      return reply.status(401).send({
        error: { code: ErrorCodes.UNAUTHENTICATED, message: AuthResponses.errors.UNAUTHENTICATED.message },
      });
    }
    const user = await getUserProfile(session.user.id);
    return { user };
  };

  const handlePatchProfile = async (req: any, reply: any) => {
    try {
      const session = await userFromCookie(req.cookies.sid, "user");
      if (!session) {
        return reply.status(401).send({
          error: { code: ErrorCodes.UNAUTHENTICATED, message: AuthResponses.errors.UNAUTHENTICATED.message },
        });
      }

      // CRITICAL SECURITY: Parameter userId dari body sengaja diabaikan untuk mencegah IDOR!
      const body = (req.body ?? {}) as {
        displayName?: unknown;
        phoneNumber?: unknown;
        ktp?: unknown;
        address?: unknown;
      };

      const result = await updateUserProfile(session.user.id, body);
      return { ok: true, user: result.user, message: result.message };
    } catch (err) {
      return sendAuthError(reply, err, req);
    }
  };

  app.get("/user/profile", handleGetProfile);
  app.get("/api/user/profile", handleGetProfile);
  app.patch("/user/profile", handlePatchProfile);
  app.patch("/api/user/profile", handlePatchProfile);
  app.put("/user/profile", handlePatchProfile);
  app.put("/api/user/profile", handlePatchProfile);

  // -------------------------------------------------------------
  // 7. LOGOUT USER (/user/logout, /auth/logout, /api/user/logout, /api/auth/logout)
  // -------------------------------------------------------------
  const handleLogout = async (req: any, reply: any) => {
    try {
      const body = (req.body ?? {}) as { token?: unknown; sessionToken?: unknown };
      const token =
        (typeof body.token === "string" && body.token.trim().length > 0 ? body.token.trim() : undefined) ??
        (typeof body.sessionToken === "string" && body.sessionToken.trim().length > 0 ? body.sessionToken.trim() : undefined) ??
        req.cookies?.sid ??
        (typeof req.headers["x-session-token"] === "string" ? req.headers["x-session-token"] : undefined);

      if (!token) {
        throw new AuthError(
          AuthResponses.errors.UNAUTHENTICATED.code,
          AuthResponses.errors.UNAUTHENTICATED.message,
          401,
        );
      }

      await logout(token, "user");
      reply.clearCookie("sid", { path: "/" });
      return reply.status(200).send({
        ok: true,
        message: AuthResponses.success.LOGOUT_SUCCESS.message,
      });
    } catch (err) {
      return sendAuthError(reply, err, req);
    }
  };

  app.post("/user/logout", handleLogout);
  app.post("/api/user/logout", handleLogout);
  app.post("/auth/logout", handleLogout);
  app.post("/api/auth/logout", handleLogout);

  // -------------------------------------------------------------
  // 7b. RESET KATA SANDI
  // POST /auth/password-reset { email }
  // POST /auth/password-reset-validation { token }
  // POST /auth/password-reset-confirm { token, password }
  // -------------------------------------------------------------
  const handlePasswordReset = async (req: any, reply: any) => {
    try {
      const body = (req.body ?? {}) as { email?: unknown };
      const result = await requestPasswordReset({
        emailRaw: body.email,
        ip: clientIp(req),
        redis: deps.redis,
        mailer: deps.mailer,
      });
      return reply.status(200).send({
        ok: true,
        message: result.message,
        email: result.email,
      });
    } catch (err) {
      return sendAuthError(reply, err, req);
    }
  };
  app.post("/auth/password-reset", handlePasswordReset);
  app.post("/api/auth/password-reset", handlePasswordReset);

  const handlePasswordResetValidation = async (req: any, reply: any) => {
    try {
      const body = (req.body ?? {}) as { token?: unknown };
      const result = await validatePasswordResetToken(body.token);
      return { ok: true, message: result.message };
    } catch (err) {
      return sendAuthError(reply, err, req);
    }
  };
  app.post("/auth/password-reset-validation", handlePasswordResetValidation);
  app.post("/api/auth/password-reset-validation", handlePasswordResetValidation);

  const handlePasswordResetConfirm = async (req: any, reply: any) => {
    try {
      const body = (req.body ?? {}) as { token?: unknown; password?: unknown };
      const result = await confirmPasswordReset({
        tokenRaw: body.token,
        passwordRaw: body.password,
      });
      return reply.status(200).send({
        ok: true,
        message: result.message,
      });
    } catch (err) {
      return sendAuthError(reply, err, req);
    }
  };
  app.post("/auth/password-reset-confirm", handlePasswordResetConfirm);
  app.post("/api/auth/password-reset-confirm", handlePasswordResetConfirm);

  app.get("/api/me", async (req, reply) => {
    const session = await userFromCookie(req.cookies.sid, "user");
    if (!session) {
      return reply.status(401).send({
        error: { code: ErrorCodes.UNAUTHENTICATED, message: AuthResponses.errors.UNAUTHENTICATED.message },
      });
    }
    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        displayName: session.user.displayName,
        phoneNumber: session.user.phoneNumber,
        ktp: session.user.ktp,
        address: session.user.address,
        nextGenerateAt: session.user.nextGenerateAt?.toISOString() ?? null,
      },
    };
  });

  // -------------------------------------------------------------
  // 8. ADMIN AUTH (Session Cookie / Header)
  // -------------------------------------------------------------
  app.post("/api/admin/auth/logout", async (req, reply) => {
    await logout(req.cookies.sid_admin, "admin");
    reply.clearCookie("sid_admin", { path: "/" });
    return { ok: true, message: AuthResponses.success.LOGOUT_SUCCESS.message };
  });

  app.get("/api/admin/me", async (req, reply) => {
    const session = await userFromCookie(req.cookies.sid_admin, "admin");
    if (!session || session.user.role !== "admin") {
      return reply.status(401).send({
        error: { code: ErrorCodes.UNAUTHENTICATED, message: "Silakan masuk sebagai admin" },
      });
    }
    return { user: { id: session.user.id, email: session.user.email, role: session.user.role } };
  });
}
