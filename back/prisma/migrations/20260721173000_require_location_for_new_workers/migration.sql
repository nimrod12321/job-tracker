-- Existing users remain legacy-compatible. Application code sets this flag
-- only when a new restaurant worker account is created after this migration.
ALTER TABLE "User"
ADD COLUMN "workerLocationRequired" BOOLEAN NOT NULL DEFAULT false;
