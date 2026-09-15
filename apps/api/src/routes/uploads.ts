import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import "@fastify/multipart";
import { ErrorCodes, type ObjectStorage } from "@ai-gen-free/core";
import { AuthError, userFromCookie } from "../auth/service.js";
import { sendError } from "../http.js";
import { parseLimitOffset } from "../admin/parse.js";
import {
  checkUploadRateLimit,
  getUploadFileForAdmin,
  getUploadFileForUser,
  listAdminUploads,
  listCustomerUploads,
  processUpload,
  softDeleteUploadForAdmin,
  softDeleteUploadForUser,
  updateUploadAliasForAdmin,
  updateUploadAliasForUser,
} from "../uploads/service.js";
import type IORedis from "ioredis";

export function normalizeUploadError(err: unknown): AuthError {
  if (err instanceof AuthError) return err;

  const rawCode = typeof err === "object" && err !== null && "code" in err ? String((err as any).code) : "";
  const rawMsg = typeof err === "object" && err !== null && "message" in err ? String((err as any).message) : "";
  const statusCode =
    typeof err === "object" && err !== null && "statusCode" in err ? Number((err as any).statusCode) : 0;

  if (rawCode === "ERR_STREAM_PREMATURE_CLOSE" || rawMsg.toLowerCase().includes("premature close")) {
    return new AuthError(
      ErrorCodes.UPLOAD_STREAM_ERROR,
      "Koneksi pengunggahan terputus sebelum berkas selesai diunggah. Pastikan koneksi stabil dan coba unggah kembali.",
      400,
    );
  }

  if (rawCode === "FST_REQ_FILE_TOO_LARGE" || statusCode === 413) {
    return new AuthError(
      ErrorCodes.VALIDATION_ERROR,
      "Ukuran berkas melebihi batas maksimal 5 MB",
      400,
    );
  }

  if (
    rawCode === "FST_INVALID_MULTIPART_CONTENT_TYPE" ||
    rawCode === "FST_ERR_CTP_INVALID_MEDIA_TYPE" ||
    rawMsg.toLowerCase().includes("multipart") ||
    rawMsg.toLowerCase().includes("unsupported media type")
  ) {
    return new AuthError(
      ErrorCodes.VALIDATION_ERROR,
      "Format permintaan tidak valid atau header Content-Type tidak sesuai. Gunakan form-data dengan field file.",
      400,
    );
  }

  return new AuthError(
    ErrorCodes.VALIDATION_ERROR,
    rawMsg || "Terjadi kesalahan saat memproses pengunggahan berkas",
    400,
  );
}

async function requireUser(
  req: { cookies: Record<string, string | undefined>; headers: Record<string, unknown> },
  reply: FastifyReply,
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

async function requireAdmin(
  req: { cookies: Record<string, string | undefined>; headers: Record<string, unknown> },
  reply: FastifyReply,
) {
  const token =
    (typeof req.cookies?.sid_admin === "string" && req.cookies.sid_admin.trim().length > 0 ? req.cookies.sid_admin.trim() : undefined) ??
    (typeof req.cookies?.sid === "string" && req.cookies.sid.trim().length > 0 ? req.cookies.sid.trim() : undefined) ??
    (typeof req.headers["x-session-token"] === "string" && (req.headers["x-session-token"] as string).trim().length > 0
      ? (req.headers["x-session-token"] as string).trim()
      : undefined) ??
    (typeof req.headers["authorization"] === "string" && (req.headers["authorization"] as string).toLowerCase().startsWith("bearer ")
      ? (req.headers["authorization"] as string).slice(7).trim()
      : undefined);

  let session = await userFromCookie(token, "admin");
  if (!session) {
    session = await userFromCookie(token, "user");
  }
  if (!session || session.user.role !== "admin") {
    reply.status(401).send({
      error: { code: ErrorCodes.UNAUTHENTICATED, message: "Silakan masuk sebagai admin" },
    });
    return null;
  }
  return session;
}

export interface UploadRouteDeps {
  storage: ObjectStorage;
  redis: IORedis;
}

export async function registerUploadRoutes(app: FastifyInstance, deps: UploadRouteDeps) {
  // POST /customer/uploads
  app.post("/customer/uploads", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireUser(req, reply);
    if (!session) return;

    try {
      await checkUploadRateLimit(deps.redis, "customer", session.userId);

      const file = await req.file();
      if (!file) {
        throw new AuthError(ErrorCodes.VALIDATION_ERROR, "File gambar wajib diunggah", 400);
      }

      const buffer = await file.toBuffer();
      const rawAlias = (file.fields?.alias as any)?.value;

      const result = await processUpload({
        storage: deps.storage,
        actor: "customer",
        actorId: session.userId,
        buffer,
        contentType: file.mimetype,
        alias: typeof rawAlias === "string" ? rawAlias : undefined,
      });

      return reply.status(200).send(result);
    } catch (err) {
      return sendError(reply, normalizeUploadError(err), req);
    }
  });

  // GET /customer/uploads
  app.get("/customer/uploads", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireUser(req, reply);
    if (!session) return;

    try {
      const pagination = parseLimitOffset(req.query as { limit?: unknown; offset?: unknown });
      const data = await listCustomerUploads(deps.storage, session.userId, pagination);
      return reply.status(200).send(data);
    } catch (err) {
      return sendError(reply, err, req);
    }
  });

  // GET /customer/uploads/:id/file (Stream file biner same-origin tanpa ekspos R2)
  app.get("/customer/uploads/:id/file", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireUser(req, reply);
    if (!session) return;

    try {
      const { id } = req.params as { id: string };
      const file = await getUploadFileForUser({
        storage: deps.storage,
        userId: session.userId,
        id,
      });
      reply.header("Content-Type", file.contentType);
      reply.header("Cache-Control", "private, max-age=3600");
      reply.header("Content-Disposition", "inline");
      return reply.send(Buffer.from(file.body));
    } catch (err) {
      return sendError(reply, err, req);
    }
  });

  // DELETE /customer/uploads/:id (Soft delete berkas gambar upload pengguna)
  app.delete("/customer/uploads/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireUser(req, reply);
    if (!session) return;

    try {
      const { id } = req.params as { id: string };
      const res = await softDeleteUploadForUser(session.userId, id);
      return reply.status(200).send(res);
    } catch (err) {
      return sendError(reply, err, req);
    }
  });

  // PATCH /customer/uploads/:id (Ubah alias berkas gambar upload pengguna)
  app.patch("/customer/uploads/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireUser(req, reply);
    if (!session) return;

    try {
      const { id } = req.params as { id: string };
      const body = (req.body ?? {}) as { alias?: unknown };
      const res = await updateUploadAliasForUser(session.userId, id, body.alias);
      return reply.status(200).send(res);
    } catch (err) {
      return sendError(reply, err, req);
    }
  });

  // POST /admin/uploads
  app.post("/admin/uploads", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;

    try {
      await checkUploadRateLimit(deps.redis, "admin", session.userId);

      const file = await req.file();
      if (!file) {
        throw new AuthError(ErrorCodes.VALIDATION_ERROR, "File gambar wajib diunggah", 400);
      }

      const buffer = await file.toBuffer();
      const rawAlias = (file.fields?.alias as any)?.value;

      const result = await processUpload({
        storage: deps.storage,
        actor: "admin",
        actorId: session.userId,
        buffer,
        contentType: file.mimetype,
        alias: typeof rawAlias === "string" ? rawAlias : undefined,
      });

      return reply.status(200).send(result);
    } catch (err) {
      return sendError(reply, normalizeUploadError(err), req);
    }
  });

  // GET /admin/uploads
  app.get("/admin/uploads", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;

    try {
      const pagination = parseLimitOffset(req.query as { limit?: unknown; offset?: unknown });
      const data = await listAdminUploads(deps.storage, pagination);
      return reply.status(200).send(data);
    } catch (err) {
      return sendError(reply, err, req);
    }
  });

  // GET /admin/uploads/:id/file (Stream file biner upload untuk admin)
  app.get("/admin/uploads/:id/file", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;

    try {
      const { id } = req.params as { id: string };
      const file = await getUploadFileForAdmin({
        storage: deps.storage,
        id,
      });
      reply.header("Content-Type", file.contentType);
      reply.header("Cache-Control", "private, max-age=3600");
      reply.header("Content-Disposition", "inline");
      return reply.send(Buffer.from(file.body));
    } catch (err) {
      return sendError(reply, err, req);
    }
  });

  // DELETE /admin/uploads/:id (Soft delete berkas gambar upload oleh admin)
  app.delete("/admin/uploads/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;

    try {
      const { id } = req.params as { id: string };
      const res = await softDeleteUploadForAdmin(id);
      return reply.status(200).send(res);
    } catch (err) {
      return sendError(reply, err, req);
    }
  });

  // PATCH /admin/uploads/:id (Ubah alias berkas gambar upload oleh admin)
  app.patch("/admin/uploads/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;

    try {
      const { id } = req.params as { id: string };
      const body = (req.body ?? {}) as { alias?: unknown };
      const res = await updateUploadAliasForAdmin(id, body.alias);
      return reply.status(200).send(res);
    } catch (err) {
      return sendError(reply, err, req);
    }
  });

  // POST /admin/uploads/sync
  app.post("/admin/uploads/sync", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;

    try {
      const { syncUploadsFromStorage } = await import("../uploads/service.js");
      const result = await syncUploadsFromStorage(deps.storage);
      return reply.status(200).send({ ok: true, sync: result });
    } catch (err) {
      return sendError(reply, err, req);
    }
  });
}
