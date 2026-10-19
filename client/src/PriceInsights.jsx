import React from "react";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Search, ShieldCheck } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "./api.js";
import { useLanguage } from "./i18n.jsx";

const districts = ["Dakshina Kannada", "Udupi"];
const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const prettyDate = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Button({ children, icon: Icon, ...props }) {
  return (
    <button className="button button-primary" {...props}>
      {Icon && <Icon size={17} />}
      {children}
    </button>
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

function ErrorNote({ children }) {
  return children ? (
    <div className="notice notice-error" role="alert">
      {children}
    </div>
  ) : null;
}

function EmptyState({ title }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <BarChart3 size={22} />
      </span>
      <h3>{title}</h3>
    </div>
  );
}

export default function PriceInsights() {
  const { t } = useLanguage();
  const [crop, setCrop] = useState("Tomato");
  const [district, setDistrict] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function load(event) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    const query = new URLSearchParams({
      crop,
      ...(district ? { district } : {}),
    });
    try {
      setData(await api(`/prices/insights?${query}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  const chartData = useMemo(
    () =>
      (data?.items || []).map((item) => ({
        ...item,
        label: prettyDate(item.observedAt),
        value: Number(item.modalPrice),
      })),
    [data],
  );
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="TRANSPARENT MARKET REFERENCES"
        title={t("prices")}
        detail={t("insightCopy")}
      />
      <form className="filter-bar insights-filter" onSubmit={load}>
        <Field label={t("searchCrop")}>
          <input
            value={crop}
            onChange={(event) => setCrop(event.target.value)}
            required
          />
        </Field>
        <Field label={t("filterDistrict")}>
          <select
            value={district}
            onChange={(event) => setDistrict(event.target.value)}
          >
            <option value="">{t("allDistricts")}</option>
            {districts.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Button type="submit" icon={Search}>
          Show prices
        </Button>
      </form>
      <ErrorNote>{error}</ErrorNote>
      {loading ? (
        <div className="panel-loading">
          <span className="spinner" />
          {t("loading")}
        </div>
      ) : (
        data && (
          <div className="insights-grid">
            <section className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">HISTORICAL OBSERVATIONS</span>
                  <h2>{data.crop} · modal price</h2>
                </div>
                <span className="unit-pill">
                  {chartData[0]?.unit || "₹ / unit"}
                </span>
              </div>
              {chartData.length ? (
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e6e9e1"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#718075" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        width={48}
                        tick={{ fontSize: 11, fill: "#718075" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value) => [money(value), "Modal price"]}
                        contentStyle={{
                          borderRadius: 8,
                          borderColor: "#e6e9e1",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#286546"
                        strokeWidth={2.5}
                        dot={{
                          r: 4,
                          fill: "#286546",
                          strokeWidth: 2,
                          stroke: "#fff",
                        }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title={t("historyEmpty")} />
              )}
              <p className="chart-explainer">
                This chart shows recorded reference observations only. It does
                not forecast future prices.
              </p>
            </section>
            <section className="panel observations-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">SOURCE & FRESHNESS</span>
                  <h2>Latest references</h2>
                </div>
                <span
                  className={`data-source-badge ${data.dataMode === "sample_demo" ? "source-demo" : data.dataMode === "none" ? "source-none" : "source-live"}`}
                >
                  {data.dataMode === "sample_demo"
                    ? t("sampleData")
                    : data.dataMode === "live"
                      ? "Verified · recent live data"
                      : data.dataMode === "none"
                        ? t("noObservations")
                        : "Fetched historical data"}
                </span>
              </div>
              {data.items.length ? (
                <div className="observation-list">
                  {[...data.items].reverse().map((item) => (
                    <div
                      className="observation-row"
                      key={
                        item.id ||
                        `${item.crop}-${item.market}-${item.observedAt}`
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
        )
      )}
    </div>
  );
}
