import { LedgerStatus, LedgerType, Prisma } from "@prisma/client";
import { AppError, ErrorCodes } from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";

function asInt(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : Number(value);
}

type LedgerLike = { type: LedgerType; status: LedgerStatus; amount: Prisma.Decimal | number };

export function adjustIdempotencyKey(userId: string, clientKey: string): string {
  return `adjust:${userId}:${clientKey}`;
}

function balanceFromEntries(entries: LedgerLike[]) {
  let postedNet = 0;
  let held = 0;
  for (const e of entries) {
    const amt = asInt(e.amount);
    if (e.status === LedgerStatus.posted) {
      if (e.type === LedgerType.topup || e.type === LedgerType.refund) postedNet += amt;
      else if (e.type === LedgerType.capture) postedNet -= amt;
      else if (e.type === LedgerType.adjust) postedNet += amt;
    }
    if (e.type === LedgerType.hold && e.status === LedgerStatus.pending) {
      held += amt;
    }
  }
  return { available: postedNet - held, held, postedNet };
}

export async function computeBalance(userId: string) {
  const entries = await prisma.ledgerEntry.findMany({ where: { userId } });
  return balanceFromEntries(entries);
}

export type AdjustWalletResult = {
  idempotent: boolean;
  available: number;
  held: number;
  entry: {
    id: string;
    type: "adjust";
    status: "posted";
    amount: number;
    reason: string | null;
    idempotencyKey: string;
  };
};

function toAdjustEntry(row: {
  id: string;
  type: LedgerType;
  status: LedgerStatus;
  amount: Prisma.Decimal | number;
  reason: string | null;
  idempotencyKey: string;
}): AdjustWalletResult["entry"] {
  return {
    id: row.id,
    type: "adjust",
    status: "posted",
    amount: asInt(row.amount),
    reason: row.reason,
    idempotencyKey: row.idempotencyKey,
  };
}

export async function adjustWallet(opts: {
  userId: string;
  amount: number;
  reason: string;
  clientKey: string;
  createdByUserId: string;
}): Promise<AdjustWalletResult> {
  if (!Number.isInteger(opts.amount) || opts.amount === 0 || Math.abs(opts.amount) > 1_000_000) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Amount harus bilangan bulat selain 0");
  }
  const reason = opts.reason.trim();
  if (reason.length < 3 || reason.length > 500) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Alasan wajib diisi (3–500 karakter)");
  }
  const idempotencyKey = adjustIdempotencyKey(opts.userId, opts.clientKey);

  const existing = await prisma.ledgerEntry.findUnique({ where: { idempotencyKey } });
  if (existing) {
    const bal = await computeBalance(opts.userId);
    return { idempotent: true, available: bal.available, held: bal.held, entry: toAdjustEntry(existing) };
  }

  try {
    const entry = await prisma.$transaction(async (tx) => {
      await tx.wallet.upsert({
        where: { userId: opts.userId },
        update: {},
        create: { userId: opts.userId },
      });
      await tx.$queryRaw`SELECT "userId" FROM "Wallet" WHERE "userId" = ${opts.userId} FOR UPDATE`;
      const replay = await tx.ledgerEntry.findUnique({ where: { idempotencyKey } });
      if (replay) return { row: replay, idempotent: true as const };
      const entries = await tx.ledgerEntry.findMany({ where: { userId: opts.userId } });
      const bal = balanceFromEntries(entries);
      if (bal.available + opts.amount < 0) {
        throw new AppError(ErrorCodes.INSUFFICIENT_POINTS, "Poin tidak cukup", 402);
      }
      const row = await tx.ledgerEntry.create({
        data: {
          userId: opts.userId,
          type: LedgerType.adjust,
          status: LedgerStatus.posted,
          amount: opts.amount,
          reason,
          idempotencyKey,
          createdByUserId: opts.createdByUserId,
        },
      });
      return { row, idempotent: false as const };
    });
    if (!entry.idempotent) {
      await refreshWalletCache(opts.userId);
    }
    const bal = await computeBalance(opts.userId);
    return {
      idempotent: entry.idempotent,
      available: bal.available,
      held: bal.held,
      entry: toAdjustEntry(entry.row),
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const row = await prisma.ledgerEntry.findUnique({ where: { idempotencyKey } });
      if (row) {
        const bal = await computeBalance(opts.userId);
        return { idempotent: true, available: bal.available, held: bal.held, entry: toAdjustEntry(row) };
      }
    }
    throw err;
  }
}

export async function refreshWalletCache(userId: string) {
  const { available } = await computeBalance(userId);
  await prisma.wallet.update({
    where: { userId },
    data: { availableCached: available, version: { increment: 1 } },
  });
  return available;
}

export async function holdForJob(opts: { userId: string; jobId: string; amount: number }) {
  await prisma.ledgerEntry.create({
    data: {
      userId: opts.userId,
      jobId: opts.jobId,
      type: LedgerType.hold,
      status: LedgerStatus.pending,
      amount: opts.amount,
      idempotencyKey: `hold:${opts.jobId}`,
    },
  });
  await refreshWalletCache(opts.userId);
}

export async function captureJob(opts: { userId: string; jobId: string; amount: number }) {
  const existing = await prisma.ledgerEntry.findUnique({
    where: { idempotencyKey: `capture:${opts.jobId}` },
  });
  if (existing) return { idempotent: true };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "userId" FROM "Wallet" WHERE "userId" = ${opts.userId} FOR UPDATE`;
      await tx.ledgerEntry.updateMany({
        where: { idempotencyKey: `hold:${opts.jobId}`, status: LedgerStatus.pending },
        data: { status: LedgerStatus.void },
      });
      await tx.ledgerEntry.create({
        data: {
          userId: opts.userId,
          jobId: opts.jobId,
          type: LedgerType.capture,
          status: LedgerStatus.posted,
          amount: opts.amount,
          idempotencyKey: `capture:${opts.jobId}`,
        },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { idempotent: true };
    }
    throw err;
  }
  await refreshWalletCache(opts.userId);
  return { idempotent: false };
}

export async function releaseJob(opts: { userId: string; jobId: string; amount: number }) {
  const existing = await prisma.ledgerEntry.findUnique({
    where: { idempotencyKey: `release:${opts.jobId}` },
  });
  if (existing) return { idempotent: true };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "userId" FROM "Wallet" WHERE "userId" = ${opts.userId} FOR UPDATE`;
      await tx.ledgerEntry.updateMany({
        where: { idempotencyKey: `hold:${opts.jobId}`, status: LedgerStatus.pending },
        data: { status: LedgerStatus.void },
      });
      await tx.ledgerEntry.create({
        data: {
          userId: opts.userId,
          jobId: opts.jobId,
          type: LedgerType.release,
          status: LedgerStatus.posted,
          amount: opts.amount,
          idempotencyKey: `release:${opts.jobId}`,
        },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { idempotent: true };
    }
    throw err;
  }
  await refreshWalletCache(opts.userId);
  return { idempotent: false };
}

export function assertEnoughPoints(available: number, cost: number) {
  if (available < cost) {
    throw new AppError(ErrorCodes.INSUFFICIENT_POINTS, "Poin tidak cukup", 402);
  }
}
