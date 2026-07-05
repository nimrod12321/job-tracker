-- CreateEnum
CREATE TYPE "DiscoveryDecision" AS ENUM ('liked', 'disliked');

-- CreateTable
CREATE TABLE "JobDiscoveryDecision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "jobUrl" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL,
    "jobDescription" TEXT NOT NULL DEFAULT '',
    "salaryText" TEXT NOT NULL DEFAULT '',
    "estimatedSalary" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "fitScore" INTEGER NOT NULL DEFAULT 0,
    "fitReason" TEXT NOT NULL DEFAULT '',
    "decision" "DiscoveryDecision" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobDiscoveryDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobDiscoveryDecision_userId_idx" ON "JobDiscoveryDecision"("userId");

-- CreateIndex
CREATE INDEX "JobDiscoveryDecision_userId_decision_idx" ON "JobDiscoveryDecision"("userId", "decision");

-- CreateIndex
CREATE INDEX "JobDiscoveryDecision_userId_jobUrl_idx" ON "JobDiscoveryDecision"("userId", "jobUrl");

-- CreateIndex
CREATE UNIQUE INDEX "JobDiscoveryDecision_userId_source_externalId_key" ON "JobDiscoveryDecision"("userId", "source", "externalId");

-- AddForeignKey
ALTER TABLE "JobDiscoveryDecision" ADD CONSTRAINT "JobDiscoveryDecision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
