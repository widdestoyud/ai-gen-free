import type { FastifyInstance } from "fastify";
import "@fastify/multipart";
import { ErrorCodes } from "@ai-gen-free/core";
import { AuthError, userFromCookie } from "../auth/service.js";
import {
  approveInvoice,
  computeBalance,
  createInvoice,
  getInvoiceForUser,
  listAdminInvoices,
  listInvoicesForUser,
  listLedger,
  listNotifications,
  listPackages,
  proofBytesForAdmin,
  proofUrlForAdmin,
  rejectInvoice,
  submitProof,
} from "../wallet/service.js";

function sendError(reply: { status: (n: number) => { send: (b: unknown) => unknown } }, err: unknown) {
  if (err instanceof AuthError) {
    return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
  }
  throw err;
}

function isFileTooLarge(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String(err.code) : "";
  const statusCode = "statusCode" in err ? Number(err.statusCode) : 0;
  return code === "FST_REQ_FILE_TOO_LARGE" || statusCode === 413;
}

async function requireUser(
  req: { cookies: { sid?: string } },
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
) {
  const session = await userFromCookie(req.cookies.sid, "user");
  if (!session) {
    reply.status(401).send({ error: { code: ErrorCodes.UNAUTHENTICATED, message: "Silakan masuk" } });
    return null;
  }
  return session;
}

async function requireAdmin(
  req: { cookies: { sid_admin?: string } },
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
) {
  const session = await userFromCookie(req.cookies.sid_admin, "admin");
  if (!session || session.user.role !== "admin") {
    reply.status(401).send({
      error: { code: ErrorCodes.UNAUTHENTICATED, message: "Silakan masuk sebagai admin" },
    });
    return null;
  }
  return session;
}

export async function registerWalletRoutes(app: FastifyInstance) {
  app.get("/api/wallet", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    const bal = await computeBalance(session.userId);
    return { available: bal.available, held: bal.held, currency: "points" };
  });

  app.get("/api/wallet/ledger", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    return { entries: await listLedger(session.userId) };
  });

  app.get("/api/catalog/topup", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    return { packages: listPackages() };
  });

  app.post("/api/invoices", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    try {
      const body = (req.body ?? {}) as { packageId?: unknown };
      return await createInvoice(session.userId, body.packageId);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/invoices", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    return { invoices: await listInvoicesForUser(session.userId) };
  });

  app.get("/api/invoices/:id", async (req, reply) => {
    const session = await requireUser(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      return await getInvoiceForUser(session.userId, id);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/api/invoices/:id/proof", async (req, reply) => {
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
        userId: session.userId,
        invoiceId: id,
        buffer,
        contentType: file.mimetype,
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

  app.get("/api/admin/notifications", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    return await listNotifications();
  });

  app.get("/api/admin/invoices", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    return { invoices: await listAdminInvoices() };
  });

  app.get("/api/admin/invoices/:id/proof", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      return await proofUrlForAdmin(id);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/admin/invoices/:id/file", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      const proof = await proofBytesForAdmin(id);
      reply.header("Content-Type", proof.contentType);
      reply.header("Cache-Control", "private, max-age=60");
      reply.header("Content-Disposition", "inline");
      return reply.send(Buffer.from(proof.bytes));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/api/admin/invoices/:id/approve", async (req, reply) => {
    const session = await requireAdmin(req, reply);
    if (!session) return;
    try {
      const { id } = req.params as { id: string };
      return await approveInvoice(id, session.userId);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/api/admin/invoices/:id/reject", async (req, reply) => {
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
}
