ALTER TABLE "ModelCatalog" ADD COLUMN IF NOT EXISTS "displayName" TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS "JobAsset_jobId_kind_key" ON "JobAsset"("jobId", "kind");
