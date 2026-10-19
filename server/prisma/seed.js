import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const farmerPassword = await bcrypt.hash("Farmer@12345", 12);
  const buyerPassword = await bcrypt.hash("Buyer@12345", 12);
  const farmer = await prisma.user.upsert({
    where: { email: "farmer@demo.krishisetu.in" },
    update: {},
    create: { name: "Demo Farmer", email: "farmer@demo.krishisetu.in", passwordHash: farmerPassword, role: "FARMER", village: "Kavoor", district: "Dakshina Kannada" }
  });
  const buyer = await prisma.user.upsert({
    where: { email: "buyer@demo.krishisetu.in" },
    update: {},
    create: { name: "Demo Buyer", email: "buyer@demo.krishisetu.in", passwordHash: buyerPassword, role: "BUYER", village: "Mangaluru", district: "Dakshina Kannada" }
  });

  const listingFixtures = [
    { id: "demo-listing-tomato", crop: "Tomato", quantity: 45, unit: "kg", expectedPrice: 23, village: "Kavoor", district: "Dakshina Kannada", variety: "Local red" },
    { id: "demo-listing-coconut", crop: "Coconut", quantity: 160, unit: "piece", expectedPrice: 30, village: "Bantwal", district: "Dakshina Kannada", variety: "Fresh harvest" },
    { id: "demo-listing-banana", crop: "Banana", quantity: 75, unit: "kg", expectedPrice: 40, village: "Kundapura", district: "Udupi", grade: "Ripe and ready" }
  ];
  for (const { id, ...data } of listingFixtures) {
    await prisma.produceListing.upsert({ where: { id }, update: { ...data, farmerId: farmer.id }, create: { id, ...data, farmerId: farmer.id } });
  }

  const request = await prisma.buyerRequest.upsert({
    where: { id: "demo-buyer-request-tomato" },
    update: {
      buyerId: buyer.id, crop: "Tomato", quantity: 30, unit: "kg", targetPrice: 25,
      village: "Mangaluru", district: "Dakshina Kannada",
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), requirements: "Firm, ripe tomatoes for a local kitchen.", status: "OPEN"
    },
    create: {
      id: "demo-buyer-request-tomato", buyerId: buyer.id, crop: "Tomato", quantity: 30, unit: "kg",
      targetPrice: 25, village: "Mangaluru", district: "Dakshina Kannada",
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), requirements: "Firm, ripe tomatoes for a local kitchen."
    }
  });
  await prisma.requestResponse.upsert({
    where: { requestId_farmerId: { requestId: request.id, farmerId: farmer.id } },
    update: {},
    create: { requestId: request.id, farmerId: farmer.id, quantity: 20, unit: "kg", price: 24, message: "I can supply a fresh harvest this week." }
  });

  const base = new Date();
  const priceFixtures = [
    ["Tomato", "Mangaluru APMC", "Dakshina Kannada", 24, "kg", 3],
    ["Tomato", "Mangaluru APMC", "Dakshina Kannada", 22, "kg", 10],
    ["Tomato", "Mangaluru APMC", "Dakshina Kannada", 26, "kg", 17],
    ["Coconut", "Puttur APMC", "Dakshina Kannada", 32, "piece", 3],
    ["Banana", "Mangaluru APMC", "Dakshina Kannada", 38, "kg", 5]
  ];
  for (let index = 0; index < priceFixtures.length; index++) {
    const [crop, market, district, modalPrice, unit, daysAgo] = priceFixtures[index];
    const externalId = `krishisetu-demo-price-${index + 1}`;
    await prisma.mandiPriceObservation.upsert({
      where: { externalId },
      update: {},
      create: {
        crop, market, district, modalPrice, unit,
        observedAt: new Date(base.getTime() - daysAgo * 24 * 60 * 60 * 1000),
        source: "KrishiSetu sample data", dataType: "DEMO", externalId
      }
    });
  }
  console.log("Seeded clearly labelled KrishiSetu demo users, produce, requests and sample mandi observations.");
  console.log("Demo credentials: farmer@demo.krishisetu.in / Farmer@12345; buyer@demo.krishisetu.in / Buyer@12345");
}

main().catch((error) => {
  console.error("Database seed failed:", error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
