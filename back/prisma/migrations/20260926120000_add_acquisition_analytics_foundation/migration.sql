-- CreateTable
CREATE TABLE "AnalyticsAcquisition" (
    "id" TEXT NOT NULL,
    "anonymousAcquisitionId" TEXT NOT NULL,
    "firstSource" TEXT NOT NULL,
    "firstMedium" TEXT NOT NULL,
    "firstCampaign" TEXT,
    "firstReferrer" TEXT,
    "direct" BOOLEAN NOT NULL,
    "firstLandingPath" TEXT NOT NULL,
    "firstTouchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsAcquisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "acquisitionId" TEXT NOT NULL,
    "clientEventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "route" TEXT,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsAcquisition_anonymousAcquisitionId_key" ON "AnalyticsAcquisition"("anonymousAcquisitionId");

-- CreateIndex
CREATE INDEX "AnalyticsAcquisition_firstTouchedAt_idx" ON "AnalyticsAcquisition"("firstTouchedAt");

-- CreateIndex
CREATE INDEX "AnalyticsAcquisition_expiresAt_idx" ON "AnalyticsAcquisition"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsEvent_clientEventId_key" ON "AnalyticsEvent"("clientEventId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_acquisitionId_idx" ON "AnalyticsEvent"("acquisitionId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventName_idx" ON "AnalyticsEvent"("eventName");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_occurredAt_idx" ON "AnalyticsEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_expiresAt_idx" ON "AnalyticsEvent"("expiresAt");

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_acquisitionId_fkey" FOREIGN KEY ("acquisitionId") REFERENCES "AnalyticsAcquisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
