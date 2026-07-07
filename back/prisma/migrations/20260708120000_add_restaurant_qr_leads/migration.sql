-- CreateEnum
CREATE TYPE "CandidateLeadStatus" AS ENUM ('new', 'contacted', 'relevant', 'rejected');

-- AlterTable
ALTER TABLE "RestaurantOwnerProfile" ADD COLUMN "slug" TEXT;

-- CreateTable
CREATE TABLE "RestaurantCandidateLead" (
    "id" TEXT NOT NULL,
    "ownerProfileId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "wantedRoles" "RestaurantRole"[] DEFAULT ARRAY[]::"RestaurantRole"[],
    "experienceText" TEXT NOT NULL DEFAULT '',
    "availability" TEXT NOT NULL DEFAULT '',
    "age" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'qr',
    "status" "CandidateLeadStatus" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantCandidateLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantOwnerProfile_slug_key" ON "RestaurantOwnerProfile"("slug");

-- CreateIndex
CREATE INDEX "RestaurantCandidateLead_ownerProfileId_idx" ON "RestaurantCandidateLead"("ownerProfileId");

-- CreateIndex
CREATE INDEX "RestaurantCandidateLead_phoneNumber_idx" ON "RestaurantCandidateLead"("phoneNumber");

-- CreateIndex
CREATE INDEX "RestaurantCandidateLead_status_idx" ON "RestaurantCandidateLead"("status");

-- CreateIndex
CREATE INDEX "RestaurantCandidateLead_createdAt_idx" ON "RestaurantCandidateLead"("createdAt");

-- AddForeignKey
ALTER TABLE "RestaurantCandidateLead" ADD CONSTRAINT "RestaurantCandidateLead_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES "RestaurantOwnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
