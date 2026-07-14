-- Store one private, single-use restaurant activation claim per restaurant.
-- Only a hash of the derived private token is persisted.
CREATE TABLE "RestaurantClaim" (
    "id" TEXT NOT NULL,
    "restaurantOwnerProfileId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RestaurantClaim_restaurantOwnerProfileId_key"
ON "RestaurantClaim"("restaurantOwnerProfileId");

CREATE UNIQUE INDEX "RestaurantClaim_tokenHash_key"
ON "RestaurantClaim"("tokenHash");

CREATE INDEX "RestaurantClaim_restaurantOwnerProfileId_idx"
ON "RestaurantClaim"("restaurantOwnerProfileId");

CREATE INDEX "RestaurantClaim_claimedAt_idx"
ON "RestaurantClaim"("claimedAt");

ALTER TABLE "RestaurantClaim"
ADD CONSTRAINT "RestaurantClaim_restaurantOwnerProfileId_fkey"
FOREIGN KEY ("restaurantOwnerProfileId")
REFERENCES "RestaurantOwnerProfile"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
