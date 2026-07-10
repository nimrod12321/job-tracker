-- CreateEnum
CREATE TYPE "RestaurantMemberRole" AS ENUM ('owner', 'hiringManager');

-- CreateEnum
CREATE TYPE "RestaurantMemberStatus" AS ENUM ('active', 'pending', 'removed');

-- CreateTable
CREATE TABLE "RestaurantMember" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "userId" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "role" "RestaurantMemberRole" NOT NULL,
    "status" "RestaurantMemberStatus" NOT NULL DEFAULT 'pending',
    "invitedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantMember_pkey" PRIMARY KEY ("id")
);

-- Backfill existing restaurant owners that already have a user account phone.
INSERT INTO "RestaurantMember" (
    "id",
    "restaurantId",
    "userId",
    "phoneNumber",
    "displayName",
    "role",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    md5(random()::text || clock_timestamp()::text),
    "RestaurantOwnerProfile"."id",
    "User"."id",
    "User"."phoneNumber",
    COALESCE(NULLIF("RestaurantOwnerProfile"."contactPerson", ''), "User"."fullName", ''),
    'owner',
    'active',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "RestaurantOwnerProfile"
JOIN "User" ON "User"."id" = "RestaurantOwnerProfile"."userId"
WHERE "User"."phoneNumber" IS NOT NULL
ON CONFLICT DO NOTHING;

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantMember_restaurantId_phoneNumber_key" ON "RestaurantMember"("restaurantId", "phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantMember_restaurantId_userId_key" ON "RestaurantMember"("restaurantId", "userId");

-- CreateIndex
CREATE INDEX "RestaurantMember_phoneNumber_idx" ON "RestaurantMember"("phoneNumber");

-- CreateIndex
CREATE INDEX "RestaurantMember_userId_idx" ON "RestaurantMember"("userId");

-- CreateIndex
CREATE INDEX "RestaurantMember_restaurantId_idx" ON "RestaurantMember"("restaurantId");

-- CreateIndex
CREATE INDEX "RestaurantMember_status_idx" ON "RestaurantMember"("status");

-- AddForeignKey
ALTER TABLE "RestaurantMember"
ADD CONSTRAINT "RestaurantMember_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "RestaurantOwnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantMember"
ADD CONSTRAINT "RestaurantMember_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantMember"
ADD CONSTRAINT "RestaurantMember_invitedByUserId_fkey"
FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
