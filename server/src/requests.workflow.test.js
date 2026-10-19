import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl;

const [{ default: app }, { prisma }] = await Promise.all([
  import("./app.js"),
  import("./db.js")
]);

const emails = [];
const describeWithDatabase = describe.skipIf(!testDatabaseUrl);

describeWithDatabase("buyer request and farmer offer workflow", () => {
  afterAll(async () => {
    if (emails.length) await prisma.user.deleteMany({ where: { email: { in: emails } } });
  });

  it("creates, edits, accepts, and refreshes a single accepted offer safely", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    async function register(role, label, district = "Udupi") {
      const email = `${label}-${suffix}@example.test`;
      emails.push(email);
      const agent = request.agent(app);
      const response = await agent.post("/api/auth/register").send({
        name: label,
        email,
        password: "test-password-123",
        role,
        district,
        village: "Test village"
      });
      expect(response.status).toBe(201);
      return agent;
    }

    const buyer = await register("BUYER", "Workflow buyer");
    const otherBuyer = await register("BUYER", "Other buyer");
    const farmer = await register("FARMER", "Workflow farmer");
    const otherFarmer = await register("FARMER", "Other farmer");
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const createdRequest = await buyer.post("/api/requests").send({
      crop: "Tomato",
      quantity: 100,
      unit: "kg",
      targetPrice: 20,
      district: "Udupi",
      deadline
    });
    expect(createdRequest.status).toBe(201);
    const requestId = createdRequest.body.data.item.id;

    const offerResponse = await farmer.post(`/api/requests/${requestId}/responses`).send({
      quantity: 40,
      unit: "kg",
      price: 18,
      message: "Fresh harvest"
    });
    expect(offerResponse.status).toBe(201);
    const offerId = offerResponse.body.data.item.id;
    const farmerRequests = await farmer.get("/api/requests");
    expect(farmerRequests.status).toBe(200);
    expect(farmerRequests.body.data.items.find(({ id }) => id === requestId).responses[0].id).toBe(offerId);

    const duplicate = await farmer.post(`/api/requests/${requestId}/responses`).send({
      quantity: 45,
      unit: "kg",
      price: 19
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.message).toContain("already have an offer");

    const edit = await farmer.patch(`/api/requests/responses/${offerId}`).send({
      quantity: 50,
      unit: "kg",
      price: 17,
      message: "Updated offer"
    });
    expect(edit.status).toBe(200);
    expect(Number(edit.body.data.item.quantity)).toBe(50);
    expect(Number(edit.body.data.item.price)).toBe(17);

    const otherOffer = await otherFarmer.post(`/api/requests/${requestId}/responses`).send({
      quantity: 30,
      unit: "kg",
      price: 16
    });
    expect(otherOffer.status).toBe(201);

    const forbiddenEdit = await otherFarmer.patch(`/api/requests/responses/${offerId}`).send({
      quantity: 50,
      unit: "kg",
      price: 17
    });
    expect(forbiddenEdit.status).toBe(403);

    const unauthorizedAcceptance = await otherBuyer.patch(`/api/requests/responses/${offerId}`).send({ status: "ACCEPTED" });
    expect(unauthorizedAcceptance.status).toBe(403);

    const accepted = await buyer.patch(`/api/requests/responses/${offerId}`).send({ status: "ACCEPTED" });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.item.status).toBe("ACCEPTED");
    expect(accepted.body.data.item.request.status).toBe("CLOSED");

    const acceptedEdit = await farmer.patch(`/api/requests/responses/${offerId}`).send({
      quantity: 55,
      unit: "kg",
      price: 16
    });
    expect(acceptedEdit.status).toBe(409);

    const farmerDashboard = await farmer.get("/api/dashboard");
    expect(farmerDashboard.status).toBe(200);
    expect(farmerDashboard.body.data.recentResponses.find(({ id }) => id === offerId).status).toBe("ACCEPTED");
    const refreshedDashboard = await farmer.get("/api/dashboard");
    expect(refreshedDashboard.body.data.recentResponses.find(({ id }) => id === offerId).status).toBe("ACCEPTED");

    const competingOffer = await buyer.patch(`/api/requests/responses/${otherOffer.body.data.item.id}`).send({ status: "ACCEPTED" });
    expect(competingOffer.status).toBe(409);
    expect(await prisma.requestResponse.count({ where: { requestId, status: "ACCEPTED" } })).toBe(1);

    const secondRequest = await buyer.post("/api/requests").send({
      crop: "Onion",
      quantity: 80,
      unit: "kg",
      district: "Udupi",
      deadline
    });
    expect(secondRequest.status).toBe(201);
    const secondOffer = await farmer.post(`/api/requests/${secondRequest.body.data.item.id}/responses`).send({
      quantity: 25,
      unit: "kg",
      price: 22
    });
    expect(secondOffer.status).toBe(201);

    const invalidTransition = await farmer.patch(`/api/requests/responses/${secondOffer.body.data.item.id}`).send({
      status: "ACCEPTED"
    });
    expect(invalidTransition.status).toBe(400);

    const closed = await buyer.patch(`/api/requests/${secondRequest.body.data.item.id}`).send({ status: "CLOSED" });
    expect(closed.status).toBe(200);
    expect((await prisma.requestResponse.findUnique({ where: { id: secondOffer.body.data.item.id } })).status).toBe("DECLINED");
    const offerAfterClose = await otherFarmer.post(`/api/requests/${secondRequest.body.data.item.id}/responses`).send({
      quantity: 15,
      unit: "kg",
      price: 21
    });
    expect(offerAfterClose.status).toBe(404);
  });

  it("creates listing-linked purchase requests for the owner farmer and preserves contact consent", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    async function register(role, label, shareContact = false) {
      const email = `${label}-${suffix}@example.test`;
      emails.push(email);
      const agent = request.agent(app);
      const response = await agent.post("/api/auth/register").send({
        name: label,
        email,
        password: "test-password-123",
        role,
        phone: "+919876543210",
        shareContact,
        district: "Udupi",
        village: "Test village"
      });
      expect(response.status).toBe(201);
      return agent;
    }

    const buyer = await register("BUYER", "Listing buyer");
    const farmer = await register("FARMER", "Listing owner");
    const otherFarmer = await register("FARMER", "Different farmer");
    const optedInFarmer = await register("FARMER", "Opted in farmer", true);

    const listingResponse = await farmer.post("/api/listings").send({
      crop: "Tomato",
      quantity: 3,
      unit: "quintal",
      expectedPrice: 5000,
      village: "Test village",
      district: "Udupi",
      variety: "Local"
    });
    expect(listingResponse.status).toBe(201);
    const listingId = listingResponse.body.data.item.id;

    const privateListing = await request(app).get(`/api/listings/marketplace/${listingId}`);
    expect(privateListing.status).toBe(200);
    expect(privateListing.body.data.item.farmer.shareContact).toBe(false);
    expect(privateListing.body.data.item.farmer.phone).toBeNull();

    const unauthenticated = await request(app).post(`/api/listings/marketplace/${listingId}/purchase-requests`).send({
      quantityKg: 20,
      pricePerKg: 50
    });
    expect(unauthenticated.status).toBe(401);

    const forbidden = await farmer.post(`/api/listings/marketplace/${listingId}/purchase-requests`).send({
      quantityKg: 20,
      pricePerKg: 50
    });
    expect(forbidden.status).toBe(403);

    const invalidQuantity = await buyer.post(`/api/listings/marketplace/${listingId}/purchase-requests`).send({
      quantityKg: 0,
      pricePerKg: 50
    });
    expect(invalidQuantity.status).toBe(400);
    const invalidPrice = await buyer.post(`/api/listings/marketplace/${listingId}/purchase-requests`).send({
      quantityKg: 20,
      pricePerKg: 0
    });
    expect(invalidPrice.status).toBe(400);
    const excessiveQuantity = await buyer.post(`/api/listings/marketplace/${listingId}/purchase-requests`).send({
      quantityKg: 301,
      pricePerKg: 50
    });
    expect(excessiveQuantity.status).toBe(400);

    const submitted = await buyer.post(`/api/listings/marketplace/${listingId}/purchase-requests`).send({
      quantityKg: 150,
      pricePerKg: 53.25,
      message: "Please harvest fresh"
    });
    expect(submitted.status).toBe(201);
    expect(submitted.body.data.item.listingId).toBe(listingId);
    expect(Number(submitted.body.data.item.quantity)).toBe(150);
    expect(Number(submitted.body.data.item.targetPrice)).toBe(53.25);
    expect(submitted.body.data.item.unit).toBe("kg");

    const duplicate = await buyer.post(`/api/listings/marketplace/${listingId}/purchase-requests`).send({
      quantityKg: 10,
      pricePerKg: 50
    });
    expect(duplicate.status).toBe(409);

    const farmerRequests = await farmer.get("/api/requests");
    const linkedRequest = farmerRequests.body.data.items.find(({ id }) => id === submitted.body.data.item.id);
    expect(linkedRequest).toBeDefined();
    expect(linkedRequest.listing.id).toBe(listingId);
    const notVisibleToOtherFarmer = await otherFarmer.get("/api/requests");
    expect(notVisibleToOtherFarmer.body.data.items.some(({ id }) => id === submitted.body.data.item.id)).toBe(false);
    const dashboard = await farmer.get("/api/dashboard");
    expect(dashboard.body.data.requests.some(({ id }) => id === submitted.body.data.item.id)).toBe(true);

    const wrongFarmerOffer = await otherFarmer.post(`/api/requests/${submitted.body.data.item.id}/responses`).send({
      quantity: 150,
      unit: "kg",
      price: 52
    });
    expect(wrongFarmerOffer.status).toBe(403);
    const farmerOffer = await farmer.post(`/api/requests/${submitted.body.data.item.id}/responses`).send({
      quantity: 150,
      unit: "kg",
      price: 52,
      message: "I can supply this quantity"
    });
    expect(farmerOffer.status).toBe(201);
    const accepted = await buyer.patch(`/api/requests/responses/${farmerOffer.body.data.item.id}`).send({ status: "ACCEPTED" });
    expect(accepted.status).toBe(200);
    const buyerRequests = await buyer.get("/api/requests");
    expect(buyerRequests.body.data.items.find(({ id }) => id === submitted.body.data.item.id).responses[0].status).toBe("ACCEPTED");

    const optedInListing = await optedInFarmer.post("/api/listings").send({
      crop: "Cucumber",
      quantity: 10,
      unit: "kg",
      expectedPrice: 25,
      village: "Test village",
      district: "Udupi"
    });
    expect(optedInListing.status).toBe(201);
    const publicOptedInListing = await request(app).get(`/api/listings/marketplace/${optedInListing.body.data.item.id}`);
    expect(publicOptedInListing.body.data.item.farmer.shareContact).toBe(true);
    expect(publicOptedInListing.body.data.item.farmer.phone).toBe("+919876543210");

    await farmer.patch(`/api/listings/${listingId}`).send({ status: "INACTIVE" });
    const unavailable = await buyer.post(`/api/listings/marketplace/${listingId}/purchase-requests`).send({
      quantityKg: 1,
      pricePerKg: 50
    });
    expect(unavailable.status).toBe(409);
  });
});
