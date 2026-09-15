import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { ErrorCodes } from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";
import { createObjectStorageFromEnv, objectStorageParamsFromEnv } from "@ai-gen-free/storage";
import { createSmtpMailer } from "./mail/smtp.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerWalletRoutes } from "./routes/wallet.js";
import { registerUploadRoutes } from "./routes/uploads.js";
import { registerPaymentRoutes } from "./routes/payment.js";
import { syncUploadsFromStorage } from "./uploads/service.js";
import { rewriteRequestUrl } from "./http-rewrite.js";
import { createMidtransPaymentGateway } from "./wallet/midtrans-factory.js";

import { randomBytes } from "node:crypto";

const port = Number(process.env.API_PORT ?? 4000);
const origin = process.env.APP_PUBLIC_URL ?? "http://localhost:3000";
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

const app = Fastify({
  logger: true,
  rewriteUrl: (req) => rewriteRequestUrl(req.url ?? "/", req.method ?? "GET"),
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

function notFoundBody(transactionId: string) {
  return {
    transaction_id: transactionId,
    error: { code: ErrorCodes.NOT_FOUND, message: "Rute tidak ditemukan" },
  };
}

function isFastifyDefault404(payload: unknown): payload is { message: string; error: string; statusCode: number } {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return false;
  const rec = payload as Record<string, unknown>;
  return rec.statusCode === 404 && rec.error === "Not Found" && typeof rec.message === "string" && rec.message.startsWith("Route ");
}

app.addHook("preSerialization", async (req, _reply, payload) => {
  if (isFastifyDefault404(payload)) {
    return notFoundBody(req.id);
  }
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
  if (error.code === "FST_ERR_NOT_FOUND") {
    return reply.status(404).send(notFoundBody(req.id));
  }

  const rawCode = typeof error.code === "string" ? error.code : "";
  const rawMsg = typeof error.message === "string" ? error.message : "";
  let status =
    typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : 500;
  let code: string = ErrorCodes.VALIDATION_ERROR;
  let message: string = error.message || "Terjadi kesalahan pada server";

  if (/^[A-Z]\d{3}$/.test(rawCode)) {
    code = rawCode;
  } else if (rawCode === "ERR_STREAM_PREMATURE_CLOSE" || rawMsg.toLowerCase().includes("premature close")) {
    code = ErrorCodes.UPLOAD_STREAM_ERROR;
    message = "Koneksi pengunggahan terputus sebelum berkas selesai diunggah. Silakan coba unggah kembali.";
    status = 400;
  } else if (
    rawCode === "FST_ERR_CTP_INVALID_MEDIA_TYPE" ||
    rawCode === "FST_INVALID_MULTIPART_CONTENT_TYPE" ||
    rawMsg.toLowerCase().includes("unsupported media type") ||
    rawMsg.toLowerCase().includes("multipart")
  ) {
    code = ErrorCodes.VALIDATION_ERROR;
    message = "Format permintaan tidak valid atau header Content-Type tidak sesuai. Gunakan form-data dengan field file.";
    status = 400;
  } else if (rawCode === "FST_REQ_FILE_TOO_LARGE" || status === 413) {
    code = ErrorCodes.VALIDATION_ERROR;
    message = "Ukuran berkas melebihi batas maksimal 5 MB.";
    status = 400;
  }

  reply.status(status).send({
    transaction_id: req.id,
    error: {
      code,
      message,
    },
  });
});

app.setNotFoundHandler((req, reply) => {
  reply.status(404).send(notFoundBody(req.id));
});

const redis = new IORedis(redisUrl);
const queueConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
const queue = new Queue("generate", { connection: queueConnection });
const mailer = createSmtpMailer();
const storageParams = objectStorageParamsFromEnv();
const storage = createObjectStorageFromEnv();
app.log.info({
  event: "api.storage",
  driver: storage.driver,
  endpointHost: (() => {
    const raw = storageParams.endpoint;
    if (!raw) return null;
    try {
      return new URL(raw).host;
    } catch {
      return raw;
    }
  })(),
  bucket: storageParams.bucket ?? null,
  hasCredentials: Boolean(storageParams.accessKeyId && storageParams.secretAccessKey),
});

await app.register(cors, {
  origin,
  credentials: true,
});
await app.register(cookie);
await app.register(multipart, {
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

app.get("/api/health", async () => ({ ok: true, service: "api" }));

await registerAuthRoutes(app, { redis, mailer });
await registerWalletRoutes(app, { storage });
await registerJobRoutes(app, { storage, queue });
await registerAdminRoutes(app, { storage, redis });
await registerUploadRoutes(app, { storage, redis });

// Payment routes (Midtrans integration)
const paymentGateway = createMidtransPaymentGateway(app.log);
await registerPaymentRoutes(app, {
  paymentGateway,
  callbackBaseUrl: origin,
  paymentDueMinutes: 60,
});

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

// Background sync existing uploads from storage into database
syncUploadsFromStorage(storage)
  .then((res) => {
    if (res.synced > 0) {
      app.log.info({ event: "uploads.storage_synced", ...res });
    }
  })
  .catch((err) => {
    app.log.warn({ event: "uploads.sync_failed", error: String(err) });
  });

