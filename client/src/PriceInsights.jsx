import React from "react";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw, ShieldCheck } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "./api.js";
import { useLanguage } from "./i18n.jsx";
import {
  buildPriceChartModel,
  filterPriceObservations,
} from "./priceInsights.js";

const colors = ["#286546", "#bd7a22", "#4d78a8", "#9c5a78", "#6c7e37"];
const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const prettyDate = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const normalized = (value) => String(value || "").toLowerCase();

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function PageHeading({ eyebrow, title, detail }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function EmptyState({ title, detail }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <BarChart3 size={22} />
      </span>
      <h3>{title}</h3>
      {detail && <p>{detail}</p>}
    </div>
  );
}

function PriceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload.find(
    (entry) => entry.value !== null && entry.value !== undefined,
  );
  const observation = point?.payload.observation;
  if (!observation) return null;
  const isDemo = observation.dataType === "DEMO";
  return (
    <div className="price-tooltip">
      <strong>{observation.crop}</strong>
      <span>
        {money(observation.modalPrice)} / {observation.unit}
      </span>
      <span>{observation.market}</span>
      <span>{observation.district || "District not specified"}</span>
      <span>{prettyDate(observation.observedAt)}</span>
      <span>
        {isDemo ? "Demo data · " : ""}
        {observation.source || "Source not specified"}
      </span>
      {isDemo && <small>Not verified live mandi prices</small>}
    </div>
  );
}

export default function PriceInsights() {
  const { t } = useLanguage();
  const [crop, setCrop] = useState("Tomato");
  const [district, setDistrict] = useState("");
  const [market, setMarket] = useState("");
  const [unit, setUnit] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await api("/prices/"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const items = data?.items || [];
  const crops = useMemo(
    () =>
      [...new Set(items.map((item) => item.crop))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [items],
  );
  useEffect(() => {
    if (
      crops.length &&
      !crops.some((item) => normalized(item) === normalized(crop))
    )
      setCrop(crops[0]);
  }, [crops, crop]);

  const districts = useMemo(
    () =>
      [
        ...new Set(
          items
            .filter(
              (item) => !crop || normalized(item.crop) === normalized(crop),
            )
            .map((item) => item.district)
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [items, crop],
  );
  useEffect(() => {
    if (
      district &&
      !districts.some((item) => normalized(item) === normalized(district))
    )
      setDistrict("");
  }, [district, districts]);
  const markets = useMemo(
    () =>
      [
        ...new Set(
          items
            .filter(
              (item) =>
                (!crop || normalized(item.crop) === normalized(crop)) &&
                (!district ||
                  normalized(item.district) === normalized(district)),
            )
            .map((item) => item.market),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [items, crop, district],
  );
  useEffect(() => {
    if (
      market &&
      !markets.some((item) => normalized(item) === normalized(market))
    )
      setMarket("");
  }, [market, markets]);

  const units = useMemo(
    () =>
      [
        ...new Set(
          filterPriceObservations(items, { crop, district, market, dateRange })
            .map((item) => item.unit)
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [items, crop, district, market, dateRange],
  );
  useEffect(() => {
    if (!units.some((item) => normalized(item) === normalized(unit)))
      setUnit(units[0] || "");
  }, [unit, units]);

  const activeUnit = units.some((item) => normalized(item) === normalized(unit))
    ? unit
    : units[0] || "";
  const filteredItems = useMemo(
    () =>
      filterPriceObservations(items, {
        crop,
        district,
        market,
        unit: activeUnit,
        dateRange,
      }),
    [items, crop, district, market, activeUnit, dateRange],
  );
  const chart = useMemo(
    () => buildPriceChartModel(filteredItems),
    [filteredItems],
  );
  const demoRecords = filteredItems.some((item) => item.dataType === "DEMO");

  return (
    <div className="page-content">
      <PageHeading
        eyebrow="TRANSPARENT MARKET REFERENCES"
        title={t("prices")}
        detail={t("insightCopy")}
      />
      <div className="filter-bar insights-filter">
        <Field label="Crop">
          <select
            aria-label="Crop"
            value={crop}
            onChange={(event) => setCrop(event.target.value)}
          >
            {!crops.length && <option value="Tomato">Tomato</option>}
            {crops.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("filterDistrict")}>
          <select
            aria-label="District"
            value={district}
            onChange={(event) => setDistrict(event.target.value)}
          >
            <option value="">{t("allDistricts")}</option>
            {districts.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Market">
          <select
            aria-label="Market"
            value={market}
            onChange={(event) => setMarket(event.target.value)}
          >
            <option value="">All markets</option>
            {markets.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Price unit">
          <select
            aria-label="Price unit"
            value={activeUnit}
            onChange={(event) => setUnit(event.target.value)}
          >
            {!units.length && <option value="">No units available</option>}
            {units.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Date range">
          <select
            aria-label="Date range"
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value)}
          >
            <option value="all">Any date</option>
            <option value="7d">Past 7 days</option>
            <option value="30d">Past 30 days</option>
            <option value="90d">Past 90 days</option>
          </select>
        </Field>
      </div>
      {error ? (
        <div className="notice notice-error price-error" role="alert">
          <span>{error}</span>
          <button
            className="button button-secondary"
            onClick={load}
            type="button"
          >
            <RefreshCw size={15} /> Retry
          </button>
        </div>
      ) : loading ? (
        <div className="panel-loading" role="status">
          <span className="spinner" />
          {t("loading")}
        </div>
      ) : (
        <>
          {demoRecords && (
            <div className="demo-disclaimer" role="note">
              <strong>Demo data</strong> — these sample records are not verified
              live mandi prices.
            </div>
          )}
          <div className="insights-grid">
            <section className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">HISTORICAL OBSERVATIONS</span>
                  <h2>
                    {crop || "Crop"} · {market || "prices by market"} ·{" "}
                    {activeUnit || "unit"} over time
                  </h2>
                </div>
                <span className="unit-pill">₹ / {activeUnit || "unit"}</span>
              </div>
              {chart.points.length ? (
                <>
                  <div
                    className="chart-wrap"
                    aria-label={`${crop} price trend graph`}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chart.points}
                        margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e6e9e1"
                        />
                        <XAxis
                          dataKey="timestamp"
                          type="number"
                          domain={["dataMin", "dataMax"]}
                          tickFormatter={(value) => prettyDate(value)}
                          tick={{ fontSize: 11, fill: "#718075" }}
                          axisLine={false}
                          tickLine={false}
                          minTickGap={20}
                        />
                        <YAxis
                          width={58}
                          tickFormatter={(value) => money(value)}
                          tick={{ fontSize: 11, fill: "#718075" }}
                          axisLine={false}
                          tickLine={false}
                          label={{
                            value: `Modal price (₹ / ${activeUnit || "unit"})`,
                            angle: -90,
                            position: "insideLeft",
                            fill: "#718075",
                            fontSize: 10,
                          }}
                        />
                        <Tooltip content={<PriceTooltip />} />
                        {chart.series.length > 1 && (
                          <Legend
                            verticalAlign="top"
                            height={32}
                            wrapperStyle={{ fontSize: 10 }}
                          />
                        )}
                        {chart.series.map((series, index) => (
                          <Line
                            key={series.key}
                            name={`${series.market}${series.district ? ` · ${series.district}` : ""}`}
                            type="monotone"
                            dataKey={series.key}
                            stroke={colors[index % colors.length]}
                            strokeWidth={2.5}
                            connectNulls
                            dot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                            activeDot={{ r: 6 }}
                            isAnimationActive={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {chart.hasInsufficientSeries && (
                    <p className="trend-note">
                      {chart.hasTrend
                        ? "Markets with one observation show only a point; more records are needed for a trend line."
                        : "Only one observation is available for each selected market. More historical records are required to show a trend line."}
                    </p>
                  )}
                </>
              ) : (
                <EmptyState
                  title="No matching price observations"
                  detail="Try another crop, market, district, or date range."
                />
              )}
              <p className="chart-explainer">
                Points show recorded observations for the selected crop and
                unit. Each line represents one market; historical changes are
                not forecasts.
              </p>
            </section>
            <section className="panel observations-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">SOURCE & FRESHNESS</span>
                  <h2>Latest references</h2>
                </div>
                <span
                  className={`data-source-badge ${demoRecords ? "source-demo" : filteredItems.length ? "source-live" : "source-none"}`}
                >
                  {demoRecords
                    ? "Demo data"
                    : filteredItems.length
                      ? "Recorded data"
                      : t("noObservations")}
                </span>
              </div>
              {filteredItems.length ? (
                <div className="observation-list">
                  {[...filteredItems].reverse().map((item, index) => (
                    <div
                      className="observation-row"
                      key={
                        item.id ||
                        `${item.crop}-${item.market}-${item.observedAt}-${index}`
                      }
                    >
                      <span className="crop-avatar">
                        <BarChart3 size={16} />
                      </span>
                      <span className="observation-copy">
                        <strong>{item.market}</strong>
                        <small>
                          {item.district || "Market"} ·{" "}
                          {prettyDate(item.observedAt)}
                        </small>
                      </span>
                      <strong>
                        {money(item.modalPrice)}
                        <small> / {item.unit}</small>
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title={t("historyEmpty")} />
              )}
              <div className="source-foot">
                <ShieldCheck size={15} />
                <span>{t("compareNote")}</span>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
