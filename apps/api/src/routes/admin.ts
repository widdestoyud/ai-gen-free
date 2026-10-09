import type { FastifyInstance } from "fastify";
import "@fastify/cookie";
import { AuthResponses, ErrorCodes, type ObjectStorage } from "@ai-gen-free/core";
import { AuthError, loginAdmin, logout, registerAdmin, userFromCookie } from "../auth/service.js";
import { requestIp, sendError } from "../http.js";
import {
  parseAdjustBody,
  parseCooldownSecondsValue,
  parseIdempotencyKey,
  parseJobMode,
  parseJobStatus,
  parseLimitOffset,
  parseOptionalQueryString,
  parseProviderParam,
} from "../admin/parse.js";
import {
  adjustUserWallet,
  getAdminUser,
  getDefaultGenerationModelsSetting,
  getGenerateCooldownSetting,
  getPaymentSettings,
  getTesterAccountSetting,
  listAdminModels,
  listAdminModelsByProvider,
  listAdminUsers,
  listAuditLogs,
  putDefaultGenerationModelsSetting,
  putGenerateCooldownSetting,
  putPaymentSettings,
  putTesterAccountSetting,
  resetUserCooldown,
  updateAdminModel,
} from "../admin/service.js";
import { getAdminJob, getAdminJobOutputFile, listAdminJobs } from "../jobs/service.js";
import { listUserActivities } from "../activity/service.js";
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
    (typeof req.headers["x-session-token"] === "string" && (req.headers["x-session-token"] as string).trim().length > 0
      ? (req.headers["x-session-token"] as string).trim()
      : undefined) ??
    (typeof req.headers["authorization"] === "string" && (req.headers["authorization"] as string).toLowerCase().startsWith("bearer ")
      ? (req.headers["authorization"] as string).slice(7).trim()
      : undefined);

  const context = {
    ip: requestIp(req),
    userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
  };

  const session = await userFromCookie(token, "admin", context);

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
      req.log.info({
        event: "admin.login_attempt",
        username: body.username,
        email: body.email,
        deviceId,
        hasPassword: Boolean(body.password),
      });
      const sessionToken =
        (typeof body.token === "string" && body.token.trim().length > 0 ? body.token.trim() : undefined) ??
        (typeof body.sessionToken === "string" && body.sessionToken.trim().length > 0 ? body.sessionToken.trim() : undefined) ??
        req.cookies?.sid_admin ??
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
      const query = (req.query ?? {}) as {
        q?: unknown;
        role?: unknown;
        limit?: unknown;
        offset?: unknown;
        page?: unknown;
        sortBy?: unknown;
        sortOrder?: unknown;
      };
      const pageNum =
        typeof query.page === "string"
          ? parseInt(query.page, 10)
          : typeof query.page === "number"
            ? query.page
            : undefined;
      const limit =
        typeof query.limit === "string"
          ? parseInt(query.limit, 10)
          : typeof query.limit === "number"
            ? query.limit
            : undefined;
      const offset =
        typeof query.offset === "string"
          ? parseInt(query.offset, 10)
          : typeof query.offset === "number"
            ? query.offset
            : undefined;
      const q = parseOptionalQueryString(query.q);
      const role = parseOptionalQueryString(query.role);
      const sortBy = typeof query.sortBy === "string" ? query.sortBy : undefined;
      const sortOrder = query.sortOrder === "asc" ? ("asc" as const) : ("desc" as const);

      const result = await listAdminUsers({
        q,
        role,
        page: pageNum,
        limit,
        offset,
        sortBy,
        sortOrder,
      });
      return {
        users: result.users,
        items: result.users,
        pagination: result.pagination,
      };
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

  const handleGetPaymentSettings = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const settings = await getPaymentSettings();
      return {
        ...settings,
        availableGateways: ["xendit", "midtrans"],
      };
    } catch (err) {
      return sendError(reply, err);
    }
  };
  app.get("/admin/settings/payment", handleGetPaymentSettings);

  const handlePutPaymentSettings = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const body = (req.body ?? {}) as {
        manualPaymentEnabled?: unknown;
        activeOnlineGateway?: unknown;
        manualExpiryMinutes?: unknown;
        onlineExpiryMinutes?: unknown;
      };
      const settings = await putPaymentSettings({
        config: body,
        actorId: session.userId,
        ip: requestIp(req),
      });
      return {
        ...settings,
        availableGateways: ["xendit", "midtrans"],
      };
    } catch (err) {
      return sendError(reply, err);
    }
  };
  app.put("/admin/settings/payment", handlePutPaymentSettings);
  app.patch("/admin/settings/payment", handlePutPaymentSettings);

  const handleGetTesterAccount = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      return await getTesterAccountSetting();
    } catch (err) {
      return sendError(reply, err);
    }
  };
  app.get("/admin/settings/tester-account", handleGetTesterAccount);

  const handlePutTesterAccount = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const body = (req.body ?? {}) as {
        enabled?: unknown;
        email?: unknown;
        otp?: unknown;
        expiresAt?: unknown;
      };
      const settings = await putTesterAccountSetting({
        config: body,
        actorId: session.userId,
        ip: requestIp(req),
      });
      return settings;
    } catch (err) {
      return sendError(reply, err);
    }
  };
  app.put("/admin/settings/tester-account", handlePutTesterAccount);
  app.patch("/admin/settings/tester-account", handlePutTesterAccount);

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

  const handleGetUserActivities = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      const query = req.query as { limit?: unknown; offset?: unknown; action?: unknown };
      const page = parseLimitOffset(query);
      return await listUserActivities({
        userId: id,
        limit: page.limit,
        offset: page.offset,
        action: parseOptionalQueryString(query.action),
      });
    } catch (err) {
      return sendError(reply, err);
    }
  };
  app.get("/admin/users/:id/activities", handleGetUserActivities);

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
      const query = (req.query ?? {}) as {
        status?: unknown;
        mode?: unknown;
        userId?: unknown;
        q?: unknown;
        limit?: unknown;
        offset?: unknown;
        page?: unknown;
        sortBy?: unknown;
        sortOrder?: unknown;
      };
      const pageNum =
        typeof query.page === "string"
          ? parseInt(query.page, 10)
          : typeof query.page === "number"
            ? query.page
            : undefined;
      const limit =
        typeof query.limit === "string"
          ? parseInt(query.limit, 10)
          : typeof query.limit === "number"
            ? query.limit
            : undefined;
      const offset =
        typeof query.offset === "string"
          ? parseInt(query.offset, 10)
          : typeof query.offset === "number"
            ? query.offset
            : undefined;
      const sortBy = typeof query.sortBy === "string" ? query.sortBy : undefined;
      const sortOrder = query.sortOrder === "asc" ? ("asc" as const) : ("desc" as const);

      const result = await listAdminJobs({
        status: parseJobStatus(query.status),
        mode: parseJobMode(query.mode),
        userId: parseOptionalQueryString(query.userId),
        q: parseOptionalQueryString(query.q),
        page: pageNum,
        limit,
        offset,
        sortBy,
        sortOrder,
      });
      return {
        jobs: result.jobs,
        items: result.jobs,
        pagination: result.pagination,
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
      const query = (req.query ?? {}) as {
        limit?: unknown;
        offset?: unknown;
        action?: unknown;
        actorId?: unknown;
        page?: unknown;
        sortBy?: unknown;
        sortOrder?: unknown;
      };
      const pageNum =
        typeof query.page === "string"
          ? parseInt(query.page, 10)
          : typeof query.page === "number"
            ? query.page
            : undefined;
      const limit =
        typeof query.limit === "string"
          ? parseInt(query.limit, 10)
          : typeof query.limit === "number"
            ? query.limit
            : undefined;
      const offset =
        typeof query.offset === "string"
          ? parseInt(query.offset, 10)
          : typeof query.offset === "number"
            ? query.offset
            : undefined;
      const action = parseOptionalQueryString(query.action);
      const actorId = parseOptionalQueryString(query.actorId);
      const sortBy = typeof query.sortBy === "string" ? query.sortBy : undefined;
      const sortOrder = query.sortOrder === "asc" ? ("asc" as const) : ("desc" as const);

      const result = await listAuditLogs({
        action,
        actorId,
        page: pageNum,
        limit,
        offset,
        sortBy,
        sortOrder,
      });
      return {
        items: result.items,
        logs: result.items,
        pagination: result.pagination,
      };
    } catch (err) {
      return sendError(reply, err);
    }
  };
  app.get("/admin/audit", handleListAudit);

  // -------------------------------------------------------------
  // 5. ADMIN MODEL MANAGEMENT (Pengaturan Model & Poin)
  // -------------------------------------------------------------
  const handleGetModelSettings = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const provider = typeof req.query?.provider === "string" ? req.query.provider : undefined;
      const [settings, allModels] = await Promise.all([
        getDefaultGenerationModelsSetting(),
        listAdminModels({ provider }),
      ]);
      return {
        config: settings.value,
        models: allModels.models,
        providers: allModels.providers,
      };
    } catch (err) {
      return sendError(reply, err);
    }
  };
  app.get("/admin/models/settings", handleGetModelSettings);

  const handlePutModelSettings = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const body = (req.body ?? {}) as {
        normalT2iModelId?: unknown;
        normalI2iModelId?: unknown;
        spicyT2iModelId?: unknown;
        spicyI2iModelId?: unknown;
        normalVideoModelId?: unknown;
        spicyVideoModelId?: unknown;
        inpaintModelId?: unknown;
      };
      const result = await putDefaultGenerationModelsSetting({
        config: {
          normalT2iModelId: typeof body.normalT2iModelId === "string" ? body.normalT2iModelId : undefined,
          normalI2iModelId: typeof body.normalI2iModelId === "string" ? body.normalI2iModelId : undefined,
          spicyT2iModelId: typeof body.spicyT2iModelId === "string" ? body.spicyT2iModelId : undefined,
          spicyI2iModelId: typeof body.spicyI2iModelId === "string" ? body.spicyI2iModelId : undefined,
          normalVideoModelId: typeof body.normalVideoModelId === "string" ? body.normalVideoModelId : undefined,
          spicyVideoModelId: typeof body.spicyVideoModelId === "string" ? body.spicyVideoModelId : undefined,
          inpaintModelId: typeof body.inpaintModelId === "string" ? body.inpaintModelId : undefined,
        },
        actorId: session.userId,
        ip: requestIp(req),
      });
      return result;
    } catch (err) {
      return sendError(reply, err);
    }
  };
  app.put("/admin/models/settings", handlePutModelSettings);

  const handleListModels = async (req: any, reply: any) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const provider = typeof req.query?.provider === "string" ? req.query.provider : undefined;
      return await listAdminModels({ provider });
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
      const params = (req.params ?? {}) as Record<string, string>;
      const modelCatalogId = params["*"] || params.modelCatalogId || params.id;
      const body = (req.body ?? {}) as {
        costPoints?: unknown;
        videoConfigPoints?: unknown;
        displayName?: unknown;
        enabled?: unknown;
        isSpicy?: unknown;
      };
      const costPoints = typeof body.costPoints === "number" ? body.costPoints : undefined;
      const videoConfigPoints =
        body.videoConfigPoints !== undefined
          ? (body.videoConfigPoints as Record<string, number> | null)
          : undefined;
      const displayName = typeof body.displayName === "string" ? body.displayName : undefined;
      const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;
      const isSpicy = typeof body.isSpicy === "boolean" ? body.isSpicy : undefined;
      return await updateAdminModel({
        id: modelCatalogId,
        costPoints,
        videoConfigPoints,
        displayName,
        enabled,
        isSpicy,
        actorId: session.userId,
        ip: requestIp(req),
      });
    } catch (err) {
      return sendError(reply, err);
    }
  };
  app.patch("/admin/model/:modelCatalogId", handleUpdateModel);
  app.put("/admin/model/:modelCatalogId", handleUpdateModel);
  app.patch("/admin/models/:modelCatalogId", handleUpdateModel);
  app.put("/admin/models/:modelCatalogId", handleUpdateModel);
}
