import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

import app from "./app.js";
import { config } from "./config.js";
import { prisma } from "./db.js";

const user = {
  id: "cache-test-user",
  name: "Cache Test",
  email: "cache-test@example.com",
  role: "FARMER",
  phone: null,
  shareContact: false,
  village: null,
  district: null,
  createdAt: new Date("2026-10-20T00:00:00.000Z"),
};
const sessionCookie = `krishisetu_session=${jwt.sign(
  { sub: user.id },
  config.JWT_SECRET,
  { expiresIn: "15m" },
)}`;

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue(user);
});

describe("authentication response caching", () => {
  it("revalidates /api/auth/me instead of returning 304 for a cached ETag", async () => {
    const initial = await request(app)
      .get("/api/auth/me")
      .set("Cookie", sessionCookie);

    expect(initial.status).toBe(200);
    expect(initial.headers.etag).toBeTruthy();
    expect(initial.headers["cache-control"]).toBe("no-store");

    const conditional = await request(app)
      .get("/api/auth/me")
      .set("Cookie", sessionCookie)
      .set("If-None-Match", initial.headers.etag)
      .set("If-Modified-Since", "Tue, 20 Oct 2026 12:00:00 GMT");

    expect(conditional.status).toBe(200);
    expect(conditional.body.data.user.id).toBe(user.id);
    expect(conditional.headers["cache-control"]).toBe("no-store");
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
  });
});
