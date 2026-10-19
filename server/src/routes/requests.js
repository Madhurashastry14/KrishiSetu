import { Router } from "express";
import { prisma } from "../db.js";
import { ApiError } from "../errors.js";
import { requireAuth, requireRole } from "../auth.js";
import { requestSchema, responseSchema } from "../validation.js";

export const requestsRouter = Router();

requestsRouter.use(requireAuth);
requestsRouter.get("/", async (req, res) => {
  const { q, district } = req.query;
  const isBuyer = req.user.role === "BUYER";
  const where = isBuyer
    ? { buyerId: req.user.id }
    : {
        status: "OPEN",
        deadline: { gt: new Date() },
        OR: [
          {
            listingId: null,
            ...(q ? { crop: { contains: q, mode: "insensitive" } } : {}),
            ...(district ? { district: { equals: district, mode: "insensitive" } } : {})
          },
          { listing: { is: { farmerId: req.user.id, ...(q ? { crop: { contains: q, mode: "insensitive" } } : {}) } } }
        ]
      };
  const items = await prisma.buyerRequest.findMany({
    where,
    orderBy: { deadline: "asc" },
    include: {
      buyer: { select: { id: true, name: true, phone: true, shareContact: true } },
      listing: { select: { id: true } },
      ...(isBuyer ? {
        responses: {
          include: {
            farmer: { select: { id: true, name: true, phone: true, shareContact: true, village: true } }
          }
        }
      } : {
        responses: {
          where: { farmerId: req.user.id },
          take: 1
        }
      })
    }
  });
  res.json({ data: { items: items.map((item) => ({
    ...item,
    buyer: { ...item.buyer, phone: item.buyer.shareContact ? item.buyer.phone : null },
    responses: isBuyer
      ? item.responses?.map((response) => ({ ...response, farmer: { ...response.farmer, phone: response.farmer.shareContact ? response.farmer.phone : null } }))
      : item.responses
  })) } });
});

requestsRouter.post("/", requireRole("BUYER"), async (req, res) => {
  const data = requestSchema.parse(req.body);
  const item = await prisma.buyerRequest.create({ data: { ...data, buyerId: req.user.id } });
  res.status(201).json({ data: { item } });
});

requestsRouter.patch("/:id", requireRole("BUYER"), async (req, res) => {
  const existing = await prisma.buyerRequest.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, "Request not found.");
  if (existing.buyerId !== req.user.id) throw new ApiError(403, "You can only change your own requests.");
  const statusOnly = Object.keys(req.body).length === 1 && ["OPEN", "CLOSED"].includes(req.body.status);
  if (!statusOnly && "status" in req.body) throw new ApiError(400, "Request status must be changed separately from request details.");
  if (!statusOnly && existing.status === "CLOSED") throw new ApiError(400, "Reopen this request before editing its details.");
  if (statusOnly && req.body.status === "OPEN" && existing.deadline <= new Date()) throw new ApiError(400, "An expired request cannot be reopened.");
  if (statusOnly && req.body.status === "OPEN") {
    if (await prisma.requestResponse.findFirst({ where: { requestId: existing.id, status: "ACCEPTED" }, select: { id: true } })) {
      throw new ApiError(409, "A request with an accepted offer cannot be reopened.");
    }
    if (existing.listingId) {
      const listing = await prisma.produceListing.findUnique({ where: { id: existing.listingId }, select: { status: true } });
      if (listing?.status !== "ACTIVE") throw new ApiError(409, "The associated listing is no longer active.");
    }
  }
  if (existing.listingId && !statusOnly) {
    throw new ApiError(400, "Details of a listing purchase request cannot be edited here.");
  }
  const data = statusOnly ? { status: req.body.status } : requestSchema.parse(req.body);
  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.buyerRequest.update({ where: { id: existing.id }, data });
    if (statusOnly && req.body.status === "CLOSED") {
      await tx.requestResponse.updateMany({
        where: { requestId: existing.id, status: "PENDING" },
        data: { status: "DECLINED" }
      });
    }
    return updated;
  });
  res.json({ data: { item } });
});

requestsRouter.post("/:id/responses", requireRole("FARMER"), async (req, res) => {
  const data = responseSchema.parse(req.body);
  try {
    const item = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "BuyerRequest" WHERE "id" = ${req.params.id} FOR UPDATE`;
      const request = await tx.buyerRequest.findUnique({ where: { id: req.params.id } });
      if (!request || request.status !== "OPEN" || request.deadline <= new Date()) {
        throw new ApiError(404, "This buyer request is no longer accepting responses.");
      }
      if (request.listingId) {
        const listing = await tx.produceListing.findUnique({ where: { id: request.listingId }, select: { farmerId: true, status: true } });
        if (!listing || listing.farmerId !== req.user.id || listing.status !== "ACTIVE") {
          throw new ApiError(403, "Only the active listing's farmer can respond to this purchase request.");
        }
      }
      if (request.unit.toLowerCase() !== data.unit.toLowerCase()) {
        throw new ApiError(400, `Offer unit must match the request unit (${request.unit}).`);
      }
      const existing = await tx.requestResponse.findUnique({
        where: { requestId_farmerId: { requestId: request.id, farmerId: req.user.id } }
      });
      if (existing) throw new ApiError(409, "You already have an offer for this request. Edit your existing offer instead.");
      return tx.requestResponse.create({ data: { ...data, requestId: request.id, farmerId: req.user.id } });
    });
    res.status(201).json({ data: { item } });
  } catch (error) {
    if (error.code === "P2002") throw new ApiError(409, "You have already responded to this request.");
    throw error;
  }
});

requestsRouter.patch("/responses/:responseId", async (req, res) => {
  const response = await prisma.requestResponse.findUnique({
    where: { id: req.params.responseId },
    include: { request: true }
  });
  if (!response) throw new ApiError(404, "Response not found.");
  if (req.user.role === "FARMER") {
    if (response.farmerId !== req.user.id) throw new ApiError(403, "You can only change your own offers.");
    const withdrawing = req.body.status === "WITHDRAWN" && Object.keys(req.body).length === 1;
    const data = withdrawing ? null : responseSchema.parse(req.body);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "BuyerRequest" WHERE "id" = ${response.requestId} FOR UPDATE`;
      const current = await tx.requestResponse.findUnique({
        where: { id: response.id },
        include: { request: true }
      });
      if (!current || current.farmerId !== req.user.id) throw new ApiError(404, "Offer not found.");
      if (current.status === "ACCEPTED") throw new ApiError(409, "An accepted offer cannot be changed or withdrawn.");
      if (current.request.status !== "OPEN" || current.request.deadline <= new Date()) {
        throw new ApiError(409, "Offers can only be changed while the buyer request is open.");
      }
      if (data && data.unit.toLowerCase() !== current.request.unit.toLowerCase()) {
        throw new ApiError(400, `Offer unit must match the request unit (${current.request.unit}).`);
      }
      await tx.requestResponse.update({
        where: { id: current.id },
        data: withdrawing ? { status: "WITHDRAWN" } : { ...data, status: "PENDING" }
      });
      return tx.requestResponse.findUnique({
        where: { id: current.id },
        include: { request: { select: { id: true, crop: true, status: true } } }
      });
    });
    return res.json({ data: { item: updated } });
  }

  if (req.user.role !== "BUYER") throw new ApiError(403, "Only the buyer can review offers.");
  if (response.request.buyerId !== req.user.id) throw new ApiError(403, "You can only review offers for your own requests.");
  if (!["ACCEPTED", "DECLINED"].includes(req.body.status)) throw new ApiError(400, "Offer status must be ACCEPTED or DECLINED.");

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.requestResponse.findUnique({
      where: { id: response.id },
      include: { request: true }
    });
    if (!current || current.request.buyerId !== req.user.id) throw new ApiError(403, "You can only review offers for your own requests.");
    if (current.status !== "PENDING") throw new ApiError(409, "Only pending offers can be reviewed.");
    if (current.request.status !== "OPEN" || current.request.deadline <= now) {
      throw new ApiError(409, "Offers can only be reviewed while the request is open.");
    }

    if (req.body.status === "DECLINED") {
      const result = await tx.requestResponse.updateMany({
        where: {
          id: current.id,
          requestId: current.requestId,
          status: "PENDING",
          request: { is: { status: "OPEN", deadline: { gt: now } } }
        },
        data: { status: "DECLINED" }
      });
      if (!result.count) throw new ApiError(409, "The request or offer has changed. Refresh and try again.");
    } else {
      if (current.request.listingId) {
        await tx.$queryRaw`SELECT "id" FROM "ProduceListing" WHERE "id" = ${current.request.listingId} FOR UPDATE`;
        const listing = await tx.produceListing.findUnique({
          where: { id: current.request.listingId },
          select: { status: true, quantity: true, unit: true }
        });
        if (!listing || listing.status !== "ACTIVE") throw new ApiError(409, "The associated listing is no longer available.");
        const availableKg = Number(listing.quantity) * (listing.unit.toLowerCase() === "quintal" ? 100 : 1);
        if (Number(current.quantity) > Number(current.request.quantity) || Number(current.quantity) > availableKg) {
          throw new ApiError(409, "The offer quantity exceeds the request or currently available listing quantity.");
        }
      }
      const claimed = await tx.buyerRequest.updateMany({
        where: { id: current.requestId, status: "OPEN", deadline: { gt: now } },
        data: { status: "CLOSED" }
      });
      if (!claimed.count) throw new ApiError(409, "This request has already been closed or another offer was accepted.");

      const accepted = await tx.requestResponse.updateMany({
        where: { id: current.id, requestId: current.requestId, status: "PENDING" },
        data: { status: "ACCEPTED" }
      });
      if (!accepted.count) throw new ApiError(409, "This offer has already been reviewed.");

      await tx.requestResponse.updateMany({
        where: { requestId: current.requestId, id: { not: current.id }, status: "PENDING" },
        data: { status: "DECLINED" }
      });
    }

    return tx.requestResponse.findUnique({
      where: { id: current.id },
      include: {
        request: { select: { id: true, crop: true, status: true } },
        farmer: { select: { id: true, name: true, phone: true, shareContact: true, village: true } }
      }
    });
  });
  res.json({ data: { item: { ...updated, farmer: { ...updated.farmer, phone: updated.farmer.shareContact ? updated.farmer.phone : null } } } });
});
