import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", requireAuth, async (req, res) => {
  if (req.user.role === "FARMER") {
    const [activeListings, requests, recentResponses] = await Promise.all([
      prisma.produceListing.count({ where: { farmerId: req.user.id, status: "ACTIVE" } }),
      prisma.buyerRequest.findMany({
        where: {
          status: "OPEN",
          deadline: { gt: new Date() },
          OR: [
            { listingId: null, district: { equals: req.user.district || "", mode: "insensitive" } },
            { listing: { is: { farmerId: req.user.id } } }
          ]
        },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { buyer: { select: { name: true } }, listing: { select: { id: true } } }
      }),
      prisma.requestResponse.findMany({
        where: { farmerId: req.user.id },
        take: 10,
        orderBy: { updatedAt: "desc" },
        include: {
          request: {
            select: {
              id: true, crop: true, quantity: true, unit: true, status: true, district: true,
              buyer: { select: { name: true } }
            }
          }
        }
      })
    ]);
    return res.json({ data: { role: "FARMER", activeListings, requests, recentResponses } });
  }
  const [openRequests, responses, activeListings] = await Promise.all([
    prisma.buyerRequest.count({ where: { buyerId: req.user.id, status: "OPEN" } }),
    prisma.requestResponse.count({ where: { request: { buyerId: req.user.id }, status: "PENDING" } }),
    prisma.produceListing.findMany({ where: { status: "ACTIVE" }, take: 5, orderBy: { createdAt: "desc" }, include: { farmer: { select: { name: true } } } })
  ]);
  res.json({ data: { role: "BUYER", openRequests, responses, activeListings } });
});
