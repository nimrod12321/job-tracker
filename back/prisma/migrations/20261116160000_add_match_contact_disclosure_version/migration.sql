-- Record which Match-contact disclosure was presented during onboarding.
-- This is deliberately separate from the legacy explicit-confirmation field.
ALTER TABLE "RestaurantOwnerProfile"
ADD COLUMN "matchContactDisclosureVersion" TEXT;
