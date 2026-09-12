import type { FastifyInstance } from "fastify";
import "@fastify/cookie";
import { AuthResponses, ErrorCodes, type ObjectStorage } from "@ai-gen-free/core";
import { AuthError, loginAdmin, logout, registerAdmin, userFromCookie } from "../auth/service.js";
import { requestIp, sendError } from "../http.js";
import {
  parseAdjustBody,
  parseCooldownSecondsValue,
  parseIdempotencyKey,
  parseJobStatus,
  parseLimitOffset,
  parseOptionalQueryString,
  parseProviderParam,
} from "../admin/parse.js";
import {
  adjustUserWallet,
  getAdminUser,
  getGenerateCooldownSetting,
  listAdminModels,
  listAdminModelsByProvider,
  listAdminUsers,
  listAuditLogs,
  putGenerateCooldownSetting,
  resetUserCooldown,
  updateAdminModel,
} from "../admin/service.js";
import { getAdminJob, getAdminJobOutputFile, listAdminJobs } from "../jobs/service.js";
import type IORedis from "ioredis";

const cookieSecure = process.env.COOKIE_SECURE === "true";
const cookieOpts = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: cookieSecure,
  maxAge: 7 * 24 * 60 * 60,
};

async function requireAdmin(
  req: { cookies: Record<string, string | undefined>; headers: Record<string, unknown> },
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
) {
  const token =
    (typeof req.cookies?.sid_admin === "string" && req.cookies.sid_admin.trim().length > 0 ? req.cookies.sid_admin.trim() : undefined) ??
    (typeof req.cookies?.sid === "string" && req.cookies.sid.trim().length > 0 ? req.cookies.sid.trim() : undefined) ??
    (typeof req.headers["x-session-token"] === "string" && (req.headers["x-session-token"] as string).trim().length > 0
      ? (req.headers["x-session-token"] as string).trim()
      : undefined) ??
    (typeof req.headers["authorization"] === "string" && (req.headers["authorization"] as string).toLowerCase().startsWith("bearer ")
      ? (req.headers["authorization"] as string).slice(7).trim()
      : undefined);

  let session = await userFromCookie(token, "admin");
  if (!session) {
    session = await userFromCookie(token, "user");
  }

  if (!session || session.user.role !== "admin") {
    reply.status(401).send({
      error: { code: ErrorCodes.UNAUTHENTICATED, message: "Silakan masuk sebagai admin" },
    });
    return null;
  }
  return session;
}

export async function registerAdminRoutes(app: FastifyInstance, deps: { storage: ObjectStorage; redis: IORedis }) {
  const handleAdminMe = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    return { user: { id: session.user.id, email: session.user.email, role: session.user.role } };
  };
  app.get("/admin/me", handleAdminMe);

  // -------------------------------------------------------------
  // 0. ADMIN REGISTER (POST /admin/register)
  // Mendaftar akun admin baru tanpa memerlukan OTP / verifikasi email.
  // -------------------------------------------------------------
  const handleAdminRegister = async (req: any, reply: any) => {
    try {
      const body = (req.body ?? {}) as { username?: unknown; email?: unknown; password?: unknown };
      const result = await registerAdmin({
        usernameRaw: body.username,
        emailRaw: body.email,
        passwordRaw: body.password,
        ip: requestIp(req),
        redis: deps.redis,
      });

      return reply.status(201).send({
        ok: true,
        user: result.user,
        message: result.message,
      });
    } catch (err) {
      return sendError(reply, err);
    }
  };

  app.post("/admin/register", handleAdminRegister);

  // -------------------------------------------------------------
  // 1. ADMIN LOGIN (POST /admin/login)
  // Tidak membutuhkan OTP atau verifikasi email. Wajib role="admin".
  // -------------------------------------------------------------
  const handleAdminLogin = async (req: any, reply: any) => {
    try {
      const body = (req.body ?? {}) as {
        username?: unknown;
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
        req.cookies?.sid_admin ??
        req.cookies?.sid ??
        (typeof req.headers["x-session-token"] === "string" ? req.headers["x-session-token"] : undefined);

      const result = await loginAdmin({
        usernameRaw: body.username,
        emailRaw: body.email,
        passwordRaw: body.password,
        deviceIdRaw: deviceId,
        sessionTokenRaw: sessionToken,
        ip: requestIp(req),
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
        redis: deps.redis,
      });

      reply.setCookie("sid_admin", result.token, cookieOpts);
      return reply.status(200).send({
        ok: true,
        user: result.user,
        sessionToken: result.token,
        message: result.message,
      });
    } catch (err) {
      return sendError(reply, err);
    }
  };

  app.post("/admin/login", handleAdminLogin);

  // -------------------------------------------------------------
  // 2. ADMIN LOGOUT (POST /admin/logout)
  // -------------------------------------------------------------
  const handleAdminLogout = async (req: any, reply: any) => {
    try {
      const body = (req.body ?? {}) as { token?: unknown; sessionToken?: unknown };
      const token =
        (typeof body.token === "string" && body.token.trim().length > 0 ? body.token.trim() : undefined) ??
        (typeof body.sessionToken === "string" && body.sessionToken.trim().length > 0 ? body.sessionToken.trim() : undefined) ??
        req.cookies?.sid_admin ??
        req.cookies?.sid ??
        (typeof req.headers["x-session-token"] === "string" ? req.headers["x-session-token"] : undefined);

      if (!token) {
        throw new AuthError(
          AuthResponses.errors.UNAUTHENTICATED.code,
          AuthResponses.errors.UNAUTHENTICATED.message,
          401,
        );
      }

      await logout(token, "admin");
      reply.clearCookie("sid_admin", { path: "/" });
      return reply.status(200).send({
        ok: true,
        message: AuthResponses.success.ADMIN_LOGOUT_SUCCESS.message,
      });
    } catch (err) {
      return sendError(reply, err);
    }
  };

  app.post("/admin/logout", handleAdminLogout);

  // -------------------------------------------------------------
  // 3. DAFTAR USER/PELANGGAN (GET /admin/customer/list & GET /admin/users)
  // -------------------------------------------------------------
  const handleListUsers = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const query = req.query as { q?: unknown; limit?: unknown; offset?: unknown };
      const page = parseLimitOffset(query);
      const q = parseOptionalQueryString(query.q);
      return await listAdminUsers({ q, ...page });
    } catch (err) {
      return sendError(reply, err);
    }
  };

  app.get("/admin/customer/list", handleListUsers);
  app.get("/admin/users", handleListUsers);

  // -------------------------------------------------------------
  // 4. SETTINGS & USER MANAGEMENT
  // -------------------------------------------------------------
  const handleGetCooldown = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    return await getGenerateCooldownSetting();
  };
  app.get("/admin/settings/generate_cooldown_seconds", handleGetCooldown);

  const handlePutCooldown = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const body = (req.body ?? {}) as { value?: unknown };
      const value = parseCooldownSecondsValue(body.value);
      return await putGenerateCooldownSetting({
        value,
        actorId: session.userId,
        ip: requestIp(req),
      });
    } catch (err) {
      return sendError(reply, err);
    }
  };
  app.put("/admin/settings/generate_cooldown_seconds", handlePutCooldown);

  const handleGetUser = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      return await getAdminUser(id);
    } catch (err) {
      return sendError(reply, err);
    }
  };
  app.get("/admin/users/:id", handleGetUser);

  const handleResetCooldown = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      return await resetUserCooldown({ userId: id, actorId: session.userId, ip: requestIp(req) });
    } catch (err) {
      return sendError(reply, err);
    }
  };
  app.post("/admin/users/:id/cooldown/reset", handleResetCooldown);

  const handleAdjustWallet = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { userId } = req.params as { userId: string };
      const body = (req.body ?? {}) as { amount?: unknown; reason?: unknown };
      const parsed = parseAdjustBody(body);
      const clientKey = parseIdempotencyKey(req.headers["idempotency-key"]);
      return await adjustUserWallet({
        userId,
        amount: parsed.amount,
        reason: parsed.reason,
        clientKey,
        actorId: session.userId,
        ip: requestIp(req),
      });
    } catch (err) {
      return sendError(reply, err);
    }
  };
  app.post("/admin/topup/poin/:userId", handleAdjustWallet);

  const handleListJobs = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const query = req.query as {
        status?: unknown;
        userId?: unknown;
        q?: unknown;
        limit?: unknown;
        offset?: unknown;
      };
      const page = parseLimitOffset(query);
      return {
        jobs: await listAdminJobs({
          status: parseJobStatus(query.status),
          userId: parseOptionalQueryString(query.userId),
          q: parseOptionalQueryString(query.q),
          ...page,
        }),
      };
    } catch (err) {
      return sendError(reply, err);
    }
  };
  app.get("/admin/jobs", handleListJobs);

  const handleGetJob = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      return await getAdminJob({ id, storage: deps.storage });
    } catch (err) {
      return sendError(reply, err);
    }
  };
  app.get("/admin/jobs/:id", handleGetJob);

  const handleGetJobFile = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      const file = await getAdminJobOutputFile({ id, storage: deps.storage });
      reply.header("Content-Type", file.contentType);
      reply.header("Cache-Control", "private, max-age=60");
      reply.header("Content-Disposition", "inline");
      return reply.send(Buffer.from(file.bytes));
    } catch (err) {
      return sendError(reply, err);
    }
  };
  app.get("/admin/jobs/:id/file", handleGetJobFile);

  const handleListAudit = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const query = req.query as { limit?: unknown; offset?: unknown; action?: unknown };
      const page = parseLimitOffset(query);
      return await listAuditLogs({
        ...page,
        action: parseOptionalQueryString(query.action),
      });
    } catch (err) {
      return sendError(reply, err);
    }
  };
  app.get("/admin/audit", handleListAudit);

  // -------------------------------------------------------------
  // 5. ADMIN MODEL MANAGEMENT (Pengaturan Model & Poin)
  // -------------------------------------------------------------
  const handleListModels = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      return await listAdminModels();
    } catch (err) {
      return sendError(reply, err);
    }
  };
  app.get("/admin/models", handleListModels);

  const handleListModelsByProvider = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { provider } = req.params as { provider: string };
      return await listAdminModelsByProvider(parseProviderParam(provider));
    } catch (err) {
      return sendError(reply, err);
    }
  };
  app.get("/admin/model/:provider/list", handleListModelsByProvider);

  const handleUpdateModel = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { modelCatalogId } = req.params as { modelCatalogId: string };
      const body = (req.body ?? {}) as { costPoints?: unknown; displayName?: unknown; enabled?: unknown };
      const costPoints = typeof body.costPoints === "number" ? body.costPoints : undefined;
      const displayName = typeof body.displayName === "string" ? body.displayName : undefined;
      const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;
      return await updateAdminModel({
        id: modelCatalogId,
        costPoints,
        displayName,
        enabled,
        actorId: session.userId,
        ip: requestIp(req),
      });
    } catch (err) {
      return sendError(reply, err);
    }
  };
  app.patch("/admin/model/:modelCatalogId", handleUpdateModel);
  app.put("/admin/model/:modelCatalogId", handleUpdateModel);
}
