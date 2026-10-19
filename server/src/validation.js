import { z } from "zod";

const text = (max = 120) => z.string().trim().min(1).max(max);
const positive = z.coerce.number().positive();

export const registrationSchema = z.object({
  name: text(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  role: z.enum(["FARMER", "BUYER"]),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  shareContact: z.boolean().optional(),
  village: z.string().trim().max(100).optional().or(z.literal("")),
  district: z.string().trim().max(100).optional().or(z.literal("")),
});
export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128),
});
export const profileSchema = z.object({
  name: text(100),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  shareContact: z.boolean().optional(),
  village: z.string().trim().max(100).optional().or(z.literal("")),
  district: z.string().trim().max(100).optional().or(z.literal("")),
});
export const listingSchema = z.object({
  crop: text(100),
  quantity: positive,
  unit: text(30),
  expectedPrice: positive,
  village: text(100),
  district: text(100),
  imageUrl: z.string().url().max(500).optional().or(z.literal("")),
  variety: z.string().trim().max(100).optional().or(z.literal("")),
  grade: z.string().trim().max(100).optional().or(z.literal("")),
});
export const requestSchema = z.object({
  crop: text(100),
  quantity: positive,
  unit: text(30),
  targetPrice: z.preprocess(
    (value) => (value === null || value === "" ? undefined : value),
    z.coerce.number().positive().optional(),
  ),
  village: z.string().trim().max(100).optional().or(z.literal("")),
  district: text(100),
  deadline: z.coerce
    .date()
    .refine((date) => date > new Date(), "Deadline must be in the future."),
  requirements: z.string().trim().max(1000).optional().or(z.literal("")),
});
export const responseSchema = z.object({
  quantity: positive,
  unit: text(30),
  price: positive,
  message: z.string().trim().max(500).optional().or(z.literal("")),
});
export const purchaseRequestSchema = z.object({
  quantityKg: positive.max(9999999999.99),
  pricePerKg: positive.max(9999999999.99),
  message: z.string().trim().max(500).optional().or(z.literal("")),
});
