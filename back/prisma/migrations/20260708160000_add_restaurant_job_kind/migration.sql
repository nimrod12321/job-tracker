-- CreateEnum
CREATE TYPE "RestaurantJobKind" AS ENUM ('draft', 'posted');

-- AlterTable
ALTER TABLE "RestaurantJob"
ADD COLUMN "kind" "RestaurantJobKind" NOT NULL DEFAULT 'posted';

-- Backfill owner-created inactive jobs that have no applications as draft templates.
-- Active jobs and jobs with applications remain posted so workers/applications keep working.
UPDATE "RestaurantJob"
SET "kind" = 'draft'
WHERE "ownerProfileId" IS NOT NULL
  AND "isActive" = false
  AND NOT EXISTS (
    SELECT 1
    FROM "RestaurantApplication"
    WHERE "RestaurantApplication"."restaurantJobId" = "RestaurantJob"."id"
  );

-- CreateIndex
CREATE INDEX "RestaurantJob_kind_idx" ON "RestaurantJob"("kind");
