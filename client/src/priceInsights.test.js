import { describe, expect, it } from "vitest";
import {
  buildPriceChartModel,
  filterPriceObservations,
  sortPriceObservations,
  summarizeMarketPrices,
} from "./priceInsights.js";

const observation = (
  market,
  observedAt,
  modalPrice,
  unit = "kg",
  crop = "Tomato",
) => ({
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
    expect(
      summaries.find((summary) => summary.unit === "kg").percentageChange,
    ).toBe(25);
    expect(
      summaries.find((summary) => summary.unit === "piece").previous,
    ).toBeNull();
    expect(
      summaries.find((summary) => summary.crop === "Banana").previous,
    ).toBeNull();
    expect(chart.points.map((point) => point.timestamp)).toEqual(
      items.map((item) => item.observedAt.getTime()),
    );
    expect(chart.hasTrend).toBe(true);
    expect(chart.hasInsufficientSeries).toBe(true);
  });

  it("keeps all-market observations in distinct market series and flags one-point markets", () => {
    const chart = buildPriceChartModel([
      observation("Mangaluru APMC", "2026-10-19", 25),
      observation("Udupi APMC", "2026-10-18", 26),
      observation("Mangaluru APMC", "2026-10-16", 20),
    ]);

    expect(chart.series.map((series) => series.market)).toEqual([
      "Mangaluru APMC",
      "Udupi APMC",
    ]);
    expect(chart.series.map((series) => series.observationCount)).toEqual([
      2, 1,
    ]);
    expect(chart.hasTrend).toBe(true);
    expect(chart.hasInsufficientSeries).toBe(true);
    expect(chart.points.map((point) => point.timestamp)).toEqual([
      new Date("2026-10-16").getTime(),
      new Date("2026-10-18").getTime(),
      new Date("2026-10-19").getTime(),
    ]);
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

  it("filters by district and unit and ignores missing or invalid price records", () => {
    const items = [
      observation("Mangaluru APMC", "2026-10-16", 20, "kg"),
      {
        ...observation("Mangaluru APMC", "2026-10-17", 30, "piece"),
        district: "Udupi",
      },
      {
        ...observation("Mangaluru APMC", "2026-10-18", null),
        district: "Dakshina Kannada",
      },
      {
        ...observation("Mangaluru APMC", "2026-10-19", 0),
        district: "Dakshina Kannada",
      },
    ];
    const filtered = filterPriceObservations(items, {
      district: "Dakshina Kannada",
      unit: "kg",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].modalPrice).toBe(20);
    expect(summarizeMarketPrices(items)).toHaveLength(2);
  });

  it("does not calculate percentage changes when the previous price is zero", () => {
    const summaries = summarizeMarketPrices([
      observation("Mangaluru APMC", "2026-10-16", 0),
      observation("Mangaluru APMC", "2026-10-18", 25),
    ]);
    expect(summaries[0].previous).toBeNull();
    expect(summaries[0].percentageChange).toBeNull();
  });
});
