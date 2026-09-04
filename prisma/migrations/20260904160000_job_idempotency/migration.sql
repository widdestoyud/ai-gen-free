ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Job_userId_idempotencyKey_key"
ON "Job"("userId", "idempotencyKey");
