import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "./i18n.jsx";
import PriceInsights from "./PriceInsights.jsx";

const demoItems = [
  {
    id: "tomato-1",
    crop: "Tomato",
    market: "Mangaluru APMC",
    district: "Dakshina Kannada",
    modalPrice: 20,
    unit: "kg",
    observedAt: "2026-10-16T00:00:00.000Z",
    source: "KrishiSetu sample data",
    dataType: "DEMO",
  },
  {
    id: "tomato-2",
    crop: "Tomato",
    market: "Mangaluru APMC",
    district: "Dakshina Kannada",
    modalPrice: 25,
    unit: "kg",
    observedAt: "2026-10-18T00:00:00.000Z",
    source: "KrishiSetu sample data",
    dataType: "DEMO",
  },
  {
    id: "tomato-3",
    crop: "Tomato",
    market: "Udupi APMC",
    district: "Udupi",
    modalPrice: 26,
    unit: "kg",
    observedAt: "2026-10-18T00:00:00.000Z",
    source: "KrishiSetu sample data",
    dataType: "DEMO",
  },
  {
    id: "banana-1",
    crop: "Banana",
    market: "Mangaluru APMC",
    district: "Dakshina Kannada",
    modalPrice: 38,
    unit: "kg",
    observedAt: "2026-10-18T00:00:00.000Z",
    source: "KrishiSetu sample data",
    dataType: "DEMO",
  },
  {
    id: "tomato-piece",
    crop: "Tomato",
    market: "Mangaluru APMC",
    district: "Dakshina Kannada",
    modalPrice: 30,
    unit: "piece",
    observedAt: "2026-10-19T00:00:00.000Z",
    source: "KrishiSetu sample data",
    dataType: "DEMO",
  },
  {
    id: "tomato-old",
    crop: "Tomato",
    market: "Mangaluru APMC",
    district: "Dakshina Kannada",
    modalPrice: 18,
    unit: "kg",
    observedAt: "2026-09-01T00:00:00.000Z",
    source: "KrishiSetu sample data",
    dataType: "DEMO",
  },
];

function renderPage(items = demoItems) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      data: { items, dataMode: items.length ? "sample_demo" : "none" },
    }),
  });
  return render(
    <LanguageProvider>
      <PriceInsights />
    </LanguageProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Price Insights page", () => {
  it("loads real API observations, labels demo records, and filters crop and market", async () => {
    renderPage();

    expect(
      await screen.findByText(/these sample records are not verified/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Demo data").length).toBeGreaterThan(0);
    expect(screen.getAllByText("₹25").length).toBeGreaterThan(0);
    expect(screen.queryByText("HISTORICAL COMPARISON")).not.toBeInTheDocument();
    expect(screen.queryByText("Price change by market")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Markets with one observation show only a point/i),
    ).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/prices/"),
      expect.objectContaining({ credentials: "include" }),
    );

    fireEvent.change(screen.getByLabelText("Market"), {
      target: { value: "Udupi APMC" },
    });
    expect((await screen.findAllByText("₹26")).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Only one observation is available for each selected market/i),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Crop"), {
      target: { value: "Banana" },
    });
    expect((await screen.findAllByText("₹38")).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Banana · prices by market · kg over time/),
    ).toBeInTheDocument();
  });

  it("filters by district, date range, and unit without mixing scales", async () => {
    renderPage();
    await screen.findByText(/these sample records are not verified/i);
    expect(screen.getAllByText("₹18").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("District"), {
      target: { value: "Udupi" },
    });
    expect((await screen.findAllByText("₹26")).length).toBeGreaterThan(0);
    expect(screen.queryByText("₹25")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("District"), {
      target: { value: "Dakshina Kannada" },
    });
    fireEvent.change(screen.getByLabelText("Price unit"), {
      target: { value: "kg" },
    });
    expect((await screen.findAllByText("₹18")).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Date range"), {
      target: { value: "7d" },
    });
    expect(screen.queryByText("₹18")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Price unit"), {
      target: { value: "piece" },
    });
    expect((await screen.findAllByText("₹30")).length).toBeGreaterThan(0);
    expect(screen.queryByText("₹25")).not.toBeInTheDocument();
    expect(screen.getByText("₹ / piece")).toBeInTheDocument();

    expect((await screen.findAllByText("₹30")).length).toBeGreaterThan(0);
  });

  it("shows an empty state when the API returns no price observations", async () => {
    renderPage([]);
    expect(
      await screen.findByText("No matching price observations"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/not verified live mandi prices/i),
    ).not.toBeInTheDocument();
  });

  it("shows an explicit API error state", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Service unavailable"));
    render(
      <LanguageProvider>
        <PriceInsights />
      </LanguageProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Service unavailable",
    );
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
