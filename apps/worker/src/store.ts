import { AssetKind, JobStatus, Prisma } from "@prisma/client";
import { prisma } from "@ai-gen-free/db";
import type { GenerateJobRecord, GenerateJobStore, OutputAssetInput } from "./process-job.js";

const DEFAULT_COOLDOWN_SECONDS = 43200;

function asInt(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : Number(value);
}

function toRecord(job: {
  id: string;
  userId: string;
  status: JobStatus;
  cost: Prisma.Decimal;
  mode: string;
  modelId: string;
  providerId: string;
  providerJobId: string | null;
  prompt: string;
  params: Prisma.JsonValue;
  startedAt: Date | null;
  nextGenerateAt: Date | null;
}): GenerateJobRecord {
  return {
    id: job.id,
    userId: job.userId,
    status: job.status,
    cost: asInt(job.cost),
    mode: job.mode,
    modelId: job.modelId,
    providerId: job.providerId,
    providerJobId: job.providerJobId,
    prompt: job.prompt,
    params: (job.params ?? {}) as Record<string, unknown>,
    startedAt: job.startedAt,
    nextGenerateAt: job.nextGenerateAt,
  };
}

export function createPrismaGenerateStore(): GenerateJobStore {
  return {
    async get(jobId) {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      return job ? toRecord(job) : null;
    },

    async markRunning(jobId, startedAt) {
      const current = await prisma.job.findUnique({ where: { id: jobId } });
      if (!current) return;
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.running,
          startedAt: current.startedAt ?? startedAt,
          progressPct: Math.max(current.progressPct, 10),
        },
      });
    },

    async saveProviderJobId(jobId, providerJobId) {
      await prisma.job.update({ where: { id: jobId }, data: { providerJobId } });
    },

    async saveProviderOutputUrls(jobId, urls) {
      const current = await prisma.job.findUnique({ where: { id: jobId } });
      if (!current) return;
      const params =
        current.params && typeof current.params === "object" && !Array.isArray(current.params)
          ? { ...(current.params as Record<string, unknown>), providerOutputUrls: urls }
          : { providerOutputUrls: urls };
      await prisma.job.update({
        where: { id: jobId },
        data: { params, progressPct: 100 },
      });
    },

    async updateProgress(jobId, progressPct) {
      await prisma.job.update({
        where: { id: jobId },
        data: { progressPct, status: JobStatus.running },
      });
    },

    async hasOutputAsset(jobId) {
      const row = await prisma.jobAsset.findFirst({
        where: { jobId, kind: AssetKind.output },
        select: { id: true },
      });
      return Boolean(row);
    },

    async putOutputAsset(jobId, asset: OutputAssetInput) {
      try {
        await prisma.jobAsset.create({
          data: {
            jobId,
            kind: AssetKind.output,
            storageKey: asset.storageKey,
            contentType: asset.contentType,
            bytes: asset.bytes,
            sha256: asset.sha256,
            expiresAt: asset.expiresAt,
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
        throw err;
      }
    },

    async succeed(jobId, opts) {
      await prisma.$transaction([
        prisma.job.update({
          where: { id: jobId },
          data: {
            status: JobStatus.succeeded,
            progressPct: 100,
            finishedAt: opts.finishedAt,
            nextGenerateAt: opts.nextGenerateAt,
          },
        }),
        prisma.user.update({
          where: { id: opts.userId },
          data: { nextGenerateAt: opts.nextGenerateAt },
        }),
      ]);
    },

    async fail(jobId, opts) {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.failed,
          errorCode: opts.errorCode,
          progressPct: 100,
          finishedAt: opts.finishedAt,
        },
      });
    },

    async cooldownSeconds() {
      const setting = await prisma.appSetting.findUnique({ where: { key: "generate_cooldown_seconds" } });
      const raw = setting?.value;
      return typeof raw === "number" && Number.isFinite(raw) ? raw : DEFAULT_COOLDOWN_SECONDS;
    },

    async listCopyPendingJobIds(olderThan) {
      const rows = await prisma.job.findMany({
        where: {
          status: JobStatus.running,
          providerJobId: { not: null },
          startedAt: { lte: olderThan },
          assets: { none: {} },
        },
        select: { id: true },
        take: 25,
        orderBy: { startedAt: "asc" },
      });
      return rows.map((row) => row.id);
    },
  };
}


