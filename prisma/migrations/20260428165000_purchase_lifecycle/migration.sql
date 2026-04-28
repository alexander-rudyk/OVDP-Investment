-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('ACTIVE', 'CLOSED', 'MATURED', 'DELETED');

-- AlterTable
ALTER TABLE "purchases"
ADD COLUMN "status" "PurchaseStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "closed_at" TIMESTAMP(3),
ADD COLUMN "deleted_at" TIMESTAMP(3),
ADD COLUMN "final_usd_rate" DECIMAL(18,8);

-- Preserve lifecycle state for purchases that were already matured before this migration.
UPDATE "purchases"
SET "status" = 'MATURED'
WHERE "matured_at" IS NOT NULL;

-- CreateIndex
CREATE INDEX "purchases_status_idx" ON "purchases"("status");
