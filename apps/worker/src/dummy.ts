import { AssetKind, JobStatus } from "@prisma/client";
import type { ObjectStorage } from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";
import { captureJob, releaseJob } from "@ai-gen-free/wallet";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

function asInt(value: { toString(): string } | number): number {
  return typeof value === "number" ? value : Number(value);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function processDummyJob(jobId: string, storage: ObjectStorage) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (job.status === JobStatus.succeeded || job.status === JobStatus.failed || job.status === JobStatus.canceled) {
    return;
  }

  const cost = asInt(job.cost);
  await prisma.job.update({
    where: { id: job.id },
    data: { status: JobStatus.running, startedAt: new Date(), progressPct: 20 },
  });
  await sleep(400);

  const params = (job.params ?? {}) as Record<string, unknown>;
  if (params.fail === true) {
    await releaseJob({ userId: job.userId, jobId: job.id, amount: cost });
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.failed,
        errorCode: "DUMMY_FAILED",
        progressPct: 100,
        finishedAt: new Date(),
      },
    });
    return;
  }

  await prisma.job.update({ where: { id: job.id }, data: { progressPct: 60 } });
  const key = `outputs/${job.userId}/${job.id}.png`;
  await storage.put({ key, body: PNG_1X1, contentType: "image/png" });
  await prisma.jobAsset.create({
    data: {
      jobId: job.id,
      kind: AssetKind.output,
      storageKey: key,
      contentType: "image/png",
      bytes: PNG_1X1.length,
      expiresAt: new Date(Date.now() + RETENTION_MS),
    },
  });

  const setting = await prisma.appSetting.findUnique({ where: { key: "generate_cooldown_seconds" } });
  const raw = setting?.value;
  const cooldownSeconds = typeof raw === "number" && Number.isFinite(raw) ? raw : 43200;
  const nextGenerateAt = new Date(Date.now() + cooldownSeconds * 1000);

  await captureJob({ userId: job.userId, jobId: job.id, amount: cost });
  await prisma.job.update({
    where: { id: job.id },
    data: {
      status: JobStatus.succeeded,
      progressPct: 100,
      finishedAt: new Date(),
      nextGenerateAt,
    },
  });
  await prisma.user.update({
    where: { id: job.userId },
    data: { nextGenerateAt },
  });
}
