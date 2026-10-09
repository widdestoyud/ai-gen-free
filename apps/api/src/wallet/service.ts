import type { IncomingHttpHeaders } from "node:http";
import { randomBytes } from "node:crypto";
import type IORedis from "ioredis";
import { LedgerStatus, LedgerType, Prisma } from "@prisma/client";
import { ErrorCodes, type ObjectStorage } from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";
import { computeBalance, refreshWalletCache } from "@ai-gen-free/wallet";
import { AuthError } from "../auth/service.js";
import { recordUserActivity } from "../activity/service.js";
import {
  findPackage,
  listPackages,
  listStaticPackages,
  listAdminPackages,
  getAdminPackage,
  createAdminPackage,
  updateAdminPackage,
  deleteAdminPackage,
  qrisInstructions,
  TOPUP_PACKAGES,
  type TopupPackage,
  type CreatePackageInput,
  type UpdatePackageInput,
} from "./catalog.js";

let walletRedis: IORedis | null = null;

export function setWalletRedis(redis: IORedis | null | undefined) {
  walletRedis = redis ?? null;
}

export async function publishInvoiceEvent(invoice: {
  id: string;
  userId: string;
  status: string;
  uniqueCode: string;
  points?: Prisma.Decimal | number;
  amountIdr?: Prisma.Decimal | number;
  reviewNote?: string | null;
  paidAt?: Date | null;
  proofSubmittedAt?: Date | null;
  [key: string]: any;
}) {
  if (!walletRedis) return;
  try {
    const payload = JSON.stringify({
      type: "invoice_updated",
      invoiceId: invoice.id,
      userId: invoice.userId,
      status: invoice.status,
      uniqueCode: invoice.uniqueCode,
      points: invoice.points !== undefined ? asInt(invoice.points) : undefined,
      amountIdr: invoice.amountIdr !== undefined ? asInt(invoice.amountIdr) : undefined,
      reviewNote: invoice.reviewNote ?? null,
      paidAt: invoice.paidAt instanceof Date ? invoice.paidAt.toISOString() : invoice.paidAt ?? null,
      proofSubmittedAt:
        invoice.proofSubmittedAt instanceof Date ? invoice.proofSubmittedAt.toISOString() : invoice.proofSubmittedAt ?? null,
      timestamp: new Date().toISOString(),
    });

    await Promise.all([
      walletRedis.publish(`invoice-events:${invoice.userId}`, payload),
      walletRedis.publish("invoice-events:all", payload),
    ]);
  } catch (err) {
    console.error("[wallet] Failed to publish invoice event to Redis", err);
  }
}

export {
  computeBalance,
  refreshWalletCache,
  listPackages,
  listStaticPackages,
  findPackage,
  listAdminPackages,
  getAdminPackage,
  createAdminPackage,
  updateAdminPackage,
  deleteAdminPackage,
  TOPUP_PACKAGES,
  type TopupPackage,
  type CreatePackageInput,
  type UpdatePackageInput,
};

const ALLOWED_PROOF = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_PROOF_BYTES = 5 * 1024 * 1024;

function asInt(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : Number(value);
}

export async function createInvoice(
  userId: string,
  packageId: unknown,
  opts?: {
    ip?: string;
    headers?: IncomingHttpHeaders;
    paymentMethod?: string;
  },
) {
  const pack = await findPackage(packageId);
  if (!pack) {
    throw new AuthError(ErrorCodes.VALIDATION_ERROR, "Paket tidak dikenal");
  }
  const uniqueCode = `INV-${randomBytes(4).toString("hex").toUpperCase()}`;
  const paymentMethod =
    opts?.paymentMethod === "manual" ? "manual" : opts?.paymentMethod === "online" ? "online" : opts?.paymentMethod;
  const invoice = await prisma.invoice.create({
    data: {
      userId,
      amountIdr: pack.amountIdr,
      points: pack.points,
      uniqueCode,
      status: "unpaid",
      paymentMethod: paymentMethod || undefined,
    },
  });

  void recordUserActivity({
    userId,
    action: "billing.invoice_created",
    req: opts ? { ip: opts.ip, headers: opts.headers } : undefined,
    metadata: {
      invoiceId: invoice.id,
      uniqueCode: invoice.uniqueCode,
      amountIdr: asInt(invoice.amountIdr),
      points: asInt(invoice.points),
      paymentMethod: paymentMethod ?? null,
    },
  });

  void publishInvoiceEvent(invoice);
  triggerLazyAutoExpire();

  return serializeInvoice(invoice, true);
}

export async function getInvoiceForUser(userId: string, id: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id, userId } });
  if (!invoice) throw new AuthError(ErrorCodes.NOT_FOUND, "Invoice tidak ditemukan", 404);
  return serializeInvoice(invoice, true);
}

export async function listInvoicesForUser(userId: string, opts?: { page?: number; limit?: number }) {
  const page = Math.max(1, Number(opts?.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(opts?.limit) || 10));
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    prisma.invoice.count({ where: { userId } }),
    prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    invoices: rows.map((row) => serializeInvoice(row, true)),
  };
}

export async function autoExpireInvoices(): Promise<{ count: number }> {
  const now = new Date();
  const manualCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const result = await prisma.invoice.updateMany({
    where: {
      status: "unpaid",
      OR: [
        { gatewayExpiredAt: { lte: now } },
        { gatewayExpiredAt: null, createdAt: { lte: manualCutoff } },
      ],
    },
    data: { status: "expired" },
  });
  return { count: result.count };
}

let lastLazyAutoExpireAt = 0;
const LAZY_EXPIRE_COOLDOWN_MS = 30_000;

export function triggerLazyAutoExpire(): void {
  const now = Date.now();
  if (now - lastLazyAutoExpireAt < LAZY_EXPIRE_COOLDOWN_MS) return;
  lastLazyAutoExpireAt = now;
  setImmediate(() => {
    void autoExpireInvoices().catch(() => {});
  });
}

export interface InvoiceSchedulerOptions {
  intervalMs?: number;
  logger?: {
    info: (obj: Record<string, unknown>, msg?: string) => void;
    warn: (obj: Record<string, unknown>, msg?: string) => void;
    error: (obj: Record<string, unknown>, msg?: string) => void;
  };
}

export function startInvoiceExpirationScheduler(opts?: InvoiceSchedulerOptions): () => void {
  const intervalMs = opts?.intervalMs ?? Number(process.env.INVOICE_EXPIRY_INTERVAL_MS ?? 60_000);
  const logger = opts?.logger;

  // Run initial asynchronous sweep (non-blocking)
  void autoExpireInvoices()
    .then((res) => {
      if (res.count > 0 && logger) {
        logger.info({ event: "wallet.invoices_auto_expired", count: res.count, phase: "init" });
      }
    })
    .catch((err) => {
      logger?.warn?.({ event: "wallet.auto_expire_failed", error: String(err), phase: "init" });
    });

  const timer = setInterval(() => {
    void autoExpireInvoices()
      .then((res) => {
        if (res.count > 0 && logger) {
          logger.info({ event: "wallet.invoices_auto_expired", count: res.count, phase: "interval" });
        }
      })
      .catch((err) => {
        logger?.error?.({ event: "wallet.auto_expire_failed", error: String(err), phase: "interval" });
      });
  }, intervalMs).unref();

  return () => clearInterval(timer);
}

export async function listAdminInvoices(opts?: {
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  q?: string;
}) {
  const page = Math.max(1, opts?.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 10));
  const skip = (page - 1) * limit;
  const sortOrder = opts?.sortOrder === "asc" ? ("asc" as const) : ("desc" as const);
  const sortBy = opts?.sortBy ?? "createdAt";

  const now = new Date();
  const manualCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const andConditions: Prisma.InvoiceWhereInput[] = [];
  const status = opts?.status?.toLowerCase().trim();

  const notExpiredCondition: Prisma.InvoiceWhereInput = {
    OR: [
      { gatewayExpiredAt: { gt: now } },
      { gatewayExpiredAt: null, createdAt: { gt: manualCutoff } },
    ],
  };

  const expiredCondition: Prisma.InvoiceWhereInput = {
    OR: [
      { status: "expired" },
      {
        status: "unpaid",
        OR: [
          { gatewayExpiredAt: { lte: now } },
          { gatewayExpiredAt: null, createdAt: { lte: manualCutoff } },
        ],
      },
    ],
  };

  if (status === "pending") {
    andConditions.push({
      OR: [
        { status: "awaiting_review" },
        {
          status: "unpaid",
          ...notExpiredCondition,
        },
      ],
    });
  } else if (status === "canceled") {
    andConditions.push({ status: { in: ["canceled", "rejected"] } });
  } else if (status === "kurasi") {
    andConditions.push({ status: "awaiting_review" });
  } else if (status === "open") {
    andConditions.push({
      status: "unpaid",
      ...notExpiredCondition,
    });
  } else if (status === "expired") {
    andConditions.push(expiredCondition);
  } else if (status && status !== "all") {
    andConditions.push({ status: status as any });
  }

  if (opts?.q && opts.q.trim()) {
    const q = opts.q.trim();
    andConditions.push({
      OR: [
        { uniqueCode: { contains: q, mode: "insensitive" } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const where: Prisma.InvoiceWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

  let orderBy: Prisma.InvoiceOrderByWithRelationInput = { createdAt: sortOrder };
  if (sortBy === "amountIdr") orderBy = { amountIdr: sortOrder };
  else if (sortBy === "points") orderBy = { points: sortOrder };
  else if (sortBy === "status") orderBy = { status: sortOrder };
  else if (sortBy === "uniqueCode") orderBy = { uniqueCode: sortOrder };

  const [total, rows] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: { user: { select: { email: true } } },
    }),
  ]);

  const items = rows.map((row) => ({
    ...serializeInvoice(row, false),
    email: row.user.email,
  }));

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}

export async function listNotifications() {
  const now = new Date();
  const manualCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const whereReview: Prisma.InvoiceWhereInput = { status: "awaiting_review" };
  const whereOpen: Prisma.InvoiceWhereInput = {
    status: "unpaid",
    OR: [
      { gatewayExpiredAt: { gt: now } },
      { gatewayExpiredAt: null, createdAt: { gt: manualCutoff } },
    ],
  };

  const [pendingCount, openCount, reviewRows, openRows] = await Promise.all([
    prisma.invoice.count({ where: whereReview }),
    prisma.invoice.count({ where: whereOpen }),
    prisma.invoice.findMany({
      where: whereReview,
      orderBy: { proofSubmittedAt: "desc" },
      take: 50,
      include: { user: { select: { email: true } } },
    }),
    prisma.invoice.findMany({
      where: whereOpen,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { email: true } } },
    }),
  ]);

  const mapItem = (row: typeof reviewRows[0]) => {
    const serialized = serializeInvoice(row, false);
    return {
      invoiceId: row.id,
      uniqueCode: row.uniqueCode,
      email: row.user.email,
      amountIdr: asInt(row.amountIdr),
      points: asInt(row.points),
      proofSubmittedAt: row.proofSubmittedAt?.toISOString() ?? null,
      status: serialized.status,
      statusLabel: serialized.statusLabel,
      paymentMethod: row.paymentMethod ?? null,
      paymentGateway: row.paymentGateway ?? null,
      gatewayPaymentChannel: row.gatewayPaymentChannel ?? null,
      gatewayExpiredAt: row.gatewayExpiredAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  };

  return {
    pendingCount,
    openCount,
    items: reviewRows.map(mapItem),
    openItems: openRows.map(mapItem),
  };
}

export async function submitProof(opts: {
  storage: ObjectStorage;
  userId: string;
  invoiceId: string;
  buffer: Buffer;
  contentType: string;
  req?: {
    ip?: string;
    headers?: IncomingHttpHeaders;
  };
}) {
  if (!ALLOWED_PROOF.has(opts.contentType)) {
    throw new AuthError(ErrorCodes.PROOF_INVALID, "Berkas harus jpeg, png, webp, atau pdf");
  }
  if (opts.buffer.length === 0 || opts.buffer.length > MAX_PROOF_BYTES) {
    throw new AuthError(ErrorCodes.PROOF_INVALID, "Ukuran bukti maksimal 5 MB");
  }
  const invoice = await prisma.invoice.findFirst({
    where: { id: opts.invoiceId, userId: opts.userId },
  });
  if (!invoice) throw new AuthError(ErrorCodes.NOT_FOUND, "Invoice tidak ditemukan", 404);
  const now = new Date();
  const isExpired =
    invoice.status === "expired" ||
    (invoice.gatewayExpiredAt && invoice.gatewayExpiredAt < now) ||
    (!invoice.gatewayExpiredAt && invoice.status !== "rejected" && now.getTime() - invoice.createdAt.getTime() > 24 * 60 * 60 * 1000) ||
    (!invoice.gatewayExpiredAt && invoice.status === "rejected" && invoice.reviewedAt && now.getTime() - invoice.reviewedAt.getTime() > 24 * 60 * 60 * 1000);

  if (isExpired) {
    if (invoice.status !== "expired") {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: "expired" },
      });
    }
    throw new AuthError(ErrorCodes.INVOICE_NOT_PAYABLE, "Invoice sudah kedaluwarsa dan tidak dapat diunggah bukti transfer", 400);
  }

  if (invoice.status !== "unpaid" && invoice.status !== "rejected") {
    throw new AuthError(ErrorCodes.INVOICE_NOT_PAYABLE, "Bukti hanya bisa diunggah untuk invoice yang belum lunas");
  }
  const key = `proofs/${opts.userId}/${invoice.id}`;
  await opts.storage.put({ key, body: opts.buffer, contentType: opts.contentType });
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "awaiting_review",
      proofStorageKey: key,
      proofContentType: opts.contentType,
      proofBytes: opts.buffer.length,
      proofSubmittedAt: new Date(),
      reviewNote: null,
      reviewedAt: null,
      reviewedByAdminId: null,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: opts.userId,
      action: "invoice.proof_submitted",
      target: invoice.id,
      meta: { bytes: opts.buffer.length, contentType: opts.contentType },
    },
  });

  void recordUserActivity({
    userId: opts.userId,
    action: "billing.proof_submitted",
    req: opts.req,
    metadata: {
      invoiceId: invoice.id,
      uniqueCode: invoice.uniqueCode,
      bytes: opts.buffer.length,
      contentType: opts.contentType,
    },
  });

  void publishInvoiceEvent(updated);

  return serializeInvoice(updated, true);
}

export async function proofUrlForAdmin(storage: ObjectStorage, invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice?.proofStorageKey) {
    throw new AuthError(ErrorCodes.PROOF_REQUIRED, "Belum ada bukti transfer", 400);
  }
  const url = await storage.signGetUrl(invoice.proofStorageKey, 10 * 60);
  return {
    url,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    contentType: invoice.proofContentType,
  };
}

export async function proofBytesForAdmin(storage: ObjectStorage, invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice?.proofStorageKey) {
    throw new AuthError(ErrorCodes.PROOF_REQUIRED, "Belum ada bukti transfer", 400);
  }
  const obj = await storage.get(invoice.proofStorageKey);
  return {
    bytes: obj.body,
    contentType: invoice.proofContentType ?? obj.contentType ?? "application/octet-stream",
  };
}

export async function approveInvoice(invoiceId: string, adminUserId: string) {
  const existing = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!existing) throw new AuthError(ErrorCodes.NOT_FOUND, "Invoice tidak ditemukan", 404);
  if (existing.status === "paid") {
    return serializeInvoice(existing, false);
  }
  if (existing.status !== "awaiting_review" || !existing.proofStorageKey) {
    throw new AuthError(ErrorCodes.PROOF_REQUIRED, "Invoice belum punya bukti yang menunggu kurasi");
  }

  try {
    const paid = await prisma.$transaction(async (tx) => {
      await tx.wallet.upsert({
        where: { userId: existing.userId },
        update: {},
        create: { userId: existing.userId },
      });
      await tx.$queryRaw`SELECT "userId" FROM "Wallet" WHERE "userId" = ${existing.userId} FOR UPDATE`;
      const moved = await tx.invoice.updateMany({
        where: { id: existing.id, status: "awaiting_review" },
        data: {
          status: "paid",
          paidAt: new Date(),
          paidByAdminId: adminUserId,
          reviewedAt: new Date(),
          reviewedByAdminId: adminUserId,
        },
      });
      if (moved.count === 0) {
        const current = await tx.invoice.findUniqueOrThrow({ where: { id: existing.id } });
        if (current.status === "paid") return current;
        throw new AuthError(ErrorCodes.INVOICE_NOT_PAYABLE, "Invoice tidak menunggu kurasi");
      }
      await tx.wallet.update({
        where: { userId: existing.userId },
        data: { version: { increment: 1 } },
      });
      await tx.ledgerEntry.create({
        data: {
          userId: existing.userId,
          invoiceId: existing.id,
          type: LedgerType.topup,
          status: LedgerStatus.posted,
          amount: existing.points,
          idempotencyKey: `topup:${existing.id}`,
          createdByUserId: adminUserId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: adminUserId,
          action: "invoice.approved",
          target: existing.id,
          meta: { points: asInt(existing.points) },
        },
      });
      return tx.invoice.findUniqueOrThrow({ where: { id: existing.id } });
    });
    if (paid.status === "paid") {
      await refreshWalletCache(existing.userId);
      void recordUserActivity({
        userId: existing.userId,
        action: "billing.invoice_paid",
        metadata: {
          invoiceId: existing.id,
          uniqueCode: existing.uniqueCode,
          points: asInt(existing.points),
          amountIdr: asInt(existing.amountIdr),
          approvedByAdminId: adminUserId,
        },
      });
      void publishInvoiceEvent(paid);
    }
    return serializeInvoice(paid, false);
  } catch (err) {
    if (err instanceof AuthError) throw err;
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const paid = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      return serializeInvoice(paid, false);
    }
    throw err;
  }
}

export async function rejectInvoice(invoiceId: string, adminUserId: string, reasonRaw: unknown) {
  if (typeof reasonRaw !== "string" || reasonRaw.trim().length < 3) {
    throw new AuthError(ErrorCodes.VALIDATION_ERROR, "Alasan penolakan wajib diisi");
  }
  const reason = reasonRaw.trim();
  const existing = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!existing) throw new AuthError(ErrorCodes.NOT_FOUND, "Invoice tidak ditemukan", 404);
  const moved = await prisma.invoice.updateMany({
    where: { id: existing.id, status: "awaiting_review" },
    data: {
      status: "rejected",
      reviewNote: reason,
      reviewedAt: new Date(),
      reviewedByAdminId: adminUserId,
    },
  });
  if (moved.count === 0) {
    throw new AuthError(ErrorCodes.INVOICE_NOT_PAYABLE, "Hanya invoice menunggu kurasi yang bisa ditolak");
  }
  const updated = await prisma.invoice.findUniqueOrThrow({ where: { id: existing.id } });
  await prisma.auditLog.create({
    data: {
      actorId: adminUserId,
      action: "invoice.rejected",
      target: existing.id,
      meta: { reason },
    },
  });
  void publishInvoiceEvent(updated);
  return serializeInvoice(updated, false);
}

export async function cancelInvoiceForUser(userId: string, invoiceId: string, reasonRaw?: unknown) {
  const reason = typeof reasonRaw === "string" && reasonRaw.trim().length > 0 ? reasonRaw.trim() : undefined;
  const existing = await prisma.invoice.findFirst({ where: { id: invoiceId, userId } });
  if (!existing) throw new AuthError(ErrorCodes.NOT_FOUND, "Invoice tidak ditemukan", 404);

  if (existing.status === "paid") {
    throw new AuthError(ErrorCodes.INVOICE_NOT_PAYABLE, "Invoice yang sudah dibayar tidak dapat dibatalkan", 400);
  }

  const now = new Date();
  const isExpired =
    existing.status === "expired" ||
    (existing.gatewayExpiredAt && new Date(existing.gatewayExpiredAt) < now);

  if (isExpired) {
    if (existing.status !== "expired") {
      await prisma.invoice.update({
        where: { id: existing.id },
        data: { status: "expired" },
      });
    }
    throw new AuthError(ErrorCodes.INVOICE_NOT_PAYABLE, "Invoice sudah kedaluwarsa dan tidak dapat dibatalkan", 400);
  }

  if (existing.status === "canceled") {
    return serializeInvoice(existing, false);
  }

  const updated = await prisma.invoice.update({
    where: { id: existing.id },
    data: {
      status: "canceled",
      reviewNote: reason ? `Dibatalkan oleh pelanggan: ${reason}` : (existing.reviewNote ?? "Dibatalkan oleh pelanggan"),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      action: "invoice.canceled",
      target: existing.id,
      meta: {
        previousStatus: existing.status,
        reason: reason ?? null,
      },
    },
  });

  void publishInvoiceEvent(updated);
  return serializeInvoice(updated, false);
}

export async function cancelInvoiceForAdmin(invoiceId: string, adminUserId: string, reasonRaw?: unknown) {
  const reason = typeof reasonRaw === "string" && reasonRaw.trim().length > 0 ? reasonRaw.trim() : undefined;
  const existing = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!existing) throw new AuthError(ErrorCodes.NOT_FOUND, "Invoice tidak ditemukan", 404);

  if (existing.status === "paid") {
    throw new AuthError(ErrorCodes.INVOICE_NOT_PAYABLE, "Invoice yang sudah dibayar tidak dapat dibatalkan", 400);
  }
  if (existing.status === "canceled") {
    return serializeInvoice(existing, false);
  }

  const updated = await prisma.invoice.update({
    where: { id: existing.id },
    data: {
      status: "canceled",
      reviewedAt: new Date(),
      reviewedByAdminId: adminUserId,
      reviewNote: reason ? `Dibatalkan oleh admin: ${reason}` : (existing.reviewNote ?? "Dibatalkan oleh admin"),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminUserId,
      action: "invoice.admin_canceled",
      target: existing.id,
      meta: {
        previousStatus: existing.status,
        reason: reason ?? null,
      },
    },
  });

  void publishInvoiceEvent(updated);
  return serializeInvoice(updated, false);
}

export async function listLedger(userId: string, opts?: { page?: number; limit?: number }) {
  const page = Math.max(1, Number(opts?.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(opts?.limit) || 10));
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    prisma.ledgerEntry.count({ where: { userId } }),
    prisma.ledgerEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        type: true,
        status: true,
        amount: true,
        createdAt: true,
        invoiceId: true,
        jobId: true,
      },
    }),
  ]);

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    entries: rows.map((row) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      amount: asInt(row.amount),
      createdAt: row.createdAt.toISOString(),
      invoiceId: row.invoiceId,
      jobId: row.jobId,
      label: ledgerLabel(row.type, row.status),
    })),
  };
}

function ledgerLabel(type: LedgerType, status: LedgerStatus): string {
  if (type === "topup" && status === "posted") return "Isi saldo";
  if (type === "hold" && status === "pending") return "Poin dikunci";
  if (type === "capture" && status === "posted") return "Pemakaian generate";
  if (type === "release") return "Poin dikembalikan";
  if (type === "refund") return "Pengembalian";
  if (type === "adjust") return "Isi saldo";
  return type;
}

function serializeInvoice(
  invoice: {
    id: string;
    amountIdr: Prisma.Decimal;
    points: Prisma.Decimal;
    status: string;
    uniqueCode: string;
    paidAt: Date | null;
    createdAt: Date;
    proofStorageKey?: string | null;
    proofSubmittedAt?: Date | null;
    reviewNote?: string | null;
    paymentMethod?: string | null;
    paymentGateway?: string | null;
    gatewayPaymentChannel?: string | null;
    gatewayExpiredAt?: Date | null;
  },
  withInstructions: boolean,
) {
  const amountIdr = asInt(invoice.amountIdr);
  const now = new Date();
  const manualExpiry = new Date(invoice.createdAt.getTime() + 60 * 60 * 1000);
  const isExpired =
    invoice.status === "expired" ||
    ((invoice.status === "unpaid" || invoice.status === "rejected") &&
      (invoice.gatewayExpiredAt
        ? new Date(invoice.gatewayExpiredAt) < now
        : manualExpiry < now));

  const effectiveStatus = isExpired ? "expired" : invoice.status;

  return {
    id: invoice.id,
    amountIdr,
    points: asInt(invoice.points),
    status: effectiveStatus,
    uniqueCode: invoice.uniqueCode,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    hasProof: Boolean(invoice.proofStorageKey),
    proofSubmittedAt: invoice.proofSubmittedAt?.toISOString() ?? null,
    reviewNote: invoice.reviewNote ?? null,
    statusLabel: statusLabel(effectiveStatus),
    paymentMethod: invoice.paymentMethod ?? null,
    paymentGateway: invoice.paymentGateway ?? null,
    gatewayPaymentChannel: invoice.gatewayPaymentChannel ?? null,
    gatewayExpiredAt: invoice.gatewayExpiredAt?.toISOString() ?? null,
    expiredAt: invoice.gatewayExpiredAt?.toISOString() ?? manualExpiry.toISOString(),
    instructions: withInstructions ? qrisInstructions(invoice.uniqueCode, amountIdr) : undefined,
  };
}

function statusLabel(status: string): string {
  switch (status) {
    case "unpaid":
      return "Belum bayar — unggah bukti";
    case "awaiting_review":
      return "Menunggu kurasi admin";
    case "paid":
      return "Lunas";
    case "rejected":
      return "Ditolak — unggah ulang";
    case "canceled":
      return "Dibatalkan";
    case "expired":
      return "Kedaluwarsa";
    default:
      return status;
  }
}
