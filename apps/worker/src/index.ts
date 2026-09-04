import Fastify from "fastify";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { createObjectStorageFromEnv } from "@ai-gen-free/storage";
import { processDummyJob } from "./dummy.js";

const healthPort = Number(process.env.WORKER_HEALTH_PORT ?? 3002);
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
const storage = createObjectStorageFromEnv();

const queueName = "generate";
const queue = new Queue(queueName, { connection });

const worker = new Worker(
  queueName,
  async (job) => {
    const jobId = typeof job.data?.jobId === "string" ? job.data.jobId : job.id;
    if (!jobId) throw new Error("generate job missing jobId");
    await processDummyJob(jobId, storage);
    return { jobId };
  },
  {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 3),
  },
);

worker.on("error", (err) => {
  console.error("worker error", err);
});

const app = Fastify({ logger: true });

app.get("/health", async () => ({
  ok: true,
  service: "worker",
  queue: queueName,
  waiting: await queue.getWaitingCount(),
}));

const shutdown = async () => {
  await worker.close();
  await queue.close();
  await connection.quit();
  await app.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ port: healthPort, host: "0.0.0.0" });
