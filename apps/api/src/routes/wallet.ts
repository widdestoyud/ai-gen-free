import type { FastifyInstance } from "fastify";
import type IORedis from "ioredis";
import "@fastify/multipart";
import { ErrorCodes, type ObjectStorage } from "@ai-gen-free/core";
import { AuthError, userFromCookie } from "../auth/service.js";
import { RedisSubscriberMultiplexer } from "../lib/redis-multiplexer.js";
import { requestIp, sendError } from "../http.js";
import {
  approveInvoice,
  cancelInvoiceForAdmin,
  cancelInvoiceForUser,
  computeBalance,
  createAdminPackage,
  createInvoice,
  deleteAdminPackage,
  getAdminPackage,
  getInvoiceForUser,
  listAdminInvoices,
  listAdminPackages,
  listInvoicesForUser,
  listLedger,
  listNotifications,
  listPackages,
  proofBytesForAdmin,
  proofUrlForAdmin,
  rejectInvoice,
  setWalletRedis,
  submitProof,
  updateAdminPackage,
  type CreatePackageInput,
  type UpdatePackageInput,
} from "../wallet/service.js";

function isFileTooLarge(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String(err.code) : "";
  const statusCode = "statusCode" in err ? Number(err.statusCode) : 0;
  return code === "FST_REQ_FILE_TOO_LARGE" || statusCode === 413;
}

async function requireUser(
  req: { cookies: Record<string, string | undefined>; headers: Record<string, unknown> },
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
) {
  const token =
    (typeof req.cookies?.sid === "string" && req.cookies.sid.trim().length > 0 ? req.cookies.sid.trim() : undefined) ??
    (typeof req.headers["x-session-token"] === "string" && (req.headers["x-session-token"] as string).trim().length > 0
      ? (req.headers["x-session-token"] as string).trim()
      : undefined) ??
    (typeof req.headers["authorization"] === "string" && (req.headers["authorization"] as string).toLowerCase().startsWith("bearer ")
      ? (req.headers["authorization"] as string).slice(7).trim()
      : undefined);

  const context = {
    ip: requestIp(req),
    userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
  };

  let session = await userFromCookie(token, "user", context);
  if (!session) {
    session = await userFromCookie(token, "admin", context);
  }
  if (!session) {
    reply.status(401).send({ error: { code: ErrorCodes.UNAUTHENTICATED, message: "Silakan masuk" } });
    return null;
  }
  return session;
}

async function requireAdmin(
  req: { cookies: Record<string, string | undefined>; headers: Record<string, unknown> },
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
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

function setNoCacheHeaders(reply: { header: (k: string, v: string) => unknown }) {
  reply.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  reply.header("Pragma", "no-cache");
  reply.header("Expires", "0");
  reply.header("Surrogate-Control", "no-store");
}

export async function registerWalletRoutes(
  app: FastifyInstance,
  deps: { storage: ObjectStorage; redis?: IORedis | null },
) {
  if (deps.redis !== undefined) {
    setWalletRedis(deps.redis);
  }

  const multiplexer = new RedisSubscriberMultiplexer(deps.redis);
  app.addHook("onClose", async () => {
    await multiplexer.close();
  });

  app.get("/customer/coin", async (req, reply) => {
    setNoCacheHeaders(reply);
    const session = await requireUser(req, reply);
    if (!session) return;
    const bal = await computeBalance(session.userId);
    return { available: bal.available, held: bal.held, currency: "points" };
  });

  app.get("/customer/coin/ledger", async (req, reply) => {
    setNoCacheHeaders(reply);
    const session = await requireUser(req, reply);
    if (!session) return;
    const { page, limit } = (req.query ?? {}) as { page?: string; limit?: string };
    return await listLedger(session.userId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });
  });

  app.get("/customer/packages", async () => {
    return { packages: await listPackages() };
  });

  app.get("/invoices/events", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    reply.raw.flushHeaders?.();

    if (!deps.redis) {
      reply.raw.write(`data: ${JSON.stringify({ type: "connected", userId: session.userId })}\n\n`);
      reply.raw.end();
      return;
    }

    const channel = `invoice-events:${session.userId}`;
    let closed = false;
    let unsubscribe: (() => void) | null = null;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };

    try {
      unsubscribe = await multiplexer.subscribe(channel, (message) => {
        try {
          reply.raw.write(`data: ${message}\n\n`);
        } catch {
          cleanup();
        }
      });
    } catch {
      cleanup();
      reply.raw.end();
      return;
    }

    reply.raw.write(`data: ${JSON.stringify({ type: "connected", userId: session.userId })}\n\n`);

    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(":ping\n\n");
      } catch {
        cleanup();
      }
    }, 15000);

    req.raw.on("close", () => {
      cleanup();
    });
  });

  app.post("/invoices", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    try {
      const body = (req.body ?? {}) as { packageId?: unknown; paymentMethod?: unknown };
      return await createInvoice(session.userId, body.packageId, {
        ip: requestIp(req as any),
        headers: req.headers,
        paymentMethod: typeof body.paymentMethod === "string" ? body.paymentMethod : undefined,
      });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/invoices", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    const { page, limit } = (req.query ?? {}) as { page?: string; limit?: string };
    return await listInvoicesForUser(session.userId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });
  });

  app.get("/invoices/:id", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      return await getInvoiceForUser(session.userId, id);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/invoices/:id/proof", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    try {
      const file = await req.file();
      if (!file) {
        throw new AuthError(ErrorCodes.PROOF_INVALID, "File bukti wajib diunggah");
      }
      if (file.fieldname !== "file") {
        throw new AuthError(ErrorCodes.PROOF_INVALID, "Field unggahan harus bernama file");
      }
      const buffer = await file.toBuffer();
      const { id } = req.params as { id: string };
      return await submitProof({
        storage: deps.storage,
        userId: session.userId,
        invoiceId: id,
        buffer,
        contentType: file.mimetype,
        req: {
          ip: requestIp(req as any),
          headers: req.headers,
        },
      });
    } catch (err) {
      if (isFileTooLarge(err)) {
        return sendError(
          reply,
          new AuthError(ErrorCodes.PROOF_INVALID, "Ukuran bukti maksimal 5 MB"),
        );
      }
      return sendError(reply, err);
    }
  });

  app.post("/invoices/:id/cancel", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      const body = (req.body ?? {}) as { reason?: unknown };
      return await cancelInvoiceForUser(session.userId, id, body.reason);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/customer/invoices/:id/cancel", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      const body = (req.body ?? {}) as { reason?: unknown };
      return await cancelInvoiceForUser(session.userId, id, body.reason);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/admin/invoices/events", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    reply.raw.flushHeaders?.();

    if (!deps.redis) {
      reply.raw.write(`data: ${JSON.stringify({ type: "connected", role: "admin" })}\n\n`);
      reply.raw.end();
      return;
    }

    const channel = "invoice-events:all";
    let closed = false;
    let unsubscribe: (() => void) | null = null;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };

    try {
      unsubscribe = await multiplexer.subscribe(channel, (message) => {
        try {
          reply.raw.write(`data: ${message}\n\n`);
        } catch {
          cleanup();
        }
      });
    } catch {
      cleanup();
      reply.raw.end();
      return;
    }

    reply.raw.write(`data: ${JSON.stringify({ type: "connected", role: "admin" })}\n\n`);

    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(":ping\n\n");
      } catch {
        cleanup();
      }
    }, 15000);

    req.raw.on("close", () => {
      cleanup();
    });
  });

  app.get("/admin/notifications", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    return await listNotifications();
  });

  app.get("/admin/invoices", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    const query = (req.query ?? {}) as {
      status?: unknown;
      page?: unknown;
      limit?: unknown;
      sortBy?: unknown;
      sortOrder?: unknown;
      q?: unknown;
    };
    const page = typeof query.page === "string" ? parseInt(query.page, 10) : typeof query.page === "number" ? query.page : 1;
    const limit = typeof query.limit === "string" ? parseInt(query.limit, 10) : typeof query.limit === "number" ? query.limit : 10;
    const sortBy = typeof query.sortBy === "string" ? query.sortBy : undefined;
    const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";
    const status = typeof query.status === "string" ? query.status : undefined;
    const q = typeof query.q === "string" ? query.q : undefined;

    const result = await listAdminInvoices({
      status,
      page,
      limit,
      sortBy,
      sortOrder,
      q,
    });
    return {
      invoices: result.items,
      items: result.items,
      pagination: result.pagination,
    };
  });

  app.get("/admin/invoices/:id/proof", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      return await proofUrlForAdmin(deps.storage, id);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/admin/invoices/:id/file", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      const proof = await proofBytesForAdmin(deps.storage, id);
      reply.header("Content-Type", proof.contentType);
      reply.header("Cache-Control", "private, max-age=60");
      reply.header("Content-Disposition", "inline");
      return reply.send(Buffer.from(proof.bytes));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/admin/invoices/:id/approve", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      return await approveInvoice(id, session.userId);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/admin/invoices/:id/reject", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      const body = (req.body ?? {}) as { reason?: unknown };
      return await rejectInvoice(id, session.userId, body.reason);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/admin/invoices/:id/cancel", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      const body = (req.body ?? {}) as { reason?: unknown };
      return await cancelInvoiceForAdmin(id, session.userId, body.reason);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/admin/packages", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    return { packages: await listAdminPackages() };
  });

  app.post("/admin/packages", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const body = (req.body ?? {}) as CreatePackageInput;
      return await createAdminPackage(session.userId, body);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/admin/packages/:id", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      return await getAdminPackage(id);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.patch("/admin/packages/:id", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      const body = (req.body ?? {}) as UpdatePackageInput;
      return await updateAdminPackage(session.userId, id, body);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.delete("/admin/packages/:id", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      return await deleteAdminPackage(session.userId, id);
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
