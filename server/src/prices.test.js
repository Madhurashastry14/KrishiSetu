import { describe, expect, it } from "vitest";
import { compareFairPrice } from "./prices.js";

const observation = {
  crop: "Tomato",
  market: "Mangaluru APMC",
  district: "Dakshina Kannada",
  modalPrice: 100,
  unit: "kg",
  observedAt: new Date("2026-10-18T00:00:00.000Z"),
  source: "Test source",
  dataType: "HISTORICAL",
};
const now = new Date("2026-10-19T00:00:00.000Z");

describe("Fair Price Meter", () => {
  it.each([
    [95, "GREEN"],
    [94.99, "AMBER"],
    [80, "AMBER"],
    [79.99, "RED"],
  ])("classifies ratio at expected price %s as %s", (expectedPrice, band) => {
    const result = compareFairPrice({
      expectedPrice,
      unit: "kg",
      observations: [observation],
      now,
    });
    expect(result.available).toBe(true);
    expect(result.band).toBe(band);
    expect(result.ratio).toBe(expectedPrice / 100);
  });

  it("prefers a matching district and compatible unit", () => {
    const otherDistrict = {
      ...observation,
      district: "Udupi",
      observedAt: new Date("2026-10-19T00:00:00.000Z"),
    };
    const result = compareFairPrice({
      expectedPrice: 90,
      unit: "kg",
      district: "Dakshina Kannada",
      observations: [otherDistrict, observation],
      now,
    });
    expect(result.reference.district).toBe("Dakshina Kannada");
    expect(
      compareFairPrice({
        expectedPrice: 90,
        unit: "piece",
        observations: [observation],
        now,
      }).available,
    ).toBe(false);
  });

  it("does not use stale observations or divide by zero", () => {
    const stale = {
      ...observation,
      observedAt: new Date("2026-08-01T00:00:00.000Z"),
    };
    expect(
      compareFairPrice({
        expectedPrice: 20,
        unit: "kg",
        observations: [stale],
        now,
      }).reason,
    ).toBe("stale");
    expect(
      compareFairPrice({
        expectedPrice: 0,
        unit: "kg",
        observations: [{ ...observation, modalPrice: 0 }],
        now,
      }).available,
    ).toBe(false);
    expect(
      compareFairPrice({
        expectedPrice: 90,
        unit: "kg",
        observations: [
          { ...observation, observedAt: new Date("2026-10-20T00:00:00.000Z") },
        ],
        now,
      }).available,
    ).toBe(false);
  });
});
