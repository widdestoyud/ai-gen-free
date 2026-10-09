import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { AppError, ErrorCodes } from "@ai-gen-free/core";
import { AuthError } from "./auth/service.js";

function buildTestApp() {
  const app = Fastify({ logger: false });

  app.setErrorHandler((error, req, reply) => {
    if (reply.sent) return;
    if (error.code === "FST_ERR_NOT_FOUND") {
      return reply.status(404).send({
        transaction_id: req.id,
        error: { code: ErrorCodes.NOT_FOUND, message: "Rute tidak ditemukan" },
      });
    }

    const rawCode = typeof error.code === "string" ? error.code : "";
    const rawMsg = typeof error.message === "string" ? error.message : "";

    let status =
      typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 600
        ? error.statusCode
        : 500;
    let code: string = ErrorCodes.NOT_READY;
    let message: string = "Terjadi gangguan sementara pada sistem. Silakan coba beberapa saat lagi.";
    let extra: Record<string, unknown> | undefined;

    if (error instanceof AppError) {
      status = error.status;
      code = error.code;
      message = error.message;
      extra = error.extra;
    } else if (error instanceof AuthError) {
      status = error.status;
      code = error.code;
      message = error.message;
    } else if (/^[A-Z]\d{3}$/.test(rawCode)) {
      code = rawCode;
      if (status < 500) {
        message = error.message || "Permintaan tidak valid.";
      }
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
    } else if (rawCode === "FST_ERR_VALIDATION" || (error as any).validation) {
      code = ErrorCodes.VALIDATION_ERROR;
      message = "Data yang dikirim tidak valid.";
      status = 400;
    } else if (status === 400 || (error instanceof SyntaxError && "body" in error)) {
      code = ErrorCodes.VALIDATION_ERROR;
      message = "Format permintaan tidak valid.";
      status = 400;
    } else if (status === 401) {
      code = ErrorCodes.UNAUTHENTICATED;
      message = "Sesi tidak valid atau telah berakhir. Silakan masuk kembali.";
    } else if (status === 403) {
      code = ErrorCodes.FORBIDDEN;
      message = "Akses ditolak.";
    } else if (status === 404) {
      code = ErrorCodes.NOT_FOUND;
      message = "Rute tidak ditemukan";
    } else if (status === 429) {
      code = ErrorCodes.RATE_LIMITED;
      message = "Terlalu banyak permintaan. Silakan coba beberapa saat lagi.";
    }

    reply.status(status).send({
      transaction_id: req.id,
      error: {
        code,
        message,
      },
      ...(extra ?? {}),
    });
  });

  app.get("/test/db-error", async () => {
    throw new Error(
      "Invalid `prisma.user.findUnique()` invocation in /app/apps/api/src/auth/service.ts:72:34\nFATAL: (ECIRCUITBREAKER) too many authentication failures"
    );
  });

  app.get("/test/app-error", async () => {
    throw new AppError("A018", "Email tidak ditemukan", 404);
  });

  app.get("/test/auth-error", async () => {
    throw new AuthError("A012", "Kata sandi yang Anda masukkan salah.", 401);
  });

  return app;
}

test("API error handler sanitizes Prisma / DB error and returns safe E001 code and message", async () => {
  const app = buildTestApp();
  const res = await app.inject({
    method: "GET",
    url: "/test/db-error",
  });

  assert.equal(res.statusCode, 500);
  const json = JSON.parse(res.payload);
  assert.equal(json.error.code, "E001");
  assert.equal(json.error.message, "Terjadi gangguan sementara pada sistem. Silakan coba beberapa saat lagi.");
  assert.equal(res.payload.includes("prisma"), false);
  assert.equal(res.payload.includes("ECIRCUITBREAKER"), false);
});

test("API error handler preserves curated AppError and AuthError codes and messages", async () => {
  const app = buildTestApp();

  const resApp = await app.inject({ method: "GET", url: "/test/app-error" });
  assert.equal(resApp.statusCode, 404);
  const jsonApp = JSON.parse(resApp.payload);
  assert.equal(jsonApp.error.code, "A018");
  assert.equal(jsonApp.error.message, "Email tidak ditemukan");

  const resAuth = await app.inject({ method: "GET", url: "/test/auth-error" });
  assert.equal(resAuth.statusCode, 401);
  const jsonAuth = JSON.parse(resAuth.payload);
  assert.equal(jsonAuth.error.code, "A012");
  assert.equal(jsonAuth.error.message, "Kata sandi yang Anda masukkan salah.");
});
