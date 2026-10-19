import { z } from "zod";

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
});

export const config = configSchema.parse({
  PORT: process.env.PORT,
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
  JWT_SECRET: process.env.JWT_SECRET || (process.env.NODE_ENV === "test" ? "test-secret-with-at-least-32-characters" : undefined),
  NODE_ENV: process.env.NODE_ENV
});

const thresholdSchema = z.object({
  green: z.coerce.number().positive().max(10).default(0.95),
  amber: z.coerce.number().positive().max(10).default(0.8)
}).refine(({ green, amber }) => green > amber, {
  message: "FAIR_PRICE_GREEN_THRESHOLD must be greater than FAIR_PRICE_AMBER_THRESHOLD."
});

export const fairPriceThresholds = thresholdSchema.parse({
  green: process.env.FAIR_PRICE_GREEN_THRESHOLD,
  amber: process.env.FAIR_PRICE_AMBER_THRESHOLD
});
