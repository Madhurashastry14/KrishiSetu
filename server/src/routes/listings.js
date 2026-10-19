import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { ApiError } from "../errors.js";
import { requireAuth, requireRole } from "../auth.js";
import { listingSchema, purchaseRequestSchema } from "../validation.js";

export const listingsRouter = Router();

function listingFilters(query) {
  const { q, district, village, minPrice, maxPrice, page = "1", pageSize = "12" } = query;
  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
  const size = Math.min(50, Math.max(1, Number.parseInt(pageSize, 10) || 12));
  const minimum = minPrice === undefined || minPrice === "" ? undefined : z.coerce.number().nonnegative().parse(minPrice);
  const maximum = maxPrice === undefined || maxPrice === "" ? undefined : z.coerce.number().nonnegative().parse(maxPrice);
  if (minimum !== undefined && maximum !== undefined && minimum > maximum) throw new ApiError(400, "Minimum price cannot exceed maximum price.");
  return {
    where: {
      status: "ACTIVE",
      ...(q ? { crop: { contains: q, mode: "insensitive" } } : {}),
      ...(district ? { district: { equals: district, mode: "insensitive" } } : {}),
      ...(village ? { village: { contains: village, mode: "insensitive" } } : {}),
      ...(minimum !== undefined ? { expectedPrice: { gte: minimum } } : {}),
      ...(maximum !== undefined ? { expectedPrice: { lte: maximum } } : {})
    },
    pageNumber,
    size
  };
}

listingsRouter.get("/marketplace", async (req, res) => {
  const { where, pageNumber, size } = listingFilters(req.query);
  const orderBy = req.query.sort === "price_asc" ? { expectedPrice: "asc" } : req.query.sort === "price_desc" ? { expectedPrice: "desc" } : { createdAt: "desc" };
  const [items, total] = await Promise.all([
    prisma.produceListing.findMany({
      where,
      orderBy,
      skip: (pageNumber - 1) * size,
      take: size,
      include: { farmer: { select: { id: true, name: true, phone: true, shareContact: true, village: true, district: true } } }
    }),
    prisma.produceListing.count({ where })
  ]);
  res.json({ data: { items: items.map((item) => ({ ...item, farmer: { ...item.farmer, phone: item.farmer.shareContact ? item.farmer.phone : null } })), pagination: { page: pageNumber, pageSize: size, total, pages: Math.ceil(total / size) } } });
});

listingsRouter.get("/marketplace/:id", async (req, res) => {
  const item = await prisma.produceListing.findUnique({
    where: { id: req.params.id },
    include: { farmer: { select: { id: true, name: true, phone: true, shareContact: true, village: true, district: true } } }
  });
  if (!item) throw new ApiError(404, "Listing not found.");
  res.json({ data: { item: { ...item, farmer: { ...item.farmer, phone: item.farmer.shareContact ? item.farmer.phone : null } } } });
});

listingsRouter.use(requireAuth);
listingsRouter.post("/marketplace/:id/purchase-requests", requireRole("BUYER"), async (req, res) => {
  const data = purchaseRequestSchema.parse(req.body);
  try {
    const item = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ProduceListing" WHERE "id" = ${req.params.id} FOR UPDATE`;
      const listing = await tx.produceListing.findUnique({ where: { id: req.params.id } });
      if (!listing || listing.status !== "ACTIVE") throw new ApiError(409, "This listing is no longer available.");
      const unit = listing.unit.toLowerCase();
      if (unit !== "kg" && unit !== "quintal") {
        throw new ApiError(400, "Purchase requests are available only for listings measured in kg or quintals.");
      }
      const existing = await tx.buyerRequest.findUnique({
        where: { buyerId_listingId: { buyerId: req.user.id, listingId: listing.id } }
      });
      if (existing) throw new ApiError(409, "You already have a purchase request for this listing.");
      const quantityKg = Math.round(data.quantityKg * 100) / 100;
      const pricePerKg = Math.round(data.pricePerKg * 100) / 100;
      if (!quantityKg || !pricePerKg) throw new ApiError(400, "Quantity and price must each be at least ₹0.01 or 0.01 kg.");
      const availableKg = Number(listing.quantity) * (unit === "quintal" ? 100 : 1);
      if (quantityKg > availableKg) throw new ApiError(400, "Requested quantity exceeds the currently available listing quantity.");
      const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      return tx.buyerRequest.create({
        data: {
          buyerId: req.user.id,
          listingId: listing.id,
          crop: listing.crop,
          quantity: quantityKg,
          unit: "kg",
          targetPrice: pricePerKg,
          village: listing.village,
          district: listing.district,
          deadline,
          requirements: data.message || null
        },
        include: { listing: { select: { id: true } } }
      });
    });
    res.status(201).json({ data: { item } });
  } catch (error) {
    if (error.code === "P2002") throw new ApiError(409, "You already have a purchase request for this listing.");
    throw error;
  }
});

listingsRouter.get("/", requireRole("FARMER"), async (req, res) => {
  const items = await prisma.produceListing.findMany({ where: { farmerId: req.user.id }, orderBy: { updatedAt: "desc" } });
  res.json({ data: { items } });
});
listingsRouter.post("/", requireRole("FARMER"), async (req, res) => {
  const data = listingSchema.parse(req.body);
  const item = await prisma.produceListing.create({ data: { ...data, farmerId: req.user.id } });
  res.status(201).json({ data: { item } });
});
listingsRouter.patch("/:id", requireRole("FARMER"), async (req, res) => {
  const existing = await prisma.produceListing.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, "Listing not found.");
  if (existing.farmerId !== req.user.id) throw new ApiError(403, "You can only change your own listings.");
  const data = ["ACTIVE", "INACTIVE"].includes(req.body.status) && Object.keys(req.body).length === 1
    ? { status: req.body.status }
    : listingSchema.parse(req.body);
  const item = await prisma.produceListing.update({ where: { id: existing.id }, data });
  res.json({ data: { item } });
});
