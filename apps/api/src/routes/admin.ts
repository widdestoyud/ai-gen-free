import type { FastifyInstance } from "fastify";
import "@fastify/cookie";
import { ErrorCodes, type ObjectStorage } from "@ai-gen-free/core";
import { userFromCookie } from "../auth/service.js";
import { requestIp, sendError } from "../http.js";
import {
  parseAdjustBody,
  parseCooldownSecondsValue,
  parseIdempotencyKey,
  parseJobStatus,
  parseLimitOffset,
  parseOptionalQueryString,
} from "../admin/parse.js";
import {
  adjustUserWallet,
  getAdminUser,
  getGenerateCooldownSetting,
  listAdminUsers,
  listAuditLogs,
  putGenerateCooldownSetting,
  resetUserCooldown,
} from "../admin/service.js";
import { getAdminJob, getAdminJobOutputFile, listAdminJobs } from "../jobs/service.js";

async function requireAdmin(
  req: { cookies: { sid_admin?: string } },
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
) {
  const session = await userFromCookie(req.cookies.sid_admin, "admin");
  if (!session || session.user.role !== "admin") {
    reply.status(401).send({
      error: { code: ErrorCodes.UNAUTHENTICATED, message: "Silakan masuk sebagai admin" },
    });
    return null;
  }
  return session;
}

export async function registerAdminRoutes(app: FastifyInstance, deps: { storage: ObjectStorage }) {
  app.get("/api/admin/settings/generate_cooldown_seconds", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    return await getGenerateCooldownSetting();
  });

  app.put("/api/admin/settings/generate_cooldown_seconds", async (req, reply) => {
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
  });

  app.get("/api/admin/users", async (req, reply) => {
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
  });

  app.get("/api/admin/users/:id", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      return await getAdminUser(id);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/api/admin/users/:id/cooldown/reset", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      return await resetUserCooldown({ userId: id, actorId: session.userId, ip: requestIp(req) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/api/admin/users/:id/wallet/adjust", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      const body = (req.body ?? {}) as { amount?: unknown; reason?: unknown };
      const parsed = parseAdjustBody(body);
      const clientKey = parseIdempotencyKey(req.headers["idempotency-key"]);
      return await adjustUserWallet({
        userId: id,
        amount: parsed.amount,
        reason: parsed.reason,
        clientKey,
        actorId: session.userId,
        ip: requestIp(req),
      });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/admin/jobs", async (req, reply) => {
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
  });

  app.get("/api/admin/jobs/:id", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      return await getAdminJob({ id, storage: deps.storage });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/admin/jobs/:id/file", async (req, reply) => {
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
  });

  app.get("/api/admin/audit", async (req, reply) => {
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
  });
}
