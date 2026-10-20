import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API response handling", () => {
  it("does not parse a bodyless 304 or accept it as an authenticated response", async () => {
    const json = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 304,
        json,
      }),
    );

    await expect(api("/auth/me")).rejects.toMatchObject({
      message:
        "The server returned 304 Not Modified without a current API response.",
      status: 304,
    });
    expect(json).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/me",
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
      }),
    );
  });

  it("continues to parse a valid current-user response", async () => {
    const user = { id: "farmer-1", role: "FARMER" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { user } }),
      }),
    );

    await expect(api("/auth/me")).resolves.toEqual({ user });
  });

  it("rejects a successful HTML SPA fallback instead of returning undefined data", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        text: async () => "<!doctype html><html></html>",
      }),
    );

    await expect(api("/auth/me")).rejects.toMatchObject({
      message:
        "API endpoint /api/auth/me returned a non-JSON response (200, text/html).",
      status: 200,
    });
    expect(log).toHaveBeenCalledWith(
      "[KrishiSetu auth]",
      expect.objectContaining({
        url: "/api/auth/me",
        status: 200,
        contentType: "text/html",
        error: expect.stringContaining("JSON parsing failed"),
      }),
    );
  });

  it("identifies the endpoint and status for unexpected HTML API responses", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
        text: async () => "<!doctype html><html></html>",
      }),
    );

    await expect(api("/prices")).rejects.toMatchObject({
      message:
        "API endpoint /api/prices returned a non-JSON response (200, text/html; charset=utf-8).",
      status: 200,
    });
    expect(log).toHaveBeenCalledWith(
      "[KrishiSetu API]",
      expect.objectContaining({
        endpoint: "/api/prices",
        status: 200,
        contentType: "text/html; charset=utf-8",
      }),
    );
  });
});
