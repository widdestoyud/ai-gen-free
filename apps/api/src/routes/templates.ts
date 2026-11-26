import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import "@fastify/cookie";
import "@fastify/multipart";
import { AppError, ErrorCodes, type ObjectStorage } from "@ai-gen-free/core";
import { AuthError, userFromCookie } from "../auth/service.js";
import { requestIp, sendError } from "../http.js";
import {
  parseAdminListQuery,
  parseCustomerListQuery,
  parseTemplateInput,
  type TemplateInput,
} from "../templates/parse.js";
import { createTemplateService } from "../templates/service.js";
import { normalizeUploadError } from "./uploads.js";

function extractToken(
  req: { cookies: Record<string, string | undefined>; headers: Record<string, unknown> },
  preferAdminCookie: boolean,
): string | undefined {
  const sidAdmin =
    typeof req.cookies?.sid_admin === "string" && req.cookies.sid_admin.trim().length > 0
      ? req.cookies.sid_admin.trim()
      : undefined;
  const sidUser =
    typeof req.cookies?.sid === "string" && req.cookies.sid.trim().length > 0
      ? req.cookies.sid.trim()
      : undefined;
  const headerToken =
    typeof req.headers["x-session-token"] === "string" &&
    (req.headers["x-session-token"] as string).trim().length > 0
      ? (req.headers["x-session-token"] as string).trim()
      : undefined;
  const authHeader = req.headers["authorization"];
  const bearer =
    typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : undefined;

  return preferAdminCookie
    ? sidAdmin ?? sidUser ?? headerToken ?? bearer
    : sidUser ?? headerToken ?? bearer;
}

async function requireUser(
  req: { cookies: Record<string, string | undefined>; headers: Record<string, unknown> },
  reply: FastifyReply,
) {
  const token = extractToken(req, false);
  const context = {
    ip: requestIp(req),
    userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
  };

  let session = await userFromCookie(token, "user", context);
  if (!session) {
    session = await userFromCookie(token, "admin", context);
  }
  if (!session) {
    reply.status(401).send({
      error: { code: ErrorCodes.UNAUTHENTICATED, message: "Silakan masuk" },
    });
    return null;
  }
  return session;
}

async function requireAdmin(
  req: { cookies: Record<string, string | undefined>; headers: Record<string, unknown> },
  reply: FastifyReply,
) {
  const token = extractToken(req, true);
  const context = {
    ip: requestIp(req),
    userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
  };

  let session = await userFromCookie(token, "admin", context);
  if (!session) {
    session = await userFromCookie(token, "user", context);
  }
  if (!session || session.user.role !== "admin") {
    reply.status(401).send({
      error: { code: ErrorCodes.UNAUTHENTICATED, message: "Silakan masuk sebagai admin" },
    });
    return null;
  }
  return session;
}

function isSingleIsActivePatch(body: unknown): body is { isActive: unknown } {
  return (
    body !== null &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    Object.keys(body).length === 1 &&
    Object.prototype.hasOwnProperty.call(body, "isActive")
  );
}

export interface TemplateRouteDeps {
  storage: ObjectStorage;
}

export async function registerTemplateRoutes(
  app: FastifyInstance,
  deps: TemplateRouteDeps,
) {
  const service = createTemplateService({ storage: deps.storage });

  // -------------------------------------------------------------
  // ADMIN TEMPLATE MANAGEMENT
  // -------------------------------------------------------------

  app.get("/admin/templates", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const q = parseAdminListQuery(req.query);
      const res = await service.adminList(q);
      return reply.status(200).send(res);
    } catch (err) {
      return sendError(reply, err, req);
    }
  });

  app.post("/admin/templates", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const input = parseTemplateInput(req.body);
      const created = await service.adminCreate(session.userId, input, requestIp(req));
      return reply.status(201).send(created);
    } catch (err) {
      return sendError(reply, err, req);
    }
  });

  app.post("/admin/templates/assets", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const isMultipart =
        typeof (req as any).isMultipart === "function" && Boolean((req as any).isMultipart());
      if (isMultipart) {
        const file = await req.file();
        if (!file) {
          throw new AppError(ErrorCodes.VALIDATION_ERROR, "File gambar wajib diunggah", 400);
        }
        const buffer = await file.toBuffer();
        const uploaded = await service.uploadAsset({
          buffer,
          contentType: file.mimetype,
        });
        return reply.status(200).send(uploaded);
      }

      const body = (req.body ?? {}) as { sourceUrl?: unknown };
      if (typeof body.sourceUrl !== "string" || body.sourceUrl.trim().length === 0) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "File gambar atau sourceUrl wajib diisi",
          400,
        );
      }

      const imported = await service.uploadAsset({ sourceUrl: body.sourceUrl.trim() });
      return reply.status(200).send(imported);
    } catch (err) {
      if (err instanceof AppError || err instanceof AuthError) {
        return sendError(reply, err, req);
      }
      return sendError(reply, normalizeUploadError(err), req);
    }
  });

  app.get("/admin/templates/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      const res = await service.adminGet(id);
      return reply.status(200).send(res);
    } catch (err) {
      return sendError(reply, err, req);
    }
  });

  app.patch("/admin/templates/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      let input: TemplateInput;
      if (isSingleIsActivePatch(req.body)) {
        if (typeof req.body.isActive !== "boolean") {
          throw new AppError(ErrorCodes.VALIDATION_ERROR, "isActive harus boolean", 400);
        }
        const existing = await service.adminGet(id);
        input = parseTemplateInput({
          title: existing.title,
          prompt: existing.prompt,
          category: existing.category,
          modelId: existing.modelId,
          aspectRatio: existing.aspectRatio,
          isSpicy: existing.isSpicy,
          isActive: req.body.isActive,
          sortOrder: existing.sortOrder,
          cover: {
            key: existing.cover.key,
            width: existing.cover.width,
            height: existing.cover.height,
          },
          images: existing.images.map((img) => ({
            key: img.key,
            alias: img.alias,
            width: img.width,
            height: img.height,
          })),
        });
      } else {
        input = parseTemplateInput(req.body);
      }

      const updated = await service.adminUpdate(session.userId, id, input, requestIp(req));
      return reply.status(200).send(updated);
    } catch (err) {
      return sendError(reply, err, req);
    }
  });

  app.delete("/admin/templates/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      const res = await service.adminDelete(session.userId, id, requestIp(req));
      return reply.status(200).send(res);
    } catch (err) {
      return sendError(reply, err, req);
    }
  });

  // -------------------------------------------------------------
  // CUSTOMER TEMPLATE GALLERY
  // -------------------------------------------------------------

  app.get("/customer/templates", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    try {
      const q = parseCustomerListQuery(req.query);
      const res = await service.customerList(session.userId, q);
      return reply.status(200).send(res);
    } catch (err) {
      return sendError(reply, err, req);
    }
  });

  app.get("/customer/templates/categories", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    try {
      const rawQuery = (req.query ?? {}) as { spicy?: unknown };
      const spicy = rawQuery.spicy === "1";
      const res = await service.customerCategories(session.userId, spicy);
      return reply.status(200).send(res);
    } catch (err) {
      return sendError(reply, err, req);
    }
  });

  app.post("/customer/templates/:id/use", async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      const res = await service.recordUse(session.userId, id);
      return reply.status(200).send(res);
    } catch (err) {
      return sendError(reply, err, req);
    }
  });
}

export const templatesRoutes = registerTemplateRoutes;
