-- CreateTable
CREATE TABLE "AdminRestaurantReadState" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "lastViewedCandidatesAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminRestaurantReadState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminRestaurantReadState_adminUserId_restaurantId_key" ON "AdminRestaurantReadState"("adminUserId", "restaurantId");

-- CreateIndex
CREATE INDEX "AdminRestaurantReadState_adminUserId_idx" ON "AdminRestaurantReadState"("adminUserId");

-- CreateIndex
CREATE INDEX "AdminRestaurantReadState_restaurantId_idx" ON "AdminRestaurantReadState"("restaurantId");

-- CreateIndex
CREATE INDEX "AdminRestaurantReadState_lastViewedCandidatesAt_idx" ON "AdminRestaurantReadState"("lastViewedCandidatesAt");

-- AddForeignKey
ALTER TABLE "AdminRestaurantReadState"
ADD CONSTRAINT "AdminRestaurantReadState_adminUserId_fkey"
FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRestaurantReadState"
ADD CONSTRAINT "AdminRestaurantReadState_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "RestaurantOwnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
