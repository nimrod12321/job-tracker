-- Add owner-view tracking for QR candidate leads.
ALTER TABLE "RestaurantCandidateLead"
ADD COLUMN "ownerViewedAt" TIMESTAMP(3);

-- Store public QR funnel events without personal applicant data.
CREATE TABLE "RestaurantQrEvent" (
    "id" TEXT NOT NULL,
    "ownerProfileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestaurantQrEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RestaurantCandidateLead_ownerViewedAt_idx" ON "RestaurantCandidateLead"("ownerViewedAt");
CREATE INDEX "RestaurantQrEvent_ownerProfileId_idx" ON "RestaurantQrEvent"("ownerProfileId");
CREATE INDEX "RestaurantQrEvent_type_idx" ON "RestaurantQrEvent"("type");
CREATE INDEX "RestaurantQrEvent_sessionId_idx" ON "RestaurantQrEvent"("sessionId");
CREATE INDEX "RestaurantQrEvent_createdAt_idx" ON "RestaurantQrEvent"("createdAt");

ALTER TABLE "RestaurantQrEvent"
ADD CONSTRAINT "RestaurantQrEvent_ownerProfileId_fkey"
FOREIGN KEY ("ownerProfileId")
REFERENCES "RestaurantOwnerProfile"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
