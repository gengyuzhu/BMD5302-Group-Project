import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import frontierData from "../part1_outputs/efficient_frontier_data.json";
import covarianceAnnualizedCsv from "../part1_outputs/covariance_matrix_annualized.csv?raw";

/* ───── theme ───── */
const theme = {
  ink: "#1d2a34",
  muted: "#5f6f7b",
  paper: "#fffdf8",
  panel: "#fff8ea",
  line: "#d9cdb3",
  short: "#2f6cad",
  long: "#5c9f45",
  asset: "#da7b24",
  gmvpShort: "#d1495b",
  gmvpLong: "#9b6a44",
  selected: "#111111",
};

const chartSize = {
  width: 920,
  height: 560,
  paddingTop: 30,
  paddingRight: 36,
  paddingBottom: 56,
  paddingLeft: 74,
};

const tickerMap = {
  "Nikko STI ETF": "STI_ETF",
  "Lion-OCBC HSTECH ETF": "HSTECH",
  "ABF SG Bond": "ABF_SG",
  "Fidelity Global Tech": "FID_TECH",
  "PIMCO Income SGD-H": "PIMCO_INC",
  "JPM US Tech SGD": "JPM_TECH",
  "Schroder Asian Growth": "SCH_ASIA",
  "BlackRock World Gold": "BLK_GOLD",
  "Franklin India SGD": "FRANK_IND",
  "United SGD Fund": "UOB_SGD",
};

/* ───── safe helpers ───── */
const safeNum = (v, fallback = 0) =>
  v != null && Number.isFinite(Number(v)) ? Number(v) : fallback;

const safeArr = (v) => (Array.isArray(v) ? v : []);

const safeStr = (v, fallback = "") =>
  typeof v === "string" ? v : fallback;

const formatPercent = (value, digits = 2) => {
  const n = safeNum(value);
  return `${(n * 100).toFixed(digits)}%`;
};

function makeTicks(min, max, count = 6) {
  const lo = safeNum(min);
  const hi = safeNum(max);
  if (lo === hi) return [lo];
  return Array.from({ length: count }, (_, i) => lo + ((hi - lo) * i) / (count - 1));
}

function pathFromPoints(points, xScale, yScale) {
  return safeArr(points)
    .map((pt, i) => {
      const r = safeNum(pt?.risk);
      const ret = safeNum(pt?.return);
      return `${i === 0 ? "M" : "L"} ${xScale(r)} ${yScale(ret)}`;
    })
    .join(" ");
}

function areaFromPoints(points, xScale, yScale, baseline) {
  const pts = safeArr(points);
  if (pts.length < 2) return "";
  const top = pts
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${xScale(safeNum(pt?.risk))} ${yScale(safeNum(pt?.return))}`)
    .join(" ");
  const lastX = xScale(safeNum(pts[pts.length - 1]?.risk));
  const firstX = xScale(safeNum(pts[0]?.risk));
  return `${top} L ${lastX} ${baseline} L ${firstX} ${baseline} Z`;
}

function weightsToRows(weightMap) {
  if (!weightMap || typeof weightMap !== "object") return [];
  return Object.entries(weightMap)
    .map(([fund, weight]) => ({ fund, weight: safeNum(weight) }))
    .sort((l, r) => Math.abs(r.weight) - Math.abs(l.weight));
}

function hoverPosition(event) {
  const svg = event?.currentTarget?.ownerSVGElement ?? event?.currentTarget;
  if (!svg) return { x: 0, y: 0 };
  const rect = svg.getBoundingClientRect();
  return { x: event.clientX - rect.left + 12, y: event.clientY - rect.top - 12 };
}

function elementHoverPosition(event, containerClassName) {
  const container =
    event?.currentTarget?.closest(`.${containerClassName}`) ?? event?.currentTarget?.parentElement;
  if (!container) return { x: 0, y: 0 };
  const rect = container.getBoundingClientRect();
  return { x: event.clientX - rect.left + 14, y: event.clientY - rect.top - 14 };
}

function tickerCode(shortName) {
  return tickerMap[shortName] ?? safeStr(shortName).toUpperCase().replace(/[^\w]+/g, "_").slice(0, 10);
}

function parseMatrixCsv(raw) {
  const lines = safeStr(raw).trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(",").slice(1);
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(",");
    return { rowLabel: safeStr(cells[0]), values: cells.slice(1).map((v) => safeNum(v)) };
  });
  return { headers, rows };
}

function buildCorrelationMatrix(covarianceMatrix, funds) {
  const volatilityMap = Object.fromEntries(
    safeArr(funds).map((f) => [safeStr(f?.shortName), safeNum(f?.annualVolatility)]),
  );
  return {
    headers: safeArr(covarianceMatrix?.headers),
    rows: safeArr(covarianceMatrix?.rows).map((row) => ({
      rowLabel: safeStr(row?.rowLabel),
      values: safeArr(row?.values).map((val, ci) => {
        const colLabel = safeArr(covarianceMatrix?.headers)[ci] ?? "";
        const denom = safeNum(volatilityMap[row?.rowLabel]) * safeNum(volatilityMap[colLabel]);
        return denom ? val / denom : 0;
      }),
    })),
  };
}

/* ───── inline keyframes (injected once) ───── */
const STYLE_ID = "ef-premium-styles";
function ensureStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes ef-glow-pulse {
      0%, 100% { opacity: 0.35; transform: scale(1); }
      50% { opacity: 0.65; transform: scale(1.18); }
    }
    @keyframes ef-gradient-border {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes ef-tab-underline {
      from { transform: scaleX(0); }
      to { transform: scaleX(1); }
    }
    @keyframes ef-fade-in {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes ef-number-pop {
      0% { transform: scale(1); }
      30% { transform: scale(1.08); }
      100% { transform: scale(1); }
    }
    .ef-slider-track {
      -webkit-appearance: none; appearance: none; width: 100%; height: 8px;
      border-radius: 4px; outline: none; cursor: pointer;
      background: linear-gradient(90deg, ${theme.long}, ${theme.short});
    }
    .ef-slider-track::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none; width: 22px; height: 22px;
      border-radius: 50%; background: #ffffff; border: 3px solid ${theme.ink};
      box-shadow: 0 2px 8px rgba(0,0,0,0.18); cursor: pointer; transition: box-shadow 0.2s;
    }
    .ef-slider-track::-webkit-slider-thumb:hover {
      box-shadow: 0 2px 14px rgba(0,0,0,0.28);
    }
    .ef-slider-track::-moz-range-thumb {
      width: 22px; height: 22px; border-radius: 50%; background: #ffffff;
      border: 3px solid ${theme.ink}; box-shadow: 0 2px 8px rgba(0,0,0,0.18); cursor: pointer;
    }
    .ef-slider-track::-moz-range-track {
      height: 8px; border-radius: 4px;
      background: linear-gradient(90deg, ${theme.long}, ${theme.short});
    }
    .ef-table-row-alt:nth-child(even) { background: rgba(255,248,234,0.45); }
    .ef-table-row-alt:hover { background: rgba(208,123,42,0.08) !important; }
  `;
  document.head.appendChild(style);
}

/* ───── small UI atoms ───── */
function SectionIcon({ d, color = theme.muted, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: 6, opacity: 0.7 }}>
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  chart: "M3 3v18h18M7 16l4-6 4 4 6-8",
  inspect: "M9 2H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 2v6m12-2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V10",
  stats: "M18 20V10M12 20V4M6 20v-6",
  matrix: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  legend: "M4 6h16M4 12h16M4 18h16",
  gmvp: "M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01z",
};

const pillStyle = (active) => ({
  padding: "10px 20px",
  borderRadius: 999,
  border: "none",
  background: active
    ? "linear-gradient(135deg, #1d2a34, #2f4a5e)"
    : "rgba(255,255,255,0.7)",
  color: active ? "#ffffff" : theme.ink,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
  boxShadow: active ? "0 4px 14px rgba(29,42,52,0.25)" : "0 1px 4px rgba(0,0,0,0.06)",
  transition: "all 0.3s ease",
  backdropFilter: "blur(6px)",
});

const glassCard = (extra = {}) => ({
  background: "rgba(255,255,255,0.55)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  borderRadius: 22,
  border: "1px solid rgba(217,205,179,0.5)",
  padding: 22,
  ...extra,
});

const sectionHeader = (icon, label) => (
  <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
    <SectionIcon d={icon} />
    <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: theme.muted, fontWeight: 600 }}>
      {label}
    </span>
  </div>
);

/* ───── animated number display ───── */
function AnimatedValue({ value, style }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setDisplay(value);
    }
  }, [value]);
  return (
    <span style={{ ...style, display: "inline-block", transition: "all 0.3s ease" }}>
      {display}
    </span>
  );
}

/* ───── tab button with animated underline ───── */
function TabButton({ active, label, onClick, tabId, panelId }) {
  return (
    <button
      type="button"
      role="tab"
      onClick={onClick}
      aria-selected={active}
      aria-controls={panelId}
      id={tabId}
      tabIndex={active ? 0 : -1}
      style={{
        position: "relative",
        padding: "10px 18px",
        border: "none",
        background: "transparent",
        color: active ? theme.ink : theme.muted,
        cursor: "pointer",
        fontSize: 14,
        fontWeight: active ? 700 : 500,
        transition: "color 0.25s ease",
      }}
    >
      {label}
      <span
        style={{
          position: "absolute",
          bottom: 0,
          left: active ? "10%" : "50%",
          width: active ? "80%" : "0%",
          height: 3,
          borderRadius: 2,
          background: "linear-gradient(90deg, #2f6cad, #5c9f45)",
          transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
    </button>
  );
}

/* ───── floating slider tooltip ───── */
function SliderTooltip({ value, min, max, containerRef }) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: `calc(${pct}% - 22px)`,
        top: -34,
        background: theme.ink,
        color: "#fff",
        fontSize: 12,
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: 8,
        pointerEvents: "none",
        whiteSpace: "nowrap",
        transition: "left 0.15s ease",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      }}
    >
      {value + 1}
      <span
        style={{
          position: "absolute",
          bottom: -5,
          left: "50%",
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: `5px solid ${theme.ink}`,
        }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════ */
export default function EfficientFrontierInteractive({ data = frontierData }) {
  const [viewMode, setViewMode] = useState("both");
  const [portfolioMode, setPortfolioMode] = useState("longOnly");
  const [portfolioIndex, setPortfolioIndex] = useState(0);
  const [tooltip, setTooltip] = useState(null);
  const [analyticsView, setAnalyticsView] = useState("statistics");
  const [statsSort, setStatsSort] = useState({ key: "annualReturn", direction: "desc" });
  const [statsSearch, setStatsSearch] = useState("");
  const [matrixHover, setMatrixHover] = useState(null);
  const [matrixTooltip, setMatrixTooltip] = useState(null);
  const [analyticsKey, setAnalyticsKey] = useState(0);
  const sliderRef = useRef(null);

  useEffect(() => { ensureStyles(); }, []);

  /* ── safe data extraction ── */
  const assets = safeArr(data?.funds);
  const shortFrontier = safeArr(data?.frontiers?.shortSalesAllowed);
  const longFrontier = safeArr(data?.frontiers?.longOnly);
  const gmvpShort = data?.gmvp?.shortSalesAllowed ?? { risk: 0, return: 0, weights: {} };
  const gmvpLong = data?.gmvp?.longOnly ?? { risk: 0, return: 0, weights: {} };
  const metadata = data?.metadata ?? {};

  const activeFrontier = portfolioMode === "shortSalesAllowed" ? shortFrontier : longFrontier;
  const boundedIndex = Math.min(portfolioIndex, Math.max(activeFrontier.length - 1, 0));
  const selectedPortfolio = activeFrontier[boundedIndex] ?? { risk: 0, return: 0, target_return: 0, weights: {} };

  const displayedSeries = useMemo(() => {
    if (viewMode === "short")
      return [{ id: "short", label: "Short sales allowed", color: theme.short, points: shortFrontier }];
    if (viewMode === "long")
      return [{ id: "long", label: "Long-only", color: theme.long, points: longFrontier }];
    return [
      { id: "short", label: "Short sales allowed", color: theme.short, points: shortFrontier },
      { id: "long", label: "Long-only", color: theme.long, points: longFrontier },
    ];
  }, [longFrontier, shortFrontier, viewMode]);

  const chartDomain = useMemo(() => {
    const frontierPoints = displayedSeries.flatMap((s) => safeArr(s.points));
    const all = [...frontierPoints, ...assets, gmvpShort, gmvpLong];
    const risks = all.map((p) => safeNum(p?.risk ?? p?.annualVolatility));
    const returns = all.map((p) => safeNum(p?.return ?? p?.annualReturn));
    return {
      riskMin: Math.max(0, Math.min(...risks) - 0.01),
      riskMax: Math.max(...risks) + 0.02,
      returnMin: Math.min(...returns) - 0.03,
      returnMax: Math.max(...returns) + 0.03,
    };
  }, [assets, displayedSeries, gmvpLong, gmvpShort]);

  const xScale = useCallback(
    (v) => {
      const { paddingLeft, width, paddingRight } = chartSize;
      const usable = width - paddingLeft - paddingRight;
      const range = chartDomain.riskMax - chartDomain.riskMin || 1;
      return paddingLeft + ((safeNum(v) - chartDomain.riskMin) / range) * usable;
    },
    [chartDomain],
  );

  const yScale = useCallback(
    (v) => {
      const { paddingTop, height, paddingBottom } = chartSize;
      const usable = height - paddingTop - paddingBottom;
      const range = chartDomain.returnMax - chartDomain.returnMin || 1;
      return height - paddingBottom - ((safeNum(v) - chartDomain.returnMin) / range) * usable;
    },
    [chartDomain],
  );

  const xTicks = makeTicks(chartDomain.riskMin, chartDomain.riskMax, 6);
  const yTicks = makeTicks(chartDomain.returnMin, chartDomain.returnMax, 6);
  const selectedRows = weightsToRows(selectedPortfolio?.weights);
  const topShortWeights = weightsToRows(gmvpShort?.weights).slice(0, 3);
  const topLongWeights = weightsToRows(gmvpLong?.weights).slice(0, 3);
  const selectedTopRows = selectedRows.filter((r) => Math.abs(r.weight) > 1e-4).slice(0, 4);
  const frontierProgress = activeFrontier.length > 1 ? boundedIndex / (activeFrontier.length - 1) : 0;
  const activeRiskBudget = selectedRows
    .filter((r) => r.weight > 1e-5)
    .reduce((s, r) => s + r.weight, 0);

  const gmvpShortX = xScale(safeNum(gmvpShort?.risk));
  const gmvpShortY = yScale(safeNum(gmvpShort?.return));
  const gmvpLongX = xScale(safeNum(gmvpLong?.risk));
  const gmvpLongY = yScale(safeNum(gmvpLong?.return));

  const selPtX = xScale(safeNum(selectedPortfolio?.risk));
  const selPtY = yScale(safeNum(selectedPortfolio?.return));

  const covarianceMatrix = useMemo(() => parseMatrixCsv(covarianceAnnualizedCsv), []);
  const correlationMatrix = useMemo(
    () => buildCorrelationMatrix(covarianceMatrix, assets),
    [assets, covarianceMatrix],
  );

  const fundStatisticsRows = useMemo(
    () =>
      assets.map((a) => ({
        ...a,
        ticker: tickerCode(safeStr(a?.shortName)),
        sharpe: safeNum(a?.annualVolatility) ? safeNum(a?.annualReturn) / safeNum(a?.annualVolatility) : 0,
      })),
    [assets],
  );

  const sortedFundStatistics = useMemo(() => {
    const dir = statsSort.direction === "asc" ? 1 : -1;
    const search = statsSearch.trim().toLowerCase();
    const filtered = search
      ? fundStatisticsRows.filter((r) =>
          [r.displayName, r.shortName, r.ticker]
            .map((v) => safeStr(v).toLowerCase())
            .some((v) => v.includes(search)),
        )
      : fundStatisticsRows;
    return [...filtered].sort((l, r) => {
      const lv = l[statsSort.key];
      const rv = r[statsSort.key];
      if (typeof lv === "string" && typeof rv === "string") return lv.localeCompare(rv) * dir;
      return (safeNum(lv) - safeNum(rv)) * dir;
    });
  }, [fundStatisticsRows, statsSearch, statsSort]);

  const covarianceMaxAbs = useMemo(
    () =>
      Math.max(
        ...safeArr(covarianceMatrix?.rows).flatMap((r) => safeArr(r?.values).map((v) => Math.abs(safeNum(v)))),
        1,
      ),
    [covarianceMatrix],
  );

  const activeAnalyticsMeta = useMemo(() => {
    if (analyticsView === "statistics") {
      const topSharpe = [...fundStatisticsRows].sort((a, b) => b.sharpe - a.sharpe)[0];
      const highestReturn = [...fundStatisticsRows].sort((a, b) => safeNum(b.annualReturn) - safeNum(a.annualReturn))[0];
      return {
        title: `Annualized Fund Statistics (${safeNum(metadata?.return_observations)} months real data)`,
        copy: "Use the annualized return, volatility, and Sharpe ratio to compare the 10-fund universe before moving to the frontier itself.",
        highlights: [
          { label: "Highest return", value: topSharpe ? `${safeStr(highestReturn?.shortName)} ${formatPercent(highestReturn?.annualReturn)}` : "-" },
          { label: "Best Sharpe", value: topSharpe ? `${safeStr(topSharpe?.shortName)} ${safeNum(topSharpe?.sharpe).toFixed(3)}` : "-" },
          { label: "Sort mode", value: `${statsSort.key} ${statsSort.direction}` },
        ],
      };
    }
    if (analyticsView === "correlation") {
      return {
        title: `Correlation Matrix (Annualized, ${safeNum(metadata?.return_observations)} months)`,
        copy: "Correlation highlights which funds tend to move together and where diversification is stronger or weaker inside the shared sample window.",
        highlights: [
          { label: "Matrix size", value: `${safeArr(correlationMatrix?.headers).length} x ${safeArr(correlationMatrix?.headers).length}` },
          {
            label: "Hover insight",
            value: matrixHover
              ? `${tickerCode(matrixHover.rowLabel)} vs ${tickerCode(matrixHover.columnLabel)} ${safeNum(matrixHover.value).toFixed(3)}`
              : "Hover a cell",
          },
          { label: "Sample window", value: `${safeStr(metadata?.sample_start)} to ${safeStr(metadata?.sample_end)}` },
        ],
      };
    }
    return {
      title: "Variance-Covariance Matrix (Annualized)",
      copy: "Variance sits on the diagonal and pairwise annualized covariance fills the off-diagonal cells, showing how fund risks interact inside optimization.",
      highlights: [
        { label: "Matrix size", value: `${safeArr(covarianceMatrix?.headers).length} x ${safeArr(covarianceMatrix?.headers).length}` },
        {
          label: "Hover insight",
          value: matrixHover
            ? `${tickerCode(matrixHover.rowLabel)} vs ${tickerCode(matrixHover.columnLabel)} ${safeNum(matrixHover.value).toFixed(4)}`
            : "Hover a cell",
        },
        { label: "Annualization", value: `${safeNum(metadata?.annualization_factor)}x monthly` },
      ],
    };
  }, [
    analyticsView,
    correlationMatrix?.headers,
    covarianceMatrix?.headers,
    metadata,
    fundStatisticsRows,
    matrixHover,
    statsSort.direction,
    statsSort.key,
  ]);

  function toggleStatsSort(nextKey) {
    setStatsSort((cur) => {
      if (cur.key === nextKey)
        return { key: nextKey, direction: cur.direction === "desc" ? "asc" : "desc" };
      return { key: nextKey, direction: nextKey === "displayName" || nextKey === "ticker" ? "asc" : "desc" };
    });
  }

  function switchAnalytics(view) {
    setAnalyticsView(view);
    setAnalyticsKey((k) => k + 1);
  }

  function matrixCellStyle(value, diagonal, matrixType) {
    if (diagonal) return { background: "rgba(208, 123, 42, 0.18)", color: theme.ink, fontWeight: 700 };
    const denom = matrixType === "correlation" ? 1 : covarianceMaxAbs;
    const norm = Math.min(1, Math.abs(safeNum(value)) / (denom || 1));
    if (value < 0)
      return { background: `rgba(209, 73, 91, ${0.08 + norm * 0.2})`, color: "#8b2336", fontWeight: 600 };
    return {
      background: `rgba(55, 109, 163, ${0.06 + norm * 0.18})`,
      color: theme.ink,
      fontWeight: value > 0.5 && matrixType === "correlation" ? 700 : 500,
    };
  }

  const baseline = chartSize.height - chartSize.paddingBottom;

  /* ══════════════════════════════════════════�?     ANALYTICS PANEL
     ══════════════════════════════════════════�?*/
  const analyticsPanel = (
    <div style={{ ...glassCard({ marginTop: 24, padding: 24 }) }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ maxWidth: 720 }}>
          {sectionHeader(ICONS.stats, "Frontier Analytics")}
          <h3 style={{ margin: "8px 0 8px", fontSize: 26, fontWeight: 700 }}>{activeAnalyticsMeta.title}</h3>
          <div style={{ color: theme.muted, lineHeight: 1.55, fontSize: 15 }}>{activeAnalyticsMeta.copy}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(140px, 1fr))", gap: 12, minWidth: 320 }}>
          {activeAnalyticsMeta.highlights.map((item) => (
            <div
              key={`${item.label}-${item.value}`}
              className="platform-chart-insight"
              style={{ minHeight: 92, background: "rgba(255,248,234,0.6)", borderRadius: 14, padding: 12, border: `1px solid ${theme.line}` }}
            >
              <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: theme.muted }}>{item.label}</span>
              <strong style={{ display: "block", marginTop: 6, fontSize: 14, wordBreak: "break-word" }}>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* ── tab bar ── */}
      <div role="tablist" aria-label="Analytics views" style={{ display: "flex", gap: 0, marginTop: 20, borderBottom: `1px solid ${theme.line}` }}>
        <TabButton active={analyticsView === "statistics"} label="Fund Statistics" onClick={() => switchAnalytics("statistics")} tabId="tab-statistics" panelId="panel-statistics" />
        <TabButton active={analyticsView === "correlation"} label="Correlation" onClick={() => switchAnalytics("correlation")} tabId="tab-correlation" panelId="panel-correlation" />
        <TabButton active={analyticsView === "covariance"} label="Covariance" onClick={() => switchAnalytics("covariance")} tabId="tab-covariance" panelId="panel-covariance" />
      </div>

      {/* ── tab content with fade-in ── */}
      <div
        key={analyticsKey}
        role="tabpanel"
        id={`panel-${analyticsView}`}
        aria-labelledby={`tab-${analyticsView}`}
        tabIndex={0}
        style={{ animation: "ef-fade-in 0.35s ease-out" }}
      >
        {analyticsView === "statistics" ? (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ color: theme.muted, fontSize: 14 }}>Search funds by display name, short name, or ticker.</div>
              <input
                type="search"
                value={statsSearch}
                onChange={(e) => setStatsSearch(e.target.value)}
                placeholder="Search fund or ticker"
                className="platform-search-input"
                style={{ padding: "8px 14px", borderRadius: 12, border: `1px solid ${theme.line}`, fontSize: 14, background: "rgba(255,255,255,0.8)" }}
              />
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="platform-data-table" style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr>
                    {[
                      { key: "displayName", label: "Fund" },
                      { key: "ticker", label: "Ticker" },
                      { key: "annualReturn", label: "Return" },
                      { key: "annualVolatility", label: "Volatility" },
                      { key: "sharpe", label: "Sharpe*" },
                    ].map((col) => {
                      const active = statsSort.key === col.key;
                      return (
                        <th
                          key={col.key}
                          style={{
                            textAlign: col.key === "displayName" || col.key === "ticker" ? "left" : "right",
                            padding: "12px 10px",
                            borderBottom: `2px solid ${theme.line}`,
                            fontSize: 13,
                            color: theme.muted,
                          }}
                        >
                          <button
                            type="button"
                            className={active ? "platform-sort-button platform-sort-button-active" : "platform-sort-button"}
                            onClick={() => toggleStatsSort(col.key)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 500, color: active ? theme.ink : theme.muted }}
                          >
                            {col.label}
                            {active ? (statsSort.direction === "desc" ? " \u2193" : " \u2191") : ""}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedFundStatistics.map((row, ri) => (
                    <tr
                      key={row.index ?? ri}
                      className="ef-table-row-alt"
                      style={{ transition: "background 0.2s" }}
                    >
                      <td style={{ padding: "12px 10px" }}>
                        <div style={{ display: "grid", gap: 3 }}>
                          <strong style={{ fontSize: 14 }}>{safeStr(row.displayName)}</strong>
                          <span style={{ color: theme.muted, fontSize: 12 }}>{safeStr(row.shortName)}</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: "IBM Plex Mono, Consolas, monospace", color: theme.muted, padding: "12px 10px", fontSize: 13 }}>
                        {safeStr(row.ticker)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: safeNum(row.annualReturn) >= 0 ? theme.long : theme.gmvpShort, padding: "12px 10px" }}>
                        {formatPercent(row.annualReturn)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600, padding: "12px 10px" }}>
                        {formatPercent(row.annualVolatility)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: safeNum(row.sharpe) >= 0 ? theme.ink : theme.gmvpShort, padding: "12px 10px" }}>
                        {safeNum(row.sharpe).toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 12, color: theme.muted, fontSize: 13 }}>
                * Sharpe ratio shown as an approximation with risk-free rate set to 0%.
              </div>
            </div>
          </div>
        ) : (
          <div className="platform-matrix-shell" style={{ marginTop: 18 }}>
            <div style={{ overflowX: "auto" }}>
              <table className="platform-matrix-table" style={{ borderCollapse: "separate", borderSpacing: 2 }}>
                <thead>
                  <tr>
                    <th className="platform-matrix-corner" style={{ padding: "8px 10px", fontSize: 12 }}>Fund</th>
                    {safeArr(analyticsView === "correlation" ? correlationMatrix?.headers : covarianceMatrix?.headers).map((h) => (
                      <th key={h} style={{ padding: "8px 6px", fontSize: 12, textAlign: "center" }}>{tickerCode(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {safeArr(analyticsView === "correlation" ? correlationMatrix?.rows : covarianceMatrix?.rows).map((row, ri) => (
                    <tr key={safeStr(row?.rowLabel)}>
                      <th style={{ padding: "8px 10px", fontSize: 12, textAlign: "left", fontWeight: 600 }}>{tickerCode(safeStr(row?.rowLabel))}</th>
                      {safeArr(row?.values).map((val, ci) => {
                        const diagonal = ri === ci;
                        const colLabel =
                          safeArr(analyticsView === "correlation" ? correlationMatrix?.headers : covarianceMatrix?.headers)[ci] ?? "";
                        const tone = matrixCellStyle(val, diagonal, analyticsView === "correlation" ? "correlation" : "covariance");
                        return (
                          <td key={`${safeStr(row?.rowLabel)}-${colLabel}`} style={{ padding: 0 }}>
                            <button
                              type="button"
                              className="platform-matrix-cell"
                              style={{
                                ...tone,
                                display: "block",
                                width: "100%",
                                minWidth: 58,
                                minHeight: 36,
                                padding: "6px 4px",
                                fontSize: 12,
                                textAlign: "center",
                                border: "none",
                                cursor: "pointer",
                                borderRadius: 4,
                                transition: "transform 0.15s, box-shadow 0.15s",
                              }}
                              onMouseEnter={(e) => {
                                const pos = elementHoverPosition(e, "platform-matrix-shell");
                                setMatrixHover({ rowLabel: safeStr(row?.rowLabel), columnLabel: colLabel, value: safeNum(val), diagonal });
                                setMatrixTooltip({
                                  x: pos.x,
                                  y: pos.y,
                                  title: `${tickerCode(safeStr(row?.rowLabel))} vs ${tickerCode(colLabel)}`,
                                  lines: [
                                    analyticsView === "correlation" ? `Correlation: ${safeNum(val).toFixed(3)}` : `Covariance: ${safeNum(val).toFixed(4)}`,
                                    diagonal ? "Diagonal cell" : val < 0 ? "Negative co-movement" : "Positive co-movement",
                                  ],
                                });
                              }}
                              onMouseMove={(e) => {
                                const pos = elementHoverPosition(e, "platform-matrix-shell");
                                setMatrixTooltip((cur) => (cur ? { ...cur, x: pos.x, y: pos.y } : cur));
                              }}
                              onMouseLeave={() => setMatrixTooltip(null)}
                              onFocus={(e) => {
                                const pos = elementHoverPosition(e, "platform-matrix-shell");
                                setMatrixHover({ rowLabel: safeStr(row?.rowLabel), columnLabel: colLabel, value: safeNum(val), diagonal });
                                setMatrixTooltip({
                                  x: pos.x,
                                  y: pos.y,
                                  title: `${tickerCode(safeStr(row?.rowLabel))} vs ${tickerCode(colLabel)}`,
                                  lines: [
                                    analyticsView === "correlation" ? `Correlation: ${safeNum(val).toFixed(3)}` : `Covariance: ${safeNum(val).toFixed(4)}`,
                                    diagonal ? "Diagonal cell" : val < 0 ? "Negative co-movement" : "Positive co-movement",
                                  ],
                                });
                              }}
                              onBlur={() => setMatrixTooltip(null)}
                            >
                              {analyticsView === "correlation" ? safeNum(val).toFixed(3) : safeNum(val).toFixed(4)}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {matrixTooltip && (
              <div
                className="chart-tooltip"
                style={{
                  left: matrixTooltip.x,
                  top: matrixTooltip.y,
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  background: "rgba(255,255,255,0.92)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  border: `1px solid ${theme.line}`,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{matrixTooltip.title}</div>
                {matrixTooltip.lines.map((line) => (
                  <div key={line} style={{ fontSize: 13, lineHeight: 1.45 }}>{line}</div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <span className="platform-legend-chip">
                <i style={{ background: "rgba(208, 123, 42, 0.85)", display: "inline-block", width: 10, height: 10, borderRadius: 2, marginRight: 6 }} />
                Diagonal = variance / self-correlation
              </span>
              <span className="platform-legend-chip">
                <i style={{ background: "rgba(55, 109, 163, 0.85)", display: "inline-block", width: 10, height: 10, borderRadius: 2, marginRight: 6 }} />
                Positive co-movement
              </span>
              <span className="platform-legend-chip">
                <i style={{ background: "rgba(209, 73, 91, 0.85)", display: "inline-block", width: 10, height: 10, borderRadius: 2, marginRight: 6 }} />
                Negative co-movement
              </span>
            </div>

            <div style={{ marginTop: 12, color: theme.muted, fontSize: 13, lineHeight: 1.5 }}>
              Hover any matrix cell to inspect the pair. The diagonal cells represent each fund&apos;s own variance in the annualized covariance matrix and self-correlation in the correlation matrix.
            </div>
          </div>
        )}
      </div>
    </div>
  );

  /* ══════════════════════════════════════════�?     RENDER
     ══════════════════════════════════════════�?*/
  return (
    <section
      className="motion-surface"
      style={{
        color: theme.ink,
        background:
          "radial-gradient(circle at top left, rgba(255, 215, 153, 0.38), transparent 32%), linear-gradient(180deg, #fffdf8 0%, #f8efe0 100%)",
        border: `1px solid ${theme.line}`,
        borderRadius: 28,
        padding: 32,
        fontFamily: "IBM Plex Sans, Segoe UI, sans-serif",
        boxShadow: "0 16px 40px rgba(42, 57, 68, 0.10)",
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap", marginBottom: 24 }}>
        <div style={{ maxWidth: 620 }}>
          {sectionHeader(ICONS.chart, "Robot Adviser Part 1")}
          <h2 style={{ margin: "8px 0 12px", fontSize: 34, lineHeight: 1.05, fontWeight: 800 }}>
            Efficient Frontier Explorer
          </h2>
          <p style={{ margin: 0, color: theme.muted, lineHeight: 1.55, fontSize: 15 }}>
            Monthly fund prices were aligned to the shared {safeStr(metadata?.sample_start)} to{" "}
            {safeStr(metadata?.sample_end)} window, then converted to annualized expected returns and
            annualized covariance for the frontier.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(180px, 1fr))", gap: 14, minWidth: 320 }}>
          <div style={{ ...glassCard({ padding: 16 }) }}>
            {sectionHeader(ICONS.stats, "Sample")}
            <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700 }}>
              {safeNum(metadata?.price_observations)} price points
            </div>
            <div style={{ fontSize: 14, color: theme.muted }}>
              {safeNum(metadata?.return_observations)} monthly returns
            </div>
          </div>

          <div style={{ ...glassCard({ padding: 16 }) }}>
            {sectionHeader(ICONS.gmvp, "Long-only GMVP")}
            <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700 }}>
              {formatPercent(gmvpLong?.return)} return
            </div>
            <div style={{ fontSize: 14, color: theme.muted }}>
              {formatPercent(gmvpLong?.risk)} volatility
            </div>
          </div>
        </div>
      </div>

      {/* ── View mode pills ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        {[
          { mode: "both", label: "Compare both" },
          { mode: "short", label: "Short sales only" },
          { mode: "long", label: "Long-only only" },
        ].map((btn) => (
          <button
            key={btn.mode}
            type="button"
            style={pillStyle(viewMode === btn.mode)}
            onClick={() => setViewMode(btn.mode)}
            aria-pressed={viewMode === btn.mode}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* ── Chart card with animated gradient border ── */}
      <div
        className="dashboard-card chart-shell"
        style={{
          position: "relative",
          background: "rgba(255,255,255,0.6)",
          backdropFilter: "blur(8px)",
          borderRadius: 22,
          padding: 3,
        }}
      >
        {/* animated gradient border */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 22,
            padding: 1,
            background: "linear-gradient(90deg, #d9cdb3, #2f6cad, #5c9f45, #da7b24, #d9cdb3)",
            backgroundSize: "300% 100%",
            animation: "ef-gradient-border 8s linear infinite",
            zIndex: 0,
            maskImage: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "exclude",
            WebkitMaskImage: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
          }}
        />
        <div className="ef-chart-scroll" style={{ position: "relative", zIndex: 1, background: "rgba(255,254,251,0.95)", borderRadius: 20, padding: 10 }}>
          <svg
            width={chartSize.width}
            height={chartSize.height}
            viewBox={`0 0 ${chartSize.width} ${chartSize.height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Efficient frontier �?shows long-only and short-sales frontiers with individual fund scatter points"
            style={{ display: "block", width: "100%", height: "auto", maxWidth: chartSize.width, overflow: "visible" }}
          >
            <defs>
              <linearGradient id="ef-fill-short" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={theme.short} stopOpacity="0.18" />
                <stop offset="100%" stopColor={theme.short} stopOpacity="0.01" />
              </linearGradient>
              <linearGradient id="ef-fill-long" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={theme.long} stopOpacity="0.18" />
                <stop offset="100%" stopColor={theme.long} stopOpacity="0.01" />
              </linearGradient>
              <radialGradient id="ef-glow-sel">
                <stop offset="0%" stopColor={portfolioMode === "shortSalesAllowed" ? theme.short : theme.long} stopOpacity="0.5" />
                <stop offset="100%" stopColor={portfolioMode === "shortSalesAllowed" ? theme.short : theme.long} stopOpacity="0" />
              </radialGradient>
              <filter id="ef-blur-glow">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>

            <rect x="0" y="0" width={chartSize.width} height={chartSize.height} rx="18" fill="#fffefb" />

            {/* grid lines */}
            {yTicks.map((tick) => (
              <g key={`y-${tick}`}>
                <line
                  x1={chartSize.paddingLeft}
                  x2={chartSize.width - chartSize.paddingRight}
                  y1={yScale(tick)}
                  y2={yScale(tick)}
                  stroke={theme.line}
                  strokeDasharray="5 6"
                />
                <text x={chartSize.paddingLeft - 12} y={yScale(tick) + 4} textAnchor="end" fontSize="13" fill={theme.muted} fontWeight="500">
                  {formatPercent(tick)}
                </text>
              </g>
            ))}

            {xTicks.map((tick) => (
              <g key={`x-${tick}`}>
                <line
                  x1={xScale(tick)}
                  x2={xScale(tick)}
                  y1={chartSize.paddingTop}
                  y2={chartSize.height - chartSize.paddingBottom}
                  stroke={theme.line}
                  strokeDasharray="5 6"
                />
                <text x={xScale(tick)} y={chartSize.height - chartSize.paddingBottom + 24} textAnchor="middle" fontSize="13" fill={theme.muted} fontWeight="500">
                  {formatPercent(tick)}
                </text>
              </g>
            ))}

            {/* axes */}
            <line x1={chartSize.paddingLeft} x2={chartSize.paddingLeft} y1={chartSize.paddingTop} y2={baseline} stroke={theme.ink} strokeWidth="1.5" />
            <line x1={chartSize.paddingLeft} x2={chartSize.width - chartSize.paddingRight} y1={baseline} y2={baseline} stroke={theme.ink} strokeWidth="1.5" />

            {/* axis labels */}
            <text x={chartSize.width / 2} y={chartSize.height - 6} textAnchor="middle" fontSize="14" fill={theme.ink} fontWeight="700">
              Annualized Volatility
            </text>
            <text
              x="12"
              y={chartSize.height / 2}
              transform={`rotate(-90 12 ${chartSize.height / 2})`}
              textAnchor="middle"
              fontSize="13"
              fill={theme.ink}
              fontWeight="700"
            >
              Annualized Expected Return
            </text>

            {/* gradient fills under curves */}
            {displayedSeries.map((series) => {
              const areaD = areaFromPoints(series.points, xScale, yScale, baseline);
              return areaD ? (
                <path
                  key={`fill-${series.id}`}
                  d={areaD}
                  fill={`url(#ef-fill-${series.id})`}
                  style={{ transition: "opacity 0.5s ease" }}
                />
              ) : null;
            })}

            {/* frontier curves */}
            {displayedSeries.map((series) => (
              <path
                key={series.id}
                d={pathFromPoints(series.points, xScale, yScale)}
                fill="none"
                stroke={series.color}
                strokeWidth="4"
                strokeLinecap="round"
                style={{ transition: "d 0.4s ease" }}
              />
            ))}

            {/* asset dots */}
            {assets.map((asset) => (
              <g
                key={asset?.index}
                onMouseEnter={(e) => {
                  const pos = hoverPosition(e);
                  setTooltip({
                    x: pos.x,
                    y: pos.y,
                    title: `${safeNum(asset?.index)}. ${safeStr(asset?.shortName)}`,
                    lines: [
                      `Expected return: ${formatPercent(asset?.annualReturn)}`,
                      `Volatility: ${formatPercent(asset?.annualVolatility)}`,
                    ],
                  });
                }}
                onMouseMove={(e) => {
                  const pos = hoverPosition(e);
                  setTooltip((cur) => (cur ? { ...cur, x: pos.x, y: pos.y } : cur));
                }}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: "pointer" }}
              >
                <circle cx={xScale(safeNum(asset?.annualVolatility))} cy={yScale(safeNum(asset?.annualReturn))} r="7.5" fill={theme.asset} />
                <text
                  x={xScale(safeNum(asset?.annualVolatility)) + 10}
                  y={yScale(safeNum(asset?.annualReturn)) - 9}
                  fontSize="12"
                  fontWeight="700"
                  fill={theme.ink}
                >
                  {asset?.index}
                </text>
              </g>
            ))}

            {/* GMVP Short diamond */}
            <g
              onMouseEnter={(e) => {
                const pos = hoverPosition(e);
                setTooltip({
                  x: pos.x,
                  y: pos.y,
                  title: "GMVP (Short sales allowed)",
                  lines: [
                    `Expected return: ${formatPercent(gmvpShort?.return)}`,
                    `Volatility: ${formatPercent(gmvpShort?.risk)}`,
                  ],
                });
              }}
              onMouseMove={(e) => {
                const pos = hoverPosition(e);
                setTooltip((cur) => (cur ? { ...cur, x: pos.x, y: pos.y } : cur));
              }}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={gmvpShortX - 8}
                y={gmvpShortY - 8}
                width="16"
                height="16"
                fill={theme.gmvpShort}
                stroke="#ffffff"
                strokeWidth="2"
                transform={`rotate(45 ${gmvpShortX} ${gmvpShortY})`}
              />
            </g>

            {/* GMVP Long square */}
            <g
              onMouseEnter={(e) => {
                const pos = hoverPosition(e);
                setTooltip({
                  x: pos.x,
                  y: pos.y,
                  title: "GMVP (Long-only)",
                  lines: [
                    `Expected return: ${formatPercent(gmvpLong?.return)}`,
                    `Volatility: ${formatPercent(gmvpLong?.risk)}`,
                  ],
                });
              }}
              onMouseMove={(e) => {
                const pos = hoverPosition(e);
                setTooltip((cur) => (cur ? { ...cur, x: pos.x, y: pos.y } : cur));
              }}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={gmvpLongX - 8}
                y={gmvpLongY - 8}
                width="16"
                height="16"
                rx="4"
                fill={theme.gmvpLong}
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>

            {/* Selected portfolio with animated glow */}
            <g
              onMouseEnter={(e) => {
                const pos = hoverPosition(e);
                setTooltip({
                  x: pos.x,
                  y: pos.y,
                  title:
                    portfolioMode === "shortSalesAllowed"
                      ? "Selected short-sales portfolio"
                      : "Selected long-only portfolio",
                  lines: [
                    `Target return: ${formatPercent(selectedPortfolio?.target_return)}`,
                    `Expected return: ${formatPercent(selectedPortfolio?.return)}`,
                    `Volatility: ${formatPercent(selectedPortfolio?.risk)}`,
                  ],
                });
              }}
              onMouseMove={(e) => {
                const pos = hoverPosition(e);
                setTooltip((cur) => (cur ? { ...cur, x: pos.x, y: pos.y } : cur));
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* crosshair lines */}
              <line
                x1={selPtX}
                x2={selPtX}
                y1={baseline}
                y2={selPtY}
                stroke="rgba(29, 42, 52, 0.18)"
                strokeDasharray="6 6"
              />
              <line
                x1={chartSize.paddingLeft}
                x2={selPtX}
                y1={selPtY}
                y2={selPtY}
                stroke="rgba(29, 42, 52, 0.18)"
                strokeDasharray="6 6"
              />

              {/* animated glow */}
              <circle
                cx={selPtX}
                cy={selPtY}
                r="26"
                fill="url(#ef-glow-sel)"
                style={{ animation: "ef-glow-pulse 2.5s ease-in-out infinite" }}
              />

              {/* outer halo */}
              <circle
                cx={selPtX}
                cy={selPtY}
                r="18"
                fill={portfolioMode === "shortSalesAllowed" ? "rgba(47, 108, 173, 0.14)" : "rgba(92, 159, 69, 0.14)"}
              />
              {/* ring */}
              <circle
                cx={selPtX}
                cy={selPtY}
                r="10"
                fill="none"
                stroke={theme.selected}
                strokeWidth="2.5"
              />
              {/* center dot */}
              <circle
                cx={selPtX}
                cy={selPtY}
                r="4.5"
                fill={portfolioMode === "shortSalesAllowed" ? theme.short : theme.long}
              />
            </g>
          </svg>

          {/* tooltip with backdrop blur */}
          {tooltip && (
            <div
              className="chart-tooltip"
              style={{
                left: tooltip.x,
                top: tooltip.y,
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                background: "rgba(255,255,255,0.92)",
                borderRadius: 12,
                padding: "10px 14px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                border: `1px solid ${theme.line}`,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{tooltip.title}</div>
              {tooltip.lines.map((line) => (
                <div key={line} style={{ fontSize: 13, lineHeight: 1.45 }}>{line}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Insight cards ── */}
      <div className="insight-grid" style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
        {[
          {
            icon: ICONS.chart,
            label: "Frontier position",
            value: <AnimatedValue value={`${boundedIndex + 1}`} style={{ fontWeight: 700, fontSize: 28 }} />,
            detail: `Point ${boundedIndex + 1} of ${activeFrontier.length} on the selected frontier.`,
            progress: frontierProgress,
          },
          {
            icon: ICONS.stats,
            label: "Positive exposure",
            value: <AnimatedValue value={formatPercent(activeRiskBudget)} style={{ fontWeight: 700, fontSize: 28 }} />,
            detail: "Sum of positive portfolio weights for the currently selected point.",
          },
          {
            icon: ICONS.inspect,
            label: "Top holdings",
            value: <AnimatedValue value={`${selectedTopRows.length}`} style={{ fontWeight: 700, fontSize: 28 }} />,
            detail: selectedTopRows.map((r) => `${r.fund} ${formatPercent(r.weight)}`).join(", "),
          },
        ].map((card) => (
          <div key={card.label} className="insight-card" style={{ ...glassCard({ padding: 18 }) }}>
            {sectionHeader(card.icon, card.label)}
            {card.value}
            <div style={{ marginTop: 6, color: theme.muted, lineHeight: 1.45, fontSize: 13 }}>{card.detail}</div>
            {card.progress != null && (
              <div className="frontier-progress-track" style={{ marginTop: 12, height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div
                  className="frontier-progress-fill"
                  style={{
                    width: `${card.progress * 100}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #5c9f45, #2f6cad)",
                    borderRadius: 3,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Portfolio Inspector + GMVP / Legend ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1.15fr) minmax(280px, 0.85fr)", gap: 20, marginTop: 24 }}>
        {/* Portfolio Inspector */}
        <div style={{ ...glassCard({ background: "rgba(255,255,255,0.7)" }) }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div>
              {sectionHeader(ICONS.inspect, "Portfolio Inspector")}
              <h3 style={{ margin: "8px 0 6px", fontSize: 24, fontWeight: 700 }}>
                {portfolioMode === "shortSalesAllowed" ? "Short-sales frontier" : "Long-only frontier"}
              </h3>
              <div style={{ color: theme.muted, fontSize: 14 }}>
                Drag the slider to inspect a point on the selected frontier and its fund weights.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignContent: "flex-start" }}>
              <button
                type="button"
                style={pillStyle(portfolioMode === "longOnly")}
                onClick={() => { setPortfolioMode("longOnly"); setPortfolioIndex(0); }}
                aria-pressed={portfolioMode === "longOnly"}
              >
                Long-only
              </button>
              <button
                type="button"
                style={pillStyle(portfolioMode === "shortSalesAllowed")}
                onClick={() => { setPortfolioMode("shortSalesAllowed"); setPortfolioIndex(0); }}
                aria-pressed={portfolioMode === "shortSalesAllowed"}
              >
                Short sales
              </button>
            </div>
          </div>

          {/* Slider with floating tooltip */}
          <div style={{ marginTop: 22, position: "relative", paddingTop: 30 }} ref={sliderRef}>
            <SliderTooltip value={boundedIndex} min={0} max={Math.max(activeFrontier.length - 1, 0)} containerRef={sliderRef} />
            <input
              type="range"
              min="0"
              max={Math.max(activeFrontier.length - 1, 0)}
              value={boundedIndex}
              onChange={(e) => setPortfolioIndex(Number(e.target.value))}
              className="ef-slider-track"
              aria-label="Portfolio position on efficient frontier"
              aria-valuetext={selectedPortfolio
                ? `Portfolio ${boundedIndex + 1} of ${activeFrontier.length}: return ${formatPercent(selectedPortfolio.return)}, volatility ${formatPercent(selectedPortfolio.risk)}`
                : `Portfolio ${boundedIndex + 1} of ${activeFrontier.length}`}
            />
          </div>

          {/* progress bar */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: theme.muted, fontSize: 13 }}>
              <span>{portfolioMode === "shortSalesAllowed" ? "Short-sales path" : "Long-only path"}</span>
              <span>{formatPercent(frontierProgress, 0)} explored</span>
            </div>
            <div style={{ marginTop: 8, height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${frontierProgress * 100}%`, height: "100%", background: "linear-gradient(90deg, #5c9f45, #2f6cad)", borderRadius: 3, transition: "width 0.3s ease" }} />
            </div>
          </div>

          {/* stat cards */}
          <div className="stat-grid" style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { label: "Target return", val: formatPercent(selectedPortfolio?.target_return) },
              { label: "Expected return", val: formatPercent(selectedPortfolio?.return) },
              { label: "Volatility", val: formatPercent(selectedPortfolio?.risk) },
            ].map((s) => (
              <div key={s.label} className="stat-card" style={{ background: "rgba(255,248,234,0.5)", borderRadius: 14, padding: 12, border: `1px solid ${theme.line}` }}>
                <div style={{ color: theme.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>{s.label}</div>
                <div style={{ marginTop: 6, fontWeight: 700, fontSize: 16, transition: "all 0.3s ease" }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* weights table */}
          <div style={{ marginTop: 18, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", paddingBottom: 10, fontSize: 13, color: theme.muted, fontWeight: 600 }}>Fund</th>
                  <th style={{ textAlign: "right", paddingBottom: 10, fontSize: 13, color: theme.muted, fontWeight: 600 }}>Weight</th>
                </tr>
              </thead>
              <tbody>
                {selectedRows.map((row, ri) => (
                  <tr
                    key={row.fund}
                    className="ef-table-row-alt"
                    style={{ borderTop: `1px solid ${theme.line}`, transition: "background 0.2s" }}
                  >
                    <td style={{ padding: "10px 0", fontSize: 14 }}>{row.fund}</td>
                    <td
                      style={{
                        padding: "10px 0",
                        textAlign: "right",
                        color: row.weight < 0 ? theme.gmvpShort : theme.ink,
                        fontWeight: 600,
                        transition: "color 0.3s",
                      }}
                    >
                      {formatPercent(row.weight)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column: GMVP + Legend */}
        <div style={{ display: "grid", gap: 20 }}>
          <div style={{ ...glassCard({ background: "rgba(255,255,255,0.7)" }) }}>
            {sectionHeader(ICONS.gmvp, "GMVP Snapshot")}
            <h3 style={{ margin: "8px 0 14px", fontSize: 22, fontWeight: 700 }}>What changes when short sales are allowed?</h3>

            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ background: "rgba(255,248,234,0.7)", borderRadius: 16, padding: 14 }}>
                <div style={{ fontWeight: 700, color: theme.gmvpShort, marginBottom: 6 }}>Short-sales GMVP</div>
                <div style={{ fontSize: 14, color: theme.muted, marginBottom: 8 }}>
                  Return {formatPercent(gmvpShort?.return)} | Volatility {formatPercent(gmvpShort?.risk)}
                </div>
                {topShortWeights.map((row) => (
                  <div key={row.fund} style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 14 }}>
                    <span>{row.fund}</span>
                    <strong>{formatPercent(row.weight)}</strong>
                  </div>
                ))}
              </div>

              <div style={{ background: "rgba(255,248,234,0.7)", borderRadius: 16, padding: 14 }}>
                <div style={{ fontWeight: 700, color: theme.gmvpLong, marginBottom: 6 }}>Long-only GMVP</div>
                <div style={{ fontSize: 14, color: theme.muted, marginBottom: 8 }}>
                  Return {formatPercent(gmvpLong?.return)} | Volatility {formatPercent(gmvpLong?.risk)}
                </div>
                {topLongWeights.map((row) => (
                  <div key={row.fund} style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 14 }}>
                    <span>{row.fund}</span>
                    <strong>{formatPercent(row.weight)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ ...glassCard({ background: "rgba(255,255,255,0.7)" }) }}>
            {sectionHeader(ICONS.legend, "Fund Legend")}
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {assets.map((asset) => (
                <div key={asset?.index} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 10, alignItems: "center" }}>
                  <strong style={{ fontSize: 14, color: theme.asset, textAlign: "center" }}>{asset?.index}</strong>
                  <span style={{ fontSize: 14 }}>{safeStr(asset?.displayName)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Analytics Panel ── */}
      {analyticsPanel}
    </section>
  );
}
