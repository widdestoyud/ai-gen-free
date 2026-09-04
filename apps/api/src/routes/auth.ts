import type { FastifyInstance } from "fastify";
import { ErrorCodes } from "@ai-gen-free/core";
import { AuthError, logout, requestOtp, userFromCookie, verifyOtp } from "../auth/service.js";
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

function sendAuthError(reply: { status: (n: number) => { send: (b: unknown) => unknown } }, err: unknown) {
  if (err instanceof AuthError) {
    return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
  }
  throw err;
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  deps: { redis: IORedis; mailer: EmailPort },
) {
  app.post("/api/auth/otp/request", async (req, reply) => {
    try {
      const body = (req.body ?? {}) as { email?: unknown };
      await requestOtp({
        emailRaw: body.email,
        ip: clientIp(req),
        redis: deps.redis,
        mailer: deps.mailer,
        adminOnly: false,
      });
      return { ok: true };
    } catch (err) {
      return sendAuthError(reply, err);
    }
  });

  app.post("/api/auth/otp/verify", async (req, reply) => {
    try {
      const body = (req.body ?? {}) as { email?: unknown; code?: unknown };
      const result = await verifyOtp({
        emailRaw: body.email,
        codeRaw: body.code,
        ip: clientIp(req),
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
        kind: "user",
      });
      reply.setCookie("sid", result.token, cookieOpts);
      return { user: result.user };
    } catch (err) {
      return sendAuthError(reply, err);
    }
  });

  app.post("/api/auth/logout", async (req, reply) => {
    await logout(req.cookies.sid, "user");
    reply.clearCookie("sid", { path: "/" });
    return { ok: true };
  });

  app.get("/api/me", async (req, reply) => {
    const session = await userFromCookie(req.cookies.sid, "user");
    if (!session) {
      return reply.status(401).send({
        error: { code: ErrorCodes.UNAUTHENTICATED, message: "Silakan masuk" },
      });
    }
    return { user: { id: session.user.id, email: session.user.email, role: session.user.role } };
  });

  app.addHook("preHandler", async (req, reply) => {
    if (!req.url.startsWith("/api/admin")) return;
    if (!basicAuthorized(req.headers.authorization)) {
      reply.header("WWW-Authenticate", 'Basic realm="admin"');
      return reply.status(401).send({
        error: { code: ErrorCodes.UNAUTHENTICATED, message: "Basic Auth wajib" },
      });
    }
  });

  app.post("/api/admin/auth/otp/request", async (req, reply) => {
    try {
      const body = (req.body ?? {}) as { email?: unknown };
      await requestOtp({
        emailRaw: body.email,
        ip: clientIp(req),
        redis: deps.redis,
        mailer: deps.mailer,
        adminOnly: true,
      });
      return { ok: true };
    } catch (err) {
      return sendAuthError(reply, err);
    }
  });

  app.post("/api/admin/auth/otp/verify", async (req, reply) => {
    try {
      const body = (req.body ?? {}) as { email?: unknown; code?: unknown };
      const result = await verifyOtp({
        emailRaw: body.email,
        codeRaw: body.code,
        ip: clientIp(req),
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
        kind: "admin",
      });
      reply.setCookie("sid_admin", result.token, cookieOpts);
      return { user: result.user };
    } catch (err) {
      return sendAuthError(reply, err);
    }
  });

  app.post("/api/admin/auth/logout", async (req, reply) => {
    await logout(req.cookies.sid_admin, "admin");
    reply.clearCookie("sid_admin", { path: "/" });
    return { ok: true };
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
