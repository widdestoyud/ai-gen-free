import Fastify from "fastify";
import cors from "@fastify/cors";
import { ErrorCodes } from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";

const port = Number(process.env.API_PORT ?? 3001);
const origin = process.env.APP_PUBLIC_URL ?? "http://localhost:3000";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin,
  credentials: true,
});

app.get("/api/health", async () => ({ ok: true, service: "api" }));

app.get("/api/ready", async (_req, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, service: "api" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "database unavailable";
    return reply.status(503).send({
      error: { code: ErrorCodes.NOT_READY, message },
    });
  }
});

const shutdown = async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ port, host: "0.0.0.0" });
