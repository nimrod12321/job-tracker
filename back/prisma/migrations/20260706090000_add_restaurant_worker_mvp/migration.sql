-- CreateEnum
CREATE TYPE "UserTrack" AS ENUM ('highTech', 'restaurant');

-- CreateEnum
CREATE TYPE "RestaurantRole" AS ENUM ('waiter', 'bartender', 'host', 'floorManager', 'cook');

-- CreateEnum
CREATE TYPE "RestaurantApplicationStatus" AS ENUM ('applied', 'selected', 'rejected');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "track" "UserTrack" NOT NULL DEFAULT 'highTech';

-- CreateTable
CREATE TABLE "RestaurantWorkerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL DEFAULT '',
    "phoneNumber" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "wantedRoles" "RestaurantRole"[] DEFAULT ARRAY[]::"RestaurantRole"[],
    "experienceText" TEXT NOT NULL DEFAULT '',
    "availability" TEXT NOT NULL DEFAULT '',
    "age" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantWorkerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantJob" (
    "id" TEXT NOT NULL,
    "restaurantName" TEXT NOT NULL,
    "role" "RestaurantRole" NOT NULL,
    "location" TEXT NOT NULL,
    "area" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "requirements" TEXT NOT NULL DEFAULT '',
    "shiftInfo" TEXT NOT NULL DEFAULT '',
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "contactWhatsapp" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantJobId" TEXT NOT NULL,
    "status" "RestaurantApplicationStatus" NOT NULL DEFAULT 'applied',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantWorkerProfile_userId_key" ON "RestaurantWorkerProfile"("userId");

-- CreateIndex
CREATE INDEX "RestaurantJob_role_idx" ON "RestaurantJob"("role");

-- CreateIndex
CREATE INDEX "RestaurantJob_location_idx" ON "RestaurantJob"("location");

-- CreateIndex
CREATE INDEX "RestaurantJob_isActive_idx" ON "RestaurantJob"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantApplication_userId_restaurantJobId_key" ON "RestaurantApplication"("userId", "restaurantJobId");

-- CreateIndex
CREATE INDEX "RestaurantApplication_userId_idx" ON "RestaurantApplication"("userId");

-- CreateIndex
CREATE INDEX "RestaurantApplication_restaurantJobId_idx" ON "RestaurantApplication"("restaurantJobId");

-- AddForeignKey
ALTER TABLE "RestaurantWorkerProfile"
ADD CONSTRAINT "RestaurantWorkerProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantApplication"
ADD CONSTRAINT "RestaurantApplication_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantApplication"
ADD CONSTRAINT "RestaurantApplication_restaurantJobId_fkey"
FOREIGN KEY ("restaurantJobId") REFERENCES "RestaurantJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
