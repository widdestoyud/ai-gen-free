import { JobStatus, LedgerStatus, LedgerType, Prisma } from "@prisma/client";
import { AppError, ErrorCodes, jobClientErrorMessage, type ObjectStorage } from "@ai-gen-free/core";
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
  assertReady?: () => Promise<void>;
}) {
  const idempotencyKey = parseIdempotencyKey(opts.idempotencyKey);
  const prompt = parsePrompt(opts.body.prompt);
  const model = await resolveModel(opts.body.mode, opts.body.modelId);
  const params = parseGenerateParams(opts.body.params, model.providerId);
  if (opts.assertReady) {
    try {
      await opts.assertReady();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new AppError(ErrorCodes.NOT_READY, `Storage/DB belum siap: ${detail}`, 503);
    }
  }

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

export type LibraryItemType = "generated" | "upload";
export type LibraryItemKind = "image" | "video";

export interface CustomerLibraryItem {
  id: string;
  type: LibraryItemType;
  kind: LibraryItemKind;
  alias: string | null;
  prompt: string | null;
  cost: number | null;
  status: string;
  url: string | null;
  mime_type: string;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  created_at: string;
  expires_at: string | null;
}

export interface ListCustomerLibraryResult {
  total: number;
  limit: number;
  offset: number;
  items: CustomerLibraryItem[];
}

export async function listCustomerLibrary(opts: {
  userId: string;
  storage: ObjectStorage;
  limit?: number;
  offset?: number;
  type?: string;
  kind?: string;
  sort?: string;
  order?: string;
  q?: string;
}): Promise<ListCustomerLibraryResult> {
  const limit = typeof opts.limit === "number" && opts.limit > 0 ? Math.min(opts.limit, 100) : 20;
  const offset = typeof opts.offset === "number" && opts.offset >= 0 ? opts.offset : 0;
  const rawType = (opts.type || opts.kind || "all").toLowerCase().trim();
  const rawSort = (opts.sort || "date").toLowerCase().trim();
  const rawOrder = (opts.order || "desc").toLowerCase().trim();
  const search = typeof opts.q === "string" ? opts.q.trim().toLowerCase() : "";

  const isAsc = rawOrder === "asc" || rawOrder === "oldest";

  // Tentukan apakah perlu mengambil generated media dan/atau upload media
  const includeGenerated =
    rawType === "all" ||
    rawType === "media" ||
    rawType === "projects" ||
    rawType === "apps" ||
    rawType === "files" ||
    rawType === "generated" ||
    rawType === "generations" ||
    rawType === "image" ||
    rawType === "images" ||
    rawType === "video" ||
    rawType === "videos";

  const includeUploads =
    rawType === "all" ||
    rawType === "media" ||
    rawType === "files" ||
    rawType === "upload" ||
    rawType === "uploads" ||
    rawType === "image" ||
    rawType === "images";

  const generatedKindFilter =
    rawType === "video" || rawType === "videos" || rawType === "apps"
      ? "video"
      : rawType === "image" || rawType === "images"
        ? "image"
        : "all";

  const now = new Date();
  // Untuk menjamin akurasi pagination gabungan dan sorting kustom, ambil batas secukupnya
  const fetchLimit = offset + limit;

  let generatedItems: CustomerLibraryItem[] = [];
  let uploadItems: CustomerLibraryItem[] = [];
  let totalJobs = 0;
  let totalUploads = 0;

  // 1. Ambil Generated Media dari Job (hanya yang berhasil / succeeded dan memiliki live output)
  if (includeGenerated) {
    try {
      const jobWhere: Prisma.JobWhereInput = {
        userId: opts.userId,
        status: JobStatus.succeeded,
      };

      const [jobsCount, jobRows] = await Promise.all([
        prisma.job.count({ where: jobWhere }),
        prisma.job.findMany({
          where: jobWhere,
          orderBy: { createdAt: isAsc ? "asc" : "desc" },
          take: rawSort === "date" || rawSort === "created_at" ? fetchLimit : 100,
          include: outputInclude,
        }),
      ]);

      totalJobs = jobsCount;

      for (const row of jobRows) {
        const asset = row.assets[0];
        const isLive = asset ? isOutputAssetLive(asset, now) : false;
        // Hanya tampilkan media yang berhasil dan asetnya masih aktif
        if (row.status !== JobStatus.succeeded || !asset || !isLive) {
          continue;
        }

        const isVideo =
          row.mode?.includes("video") ||
          row.mode === "t2v" ||
          row.mode === "i2v" ||
          (asset?.contentType?.startsWith("video/") ?? false);
        const itemKind: LibraryItemKind = isVideo ? "video" : "image";

        if (generatedKindFilter !== "all" && generatedKindFilter !== itemKind) {
          continue;
        }

        const url = `/customer/generated/${row.id}/file`;
        const mimeType = asset?.contentType || (isVideo ? "video/mp4" : "image/webp");

        generatedItems.push({
          id: row.id,
          type: "generated",
          kind: itemKind,
          alias: row.alias ?? null,
          prompt: row.prompt,
          cost: Number(row.cost),
          status: row.status,
          url,
          mime_type: mimeType,
          width: asset?.width ?? null,
          height: asset?.height ?? null,
          size_bytes: asset?.bytes ?? null,
          created_at: row.createdAt.toISOString(),
          expires_at: asset?.expiresAt ? asset.expiresAt.toISOString() : null,
        });
      }
    } catch {
      // Non-fatal if db offline
    }
  }

  // 2. Ambil Uploaded Media
  if (includeUploads) {
    try {
      const uploadWhere: Prisma.UploadWhereInput = {
        userId: opts.userId,
        actor: "customer",
        purgedAt: null,
        deletedAt: null,
        expiresAt: { gt: now },
      };

      const [uploadsCount, uploadRows] = await Promise.all([
        prisma.upload.count({ where: uploadWhere }),
        prisma.upload.findMany({
          where: uploadWhere,
          orderBy: { createdAt: isAsc ? "asc" : "desc" },
          take: rawSort === "date" || rawSort === "created_at" ? fetchLimit : 100,
        }),
      ]);

      totalUploads = uploadsCount;

      for (const row of uploadRows) {
        uploadItems.push({
          id: row.id,
          type: "upload",
          kind: "image",
          alias: row.alias ?? null,
          prompt: null,
          cost: null,
          status: "ready",
          url: `/customer/uploads/${row.id}/file`,
          mime_type: (row.contentType as string) || "image/webp",
          width: row.width,
          height: row.height,
          size_bytes: row.bytes,
          created_at: row.createdAt.toISOString(),
          expires_at: row.expiresAt.toISOString(),
        });
      }
    } catch {
      // Non-fatal if db offline
    }
  }

  // 3. Gabungkan dan filter query pencarian jika ada
  let combined = [...generatedItems, ...uploadItems];

  if (search) {
    combined = combined.filter((item) => {
      const aliasMatch = item.alias?.toLowerCase().includes(search) ?? false;
      const promptMatch = item.prompt?.toLowerCase().includes(search) ?? false;
      const idMatch = item.id.toLowerCase().includes(search);
      return aliasMatch || promptMatch || idMatch;
    });
  }

  // 4. Urutkan berdasarkan sort dan order
  combined.sort((a, b) => {
    let cmp = 0;
    if (rawSort === "name" || rawSort === "alias") {
      const nameA = (a.alias || a.prompt || a.id).toLowerCase();
      const nameB = (b.alias || b.prompt || b.id).toLowerCase();
      cmp = nameA.localeCompare(nameB);
    } else if (rawSort === "size" || rawSort === "size_bytes") {
      const sizeA = a.size_bytes ?? 0;
      const sizeB = b.size_bytes ?? 0;
      cmp = sizeA - sizeB;
    } else if (rawSort === "cost") {
      const costA = a.cost ?? 0;
      const costB = b.cost ?? 0;
      cmp = costA - costB;
    } else {
      // Default: date / created_at
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      cmp = timeA - timeB;
    }

    return isAsc ? cmp : -cmp;
  });

  const total = search || rawType !== "all" ? combined.length : totalJobs + totalUploads;
  const items = combined.slice(offset, offset + limit);

  return {
    total,
    limit,
    offset,
    items,
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

export async function getJobOutputFileForUser(opts: {
  userId: string;
  id: string;
  storage: ObjectStorage;
}) {
  const job = await prisma.job.findFirst({
    where: { id: opts.id, userId: opts.userId },
    include: outputInclude,
  });
  if (!job) throw new AppError(ErrorCodes.NOT_FOUND, "Job tidak ditemukan", 404);
  return readLiveOutputFile(job, opts.storage);
}

export async function getAdminJobOutputFile(opts: { id: string; storage: ObjectStorage }) {
  const job = await prisma.job.findUnique({
    where: { id: opts.id },
    include: outputInclude,
  });
  if (!job) throw new AppError(ErrorCodes.NOT_FOUND, "Job tidak ditemukan", 404);
  return readLiveOutputFile(job, opts.storage);
}

async function readLiveOutputFile(
  job: { assets: { storageKey: string; contentType: string; expiresAt: Date; purgedAt: Date | null }[] },
  storage: ObjectStorage,
) {
  const asset = job.assets[0];
  if (!asset || !isOutputAssetLive(asset, new Date())) {
    throw new AppError(ErrorCodes.NOT_FOUND, "File tidak ditemukan", 404);
  }
  try {
    const obj = await storage.get(asset.storageKey);
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
    alias?: string | null;
    assets: { storageKey: string; contentType: string; expiresAt: Date; purgedAt: Date | null }[];
  },
  storage: ObjectStorage,
) {
  const asset = job.assets[0];
  const output = await resolveJobOutput(job.status, asset, storage, { jobId: job.id });
  return {
    id: job.id,
    status: job.status,
    mode: job.mode,
    modelId: job.modelId,
    prompt: job.prompt,
    cost: Number(job.cost),
    progressPct: job.progressPct,
    errorCode: job.status === "failed" ? job.errorCode : null,
    errorMessage: job.status === "failed" ? jobClientErrorMessage(job.errorCode) : null,
    queuePosition: job.queuePosition,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
    nextGenerateAt: job.nextGenerateAt?.toISOString() ?? null,
    alias: job.alias ?? null,
    output,
  };
}

export async function updateJobAliasForUser(opts: {
  userId: string;
  id: string;
  rawAlias: unknown;
  storage: ObjectStorage;
}) {
  const job = await prisma.job.findFirst({
    where: { id: opts.id, userId: opts.userId },
    include: outputInclude,
  });
  if (!job) throw new AppError(ErrorCodes.NOT_FOUND, "Job tidak ditemukan", 404);

  const alias =
    typeof opts.rawAlias === "string" && opts.rawAlias.trim().length > 0
      ? opts.rawAlias.trim().slice(0, 100)
      : opts.rawAlias === null || opts.rawAlias === ""
        ? null
        : job.alias;

  const updated = await prisma.job.update({
    where: { id: job.id },
    data: { alias },
    include: outputInclude,
  });

  return serializeJob(updated, opts.storage);
}
