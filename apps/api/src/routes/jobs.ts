import type { FastifyInstance } from "fastify";
import type { Queue } from "bullmq";
import { ErrorCodes, type ObjectStorage } from "@ai-gen-free/core";
import { userFromCookie } from "../auth/service.js";
import { sendError } from "../http.js";
import { listEnabledModels } from "../jobs/catalog.js";
import { getJobForUser, listJobsForUser, submitJob } from "../jobs/service.js";

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
  app.get("/api/catalog/generate", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    return { models: await listEnabledModels() };
  });

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
              attempts: 5,
              backoff: { type: "custom" },
            },
          );
        },
      });
      return reply.code(202).send(accepted);
    } catch (err) {
      return sendError(reply, err);
    }
  };

  app.post("/generate/siray/gpt-image-2-t2i", handleSirayGptImage2);
  app.post("/api/generate/siray/gpt-image-2-t2i", handleSirayGptImage2);

  app.post("/api/jobs", async (req, reply) => {
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
              attempts: 5,
              backoff: { type: "custom" },
            },
          );
        },
      });
      return reply.code(202).send(accepted);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/jobs", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    return await listJobsForUser({ userId: session.userId, storage: deps.storage });
  });

  app.get("/api/jobs/:id", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      return await getJobForUser({ userId: session.userId, id, storage: deps.storage });
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
