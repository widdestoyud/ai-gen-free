import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { ErrorCodes } from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";
import { createObjectStorageFromEnv } from "@ai-gen-free/storage";
import { createSmtpMailer } from "./mail/smtp.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerWalletRoutes } from "./routes/wallet.js";

import { randomBytes } from "node:crypto";

const port = Number(process.env.API_PORT ?? 4000);
const origin = process.env.APP_PUBLIC_URL ?? "http://localhost:3000";
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

const app = Fastify({
  logger: true,
  genReqId: (req) => {
    const existing = req.headers["x-transaction-id"];
    if (typeof existing === "string" && existing.length >= 8 && existing.length <= 128) {
      return existing;
    }
    return `tx-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  },
  requestIdHeader: "x-transaction-id",
});

app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body: string, done) => {
  if (!body || body.trim() === "") {
    done(null, {});
    return;
  }
  try {
    const json = JSON.parse(body);
    done(null, json);
  } catch (err: any) {
    err.statusCode = 400;
    done(err, undefined);
  }
});

app.addHook("preSerialization", async (req, _reply, payload) => {
  if (
    payload !== null &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    !Buffer.isBuffer(payload) &&
    !("transaction_id" in (payload as Record<string, unknown>))
  ) {
    return {
      transaction_id: req.id,
      ...(payload as Record<string, unknown>),
    };
  }
  return payload;
});

app.setErrorHandler((error, req, reply) => {
  req.log.error(error);
  if (reply.sent) return;
  const status =
    typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : 500;
  reply.status(status).send({
    transaction_id: req.id,
    error: {
      code: (error as Record<string, unknown>).code || ErrorCodes.VALIDATION_ERROR,
      message: error.message || "Terjadi kesalahan pada server",
    },
  });
});
const redis = new IORedis(redisUrl);
const queueConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
const queue = new Queue("generate", { connection: queueConnection });
const mailer = createSmtpMailer();
const storage = createObjectStorageFromEnv();

await app.register(cors, {
  origin,
  credentials: true,
});
await app.register(cookie);
await app.register(multipart, {
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

app.get("/health", async () => ({ ok: true, service: "api" }));
app.get("/api/health", async () => ({ ok: true, service: "api" }));

app.get("/api/ready", async (_req, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    return { ok: true, service: "api" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "dependency unavailable";
    return reply.status(503).send({
      error: { code: ErrorCodes.NOT_READY, message },
    });
  }
});

await registerAuthRoutes(app, { redis, mailer });
await registerWalletRoutes(app, { storage });
await registerJobRoutes(app, { storage, queue });
await registerAdminRoutes(app, { storage, redis });

const shutdown = async () => {
  await app.close();
  await queue.close();
  await queueConnection.quit();
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ port, host: "0.0.0.0" });
