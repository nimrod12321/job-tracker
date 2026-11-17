-- Additive Job Board / QR roles. Existing enum values and records are preserved.
ALTER TYPE "RestaurantRole" ADD VALUE 'restaurantManager';
ALTER TYPE "RestaurantRole" ADD VALUE 'baker';
ALTER TYPE "RestaurantRole" ADD VALUE 'pastryChef';

-- New restaurants can explicitly opt into resolving Match contact details from
-- their current verified team. Null keeps legacy/custom per-job contacts intact.
ALTER TABLE "RestaurantOwnerProfile"
ADD COLUMN "ownerMatchContactConfirmedAt" TIMESTAMP(3),
ADD COLUMN "primaryHiringManagerMemberId" TEXT;

CREATE UNIQUE INDEX "RestaurantOwnerProfile_primaryHiringManagerMemberId_key"
ON "RestaurantOwnerProfile"("primaryHiringManagerMemberId");

ALTER TABLE "RestaurantOwnerProfile"
ADD CONSTRAINT "RestaurantOwnerProfile_primaryHiringManagerMemberId_fkey"
FOREIGN KEY ("primaryHiringManagerMemberId")
REFERENCES "RestaurantMember"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
