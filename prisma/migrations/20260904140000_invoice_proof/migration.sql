-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'awaiting_review';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'rejected';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "proofStorageKey" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "proofContentType" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "proofBytes" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "proofSubmittedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "reviewNote" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "reviewedByAdminId" TEXT;

CREATE INDEX IF NOT EXISTS "Invoice_status_proofSubmittedAt_idx"
ON "Invoice"("status", "proofSubmittedAt");
