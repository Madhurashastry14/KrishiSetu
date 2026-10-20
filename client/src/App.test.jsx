import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./AuthContext.jsx";
import App, { OfferStatusBadge } from "./App.jsx";
import { LanguageProvider } from "./i18n.jsx";

beforeEach(() => localStorage.setItem("krishisetu-language", "en"));
afterEach(() => cleanup());

function renderApp(path = "/") {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ error: { message: "Please sign in to continue." } }),
  });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LanguageProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe("KrishiSetu entry flows", () => {
  it("renders an accepted farmer offer with a clear accepted badge", () => {
    render(
      <OfferStatusBadge
        status="ACCEPTED"
        t={(key) => (key === "offerAccepted" ? "Accepted" : key)}
      />,
    );
    expect(screen.getByText("Accepted")).toBeInTheDocument();
  });

  it("renders the marketplace landing page and updates its primary copy in Kannada", async () => {
    renderApp();
    expect(
      await screen.findByRole("heading", { name: /good food deserves/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ಕನ್ನಡ" }));
    expect(screen.getAllByText(/ಕೃಷಿಸೇತು/).length).toBeGreaterThan(0);
    expect(
      await screen.findByRole("heading", {
        name: "ಉತ್ತಮ ಆಹಾರಕ್ಕೆ ನ್ಯಾಯಯುತ ಪ್ರಯಾಣ ಬೇಕು.",
      }),
    ).toBeInTheDocument();
  });

  it("shows labelled login fields and prevents empty submission", async () => {
    renderApp("/login");
    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeRequired();
    expect(screen.getByLabelText("Password")).toBeRequired();
  });

  it("keeps a refreshed nested route loading until the current user is resolved", async () => {
    let resolveAuthRequest;
    global.fetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveAuthRequest = resolve;
        }),
    );

    render(
      <MemoryRouter initialEntries={["/listings/new"]}>
        <LanguageProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LanguageProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Welcome back" }),
    ).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/me"),
      expect.objectContaining({ credentials: "include" }),
    );

    resolveAuthRequest({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          user: {
            id: "farmer-1",
            name: "Farmer One",
            role: "FARMER",
            village: "Kavoor",
            district: "Udupi",
          },
        },
      }),
    });

    expect(
      await screen.findByRole("heading", { name: "Add produce" }),
    ).toBeInTheDocument();
  });

  it("opens and submits the purchase-request form from a listing detail", async () => {
    const listing = {
      id: "listing-1",
      crop: "Tomato",
      quantity: 20,
      unit: "kg",
      expectedPrice: 40,
      village: "Kavoor",
      district: "Udupi",
      status: "ACTIVE",
      createdAt: "2026-10-19T00:00:00.000Z",
      farmer: {
        id: "farmer-1",
        name: "Local Farmer",
        phone: null,
        shareContact: false,
      },
    };
    const purchaseRequest = {
      id: "request-1",
      listingId: "listing-1",
      crop: "Tomato",
      quantity: 5,
      unit: "kg",
      targetPrice: 42,
      status: "OPEN",
      requirements: "Please harvest fresh",
      responses: [],
    };
    global.fetch = vi.fn(async (url, options = {}) => {
      const path = new URL(url, "http://localhost").pathname;
      let payload;
      if (path.endsWith("/auth/me"))
        payload = {
          data: { user: { id: "buyer-1", name: "Buyer One", role: "BUYER" } },
        };
      else if (path.endsWith("/listings/marketplace/listing-1"))
        payload = { data: { item: listing } };
      else if (path.endsWith("/requests") && options.method !== "POST")
        payload = { data: { items: [] } };
      else if (path.endsWith("/purchase-requests"))
        payload = { data: { item: purchaseRequest } };
      else payload = { data: {} };
      return { ok: true, status: 200, json: async () => payload };
    });

    render(
      <MemoryRouter initialEntries={["/marketplace/listing-1"]}>
        <LanguageProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LanguageProvider>
      </MemoryRouter>,
    );
    expect(
      await screen.findByText("Contact details are private"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Contact farmer" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", { name: "Send Purchase Request" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Required quantity (kg)"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Proposed price per kg (₹)"), {
      target: { value: "42" },
    });
    fireEvent.change(
      screen.getByLabelText("Message to the farmer (optional)"),
      { target: { value: "Please harvest fresh" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    expect(await screen.findByText("Purchase request")).toBeInTheDocument();
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/purchase-requests"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            quantityKg: 5,
            pricePerKg: 42,
            message: "Please harvest fresh",
          }),
        }),
      ),
    );
  });

  it("shows contact actions only when the farmer has opted in", async () => {
    global.fetch = vi.fn(async (url) => {
      const path = new URL(url, "http://localhost").pathname;
      if (path.endsWith("/auth/me"))
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: { message: "Please sign in." } }),
        };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            item: {
              id: "shared-listing",
              crop: "Cucumber",
              quantity: 10,
              unit: "kg",
              expectedPrice: 25,
              village: "Kavoor",
              district: "Udupi",
              status: "ACTIVE",
              createdAt: "2026-10-19T00:00:00.000Z",
              farmer: {
                id: "farmer-2",
                name: "Shared Farmer",
                phone: "+919876543210",
                shareContact: true,
              },
            },
          },
        }),
      };
    });
    render(
      <MemoryRouter initialEntries={["/marketplace/shared-listing"]}>
        <LanguageProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LanguageProvider>
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("link", { name: "Contact farmer" }),
    ).toHaveAttribute("href", "tel:+919876543210");
    expect(screen.getByRole("link", { name: /WhatsApp/i })).toHaveAttribute(
      "href",
      "https://wa.me/919876543210",
    );
    expect(
      screen.getByRole("link", { name: "Sign in to send a purchase request" }),
    ).toBeInTheDocument();
  });
});
