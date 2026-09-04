import { LedgerStatus, LedgerType, Prisma } from "@prisma/client";
import { AppError, ErrorCodes } from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";

function asInt(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : Number(value);
}

export async function computeBalance(userId: string) {
  const entries = await prisma.ledgerEntry.findMany({ where: { userId } });
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
