const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
const isValidObservation = (item) =>
  Number.isFinite(new Date(item.observedAt).getTime()) &&
  Number.isFinite(Number(item.modalPrice)) &&
  Number(item.modalPrice) > 0;

export function sortPriceObservations(items) {
  return items
    .filter(isValidObservation)
    .sort(
      (a, b) =>
        new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime(),
    );
}

export function filterPriceObservations(
  items,
  {
    crop = "",
    district = "",
    market = "",
    unit = "",
    dateRange = "all",
    now = new Date(),
  } = {},
) {
  const days = Number.parseInt(dateRange, 10);
  const cutoff = Number.isFinite(days)
    ? now.getTime() - days * 24 * 60 * 60 * 1000
    : null;
  return sortPriceObservations(
    items.filter((item) => {
      const timestamp = new Date(item.observedAt).getTime();
      return (
        (!crop || normalize(item.crop) === normalize(crop)) &&
        (!district || normalize(item.district) === normalize(district)) &&
        (!market || normalize(item.market) === normalize(market)) &&
        (!unit || normalize(item.unit) === normalize(unit)) &&
        (cutoff === null || (timestamp >= cutoff && timestamp <= now.getTime()))
      );
    }),
  );
}

export function buildPriceChartModel(items) {
  const sorted = sortPriceObservations(items);
  const groups = new Map();
  const seriesKeys = sorted.map((observation) => {
    const groupId = JSON.stringify([
      normalize(observation.crop),
      normalize(observation.market),
      normalize(observation.district),
      normalize(observation.unit),
    ]);
    if (!groups.has(groupId)) {
      groups.set(groupId, {
        key: `price${groups.size}`,
        crop: observation.crop,
        market: observation.market,
        district: observation.district,
        unit: observation.unit,
        observationCount: 0,
      });
    }
    groups.get(groupId).observationCount++;
    return groups.get(groupId).key;
  });
  const series = [...groups.values()];
  return {
    series,
    hasTrend: series.some((item) => item.observationCount > 1),
    hasInsufficientSeries: series.some((item) => item.observationCount === 1),
    points: sorted.map((observation, index) => ({
      timestamp: new Date(observation.observedAt).getTime(),
      [seriesKeys[index]]: Number(observation.modalPrice),
      observation,
    })),
  };
}

export function summarizeMarketPrices(items) {
  const groups = new Map();
  for (const observation of sortPriceObservations(items)) {
    const groupId = JSON.stringify([
      normalize(observation.crop),
      normalize(observation.market),
      normalize(observation.district),
      normalize(observation.unit),
    ]);
    if (!groups.has(groupId)) groups.set(groupId, []);
    groups.get(groupId).push(observation);
  }
  return [...groups.values()]
    .map((observations) => {
      const latest = observations[observations.length - 1];
      const previous = observations[observations.length - 2] || null;
      const absoluteChange =
        previous &&
        Number.isFinite(Number(latest.modalPrice)) &&
        Number.isFinite(Number(previous.modalPrice))
          ? Number(latest.modalPrice) - Number(previous.modalPrice)
          : null;
      const previousPrice =
        previous && Number(previous.modalPrice) > 0
          ? Number(previous.modalPrice)
          : null;
      const percentageChange =
        absoluteChange !== null && previousPrice
          ? (absoluteChange / previousPrice) * 100
          : null;
      return {
        market: latest.market,
        crop: latest.crop,
        district: latest.district,
        unit: latest.unit,
        latest,
        previous,
        absoluteChange,
        percentageChange: Number.isFinite(percentageChange)
          ? percentageChange
          : null,
      };
    })
    .sort(
      (a, b) =>
        a.market.localeCompare(b.market) ||
        normalize(a.district).localeCompare(normalize(b.district)) ||
        normalize(a.unit).localeCompare(normalize(b.unit)),
    );
}
