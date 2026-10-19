import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "./app.js";

describe("HTTP API", () => {
  it("returns a healthy status", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("ok");
  });

  it("rejects protected routes without a session cookie", async () => {
    const response = await request(app).get("/api/dashboard");
    expect(response.status).toBe(401);
    expect(response.body.error.message).toContain("sign in");
  });

  it("uses a consistent not-found error response", async () => {
    const response = await request(app).get("/api/missing");
    expect(response.status).toBe(404);
    expect(response.body.error.message).toBe("Endpoint not found.");
  });

  it("rejects incomplete Fair Price Meter requests without querying the database", async () => {
    const response = await request(app).get("/api/prices/compare?crop=Tomato");
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("positive expectedPrice");
  });

  it("rejects impossible marketplace price ranges before database access", async () => {
    const response = await request(app).get("/api/listings/marketplace?minPrice=25&maxPrice=10");
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("Minimum price");
  });
});
