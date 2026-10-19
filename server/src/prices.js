import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fairPriceThresholds } from "./config.js";
import { prisma } from "./db.js";

const require = createRequire(import.meta.url);
export const demoPrices = require("./data/demo-prices.json");

const field = (record, names) => {
  const key = Object.keys(record).find((item) => names.includes(item.toLowerCase().replace(/[\s_-]/g, "")));
  return key ? record[key] : undefined;
};

function normalizeLiveRecord(record) {
  const crop = field(record, ["commodity", "crop", "commodityname"]);
  const market = field(record, ["market", "marketname", "apmc"]);
  const district = field(record, ["district", "districtname"]);
  const price = Number(String(field(record, ["modalprice", "modal", "modalprice(rs/quintal)", "modalprice(rs/qtl)"])).replace(/,/g, ""));
  const rawDate = field(record, ["arrivaldate", "date", "reporteddate"]);
  const date = parseObservationDate(rawDate);
  const recordId = field(record, ["id", "recordid"]);
  if (typeof crop !== "string" || typeof market !== "string" || !Number.isFinite(price) || price <= 0 || Number.isNaN(date.getTime())) return null;
  return {
    crop: crop.trim(),
    market: market.trim(),
    district: typeof district === "string" ? district.trim() : null,
    modalPrice: price,
    unit: "quintal",
    observedAt: date,
    source: "data.gov.in Agmarknet",
    dataType: Date.now() - date.getTime() <= 3 * 24 * 60 * 60 * 1000 ? "LIVE" : "HISTORICAL",
    externalId: recordId
      ? `agmarknet:${String(recordId).trim()}`
      : `agmarknet:${createHash("sha256").update(`${crop}|${market}|${district || ""}|${date.toISOString()}|${price}`).digest("hex")}`
  };
}

function parseObservationDate(value) {
  if (!value) return new Date(Number.NaN);
  if (typeof value !== "string") return new Date(value);
  const match = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return new Date(value);
  const [, day, month, year] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return parsed.getUTCDate() === Number(day) && parsed.getUTCMonth() === Number(month) - 1 ? parsed : new Date(Number.NaN);
}

export async function syncAgmarknet() {
  const { AGMARKNET_API_KEY, AGMARKNET_RESOURCE_ID } = process.env;
  if (!AGMARKNET_API_KEY || !AGMARKNET_RESOURCE_ID) return { imported: 0, configured: false };
  const url = new URL(`https://api.data.gov.in/resource/${encodeURIComponent(AGMARKNET_RESOURCE_ID)}`);
  url.searchParams.set("api-key", AGMARKET_API_KEY_SAFE(AGMARKNET_API_KEY));
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "100");
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Agmarknet returned HTTP ${response.status}.`);
  const body = await response.json();
  const records = Array.isArray(body.records) ? body.records : [];
  let imported = 0;
  for (const record of records) {
    const observation = normalizeLiveRecord(record);
    if (!observation) continue;
    if (observation.externalId) {
      await prisma.mandiPriceObservation.upsert({
        where: { externalId: observation.externalId },
        update: observation,
        create: observation
      });
    } else {
      await prisma.mandiPriceObservation.create({ data: observation });
    }
    imported++;
  }
  return { imported, configured: true };
}

function AGMARKET_API_KEY_SAFE(value) {
  return value.trim();
}

export function compareFairPrice({ expectedPrice, unit, observations, now = new Date(), district }) {
  const sameUnit = observations.filter((item) => item.unit.toLowerCase() === unit.toLowerCase() && Number.isFinite(Number(item.modalPrice)) && Number(item.modalPrice) > 0);
  const fresh = sameUnit.filter((item) => {
    const age = now - new Date(item.observedAt);
    return age >= 0 && age <= 45 * 24 * 60 * 60 * 1000;
  });
  const selected = fresh.sort((a, b) => {
    const aDistrict = district && a.district?.toLowerCase() === district.toLowerCase() ? 1 : 0;
    const bDistrict = district && b.district?.toLowerCase() === district.toLowerCase() ? 1 : 0;
    return bDistrict - aDistrict || new Date(b.observedAt) - new Date(a.observedAt);
  })[0];
  if (!selected) {
    return {
      available: false,
      reason: sameUnit.length ? "stale" : "missing_or_incompatible",
      message: sameUnit.length ? "No recent reference price is available." : "No compatible reference price is available.",
      thresholds: fairPriceThresholds
    };
  }
  const ratio = Number(expectedPrice) / Number(selected.modalPrice);
  const band = ratio >= fairPriceThresholds.green ? "GREEN" : ratio >= fairPriceThresholds.amber ? "AMBER" : "RED";
  return {
    available: true,
    band,
    ratio,
    message: band === "GREEN" ? "Your expected price is close to or above this reference." : band === "AMBER" ? "Your expected price is moderately below this reference." : "Your expected price is substantially below this reference.",
    reference: selected,
    thresholds: fairPriceThresholds
  };
}

export async function listPriceObservations({ crop, district, limit = 100 }) {
  const where = {
    ...(crop ? { crop: { equals: crop, mode: "insensitive" } } : {}),
    ...(district ? { district: { equals: district, mode: "insensitive" } } : {})
  };
  const stored = await prisma.mandiPriceObservation.findMany({ where, orderBy: { observedAt: "desc" }, take: limit });
  if (stored.length) {
    return classifyPriceObservations(stored);
  }
  return demoPrices.filter((item) =>
    (!crop || item.crop.toLowerCase() === crop.toLowerCase()) &&
    (!district || item.district?.toLowerCase() === district.toLowerCase())
  );
}

export function classifyPriceObservations(items, now = new Date()) {
  return items.map((item) => ({
    ...item,
    dataType: item.dataType === "DEMO" ? "DEMO" : (now - new Date(item.observedAt).getTime()) >= 0 && (now - new Date(item.observedAt).getTime()) <= 3 * 24 * 60 * 60 * 1000 ? "LIVE" : "HISTORICAL"
  }));
}

export function getPriceDataMode(items) {
  if (!items.length) return "none";
  if (items.some((item) => item.dataType === "LIVE")) return "live";
  if (items.some((item) => item.dataType === "HISTORICAL")) return "historical";
  return "sample_demo";
}
