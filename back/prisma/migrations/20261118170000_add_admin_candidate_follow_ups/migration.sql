CREATE TYPE "AdminCandidateFollowUpStatus" AS ENUM (
  'notContacted',
  'contacted',
  'lookingForJob',
  'foundJobElsewhere',
  'hiredByAdmin'
);

CREATE TYPE "AdminOpportunityConsentStatus" AS ENUM (
  'notAsked',
  'yes',
  'no'
);

CREATE TABLE "AdminCandidateFollowUp" (
  "id" TEXT NOT NULL,
  "candidateUserId" TEXT,
  "candidateName" TEXT NOT NULL DEFAULT '',
  "candidatePhone" TEXT NOT NULL,
  "status" "AdminCandidateFollowUpStatus" NOT NULL DEFAULT 'notContacted',
  "privateNote" TEXT NOT NULL DEFAULT '',
  "lastAdminContactAt" TIMESTAMP(3),
  "nextFollowUpAt" TIMESTAMP(3),
  "opportunityConsent" "AdminOpportunityConsentStatus" NOT NULL DEFAULT 'notAsked',
  "opportunityConsentAt" TIMESTAMP(3),
  "opportunityConsentMethod" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminCandidateFollowUp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminCandidateFollowUp_candidateUserId_key"
  ON "AdminCandidateFollowUp"("candidateUserId");

CREATE UNIQUE INDEX "AdminCandidateFollowUp_candidatePhone_key"
  ON "AdminCandidateFollowUp"("candidatePhone");

CREATE INDEX "AdminCandidateFollowUp_status_idx"
  ON "AdminCandidateFollowUp"("status");

CREATE INDEX "AdminCandidateFollowUp_lastAdminContactAt_idx"
  ON "AdminCandidateFollowUp"("lastAdminContactAt");

CREATE INDEX "AdminCandidateFollowUp_nextFollowUpAt_idx"
  ON "AdminCandidateFollowUp"("nextFollowUpAt");

ALTER TABLE "AdminCandidateFollowUp"
  ADD CONSTRAINT "AdminCandidateFollowUp_candidateUserId_fkey"
  FOREIGN KEY ("candidateUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
