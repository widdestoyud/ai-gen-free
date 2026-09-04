import { randomBytes } from "node:crypto";
import { LedgerStatus, LedgerType, Prisma } from "@prisma/client";
import { ErrorCodes, type ObjectStorage } from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";
import { computeBalance, refreshWalletCache } from "@ai-gen-free/wallet";
import { AuthError } from "../auth/service.js";
import { findPackage, qrisInstructions, TOPUP_PACKAGES } from "./catalog.js";

export { computeBalance, refreshWalletCache };

const ALLOWED_PROOF = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_PROOF_BYTES = 5 * 1024 * 1024;

function asInt(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : Number(value);
}

export function listPackages() {
  return TOPUP_PACKAGES;
}

export async function createInvoice(userId: string, packageId: unknown) {
  const pack = findPackage(packageId);
  if (!pack) {
    throw new AuthError(ErrorCodes.VALIDATION_ERROR, "Paket tidak dikenal");
  }
  const uniqueCode = `INV-${randomBytes(4).toString("hex").toUpperCase()}`;
  const invoice = await prisma.invoice.create({
    data: {
      userId,
      amountIdr: pack.amountIdr,
      points: pack.points,
      uniqueCode,
      status: "unpaid",
    },
  });
  return serializeInvoice(invoice, true);
}

export async function getInvoiceForUser(userId: string, id: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id, userId } });
  if (!invoice) throw new AuthError(ErrorCodes.NOT_FOUND, "Invoice tidak ditemukan", 404);
  return serializeInvoice(invoice, true);
}

export async function listInvoicesForUser(userId: string) {
  const rows = await prisma.invoice.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((row) => serializeInvoice(row, true));
}

export async function listAdminInvoices() {
  const rows = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true } } },
  });
  return rows.map((row) => ({
    ...serializeInvoice(row, false),
    email: row.user.email,
  }));
}

export async function listNotifications() {
  const where = { status: "awaiting_review" as const };
  const [pendingCount, rows] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy: { proofSubmittedAt: "desc" },
      take: 50,
      include: { user: { select: { email: true } } },
    }),
  ]);
  return {
    pendingCount,
    items: rows.map((row) => ({
      invoiceId: row.id,
      uniqueCode: row.uniqueCode,
      email: row.user.email,
      amountIdr: asInt(row.amountIdr),
      points: asInt(row.points),
      proofSubmittedAt: row.proofSubmittedAt?.toISOString() ?? null,
      status: row.status,
    })),
  };
}

export async function submitProof(opts: {
  storage: ObjectStorage;
  userId: string;
  invoiceId: string;
  buffer: Buffer;
  contentType: string;
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
  return serializeInvoice(updated, false);
}

export async function listLedger(userId: string) {
  const rows = await prisma.ledgerEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      type: true,
      status: true,
      amount: true,
      createdAt: true,
      invoiceId: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    amount: asInt(row.amount),
    createdAt: row.createdAt.toISOString(),
    invoiceId: row.invoiceId,
    label: ledgerLabel(row.type, row.status),
  }));
}

function ledgerLabel(type: LedgerType, status: LedgerStatus): string {
  if (type === "topup" && status === "posted") return "Isi saldo";
  if (type === "hold" && status === "pending") return "Poin dikunci";
  if (type === "capture" && status === "posted") return "Pemakaian generate";
  if (type === "release") return "Poin dikembalikan";
  if (type === "refund") return "Pengembalian";
  if (type === "adjust") return "Penyesuaian admin";
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
  },
  withInstructions: boolean,
) {
  const amountIdr = asInt(invoice.amountIdr);
  return {
    id: invoice.id,
    amountIdr,
    points: asInt(invoice.points),
    status: invoice.status,
    uniqueCode: invoice.uniqueCode,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    hasProof: Boolean(invoice.proofStorageKey),
    proofSubmittedAt: invoice.proofSubmittedAt?.toISOString() ?? null,
    reviewNote: invoice.reviewNote ?? null,
    statusLabel: statusLabel(invoice.status),
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
      return "Kedaluarsa";
    default:
      return status;
  }
}
