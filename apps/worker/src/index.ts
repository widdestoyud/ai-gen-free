import Fastify from "fastify";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import type { GenerationProvider } from "@ai-gen-free/core";
import { createObjectStorageFromEnv, objectStorageParamsFromEnv } from "@ai-gen-free/storage";
import { SirayProvider } from "@ai-gen-free/providers-siray";
import { DummyProvider } from "./dummy.js";
import { fetchOutputBytes, fetchWithSirayAuth } from "./fetch-output.js";
import { processGenerateJob } from "./process-job.js";
import { recoverCopyPendingJobs, RECOVER_EVERY_MS } from "./recover-copy.js";
import { appendSirayTrace, runWithSirayJobLog } from "./siray-file-log.js";
import { createPrismaGenerateStore } from "./store.js";
import {
  RETENTION_EVERY_MS,
  createPrismaRetentionStore,
  runRetentionSweep,
} from "./retention.js";

const healthPort = Number(process.env.WORKER_HEALTH_PORT ?? 3002);
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 3);

const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
const storageParams = objectStorageParamsFromEnv();
let storage;
try {
  storage = createObjectStorageFromEnv();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(
    JSON.stringify({
      event: "worker.storage",
      source: "storage",
      ok: false,
      driver: storageParams.driver,
      endpointHost: hostOf(storageParams.endpoint),
      bucket: storageParams.bucket ?? null,
      hasCredentials: Boolean(storageParams.accessKeyId && storageParams.secretAccessKey),
      message,
      hint: "Cloudflare Dashboard → R2 object storage → API Tokens. Access Key ID = STORAGE_ACCESS_KEY, Secret Access Key = STORAGE_SECRET_KEY. https://developers.cloudflare.com/r2/api/tokens/",
    }),
  );
  throw err;
}
console.log(
  JSON.stringify({
    event: "worker.storage",
    source: "storage",
    ok: true,
    driver: storage.driver,
    endpointHost: hostOf(storageParams.endpoint),
    bucket: storageParams.bucket ?? null,
    hasCredentials: Boolean(storageParams.accessKeyId && storageParams.secretAccessKey),
  }),
);
const store = createPrismaGenerateStore();

const sirayToken = process.env.SIRAY_API_TOKEN ?? "";
const fetchBytes = (url: string) => fetchOutputBytes(url, fetchWithSirayAuth(sirayToken));

const providers = new Map<string, GenerationProvider>([
  ["dummy", new DummyProvider()],
  [
    "siray",
    new SirayProvider({
      token: sirayToken,
      apiBase: process.env.SIRAY_API_BASE,
      onTrace: (event) => appendSirayTrace(event),
    }),
  ],
]);

const queueName = "generate";
const queue = new Queue(queueName, { connection });
// Queue `retention` terpisah agar FIFO generate tidak terganjal.
const retentionConnection = connection.duplicate();
const retentionQueue = new Queue("retention", { connection: retentionConnection });
const retentionStore = createPrismaRetentionStore();

function backoffMs(attemptsMade: number): number {
  return 5000 * 3 ** Math.max(0, attemptsMade - 1);
}

const worker = new Worker(
  queueName,
  async (job) => {
    const jobId = typeof job.data?.jobId === "string" ? job.data.jobId : job.id;
    if (!jobId) throw new Error("generate job missing jobId");
    const maxAttempts = job.opts.attempts ?? 5;
    const lastAttempt = job.attemptsMade + 1 >= maxAttempts;
    await runWithSirayJobLog(jobId, () =>
      processGenerateJob({
        jobId,
        providers,
        storage,
        store,
        lastAttempt,
        fetchBytes,
      }),
    );
    return { jobId };
  },
  {
    connection,
    concurrency,
    lockDuration: 120_000,
    stalledInterval: 15_000,
    settings: {
      backoffStrategy: (attemptsMade) => backoffMs(attemptsMade),
    },
  },
);

worker.on("error", (err) => {
  console.error("worker error", err);
});

const retentionWorker = new Worker(
  "retention",
  async () => {
    await runRetentionSweep({ store: retentionStore, storage });
  },
  { connection: retentionConnection, concurrency: 1 },
);

retentionWorker.on("error", (err) => {
  console.error("retention worker error", err);
});

await retentionQueue.upsertJobScheduler(
  "retention-sweep",
  { every: RETENTION_EVERY_MS },
  { name: "sweep", data: {} },
);

setInterval(() => {
  recoverCopyPendingJobs({ store, queue }).catch((err) => {
    console.error("recover-copy error", err);
  });
}, RECOVER_EVERY_MS).unref();

recoverCopyPendingJobs({ store, queue }).catch((err) => {
  console.error("recover-copy error", err);
});

worker.on("failed", async (job) => {
  if (!job) return;
  const maxAttempts = job.opts.attempts ?? 5;
  if (job.attemptsMade < maxAttempts) return;
  const jobId = typeof job.data?.jobId === "string" ? job.data.jobId : job.id;
  if (!jobId) return;
  try {
    await runWithSirayJobLog(jobId, () =>
      processGenerateJob({
        jobId,
        providers,
        storage,
        store,
        lastAttempt: true,
        fetchBytes,
      }),
    );
  } catch (err) {
    console.error("worker fail-closed error", err);
  }
});

const app = Fastify({ logger: true });

app.get("/health", async () => ({
  ok: true,
  service: "worker",
  queue: queueName,
  waiting: await queue.getWaitingCount(),
  retentionWaiting: await retentionQueue.getWaitingCount(),
}));

const shutdown = async () => {
  await worker.close();
  await retentionWorker.close();
  await queue.close();
  await retentionQueue.close();
  await retentionConnection.quit();
  await connection.quit();
  await app.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ port: healthPort, host: "0.0.0.0" });

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
