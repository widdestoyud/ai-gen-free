import type { ObjectStorage } from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";

export const RETENTION_BATCH = 100;
export const RETENTION_EVERY_MS = 15 * 60 * 1000;
const MAX_BATCHES = 50;

export type RetentionAsset = {
  id: string;
  jobId: string;
  storageKey: string;
  expiresAt: Date;
  purgedAt: Date | null;
};

export type RetentionStore = {
  listExpiredUnpurged(
    now: Date,
    take: number,
    after?: { expiresAt: Date; id: string },
  ): Promise<RetentionAsset[]>;
  markPurged(id: string, purgedAt: Date): Promise<void>;
};

export function isRetentionKey(storageKey: string): boolean {
  return storageKey.startsWith("outputs/") || storageKey.startsWith("inputs/");
}

export function createPrismaRetentionStore(): RetentionStore {
  return {
    async listExpiredUnpurged(now, take, after) {
      return prisma.jobAsset.findMany({
        where: {
          expiresAt: { lt: now },
          purgedAt: null,
          ...(after
            ? {
                OR: [
                  { expiresAt: { gt: after.expiresAt } },
                  { expiresAt: after.expiresAt, id: { gt: after.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
        take,
        select: { id: true, jobId: true, storageKey: true, expiresAt: true, purgedAt: true },
      });
    },
    async markPurged(id, purgedAt) {
      await prisma.jobAsset.updateMany({
        where: { id, purgedAt: null },
        data: { purgedAt },
      });
    },
  };
}

export async function runRetentionSweep(opts: {
  store: RetentionStore;
  storage: ObjectStorage;
  now?: () => Date;
  batchSize?: number;
}): Promise<{ purged: number; skipped: number; failed: number }> {
  const now = opts.now ?? (() => new Date());
  const batchSize = opts.batchSize ?? RETENTION_BATCH;
  let purged = 0;
  let skipped = 0;
  let failed = 0;
  let after: { expiresAt: Date; id: string } | undefined;

  for (let i = 0; i < MAX_BATCHES; i += 1) {
    const batch = await opts.store.listExpiredUnpurged(now(), batchSize, after);
    if (batch.length === 0) break;
    for (const asset of batch) {
      if (!isRetentionKey(asset.storageKey)) {
        console.error(
          JSON.stringify({
            event: "retention.skip_prefix",
            assetId: asset.id,
            jobId: asset.jobId,
            key: asset.storageKey,
          }),
        );
        skipped += 1;
        continue;
      }
      try {
        await opts.storage.delete(asset.storageKey);
      } catch (err) {
        failed += 1;
        console.error(
          JSON.stringify({
            event: "retention.delete_failed",
            assetId: asset.id,
            jobId: asset.jobId,
            key: asset.storageKey,
            error: err instanceof Error ? err.message : "delete failed",
          }),
        );
        continue;
      }
      const purgedAt = now();
      await opts.store.markPurged(asset.id, purgedAt);
      purged += 1;
      console.log(
        JSON.stringify({
          event: "retention.purged",
          assetId: asset.id,
          jobId: asset.jobId,
          key: asset.storageKey,
        }),
      );
    }
    const last = batch[batch.length - 1]!;
    after = { expiresAt: last.expiresAt, id: last.id };
    if (batch.length < batchSize) break;
  }

  return { purged, skipped, failed };
}
