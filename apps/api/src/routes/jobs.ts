import type { FastifyInstance } from "fastify";
import type { Queue } from "bullmq";
import { ErrorCodes, type ObjectStorage } from "@ai-gen-free/core";
import { userFromCookie } from "../auth/service.js";
import { sendError } from "../http.js";
import { listEnabledModels } from "../jobs/catalog.js";
import { getJobForUser, listJobsForUser, submitJob } from "../jobs/service.js";

async function requireUser(
  req: { cookies: { sid?: string } },
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
) {
  const session = await userFromCookie(req.cookies.sid, "user");
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
