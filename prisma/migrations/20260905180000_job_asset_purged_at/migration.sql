-- M5: retensi objek 14 hari menandai JobAsset tanpa menghapus baris Job/prompt/hash.

ALTER TABLE "JobAsset" ADD COLUMN "purgedAt" TIMESTAMP(3);

CREATE INDEX "JobAsset_expiresAt_purgedAt_idx" ON "JobAsset"("expiresAt", "purgedAt");
