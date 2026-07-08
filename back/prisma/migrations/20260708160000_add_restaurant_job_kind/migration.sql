-- CreateEnum
CREATE TYPE "RestaurantJobKind" AS ENUM ('draft', 'posted');

-- AlterTable
ALTER TABLE "RestaurantJob"
ADD COLUMN "kind" "RestaurantJobKind" NOT NULL DEFAULT 'draft';

-- Existing public/demo jobs and already-active jobs are real posted jobs.
UPDATE "RestaurantJob"
SET "kind" = 'posted'
WHERE "ownerProfileId" IS NULL
  OR "isActive" = true
  OR EXISTS (
    SELECT 1
    FROM "RestaurantApplication"
    WHERE "RestaurantApplication"."restaurantJobId" = "RestaurantJob"."id"
  );

-- Safely backfill only the known starter templates as drafts.
-- Do not blindly convert every inactive owner job, because inactive posted jobs are valid.
UPDATE "RestaurantJob"
SET "kind" = 'draft'
WHERE "ownerProfileId" IS NOT NULL
  AND "isActive" = false
  AND NOT EXISTS (
    SELECT 1
    FROM "RestaurantApplication"
    WHERE "RestaurantApplication"."restaurantJobId" = "RestaurantJob"."id"
  )
  AND (
    ("role" = 'waiter' AND "shiftInfo" = '3–4 shifts per week, including at least one weekend shift.')
    OR ("role" = 'bartender' AND "shiftInfo" = 'Mostly evening shifts, 3–4 shifts per week, including at least one weekend shift.')
    OR ("role" = 'host' AND "shiftInfo" = 'Evening and weekend shifts, 3–4 shifts per week.')
    OR ("role" = 'cook' AND "shiftInfo" = '3–4 shifts per week, morning/evening depending on restaurant needs, including at least one weekend shift.')
    OR ("role" = 'floorManager' AND "shiftInfo" = '3–4 shifts per week, including evening and weekend availability.')
  );

-- CreateIndex
CREATE INDEX "RestaurantJob_kind_idx" ON "RestaurantJob"("kind");
