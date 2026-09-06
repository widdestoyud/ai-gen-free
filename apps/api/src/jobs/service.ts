import { JobStatus, LedgerStatus, LedgerType, Prisma } from "@prisma/client";
import { AppError, ErrorCodes, type ObjectStorage } from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";
import { assertEnoughPoints, computeBalance, refreshWalletCache } from "@ai-gen-free/wallet";
import { resolveModel } from "./catalog.js";
import { parseGenerateParams } from "./params.js";
import { isOutputAssetLive, isOutputPurged, promptPreview, resolveJobOutput } from "./output.js";

const PROMPT_MAX = 4000;

export async function submitJob(opts: {
  userId: string;
  idempotencyKey: unknown;
  body: { mode?: unknown; modelId?: unknown; prompt?: unknown; params?: unknown; cost?: unknown; providerId?: unknown };
  enqueue: (jobId: string) => Promise<void>;
}) {
  const idempotencyKey = parseIdempotencyKey(opts.idempotencyKey);
  const prompt = parsePrompt(opts.body.prompt);
  const model = await resolveModel(opts.body.mode, opts.body.modelId);
  const params = parseGenerateParams(opts.body.params, model.providerId);

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
  console.log(
    JSON.stringify({
      event: "job.accepted",
      jobId: job.id,
      userId: opts.userId,
      costHeld: model.costPoints,
      modelId: model.modelId,
      providerId: model.providerId,
    }),
  );
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
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: opts.userId },
    select: { nextGenerateAt: true },
  });
  const rows = await prisma.job.findMany({
    where: { userId: opts.userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { assets: { where: { kind: "output" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return {
    nextGenerateAt: user.nextGenerateAt?.toISOString() ?? null,
    jobs: await Promise.all(rows.map((row) => serializeJob(row, opts.storage))),
  };
}

const outputInclude = {
  assets: { where: { kind: "output" as const }, orderBy: { createdAt: "desc" as const }, take: 1 },
};

export async function listAdminJobs(opts: {
  status?: JobStatus;
  userId?: string;
  q?: string;
  limit: number;
  offset: number;
}) {
  const rows = await prisma.job.findMany({
    where: {
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.userId ? { userId: opts.userId } : {}),
      ...(opts.q ? { user: { email: { contains: opts.q, mode: "insensitive" } } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit,
    skip: opts.offset,
    include: {
      user: { select: { email: true } },
      ...outputInclude,
    },
  });
  const now = new Date();
  return rows.map((row) => {
    const asset = row.assets[0];
    return {
      id: row.id,
      userId: row.userId,
      email: row.user.email,
      mode: row.mode,
      status: row.status,
      modelId: row.modelId,
      cost: Number(row.cost),
      promptPreview: promptPreview(row.prompt),
      outputSha256: asset?.sha256 ?? null,
      createdAt: row.createdAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null,
      availableUntil: asset?.expiresAt.toISOString() ?? null,
      purged: isOutputPurged(asset, now),
    };
  });
}

export async function getAdminJob(opts: { id: string; storage: ObjectStorage }) {
  const job = await prisma.job.findUnique({
    where: { id: opts.id },
    include: {
      user: { select: { email: true } },
      ...outputInclude,
    },
  });
  if (!job) throw new AppError(ErrorCodes.NOT_FOUND, "Job tidak ditemukan", 404);
  const serialized = await serializeJob(job, opts.storage);
  const asset = job.assets[0];
  return {
    ...serialized,
    userId: job.userId,
    email: job.user.email,
    params: job.params,
    purged: isOutputPurged(asset, new Date()),
    outputSha256: asset?.sha256 ?? null,
  };
}

export async function getAdminJobOutputFile(opts: { id: string; storage: ObjectStorage }) {
  const job = await prisma.job.findUnique({
    where: { id: opts.id },
    include: outputInclude,
  });
  if (!job) throw new AppError(ErrorCodes.NOT_FOUND, "Job tidak ditemukan", 404);
  const asset = job.assets[0];
  if (!asset || !isOutputAssetLive(asset, new Date())) {
    throw new AppError(ErrorCodes.NOT_FOUND, "File tidak ditemukan", 404);
  }
  try {
    const obj = await opts.storage.get(asset.storageKey);
    return {
      bytes: obj.body,
      contentType: asset.contentType || obj.contentType || "application/octet-stream",
    };
  } catch {
    throw new AppError(ErrorCodes.NOT_FOUND, "File tidak ditemukan", 404);
  }
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
    modelId: string;
    prompt: string;
    cost: Prisma.Decimal;
    progressPct: number;
    errorCode: string | null;
    queuePosition: number | null;
    createdAt: Date;
    finishedAt: Date | null;
    nextGenerateAt: Date | null;
    assets: { storageKey: string; contentType: string; expiresAt: Date; purgedAt: Date | null }[];
  },
  storage: ObjectStorage,
) {
  const asset = job.assets[0];
  const output = await resolveJobOutput(job.status, asset, storage);
  return {
    id: job.id,
    status: job.status,
    mode: job.mode,
    modelId: job.modelId,
    prompt: job.prompt,
    cost: Number(job.cost),
    progressPct: job.progressPct,
    errorCode: job.status === "failed" ? job.errorCode : null,
    queuePosition: job.queuePosition,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
    nextGenerateAt: job.nextGenerateAt?.toISOString() ?? null,
    output,
  };
}
