import { describe, expect, it } from "vitest";
import {
  buildPriceChartModel,
  filterPriceObservations,
  sortPriceObservations,
  summarizeMarketPrices,
} from "./priceInsights.js";

const observation = (market, observedAt, modalPrice, unit = "kg", crop = "Tomato") => ({
  crop,
  market,
  district: "Dakshina Kannada",
  modalPrice,
  unit,
  observedAt: new Date(observedAt),
});

describe("price insight calculations", () => {
  it("filters by crop and market and sorts the matching records chronologically", () => {
    const items = [
      observation("Mangaluru APMC", "2026-10-19", 25),
      observation("Udupi APMC", "2026-10-18", 26),
      observation("Mangaluru APMC", "2026-10-17", 20, "kg", "Banana"),
      observation("Mangaluru APMC", "2026-10-16", 21),
    ];
    const filtered = filterPriceObservations(items, {
      crop: "tomato",
      market: "mangaluru apmc",
    });
    expect(filtered.map((item) => Number(item.modalPrice))).toEqual([21, 25]);
    expect(
      sortPriceObservations(items).map((item) => item.observedAt.toISOString()),
    ).toEqual([
      "2026-10-16T00:00:00.000Z",
      "2026-10-17T00:00:00.000Z",
      "2026-10-18T00:00:00.000Z",
      "2026-10-19T00:00:00.000Z",
    ]);
  });

  it("calculates absolute and percentage changes from the previous comparable market record", () => {
    const summaries = summarizeMarketPrices([
      observation("Mangaluru APMC", "2026-10-18", 25),
      observation("Mangaluru APMC", "2026-10-16", 20),
    ]);
    expect(summaries[0].absoluteChange).toBe(5);
    expect(summaries[0].percentageChange).toBe(25);
    expect(summaries[0].previous.modalPrice).toBe(20);
  });

  it("keeps incompatible units in separate chart and comparison series", () => {
    const items = [
      observation("Mangaluru APMC", "2026-10-16", 20, "kg"),
      observation("Mangaluru APMC", "2026-10-18", 25, "kg"),
      observation("Mangaluru APMC", "2026-10-19", 50, "piece"),
      observation("Mangaluru APMC", "2026-10-19", 35, "kg", "Banana"),
    ];
    const chart = buildPriceChartModel(items);
    const summaries = summarizeMarketPrices(items);

    expect(chart.series).toHaveLength(3);
    expect(new Set(chart.series.map((series) => series.unit))).toEqual(
      new Set(["kg", "piece"]),
    );
    expect(summaries).toHaveLength(3);
    expect(summaries.find((summary) => summary.unit === "kg").percentageChange).toBe(25);
    expect(summaries.find((summary) => summary.unit === "piece").previous).toBeNull();
    expect(summaries.find((summary) => summary.crop === "Banana").previous).toBeNull();
    expect(chart.points.map((point) => point.observedAt)).toEqual(
      items.map((item) => item.observedAt),
    );
  });

  it("limits a selected date range without including future or stale observations", () => {
    const filtered = filterPriceObservations(
      [
        observation("Mangaluru APMC", "2026-10-01", 20),
        observation("Mangaluru APMC", "2026-10-15", 22),
        observation("Mangaluru APMC", "2026-10-21", 24),
      ],
      { dateRange: "7d", now: new Date("2026-10-20T00:00:00.000Z") },
    );
    expect(filtered.map((item) => Number(item.modalPrice))).toEqual([22]);
  });
});
