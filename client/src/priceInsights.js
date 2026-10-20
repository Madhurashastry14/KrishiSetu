const normalize = (value) => String(value || "").trim().toLowerCase();

export function sortPriceObservations(items) {
  return [...items].sort(
    (a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime(),
  );
}

export function filterPriceObservations(
  items,
  { crop = "", district = "", market = "", dateRange = "all", now = new Date() } = {},
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
      });
    }
    return groups.get(groupId).key;
  });
  return {
    series: [...groups.values()],
    points: sorted.map((observation, index) => ({
      observedAt: observation.observedAt,
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
      const absoluteChange = previous
        ? Number(latest.modalPrice) - Number(previous.modalPrice)
        : null;
      const previousPrice =
        previous && Number(previous.modalPrice) > 0
          ? Number(previous.modalPrice)
          : null;
      return {
        market: latest.market,
        crop: latest.crop,
        district: latest.district,
        unit: latest.unit,
        latest,
        previous,
        absoluteChange,
        percentageChange: previousPrice
          ? (absoluteChange / previousPrice) * 100
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
