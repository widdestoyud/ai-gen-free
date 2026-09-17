import type { FastifyInstance } from "fastify";
import type { Queue } from "bullmq";
import { ErrorCodes, type ObjectStorage } from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";
import { assertStorageReady } from "@ai-gen-free/storage";
import { userFromCookie } from "../auth/service.js";
import { sendError } from "../http.js";
import { listEnabledModels } from "../jobs/catalog.js";
import { resolveSirayGenerateSlug, sirayGenerateParamsFromBody } from "../jobs/siray-generate.js";
import {
  getJobForUser,
  getJobOutputFileForUser,
  listCustomerLibrary,
  listJobsForUser,
  submitJob,
  updateJobAliasForUser,
} from "../jobs/service.js";
import { parseOptionalInt } from "../admin/parse.js";
import { getDefaultGenerationModelsSetting } from "../admin/service.js";

import type IORedis from "ioredis";

async function assertGenerateReady(storage: ObjectStorage): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
  await assertStorageReady(storage);
}

async function requireUser(
  req: { cookies: Record<string, string | undefined>; headers: Record<string, unknown> },
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
) {
  const token =
    (typeof req.cookies?.sid === "string" && req.cookies.sid.trim().length > 0 ? req.cookies.sid.trim() : undefined) ??
    (typeof req.headers["x-session-token"] === "string" && (req.headers["x-session-token"] as string).trim().length > 0
      ? (req.headers["x-session-token"] as string).trim()
      : undefined) ??
    (typeof req.headers["authorization"] === "string" && (req.headers["authorization"] as string).toLowerCase().startsWith("bearer ")
      ? (req.headers["authorization"] as string).slice(7).trim()
      : undefined);

  const session = await userFromCookie(token, "user");
  if (!session) {
    reply.status(401).send({ error: { code: ErrorCodes.UNAUTHENTICATED, message: "Silakan masuk" } });
    return null;
  }
  return session;
}

export async function registerJobRoutes(
  app: FastifyInstance,
  deps: { storage: ObjectStorage; queue: Queue; redis?: IORedis },
) {
  const enqueueGenerate = async (jobId: string) => {
    await deps.queue.add("generate", { jobId }, { jobId, attempts: 10, backoff: { type: "custom" } });
  };

  app.post("/generate/siray/:modelSlug", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    try {
      const { modelSlug } = req.params as { modelSlug: string };
      const mapped = resolveSirayGenerateSlug(modelSlug);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const idempotencyKey =
        req.headers["idempotency-key"] ?? `siray-${modelSlug}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const accepted = await submitJob({
        userId: session.userId,
        idempotencyKey,
        body: {
          mode: mapped.mode,
          modelId: mapped.modelId,
          prompt: body.prompt,
          params: sirayGenerateParamsFromBody(body, mapped.defaultParams),
        },
        enqueue: enqueueGenerate,
        assertReady: () => assertGenerateReady(deps.storage),
      });
      return reply.code(202).send(accepted);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/customer/models", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    const [models, defaultsSetting] = await Promise.all([
      listEnabledModels(),
      getDefaultGenerationModelsSetting(),
    ]);
    return { models, defaults: defaultsSetting.value };
  });

  app.post("/jobs", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    try {
      const accepted = await submitJob({
        userId: session.userId,
        idempotencyKey: req.headers["idempotency-key"],
        body: (req.body ?? {}) as {
          mode?: unknown;
          modelId?: unknown;
          prompt?: unknown;
          params?: unknown;
          cost?: unknown;
          providerId?: unknown;
        },
        enqueue: enqueueGenerate,
        assertReady: () => assertGenerateReady(deps.storage),
      });
      return reply.code(202).send(accepted);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  // GET /customer/generated-lists (Khusus daftar pekerjaan generate AI)
  app.get("/customer/generated-lists", async (req: any, reply: any) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    return await listJobsForUser({ userId: session.userId, storage: deps.storage });
  });

  // GET /customer/library (Daftar gabungan generated image/video dan uploaded images, default 20 per halaman)
  app.get("/customer/library", async (req: any, reply: any) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    try {
      const q = (req.query ?? {}) as {
        limit?: unknown;
        offset?: unknown;
        type?: unknown;
        kind?: unknown;
        sort?: unknown;
        sortBy?: unknown;
        order?: unknown;
        q?: unknown;
      };
      const limit = parseOptionalInt(q.limit, 20);
      const offset = parseOptionalInt(q.offset, 0);
      const type = typeof q.type === "string" ? q.type : typeof q.kind === "string" ? q.kind : "all";
      const sort = typeof q.sort === "string" ? q.sort : typeof q.sortBy === "string" ? q.sortBy : "date";
      const order = typeof q.order === "string" ? q.order : "desc";
      const search = typeof q.q === "string" ? q.q.trim() : undefined;

      const data = await listCustomerLibrary({
        userId: session.userId,
        storage: deps.storage,
        limit,
        offset,
        type,
        sort,
        order,
        q: search,
      });
      return reply.status(200).send(data);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/customer/generated/:jobId", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    try {
      const { jobId } = req.params as { jobId: string };
      return await getJobForUser({ userId: session.userId, id: jobId, storage: deps.storage });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.patch("/customer/generated/:jobId", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    try {
      const { jobId } = req.params as { jobId: string };
      const body = (req.body ?? {}) as { alias?: unknown };
      return await updateJobAliasForUser({
        userId: session.userId,
        id: jobId,
        rawAlias: body.alias,
        storage: deps.storage,
      });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/customer/generated/:jobId/file", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    try {
      const { jobId } = req.params as { jobId: string };
      const file = await getJobOutputFileForUser({
        userId: session.userId,
        id: jobId,
        storage: deps.storage,
      });
      reply.header("Content-Type", file.contentType);
      reply.header("Cache-Control", "private, max-age=60");
      reply.header("Content-Disposition", "inline");
      return reply.send(Buffer.from(file.bytes));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  const handleJobEvents = async (req: any, reply: any) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    const { jobId } = req.params as { jobId: string };

    const job = await prisma.job.findFirst({
      where: { id: jobId, userId: session.userId },
      include: { assets: { select: { storageKey: true, contentType: true, createdAt: true } } },
    });
    if (!job) {
      return reply.status(404).send({
        error: { code: ErrorCodes.NOT_FOUND, message: "Job tidak ditemukan" },
      });
    }

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    reply.raw.flushHeaders?.();

    if (job.status === "succeeded") {
      const output = job.assets[0]
        ? {
            url: `/customer/generated/${job.id}/file`,
            contentType: job.assets[0].contentType,
            createdAt: job.assets[0].createdAt.toISOString(),
          }
        : null;
      reply.raw.write(
        `data: ${JSON.stringify({
          jobId: job.id,
          status: "succeeded",
          progressPct: 100,
          output,
          nextGenerateAt: job.nextGenerateAt ? job.nextGenerateAt.toISOString() : null,
        })}\n\n`,
      );
      reply.raw.end();
      return;
    }

    if (job.status === "failed" || job.status === "canceled") {
      reply.raw.write(
        `data: ${JSON.stringify({
          jobId: job.id,
          status: job.status,
          errorCode: job.errorCode,
          errorMessage: job.errorMessage,
        })}\n\n`,
      );
      reply.raw.end();
      return;
    }

    if (!deps.redis) {
      reply.raw.write(
        `data: ${JSON.stringify({
          jobId: job.id,
          status: job.status,
          progressPct: job.progressPct ?? 0,
        })}\n\n`,
      );
      reply.raw.end();
      return;
    }

    const subscriber = deps.redis.duplicate();
    const channel = `job-events:${jobId}`;

    const cleanup = async () => {
      clearInterval(heartbeat);
      subscriber.removeAllListeners();
      try {
        await subscriber.unsubscribe(channel);
        await subscriber.quit();
      } catch {}
    };

    subscriber.on("message", (chn, message) => {
      if (chn !== channel) return;
      reply.raw.write(`data: ${message}\n\n`);
      try {
        const parsed = JSON.parse(message);
        if (parsed.status === "succeeded" || parsed.status === "failed" || parsed.status === "canceled") {
          void cleanup();
          reply.raw.end();
        }
      } catch {}
    });

    try {
      await subscriber.subscribe(channel);
    } catch {
      void cleanup();
      reply.raw.end();
      return;
    }

    reply.raw.write(
      `data: ${JSON.stringify({
        jobId: job.id,
        status: job.status,
        progressPct: job.progressPct ?? 0,
      })}\n\n`,
    );

    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(":ping\n\n");
      } catch {
        void cleanup();
      }
    }, 15000);

    req.raw.on("close", () => {
      void cleanup();
    });
  };

  app.get("/customer/generated/:jobId/events", handleJobEvents);
  app.get("/customer/jobs/:jobId/events", handleJobEvents);
}
