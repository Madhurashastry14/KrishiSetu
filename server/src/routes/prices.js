import { Router } from "express";
import { prisma } from "../db.js";
import { ApiError } from "../errors.js";
import { requireAuth } from "../auth.js";
import { classifyPriceObservations, compareFairPrice, demoPrices, getPriceDataMode, listPriceObservations, syncAgmarknet } from "../prices.js";

export const pricesRouter = Router();

pricesRouter.get("/", async (req, res) => {
  const items = await listPriceObservations({ crop: req.query.crop, district: req.query.district, limit: 200 });
  res.json({ data: { items, dataMode: getPriceDataMode(items) } });
});

pricesRouter.get("/compare", async (req, res) => {
  const crop = String(req.query.crop || "").trim();
  const unit = String(req.query.unit || "").trim();
  const expectedPrice = Number(req.query.expectedPrice);
  if (!crop || !unit || !Number.isFinite(expectedPrice) || expectedPrice <= 0) throw new ApiError(400, "Crop, unit and a positive expectedPrice are required.");
  const stored = await prisma.mandiPriceObservation.findMany({ where: { crop: { equals: crop, mode: "insensitive" } }, orderBy: { observedAt: "desc" }, take: 100 });
  const observations = stored.length
    ? classifyPriceObservations(stored)
    : demoPrices.filter((item) => item.crop.toLowerCase() === crop.toLowerCase());
  res.json({ data: compareFairPrice({ expectedPrice, unit, observations, district: String(req.query.district || "") }) });
});

pricesRouter.get("/insights", async (req, res) => {
  const crop = String(req.query.crop || "");
  const items = await listPriceObservations({ crop: crop || undefined, district: req.query.district, limit: 200 });
  const sorted = [...items].sort((a, b) => new Date(a.observedAt) - new Date(b.observedAt));
  res.json({ data: { crop, items: sorted, dataMode: getPriceDataMode(sorted) } });
});

pricesRouter.post("/sync", requireAuth, async (req, res) => {
  const result = await syncAgmarknet();
  if (!result.configured) throw new ApiError(503, "Live mandi data is not configured. Sample data remains available.");
  res.json({ data: result });
});
