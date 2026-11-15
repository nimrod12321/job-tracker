-- Existing accounts remain completed without manufacturing historical legal
-- consent. New OTP registrations explicitly write NULL until the final
-- consent step succeeds.
ALTER TABLE "User"
ADD COLUMN "registrationCompletedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
