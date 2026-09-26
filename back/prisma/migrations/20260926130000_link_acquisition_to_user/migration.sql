-- AlterTable
ALTER TABLE "AnalyticsAcquisition" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "AnalyticsAcquisition_userId_idx" ON "AnalyticsAcquisition"("userId");

-- AddForeignKey
ALTER TABLE "AnalyticsAcquisition" ADD CONSTRAINT "AnalyticsAcquisition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
