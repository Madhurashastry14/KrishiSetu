CREATE TYPE "Role" AS ENUM ('FARMER', 'BUYER');
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "ResponseStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
CREATE TYPE "PriceDataType" AS ENUM ('LIVE', 'HISTORICAL', 'DEMO');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "phone" TEXT,
  "shareContact" BOOLEAN NOT NULL DEFAULT false,
  "village" TEXT,
  "district" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProduceListing" (
  "id" TEXT NOT NULL,
  "farmerId" TEXT NOT NULL,
  "crop" TEXT NOT NULL,
  "quantity" DECIMAL(12,2) NOT NULL,
  "unit" TEXT NOT NULL,
  "expectedPrice" DECIMAL(12,2) NOT NULL,
  "village" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "imageUrl" TEXT,
  "variety" TEXT,
  "grade" TEXT,
  "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProduceListing_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BuyerRequest" (
  "id" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "crop" TEXT NOT NULL,
  "quantity" DECIMAL(12,2) NOT NULL,
  "unit" TEXT NOT NULL,
  "targetPrice" DECIMAL(12,2),
  "village" TEXT,
  "district" TEXT NOT NULL,
  "deadline" TIMESTAMP(3) NOT NULL,
  "requirements" TEXT,
  "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BuyerRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RequestResponse" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "farmerId" TEXT NOT NULL,
  "quantity" DECIMAL(12,2) NOT NULL,
  "unit" TEXT NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "message" TEXT,
  "status" "ResponseStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RequestResponse_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MandiPriceObservation" (
  "id" TEXT NOT NULL,
  "crop" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "district" TEXT,
  "modalPrice" DECIMAL(12,2) NOT NULL,
  "unit" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL,
  "dataType" "PriceDataType" NOT NULL DEFAULT 'DEMO',
  "externalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MandiPriceObservation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_district_idx" ON "User"("role", "district");
CREATE INDEX "ProduceListing_status_crop_district_idx" ON "ProduceListing"("status", "crop", "district");
CREATE INDEX "ProduceListing_farmerId_status_idx" ON "ProduceListing"("farmerId", "status");
CREATE INDEX "BuyerRequest_status_crop_district_deadline_idx" ON "BuyerRequest"("status", "crop", "district", "deadline");
CREATE INDEX "BuyerRequest_buyerId_status_idx" ON "BuyerRequest"("buyerId", "status");
CREATE UNIQUE INDEX "RequestResponse_requestId_farmerId_key" ON "RequestResponse"("requestId", "farmerId");
CREATE INDEX "RequestResponse_farmerId_status_idx" ON "RequestResponse"("farmerId", "status");
CREATE UNIQUE INDEX "MandiPriceObservation_externalId_key" ON "MandiPriceObservation"("externalId");
CREATE INDEX "MandiPriceObservation_crop_district_observedAt_idx" ON "MandiPriceObservation"("crop", "district", "observedAt");
ALTER TABLE "ProduceListing" ADD CONSTRAINT "ProduceListing_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuyerRequest" ADD CONSTRAINT "BuyerRequest_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequestResponse" ADD CONSTRAINT "RequestResponse_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BuyerRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequestResponse" ADD CONSTRAINT "RequestResponse_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
