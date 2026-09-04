import { JobStatus, LedgerStatus, LedgerType, Prisma } from "@prisma/client";
import { AppError, ErrorCodes, type ObjectStorage } from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";
import { assertEnoughPoints, computeBalance, refreshWalletCache } from "@ai-gen-free/wallet";
import { resolveModel } from "./catalog.js";

const PROMPT_MAX = 4000;
const SIGNED_SECONDS = 10 * 60;

export async function submitJob(opts: {
  userId: string;
  idempotencyKey: unknown;
  body: { mode?: unknown; prompt?: unknown; params?: unknown; cost?: unknown };
  enqueue: (jobId: string) => Promise<void>;
}) {
  const idempotencyKey = parseIdempotencyKey(opts.idempotencyKey);
  const prompt = parsePrompt(opts.body.prompt);
  const params = parseParams(opts.body.params);
  const model = await resolveModel(opts.body.mode);

  const replay = await prisma.job.findFirst({
    where: { userId: opts.userId, idempotencyKey },
  });
  if (replay) {
    return toAccepted(replay);
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: opts.userId } });
  const now = Date.now();
  if (user.nextGenerateAt && user.nextGenerateAt.getTime() > now) {
    const retry = Math.ceil((user.nextGenerateAt.getTime() - now) / 1000);
    throw new AppError(ErrorCodes.COOLDOWN, "Tunggu sebelum generate lagi", 429, {
      retry_after_seconds: retry,
    });
  }

  const active = await prisma.job.findFirst({
    where: { userId: opts.userId, status: { in: [JobStatus.queued, JobStatus.running] } },
  });
  if (active) {
    throw new AppError(ErrorCodes.JOB_IN_PROGRESS, "Masih ada generate yang berjalan", 409);
  }

  const { available } = await computeBalance(opts.userId);
  assertEnoughPoints(available, model.costPoints);

  let job;
  try {
    job = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "userId" FROM "Wallet" WHERE "userId" = ${opts.userId} FOR UPDATE`;
      const created = await tx.job.create({
        data: {
          userId: opts.userId,
          mode: model.mode,
          status: JobStatus.queued,
          cost: model.costPoints,
          modelId: model.modelId,
          providerId: model.providerId,
          prompt,
          params,
          idempotencyKey,
        },
      });
      await tx.ledgerEntry.create({
        data: {
          userId: opts.userId,
          jobId: created.id,
          type: LedgerType.hold,
          status: LedgerStatus.pending,
          amount: model.costPoints,
          idempotencyKey: `hold:${created.id}`,
        },
      });
      return created;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.job.findFirst({
        where: { userId: opts.userId, idempotencyKey },
      });
      if (existing) return toAccepted(existing);
      throw new AppError(ErrorCodes.JOB_IN_PROGRESS, "Masih ada generate yang berjalan", 409);
    }
    throw err;
  }

  await refreshWalletCache(opts.userId);
  const queuedAhead = await prisma.job.count({
    where: { status: JobStatus.queued, createdAt: { lt: job.createdAt } },
  });
  const queuePosition = queuedAhead + 1;
  await prisma.job.update({ where: { id: job.id }, data: { queuePosition } });
  await opts.enqueue(job.id);
  return toAccepted({ ...job, queuePosition });
}

export async function getJobForUser(opts: { userId: string; id: string; storage: ObjectStorage }) {
  const job = await prisma.job.findFirst({
    where: { id: opts.id, userId: opts.userId },
    include: { assets: { where: { kind: "output" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!job) throw new AppError(ErrorCodes.NOT_FOUND, "Job tidak ditemukan", 404);
  return serializeJob(job, opts.storage);
}

export async function listJobsForUser(opts: { userId: string; storage: ObjectStorage }) {
  const rows = await prisma.job.findMany({
    where: { userId: opts.userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { assets: { where: { kind: "output" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return Promise.all(rows.map((row) => serializeJob(row, opts.storage)));
}

function parseIdempotencyKey(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length < 8 || raw.trim().length > 128) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Header Idempotency-Key wajib (8–128 karakter)");
  }
  return raw.trim();
}

function parsePrompt(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Prompt wajib diisi");
  }
  const prompt = raw.trim();
  if (prompt.length > PROMPT_MAX) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Prompt terlalu panjang");
  }
  return prompt;
}

function parseParams(raw: unknown): Prisma.InputJsonValue {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "params harus objek");
  }
  return raw as Prisma.InputJsonValue;
}

function toAccepted(job: { id: string; status: string; cost: Prisma.Decimal | number; queuePosition: number | null }) {
  const cost = typeof job.cost === "number" ? job.cost : Number(job.cost);
  return {
    job_id: job.id,
    status: job.status,
    cost_held: cost,
    queue_position: job.queuePosition ?? 1,
  };
}

async function serializeJob(
  job: {
    id: string;
    status: string;
    mode: string;
    prompt: string;
    cost: Prisma.Decimal;
    progressPct: number;
    errorCode: string | null;
    queuePosition: number | null;
    createdAt: Date;
    finishedAt: Date | null;
    nextGenerateAt: Date | null;
    assets: { storageKey: string; contentType: string; expiresAt: Date }[];
  },
  storage: ObjectStorage,
) {
  const asset = job.status === "succeeded" ? job.assets[0] : undefined;
  let output: { url: string; contentType: string; availableUntil: string; signedExpiresAt: string } | null = null;
  if (asset) {
    const url = await storage.signGetUrl(asset.storageKey, SIGNED_SECONDS);
    output = {
      url,
      contentType: asset.contentType,
      availableUntil: asset.expiresAt.toISOString(),
      signedExpiresAt: new Date(Date.now() + SIGNED_SECONDS * 1000).toISOString(),
    };
  }
  return {
    id: job.id,
    status: job.status,
    mode: job.mode,
    prompt: job.prompt,
    cost: Number(job.cost),
    progressPct: job.progressPct,
    errorCode: job.errorCode,
    queuePosition: job.queuePosition,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
    nextGenerateAt: job.nextGenerateAt?.toISOString() ?? null,
    output,
  };
}
