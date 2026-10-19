ALTER TABLE "BuyerRequest" ADD COLUMN "listingId" TEXT;
CREATE INDEX "BuyerRequest_listingId_idx" ON "BuyerRequest"("listingId");
CREATE UNIQUE INDEX "BuyerRequest_buyerId_listingId_key" ON "BuyerRequest"("buyerId", "listingId");
ALTER TABLE "BuyerRequest" ADD CONSTRAINT "BuyerRequest_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "ProduceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
