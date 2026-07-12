-- Add QR-only restaurant roles. These are separate from posted jobs.
ALTER TYPE "RestaurantRole" ADD VALUE IF NOT EXISTS 'barista';
ALTER TYPE "RestaurantRole" ADD VALUE IF NOT EXISTS 'socialManager';

ALTER TABLE "RestaurantOwnerProfile"
ADD COLUMN "qrEnabledRoles" "RestaurantRole"[] NOT NULL
DEFAULT ARRAY['waiter', 'bartender', 'host', 'cook', 'floorManager']::"RestaurantRole"[];
