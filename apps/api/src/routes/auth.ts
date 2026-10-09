import type { FastifyInstance } from "fastify";
import { AuthResponses, ErrorCodes } from "@ai-gen-free/core";
import {
  AuthError,
  changeUserPassword,
  confirmPasswordReset,
  getUserProfile,
  loginUser,
  loginWithGoogle,
  logout,
  registerUser,
  requestPasswordReset,
  resendOtp,
  updateUserProfile,
  userFromCookie,
  validateEmailToken,
  validateOtp,
  validatePasswordResetToken,
} from "../auth/service.js";
import type { EmailPort } from "@ai-gen-free/core";
import { requestIp, sendError } from "../http.js";
import type IORedis from "ioredis";

const cookieSecure = process.env.COOKIE_SECURE === "true";
const cookieOpts = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: cookieSecure,
  maxAge: 7 * 24 * 60 * 60,
};

function sessionTokenFromReq(req: {
  body?: unknown;
  cookies?: Record<string, string | undefined>;
  headers: Record<string, unknown>;
}): string | undefined {
  const body = (req.body ?? {}) as { token?: unknown; sessionToken?: unknown };
  const headerToken = req.headers["x-session-token"];
  const bearer = req.headers["authorization"];
  return (
    (typeof body.token === "string" && body.token.trim().length > 0 ? body.token.trim() : undefined) ??
    (typeof body.sessionToken === "string" && body.sessionToken.trim().length > 0 ? body.sessionToken.trim() : undefined) ??
    (typeof req.cookies?.sid === "string" && req.cookies.sid.trim().length > 0 ? req.cookies.sid.trim() : undefined) ??
    (typeof headerToken === "string" && headerToken.trim().length > 0 ? headerToken.trim() : undefined) ??
    (typeof bearer === "string" && bearer.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : undefined)
  );
}


export async function registerAuthRoutes(
  app: FastifyInstance,
  deps: { redis: IORedis; mailer: EmailPort },
) {
  // -------------------------------------------------------------
  // 1. REGISTRASI PELANGGAN (POST /customer/register)
  // Input: email, password
  // -------------------------------------------------------------
  const handleRegister = async (req: any, reply: any) => {
    try {
      const body = (req.body ?? {}) as { email?: unknown; password?: unknown };
      const result = await registerUser({
        emailRaw: body.email,
        passwordRaw: body.password,
        ip: requestIp(req),
        redis: deps.redis,
        mailer: deps.mailer,
      });
      return reply.status(201).send({
        ok: true,
        message: result.message,
        email: result.email,
      });
    } catch (err) {
      return sendError(reply, err, req);
    }
  };
  app.post(
    "/customer/register",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", minLength: 1 },
            password: { type: "string", minLength: 1 },
          },
          additionalProperties: true,
        },
      },
    },
    handleRegister,
  );

  // -------------------------------------------------------------
  // 1b. LOGIN / REGISTER VIA GOOGLE OAUTH2 (POST /auth/google)
  // Input: idToken, deviceId?
  // -------------------------------------------------------------
  app.post(
    "/auth/google",
    {
      schema: {
        body: {
          type: "object",
          required: ["idToken"],
          properties: {
            idToken: { type: "string", minLength: 1 },
            deviceId: { type: "string" },
          },
          additionalProperties: true,
        },
      },
    },
    async (req: any, reply: any) => {
      try {
        const internalSecret = process.env.INTERNAL_API_SECRET;
        if (internalSecret) {
          const headerSecret = req.headers["x-internal-secret"];
          if (headerSecret !== internalSecret) {
            return reply.status(403).send({
              error: {
                code: "A007",
                message: "Akses ditolak (invalid internal secret).",
              },
            });
          }
        }

        const body = (req.body ?? {}) as { idToken?: unknown; deviceId?: unknown };
        const ip = requestIp(req);
        const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined;

        const result = await loginWithGoogle({
          idTokenRaw: body.idToken,
          deviceIdRaw: body.deviceId,
          ip,
          userAgent,
          headers: req.headers,
          redis: deps.redis,
        });

        reply.setCookie("sid", result.token, cookieOpts);

        return reply.status(200).send({
          ok: true,
          token: result.token,
          sid: result.sid,
          user: result.user,
          isNewUser: result.isNewUser,
          message: result.message,
        });
      } catch (err) {
        return sendError(reply, err, req);
      }
    },
  );

  // -------------------------------------------------------------
  // 2. VALIDASI EMAIL TOKEN (POST /auth/email-validation)
  // Input: token
  // -------------------------------------------------------------
  const handleEmailValidation = async (req: any, reply: any) => {
    try {
      const body = (req.body ?? {}) as { token?: unknown };
      const result = await validateEmailToken(body.token);
      return { ok: true, message: result.message };
    } catch (err) {
      return sendError(reply, err, req);
    }
  };
  app.post(
    "/auth/email-validation",
    {
      schema: {
        body: {
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string", minLength: 1 },
          },
          additionalProperties: true,
        },
      },
    },
    handleEmailValidation,
  );

  // -------------------------------------------------------------
  // 3. LOGIN PELANGGAN (POST /customer/login)
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
        ip: requestIp(req),
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
      return sendError(reply, err, req);
    }
  };
  app.post(
    "/customer/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", minLength: 1 },
            password: { type: "string", minLength: 1 },
            deviceId: { type: "string" },
            token: { type: "string" },
            sessionToken: { type: "string" },
          },
          additionalProperties: true,
        },
      },
    },
    handleLogin,
  );

  // -------------------------------------------------------------
  // 4. REQUEST / RESEND OTP (POST /auth/otp)
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
        ip: requestIp(req),
        redis: deps.redis,
        mailer: deps.mailer,
      });
      return { ok: true, message: result.message };
    } catch (err) {
      return sendError(reply, err, req);
    }
  };
  app.post(
    "/auth/otp",
    {
      schema: {
        body: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", minLength: 1 },
          },
          additionalProperties: true,
        },
      },
    },
    handleResendOtp,
  );

  // -------------------------------------------------------------
  // 5. VALIDASI OTP (POST /auth/otp-validation)
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
        ip: requestIp(req),
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
      return sendError(reply, err, req);
    }
  };
  app.post(
    "/auth/otp-validation",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "code"],
          properties: {
            email: { type: "string", minLength: 1 },
            code: { type: "string", minLength: 1 },
            deviceId: { type: "string" },
          },
          additionalProperties: true,
        },
      },
    },
    handleOtpValidation,
  );

  // -------------------------------------------------------------
  // 6. PROFIL PELANGGAN (GET/PATCH /customer/profile)
  // IDOR SAFE: Identitas diambil secara mutlak dari cookie sesi sid
  // Input update: displayName, phoneNumber, ktp, address, gender
  // -------------------------------------------------------------
  const handleGetProfile = async (req: any, reply: any) => {
    const context = {
      ip: requestIp(req),
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
    };
    const session = await userFromCookie(sessionTokenFromReq(req), "user", context);
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
      const context = {
        ip: requestIp(req),
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
      };
      const session = await userFromCookie(sessionTokenFromReq(req), "user", context);
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
        gender?: unknown;
        email?: unknown;
        acceptUploadPolicy?: unknown;
        dateOfBirth?: unknown;
        spicyModeEnabled?: unknown;
      };

      const result = await updateUserProfile(session.user.id, {
        ...body,
        req: { ip: requestIp(req), headers: req.headers },
      } as any);
      return { ok: true, user: result.user, message: result.message };
    } catch (err) {
      return sendError(reply, err, req);
    }
  };

  const profileUpdateSchema = {
    schema: {
      body: {
        type: "object",
        properties: {
          displayName: { type: "string" },
          phoneNumber: { type: "string" },
          ktp: { type: "string" },
          address: { type: "string" },
          gender: { type: "string" },
          email: { type: "string" },
          acceptUploadPolicy: { type: "boolean" },
          dateOfBirth: { type: "string" },
          spicyModeEnabled: { type: "boolean" },
        },
        additionalProperties: true,
      },
    },
  };

  app.get("/customer/profile", handleGetProfile);
  app.patch("/customer/profile", profileUpdateSchema, handlePatchProfile);
  app.put("/customer/profile", profileUpdateSchema, handlePatchProfile);

  // -------------------------------------------------------------
  // 7. LOGOUT PELANGGAN (POST /customer/logout)
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
      return sendError(reply, err, req);
    }
  };

  app.post(
    "/customer/logout",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            token: { type: "string" },
            sessionToken: { type: "string" },
          },
          additionalProperties: true,
        },
      },
    },
    handleLogout,
  );

  // -------------------------------------------------------------
  // 7b. GANTI KATA SANDI (POST /customer/password-change)
  // Input: currentPassword, newPassword (IDOR safe via session.user.id)
  // -------------------------------------------------------------
  const handleChangePassword = async (req: any, reply: any) => {
    try {
      const context = {
        ip: requestIp(req),
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
      };
      const session = await userFromCookie(sessionTokenFromReq(req), "user", context);
      if (!session) {
        return reply.status(401).send({
          error: { code: ErrorCodes.UNAUTHENTICATED, message: AuthResponses.errors.UNAUTHENTICATED.message },
        });
      }

      const body = (req.body ?? {}) as {
        currentPassword?: unknown;
        newPassword?: unknown;
      };

      const result = await changeUserPassword({
        userId: session.user.id,
        currentPasswordRaw: body.currentPassword,
        newPasswordRaw: body.newPassword,
        req: { ip: requestIp(req), headers: req.headers },
      });

      return reply.status(200).send({
        ok: true,
        message: result.message,
      });
    } catch (err) {
      return sendError(reply, err, req);
    }
  };

  const passwordChangeSchema = {
    schema: {
      body: {
        type: "object",
        required: ["currentPassword", "newPassword"],
        properties: {
          currentPassword: { type: "string", minLength: 1 },
          newPassword: { type: "string", minLength: 1 },
        },
        additionalProperties: true,
      },
    },
  };

  app.post("/customer/password-change", passwordChangeSchema, handleChangePassword);
  app.post("/customer/change-password", passwordChangeSchema, handleChangePassword);

  // -------------------------------------------------------------
  // 7c. RESET KATA SANDI
  // POST /auth/password-reset { email }
  // POST /auth/password-reset-validation { token }
  // POST /auth/password-reset-confirm { token, password }
  // -------------------------------------------------------------
  const handlePasswordReset = async (req: any, reply: any) => {
    try {
      const body = (req.body ?? {}) as { email?: unknown };
      const result = await requestPasswordReset({
        emailRaw: body.email,
        ip: requestIp(req),
        redis: deps.redis,
        mailer: deps.mailer,
      });
      return reply.status(200).send({
        ok: true,
        message: result.message,
        email: result.email,
      });
    } catch (err) {
      return sendError(reply, err, req);
    }
  };
  app.post(
    "/auth/password-reset",
    {
      schema: {
        body: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", minLength: 1 },
          },
          additionalProperties: true,
        },
      },
    },
    handlePasswordReset,
  );

  const handlePasswordResetValidation = async (req: any, reply: any) => {
    try {
      const body = (req.body ?? {}) as { token?: unknown };
      const result = await validatePasswordResetToken(body.token);
      return { ok: true, message: result.message };
    } catch (err) {
      return sendError(reply, err, req);
    }
  };
  app.post(
    "/auth/password-reset-validation",
    {
      schema: {
        body: {
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string", minLength: 1 },
          },
          additionalProperties: true,
        },
      },
    },
    handlePasswordResetValidation,
  );

  const handlePasswordResetConfirm = async (req: any, reply: any) => {
    try {
      const body = (req.body ?? {}) as { token?: unknown; password?: unknown };
      const result = await confirmPasswordReset({
        tokenRaw: body.token,
        passwordRaw: body.password,
        req: { ip: requestIp(req), headers: req.headers },
      });
      return reply.status(200).send({
        ok: true,
        message: result.message,
      });
    } catch (err) {
      return sendError(reply, err, req);
    }
  };
  app.post(
    "/auth/password-reset-confirm",
    {
      schema: {
        body: {
          type: "object",
          required: ["token", "password"],
          properties: {
            token: { type: "string", minLength: 1 },
            password: { type: "string", minLength: 1 },
          },
          additionalProperties: true,
        },
      },
    },
    handlePasswordResetConfirm,
  );
}
