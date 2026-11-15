-- Additive privacy consent and SMS preference fields. Existing users remain
-- without historical legal/marketing consent; transactional service alerts
-- retain their existing enabled behavior until a user changes the setting.
ALTER TABLE "User"
ADD COLUMN "legalAcceptedAt" TIMESTAMP(3),
ADD COLUMN "legalPolicyVersion" TEXT,
ADD COLUMN "marketingSmsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "marketingSmsConsentedAt" TIMESTAMP(3),
ADD COLUMN "marketingSmsOptedOutAt" TIMESTAMP(3),
ADD COLUMN "newCandidateSmsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "candidateReminderSmsEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "MarketingSmsUnsubscribeToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingSmsUnsubscribeToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingSmsUnsubscribeToken_tokenHash_key"
ON "MarketingSmsUnsubscribeToken"("tokenHash");

CREATE INDEX "MarketingSmsUnsubscribeToken_userId_idx"
ON "MarketingSmsUnsubscribeToken"("userId");

CREATE INDEX "MarketingSmsUnsubscribeToken_expiresAt_idx"
ON "MarketingSmsUnsubscribeToken"("expiresAt");

CREATE INDEX "MarketingSmsUnsubscribeToken_usedAt_idx"
ON "MarketingSmsUnsubscribeToken"("usedAt");

ALTER TABLE "MarketingSmsUnsubscribeToken"
ADD CONSTRAINT "MarketingSmsUnsubscribeToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
