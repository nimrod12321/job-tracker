-- AlterEnum
ALTER TYPE "UserTrack" ADD VALUE 'restaurantOwner';

-- AlterTable
ALTER TABLE "RestaurantJob"
ADD COLUMN "ownerProfileId" TEXT;

-- CreateTable
CREATE TABLE "RestaurantOwnerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantName" TEXT NOT NULL DEFAULT '',
    "contactPerson" TEXT NOT NULL DEFAULT '',
    "phoneNumber" TEXT NOT NULL DEFAULT '',
    "whatsappNumber" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "area" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantOwnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RestaurantJob_ownerProfileId_idx" ON "RestaurantJob"("ownerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantOwnerProfile_userId_key" ON "RestaurantOwnerProfile"("userId");

-- AddForeignKey
ALTER TABLE "RestaurantJob"
ADD CONSTRAINT "RestaurantJob_ownerProfileId_fkey"
FOREIGN KEY ("ownerProfileId") REFERENCES "RestaurantOwnerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOwnerProfile"
ADD CONSTRAINT "RestaurantOwnerProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
