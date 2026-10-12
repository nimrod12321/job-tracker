-- CreateEnum
CREATE TYPE "RestaurantCandidateNotificationKind" AS ENUM ('newCandidate', 'reminder24h');

-- CreateEnum
CREATE TYPE "RestaurantCandidateNotificationStatus" AS ENUM ('pending', 'accepted', 'failed');

-- AlterTable
ALTER TABLE "RestaurantCandidateLead"
ADD COLUMN "firstContactInitiatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RestaurantCandidateNotificationDelivery" (
    "id" TEXT NOT NULL,
    "candidateLeadId" TEXT NOT NULL,
    "recipientMemberId" TEXT,
    "recipientPhone" TEXT NOT NULL,
    "kind" "RestaurantCandidateNotificationKind" NOT NULL,
    "status" "RestaurantCandidateNotificationStatus" NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "providerMessageSid" TEXT,
    "safeErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantCandidateNotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantCandidateNotificationDelivery_candidateLeadId_recipientPhone_kind_key"
ON "RestaurantCandidateNotificationDelivery"("candidateLeadId", "recipientPhone", "kind");

-- CreateIndex
CREATE INDEX "RestaurantCandidateNotificationDelivery_candidateLeadId_idx"
ON "RestaurantCandidateNotificationDelivery"("candidateLeadId");

-- CreateIndex
CREATE INDEX "RestaurantCandidateNotificationDelivery_recipientMemberId_idx"
ON "RestaurantCandidateNotificationDelivery"("recipientMemberId");

-- CreateIndex
CREATE INDEX "RestaurantCandidateNotificationDelivery_status_idx"
ON "RestaurantCandidateNotificationDelivery"("status");

-- AddForeignKey
ALTER TABLE "RestaurantCandidateNotificationDelivery"
ADD CONSTRAINT "RestaurantCandidateNotificationDelivery_candidateLeadId_fkey"
FOREIGN KEY ("candidateLeadId") REFERENCES "RestaurantCandidateLead"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantCandidateNotificationDelivery"
ADD CONSTRAINT "RestaurantCandidateNotificationDelivery_recipientMemberId_fkey"
FOREIGN KEY ("recipientMemberId") REFERENCES "RestaurantMember"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
