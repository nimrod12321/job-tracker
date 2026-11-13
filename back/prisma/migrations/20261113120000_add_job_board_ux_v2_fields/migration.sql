-- CreateEnum
CREATE TYPE "RestaurantEmploymentScope" AS ENUM ('fullTime', 'partTime', 'flexible');

-- CreateEnum
CREATE TYPE "RestaurantVenueType" AS ENUM ('restaurant', 'bar', 'cafe', 'fastFood', 'stand', 'patisserie');

-- AlterTable
ALTER TABLE "RestaurantJob"
ADD COLUMN "employmentScope" "RestaurantEmploymentScope",
ADD COLUMN "hourlyWage" INTEGER;

-- AlterTable
ALTER TABLE "RestaurantOwnerProfile"
ADD COLUMN "venueTypes" "RestaurantVenueType"[] NOT NULL DEFAULT ARRAY[]::"RestaurantVenueType"[];
