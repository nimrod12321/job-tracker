-- AlterTable
ALTER TABLE "RestaurantJob" ADD COLUMN "publishedFromDraftId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantJob_publishedFromDraftId_key" ON "RestaurantJob"("publishedFromDraftId");
