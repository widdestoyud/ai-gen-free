import type { IncomingHttpHeaders } from "node:http";
import { JobMode, JobStatus, LedgerStatus, LedgerType, Prisma } from "@prisma/client";
import { AppError, AuthResponses, ErrorCodes, jobClientErrorMessage, type ObjectStorage } from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";
import { assertEnoughPoints, computeBalance, refreshWalletCache } from "@ai-gen-free/wallet";
import { recordUserActivity } from "../activity/service.js";
import { resolveModel, resolveVideoPointCost, toOpaqueModelId } from "./catalog.js";
import { parseGenerateParams } from "./params.js";
import { isOutputAssetLive, isOutputPurged, promptPreview, resolveJobOutput } from "./output.js";

const PROMPT_MAX = 4000;

export async function submitJob(opts: {
  userId: string;
  idempotencyKey: unknown;
  body: { mode?: unknown; modelId?: unknown; prompt?: unknown; params?: unknown; providerId?: unknown; isSpicy?: unknown };
  enqueue: (jobId: string) => Promise<void>;
  assertReady?: () => Promise<void>;
  req?: {
    ip?: string;
    headers?: IncomingHttpHeaders;
  };
}) {
  const idempotencyKey = parseIdempotencyKey(opts.idempotencyKey);
  const model = await resolveModel(opts.body.mode, opts.body.modelId, opts.body.isSpicy);
  const isImageTransform =
    model.mode === "i2i" ||
    model.mode === "inpaint" ||
    model.mode === "faceswap" ||
    model.modelId.includes("upscale");
  const prompt = parsePrompt(opts.body.prompt, isImageTransform);
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
  if (model.isSpicy && !user.spicyModeEnabled) {
    throw new AppError(
      ErrorCodes.SPICY_MODE_REQUIRED,
      AuthResponses.errors.SPICY_MODE_REQUIRED.message,
      403,
    );
  }

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

  const isVideo = model.mode === "t2v" || model.mode === "i2v";
  const parsedParams = (params as Record<string, unknown>) ?? {};
  const effectiveCost = isVideo
    ? resolveVideoPointCost(parsedParams.duration, parsedParams.resolution, model.videoConfigPoints, model.costPoints)
    : model.costPoints;

  const { available } = await computeBalance(opts.userId);
  assertEnoughPoints(available, effectiveCost);

  let job;
  try {
    job = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "userId" FROM "Wallet" WHERE "userId" = ${opts.userId} FOR UPDATE`;
      const created = await tx.job.create({
        data: {
          userId: opts.userId,
          mode: model.mode,
          status: JobStatus.queued,
          cost: effectiveCost,
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
          amount: effectiveCost,
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
  void recordUserActivity({
    userId: opts.userId,
    action: `generate.${model.mode}`,
    req: opts.req,
    metadata: {
      jobId: job.id,
      mode: model.mode,
      cost: effectiveCost,
      promptPreview: promptPreview(prompt, 100),
      params,
    },
  });
  console.log(
    JSON.stringify({
      event: "job.accepted",
      jobId: job.id,
      userId: opts.userId,
      costHeld: effectiveCost,
      modelId: model.modelId,
      providerId: model.providerId,
    }),
  );
  return toAccepted({ ...job, queuePosition });
}

export async function getJobForUser(opts: { userId: string; id: string; storage: ObjectStorage }) {
  const [job, user] = await Promise.all([
    prisma.job.findFirst({
      where: { id: opts.id, userId: opts.userId },
      include: { assets: { where: { kind: "output" }, orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    prisma.user.findUnique({
      where: { id: opts.userId },
      select: { spicyModeEnabled: true },
    }),
  ]);
  if (!job) throw new AppError(ErrorCodes.NOT_FOUND, "Job tidak ditemukan", 404);

  const isSpicy =
    (job.modelId && (job.modelId.includes("spicy") || job.modelId.includes("uncensored"))) ||
    (job.params &&
      typeof job.params === "object" &&
      !Array.isArray(job.params) &&
      ((job.params as Record<string, unknown>).isSpicy === true ||
        (job.params as Record<string, unknown>).is_spicy === true));

  if (isSpicy && !user?.spicyModeEnabled) {
    throw new AppError(
      ErrorCodes.SPICY_MODE_REQUIRED,
      AuthResponses.errors.SPICY_MODE_REQUIRED.message,
      403,
    );
  }

  return serializeJob(job, opts.storage);
}

export async function listJobsForUser(opts: { userId: string; storage: ObjectStorage }) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: opts.userId },
    select: { nextGenerateAt: true, spicyModeEnabled: true },
  });

  let spicyModelIds: Set<string> | null = null;
  if (!user.spicyModeEnabled) {
    const spicyCatalogRows = await prisma.modelCatalog
      .findMany({
        where: { isSpicy: true },
        select: { modelId: true },
      })
      .catch(() => []);
    spicyModelIds = new Set(spicyCatalogRows.map((r) => r.modelId));
  }

  const rows = await prisma.job.findMany({
    where: {
      userId: opts.userId,
      ...(!user.spicyModeEnabled && spicyModelIds
        ? {
            AND: [
              { modelId: { notIn: Array.from(spicyModelIds) } },
              { modelId: { not: { contains: "spicy" } } },
              { modelId: { not: { contains: "uncensored" } } },
            ],
          }
        : {}),
    },
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
  model_id?: string | null;
  cost: number | null;
  status: string;
  url: string | null;
  mime_type: string;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  created_at: string;
  expires_at: string | null;
  params?: Record<string, unknown> | null;
  is_spicy?: boolean;
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
  isSpicy?: boolean;
}): Promise<ListCustomerLibraryResult> {
  const limit = typeof opts.limit === "number" && opts.limit > 0 ? Math.min(opts.limit, 100) : 20;
  const offset = typeof opts.offset === "number" && opts.offset >= 0 ? opts.offset : 0;
  const rawType = (opts.type || opts.kind || "all").toLowerCase().trim();
  const rawSort = (opts.sort || "date").toLowerCase().trim();
  const rawOrder = (opts.order || "desc").toLowerCase().trim();
  const search = typeof opts.q === "string" ? opts.q.trim().toLowerCase() : "";

  const isAsc = rawOrder === "asc" || rawOrder === "oldest";

  const [user, spicyCatalogRows] = await Promise.all([
    prisma.user
      .findUnique({
        where: { id: opts.userId },
        select: { spicyModeEnabled: true },
      })
      .catch(() => null),
    prisma.modelCatalog
      .findMany({
        where: { isSpicy: true },
        select: { modelId: true },
      })
      .catch(() => []),
  ]);

  const spicyModeEnabled = Boolean(user?.spicyModeEnabled);
  const spicyModelIds = new Set(spicyCatalogRows.map((r) => r.modelId));

  const isJobSpicy = (row: {
    modelId?: string | null;
    params?: Prisma.JsonValue | null;
  }): boolean => {
    if (row.modelId && spicyModelIds.has(row.modelId)) return true;
    if (row.modelId && (row.modelId.includes("spicy") || row.modelId.includes("uncensored"))) {
      return true;
    }
    if (row.params && typeof row.params === "object" && !Array.isArray(row.params)) {
      const p = row.params as Record<string, unknown>;
      if (p.isSpicy === true || p.is_spicy === true) return true;
    }
    return false;
  };

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
      const shouldExcludeSpicy = !spicyModeEnabled || opts.isSpicy === false;
      const shouldOnlySpicy = spicyModeEnabled && opts.isSpicy === true;

      const spicyFilterCondition: Prisma.JobWhereInput = shouldExcludeSpicy
        ? {
            AND: [
              { modelId: { notIn: Array.from(spicyModelIds) } },
              { modelId: { not: { contains: "spicy" } } },
              { modelId: { not: { contains: "uncensored" } } },
            ],
          }
        : shouldOnlySpicy
          ? {
              OR: [
                { modelId: { in: Array.from(spicyModelIds) } },
                { modelId: { contains: "spicy" } },
                { modelId: { contains: "uncensored" } },
              ],
            }
          : {};

      const jobWhere: Prisma.JobWhereInput = {
        userId: opts.userId,
        status: JobStatus.succeeded,
        assets: {
          some: {
            kind: "output",
            purgedAt: null,
            expiresAt: { gt: now },
          },
        },
        ...spicyFilterCondition,
      };

      if (generatedKindFilter === "video") {
        jobWhere.mode = { in: ["t2v", "i2v"] };
      } else if (generatedKindFilter === "image") {
        jobWhere.mode = { in: ["t2i", "i2i", "inpaint", "faceswap"] };
      }

      if (search) {
        jobWhere.OR = [
          { alias: { contains: search, mode: "insensitive" } },
          { prompt: { contains: search, mode: "insensitive" } },
          { id: { contains: search, mode: "insensitive" } },
          { modelId: { contains: search, mode: "insensitive" } },
        ];
      }

      let jobOrderBy: Prisma.JobOrderByWithRelationInput = { createdAt: isAsc ? "asc" : "desc" };
      if (rawSort === "name" || rawSort === "alias") {
        jobOrderBy = { alias: isAsc ? "asc" : "desc" };
      } else if (rawSort === "cost") {
        jobOrderBy = { cost: isAsc ? "asc" : "desc" };
      }

      const isJobOnly = !includeUploads;

      const [jobsCount, jobRows] = await Promise.all([
        prisma.job.count({ where: jobWhere }),
        prisma.job.findMany({
          where: jobWhere,
          orderBy: jobOrderBy,
          skip: isJobOnly ? offset : 0,
          take: isJobOnly ? limit : fetchLimit,
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

        const spicy = isJobSpicy(row);
        if (shouldExcludeSpicy && spicy) {
          continue;
        }
        if (shouldOnlySpicy && !spicy) {
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

        const url = `/api/customer/generated/${row.id}/file`;
        const mimeType = asset?.contentType || (isVideo ? "video/mp4" : "image/webp");

        generatedItems.push({
          id: row.id,
          type: "generated",
          kind: itemKind,
          alias: row.alias ?? null,
          prompt: row.prompt,
          model_id: row.modelId ?? null,
          cost: Number(row.cost),
          status: row.status,
          url,
          mime_type: mimeType,
          width: asset?.width ?? null,
          height: asset?.height ?? null,
          size_bytes: asset?.bytes ?? null,
          created_at: row.createdAt.toISOString(),
          expires_at: asset?.expiresAt ? asset.expiresAt.toISOString() : null,
          params: (row.params as Record<string, unknown>) ?? null,
          is_spicy: spicy,
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

      if (search) {
        uploadWhere.OR = [
          { alias: { contains: search, mode: "insensitive" } },
          { id: { contains: search, mode: "insensitive" } },
        ];
      }

      let uploadOrderBy: Prisma.UploadOrderByWithRelationInput = { createdAt: isAsc ? "asc" : "desc" };
      if (rawSort === "name" || rawSort === "alias") {
        uploadOrderBy = { alias: isAsc ? "asc" : "desc" };
      } else if (rawSort === "size" || rawSort === "size_bytes") {
        uploadOrderBy = { bytes: isAsc ? "asc" : "desc" };
      }

      const isUploadOnly = !includeGenerated;

      const [uploadsCount, uploadRows] = await Promise.all([
        prisma.upload.count({ where: uploadWhere }),
        prisma.upload.findMany({
          where: uploadWhere,
          orderBy: uploadOrderBy,
          skip: isUploadOnly ? offset : 0,
          take: isUploadOnly ? limit : fetchLimit,
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
          model_id: null,
          cost: null,
          status: "ready",
          url: `/api/customer/uploads/${row.id}/file`,
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

  // 3. Gabungkan jika kedua jenis media diminta
  let combined = [...generatedItems, ...uploadItems];

  if (includeGenerated && includeUploads) {
    if (search) {
      combined = combined.filter((item) => {
        const aliasMatch = item.alias?.toLowerCase().includes(search) ?? false;
        const promptMatch = item.prompt?.toLowerCase().includes(search) ?? false;
        const idMatch = item.id.toLowerCase().includes(search);
        const modelMatch = item.model_id?.toLowerCase().includes(search) ?? false;
        const isUpscale =
          item.model_id?.toLowerCase().includes("upscale") ||
          Boolean(item.params && (item.params.upscale_mode !== undefined || item.params.upscale_factor !== undefined));
        const upscaleMatch = isUpscale && (search.includes("upscale") || search === "upscaled");
        return aliasMatch || promptMatch || idMatch || modelMatch || upscaleMatch;
      });
    }

    // Jalankan sorting gabungan
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

  // Jika single-source, pagination sudah diterapkan di tingkat database
  return {
    total: includeGenerated ? totalJobs : totalUploads,
    limit,
    offset,
    items: combined,
  };
}

const outputInclude = {
  assets: { where: { kind: "output" as const }, orderBy: { createdAt: "desc" as const }, take: 1 },
};

export async function listAdminJobs(opts: {
  status?: JobStatus;
  mode?: JobMode;
  userId?: string;
  q?: string;
  page?: number;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  const page =
    opts.page && opts.page > 0
      ? opts.page
      : opts.offset !== undefined
        ? Math.floor(opts.offset / (opts.limit || 10)) + 1
        : 1;
  const limit = Math.min(100, Math.max(1, opts.limit ?? 10));
  const skip = opts.offset !== undefined ? opts.offset : (page - 1) * limit;
  const sortOrder = opts.sortOrder === "asc" ? ("asc" as const) : ("desc" as const);
  const sortBy = opts.sortBy ?? "createdAt";

  const where: Prisma.JobWhereInput = {
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.mode ? { mode: opts.mode } : {}),
    ...(opts.userId ? { userId: opts.userId } : {}),
    ...(opts.q ? { user: { email: { contains: opts.q, mode: "insensitive" } } } : {}),
  };

  let orderBy: Prisma.JobOrderByWithRelationInput = { createdAt: sortOrder };
  if (sortBy === "cost") orderBy = { cost: sortOrder };
  else if (sortBy === "status") orderBy = { status: sortOrder };
  else if (sortBy === "mode") orderBy = { mode: sortOrder };

  const [total, rows] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy,
      take: limit,
      skip,
      include: {
        user: { select: { email: true } },
        ...outputInclude,
      },
    }),
  ]);

  const now = new Date();
  const items = rows.map((row) => {
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

  return {
    jobs: items,
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      hasNext: skip + limit < total,
      hasPrev: skip > 0,
    },
  };
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

function parsePrompt(raw: unknown, allowEmpty = false): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    if (allowEmpty) return "";
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
    params?: Prisma.JsonValue;
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
    modelId: toOpaqueModelId(job.mode, job.modelId),
    prompt: job.prompt,
    params: (job.params as Record<string, unknown>) ?? {},
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
