-- AlterTable
ALTER TABLE "RestaurantWorkerProfile"
ADD COLUMN "preferredWorkAreaLatitude" DOUBLE PRECISION,
ADD COLUMN "preferredWorkAreaLongitude" DOUBLE PRECISION,
ADD COLUMN "preferredWorkAreaRadiusKm" DOUBLE PRECISION;
