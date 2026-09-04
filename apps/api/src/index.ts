import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import IORedis from "ioredis";
import { ErrorCodes } from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";
import { createSmtpMailer } from "./mail/smtp.js";
import { registerAuthRoutes } from "./routes/auth.js";

const port = Number(process.env.API_PORT ?? 3001);
const origin = process.env.APP_PUBLIC_URL ?? "http://localhost:3000";
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

const app = Fastify({ logger: true });
const redis = new IORedis(redisUrl);
const mailer = createSmtpMailer();

await app.register(cors, {
  origin,
  credentials: true,
});
await app.register(cookie);

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

const shutdown = async () => {
  await app.close();
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ port, host: "0.0.0.0" });
