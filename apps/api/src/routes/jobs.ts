import type { FastifyInstance } from "fastify";
import type { Queue } from "bullmq";
import { ErrorCodes, type ObjectStorage } from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";
import { assertStorageReady } from "@ai-gen-free/storage";
import { userFromCookie } from "../auth/service.js";
import { sendError } from "../http.js";
import { listEnabledModels } from "../jobs/catalog.js";
import { getJobForUser, getJobOutputFileForUser, listJobsForUser, submitJob } from "../jobs/service.js";

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
  deps: { storage: ObjectStorage; queue: Queue },
) {
  const handleSirayGptImage2 = async (req: any, reply: any) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const idempotencyKey =
        req.headers["idempotency-key"] ?? `siray-gpt2-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const accepted = await submitJob({
        userId: session.userId,
        idempotencyKey,
        body: {
          mode: "t2i",
          modelId: "openai/gpt-image-2-t2i",
          prompt: body.prompt,
          params: {
            n: body.n,
            output_format: body.output_format ?? body.outputFormat,
            quality: body.quality,
            size: body.size,
            moderation: body.moderation,
            aspectRatio: body.aspectRatio ?? body.aspect_ratio,
          },
        },
        enqueue: async (jobId) => {
          await deps.queue.add(
            "generate",
            { jobId },
            {
              jobId,
              attempts: 10,
              backoff: { type: "custom" },
            },
          );
        },
        assertReady: () => assertGenerateReady(deps.storage),
      });
      return reply.code(202).send(accepted);
    } catch (err) {
      return sendError(reply, err);
    }
  };

  app.post("/generate/siray/gpt-image-2-t2i", handleSirayGptImage2);

  app.get("/customer/models", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    return { models: await listEnabledModels() };
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
        enqueue: async (jobId) => {
          await deps.queue.add(
            "generate",
            { jobId },
            {
              jobId,
              attempts: 10,
              backoff: { type: "custom" },
            },
          );
        },
        assertReady: () => assertGenerateReady(deps.storage),
      });
      return reply.code(202).send(accepted);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/customer/generated-lists", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    return await listJobsForUser({ userId: session.userId, storage: deps.storage });
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
}
