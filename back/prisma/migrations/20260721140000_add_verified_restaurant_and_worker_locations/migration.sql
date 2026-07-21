-- Additive location foundation. Existing legacy address data is intentionally
-- left untouched and remains unverified until an admin verifies it manually.
CREATE TYPE "RestaurantLocationStatus" AS ENUM ('unverified', 'verified');

ALTER TABLE "RestaurantOwnerProfile"
ADD COLUMN "locationStatus" "RestaurantLocationStatus" NOT NULL DEFAULT 'unverified',
ADD COLUMN "locationCity" TEXT,
ADD COLUMN "locationStreetName" TEXT,
ADD COLUMN "locationStreetNumber" TEXT,
ADD COLUMN "formattedAddress" TEXT,
ADD COLUMN "googlePlaceId" TEXT,
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "locationVerifiedAt" TIMESTAMP(3);

ALTER TABLE "RestaurantWorkerProfile"
ADD COLUMN "homeStreetName" TEXT,
ADD COLUMN "homeAreaFormatted" TEXT,
ADD COLUMN "homeGooglePlaceId" TEXT,
ADD COLUMN "homeLatitude" DOUBLE PRECISION,
ADD COLUMN "homeLongitude" DOUBLE PRECISION,
ADD COLUMN "homeLocationUpdatedAt" TIMESTAMP(3);
