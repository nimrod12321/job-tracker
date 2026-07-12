-- Normalize the old Drafts/Posted Jobs model into one owner Job Board.
-- Draft jobs become inactive posted jobs.
UPDATE "RestaurantJob"
SET
  "kind" = 'posted',
  "isActive" = false,
  "publishedFromDraftId" = NULL
WHERE "kind" = 'draft';

-- One job per role per restaurant is the new beta rule.
-- If old data has duplicate ownerProfileId+role rows, keep the best board row:
-- active jobs first, then most recently updated. Preserve duplicate rows by
-- detaching them from the owner profile instead of hard-deleting them.
WITH ranked_jobs AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "ownerProfileId", "role"
      ORDER BY
        CASE WHEN "isActive" THEN 0 ELSE 1 END,
        "updatedAt" DESC,
        "createdAt" DESC,
        "id" ASC
    ) AS row_number
  FROM "RestaurantJob"
  WHERE "ownerProfileId" IS NOT NULL
)
UPDATE "RestaurantJob"
SET
  "ownerProfileId" = NULL,
  "isActive" = false,
  "publishedFromDraftId" = NULL
WHERE "id" IN (
  SELECT "id"
  FROM ranked_jobs
  WHERE row_number > 1
);

CREATE UNIQUE INDEX "RestaurantJob_ownerProfileId_role_key"
ON "RestaurantJob"("ownerProfileId", "role");
