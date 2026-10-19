import { describe, expect, it } from "vitest";
import {
  listingSchema,
  purchaseRequestSchema,
  requestSchema,
  registrationSchema,
} from "./validation.js";

describe("server-side request validation", () => {
  it("accepts a buyer request with no target price", () => {
    const result = requestSchema.parse({
      crop: "Tomato",
      quantity: "20",
      unit: "kg",
      targetPrice: null,
      district: "Udupi",
      deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    });
    expect(result.targetPrice).toBeUndefined();
    expect(result.quantity).toBe(20);
  });

  it("rejects invalid roles, empty crop names, and non-positive listing prices", () => {
    expect(
      registrationSchema.safeParse({
        name: "Name",
        email: "farmer@example.com",
        password: "12345678",
        role: "ADMIN",
      }).success,
    ).toBe(false);
    expect(
      listingSchema.safeParse({
        crop: "",
        quantity: 1,
        unit: "kg",
        expectedPrice: 0,
        village: "Kavoor",
        district: "Udupi",
      }).success,
    ).toBe(false);
  });

  it("requires positive purchase-request quantity and price", () => {
    expect(
      purchaseRequestSchema.safeParse({ quantityKg: 0, pricePerKg: 10 })
        .success,
    ).toBe(false);
    expect(
      purchaseRequestSchema.safeParse({ quantityKg: 2, pricePerKg: -1 })
        .success,
    ).toBe(false);
    expect(
      purchaseRequestSchema.safeParse({ quantityKg: "2.5", pricePerKg: "4.25" })
        .success,
    ).toBe(true);
  });
});
