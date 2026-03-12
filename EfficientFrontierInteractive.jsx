import React, { useMemo, useState } from "react";
import frontierData from "./part1_outputs/efficient_frontier_data.json";

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

const buttonStyle = (active) => ({
  padding: "10px 14px",
  borderRadius: 999,
  border: `1px solid ${active ? theme.ink : theme.line}`,
  background: active ? theme.ink : "#ffffff",
  color: active ? "#ffffff" : theme.ink,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
});

const formatPercent = (value, digits = 2) => `${(value * 100).toFixed(digits)}%`;

function makeTicks(min, max, count = 6) {
  if (min === max) {
    return [min];
  }
  return Array.from({ length: count }, (_, index) => min + ((max - min) * index) / (count - 1));
}

function pathFromPoints(points, xScale, yScale) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xScale(point.risk)} ${yScale(point.return)}`)
    .join(" ");
}

function weightsToRows(weightMap) {
  return Object.entries(weightMap)
    .map(([fund, weight]) => ({ fund, weight }))
    .sort((left, right) => Math.abs(right.weight) - Math.abs(left.weight));
}

function hoverPosition(event) {
  const svg = event.currentTarget.ownerSVGElement ?? event.currentTarget;
  const rect = svg.getBoundingClientRect();
  return {
    x: event.clientX - rect.left + 12,
    y: event.clientY - rect.top - 12,
  };
}

export default function EfficientFrontierInteractive({ data = frontierData }) {
  const [viewMode, setViewMode] = useState("both");
  const [portfolioMode, setPortfolioMode] = useState("longOnly");
  const [portfolioIndex, setPortfolioIndex] = useState(0);
  const [tooltip, setTooltip] = useState(null);

  const assets = data.funds;
  const shortFrontier = data.frontiers.shortSalesAllowed;
  const longFrontier = data.frontiers.longOnly;
  const gmvpShort = data.gmvp.shortSalesAllowed;
  const gmvpLong = data.gmvp.longOnly;

  const activeFrontier = portfolioMode === "shortSalesAllowed" ? shortFrontier : longFrontier;
  const boundedIndex = Math.min(portfolioIndex, activeFrontier.length - 1);
  const selectedPortfolio = activeFrontier[boundedIndex];

  const displayedSeries = useMemo(() => {
    if (viewMode === "short") {
      return [{ id: "short", label: "Short sales allowed", color: theme.short, points: shortFrontier }];
    }
    if (viewMode === "long") {
      return [{ id: "long", label: "Long-only", color: theme.long, points: longFrontier }];
    }
    return [
      { id: "short", label: "Short sales allowed", color: theme.short, points: shortFrontier },
      { id: "long", label: "Long-only", color: theme.long, points: longFrontier },
    ];
  }, [longFrontier, shortFrontier, viewMode]);

  const chartDomain = useMemo(() => {
    const frontierPoints = displayedSeries.flatMap((series) => series.points);
    const gmvpPoints = [gmvpShort, gmvpLong];
    const allPoints = [...frontierPoints, ...assets, ...gmvpPoints];

    const risks = allPoints.map((point) => point.risk ?? point.annualVolatility);
    const returns = allPoints.map((point) => point.return ?? point.annualReturn);

    const minRisk = Math.min(...risks);
    const maxRisk = Math.max(...risks);
    const minReturn = Math.min(...returns);
    const maxReturn = Math.max(...returns);

    return {
      riskMin: Math.max(0, minRisk - 0.01),
      riskMax: maxRisk + 0.02,
      returnMin: minReturn - 0.03,
      returnMax: maxReturn + 0.03,
    };
  }, [assets, displayedSeries, gmvpLong, gmvpShort]);

  const xScale = (value) => {
    const { paddingLeft, width, paddingRight } = chartSize;
    const usable = width - paddingLeft - paddingRight;
    return (
      paddingLeft +
      ((value - chartDomain.riskMin) / (chartDomain.riskMax - chartDomain.riskMin || 1)) * usable
    );
  };

  const yScale = (value) => {
    const { paddingTop, height, paddingBottom } = chartSize;
    const usable = height - paddingTop - paddingBottom;
    return (
      height -
      paddingBottom -
      ((value - chartDomain.returnMin) / (chartDomain.returnMax - chartDomain.returnMin || 1)) * usable
    );
  };

  const xTicks = makeTicks(chartDomain.riskMin, chartDomain.riskMax, 6);
  const yTicks = makeTicks(chartDomain.returnMin, chartDomain.returnMax, 6);
  const selectedRows = weightsToRows(selectedPortfolio.weights);

  const topShortWeights = weightsToRows(gmvpShort.weights).slice(0, 3);
  const topLongWeights = weightsToRows(gmvpLong.weights).slice(0, 3);

  return (
    <section
      style={{
        color: theme.ink,
        background:
          "radial-gradient(circle at top left, rgba(255, 215, 153, 0.38), transparent 32%), linear-gradient(180deg, #fffdf8 0%, #f8efe0 100%)",
        border: `1px solid ${theme.line}`,
        borderRadius: 28,
        padding: 28,
        fontFamily: "IBM Plex Sans, Segoe UI, sans-serif",
        boxShadow: "0 16px 40px rgba(42, 57, 68, 0.10)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 20,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div style={{ maxWidth: 620 }}>
          <p style={{ margin: 0, letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 12, color: theme.muted }}>
            Robot Adviser Part 1
          </p>
          <h2 style={{ margin: "8px 0 10px", fontSize: 34, lineHeight: 1.05 }}>
            Efficient Frontier Explorer
          </h2>
          <p style={{ margin: 0, color: theme.muted, lineHeight: 1.5 }}>
            Monthly fund prices were aligned to the shared {data.metadata.sample_start} to{" "}
            {data.metadata.sample_end} window, then converted to annualized expected returns and
            annualized covariance for the frontier.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(180px, 1fr))",
            gap: 12,
            minWidth: 320,
          }}
        >
          <div style={{ background: theme.panel, borderRadius: 18, padding: 14, border: `1px solid ${theme.line}` }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.muted }}>
              Sample
            </div>
            <div style={{ marginTop: 8, fontSize: 15, fontWeight: 600 }}>
              {data.metadata.price_observations} price points
            </div>
            <div style={{ fontSize: 14, color: theme.muted }}>
              {data.metadata.return_observations} monthly returns
            </div>
          </div>

          <div style={{ background: theme.panel, borderRadius: 18, padding: 14, border: `1px solid ${theme.line}` }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.muted }}>
              Long-only GMVP
            </div>
            <div style={{ marginTop: 8, fontSize: 15, fontWeight: 600 }}>
              {formatPercent(gmvpLong.return)} return
            </div>
            <div style={{ fontSize: 14, color: theme.muted }}>
              {formatPercent(gmvpLong.risk)} volatility
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <button type="button" style={buttonStyle(viewMode === "both")} onClick={() => setViewMode("both")}>
          Compare both
        </button>
        <button type="button" style={buttonStyle(viewMode === "short")} onClick={() => setViewMode("short")}>
          Short sales only
        </button>
        <button type="button" style={buttonStyle(viewMode === "long")} onClick={() => setViewMode("long")}>
          Long-only only
        </button>
      </div>

      <div
        style={{
          position: "relative",
          overflowX: "auto",
          background: "rgba(255,255,255,0.54)",
          borderRadius: 22,
          border: `1px solid ${theme.line}`,
          padding: 10,
        }}
      >
        <svg width={chartSize.width} height={chartSize.height} role="img" aria-label="Efficient frontier chart">
          <rect x="0" y="0" width={chartSize.width} height={chartSize.height} rx="18" fill="#fffefb" />

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
              <text x={chartSize.paddingLeft - 12} y={yScale(tick) + 4} textAnchor="end" fontSize="12" fill={theme.muted}>
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
              <text
                x={xScale(tick)}
                y={chartSize.height - chartSize.paddingBottom + 24}
                textAnchor="middle"
                fontSize="12"
                fill={theme.muted}
              >
                {formatPercent(tick)}
              </text>
            </g>
          ))}

          <line
            x1={chartSize.paddingLeft}
            x2={chartSize.paddingLeft}
            y1={chartSize.paddingTop}
            y2={chartSize.height - chartSize.paddingBottom}
            stroke={theme.ink}
          />
          <line
            x1={chartSize.paddingLeft}
            x2={chartSize.width - chartSize.paddingRight}
            y1={chartSize.height - chartSize.paddingBottom}
            y2={chartSize.height - chartSize.paddingBottom}
            stroke={theme.ink}
          />

          <text
            x={chartSize.width / 2}
            y={chartSize.height - 8}
            textAnchor="middle"
            fontSize="13"
            fill={theme.ink}
            fontWeight="600"
          >
            Annualized Volatility
          </text>
          <text
            x="18"
            y={chartSize.height / 2}
            transform={`rotate(-90 18 ${chartSize.height / 2})`}
            textAnchor="middle"
            fontSize="13"
            fill={theme.ink}
            fontWeight="600"
          >
            Annualized Expected Return
          </text>

          {displayedSeries.map((series) => (
            <path
              key={series.id}
              d={pathFromPoints(series.points, xScale, yScale)}
              fill="none"
              stroke={series.color}
              strokeWidth="4"
              strokeLinecap="round"
            />
          ))}

          {assets.map((asset) => (
            <g
              key={asset.index}
              onMouseEnter={(event) => {
                const position = hoverPosition(event);
                setTooltip({
                  x: position.x,
                  y: position.y,
                  title: `${asset.index}. ${asset.shortName}`,
                  lines: [
                    `Expected return: ${formatPercent(asset.annualReturn)}`,
                    `Volatility: ${formatPercent(asset.annualVolatility)}`,
                  ],
                });
              }}
              onMouseMove={(event) => {
                const position = hoverPosition(event);
                setTooltip((current) => (current ? { ...current, x: position.x, y: position.y } : current));
              }}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: "pointer" }}
            >
              <circle cx={xScale(asset.annualVolatility)} cy={yScale(asset.annualReturn)} r="7.5" fill={theme.asset} />
              <text
                x={xScale(asset.annualVolatility) + 10}
                y={yScale(asset.annualReturn) - 9}
                fontSize="12"
                fontWeight="700"
                fill={theme.ink}
              >
                {asset.index}
              </text>
            </g>
          ))}

          <g
            onMouseEnter={(event) => {
              const position = hoverPosition(event);
              setTooltip({
                x: position.x,
                y: position.y,
                title: "GMVP (Short sales allowed)",
                lines: [
                  `Expected return: ${formatPercent(gmvpShort.return)}`,
                  `Volatility: ${formatPercent(gmvpShort.risk)}`,
                ],
              });
            }}
            onMouseMove={(event) => {
              const position = hoverPosition(event);
              setTooltip((current) => (current ? { ...current, x: position.x, y: position.y } : current));
            }}
            onMouseLeave={() => setTooltip(null)}
            style={{ cursor: "pointer" }}
          >
            <text x={xScale(gmvpShort.risk)} y={yScale(gmvpShort.return) + 6} textAnchor="middle" fontSize="22" fill={theme.gmvpShort}>
              ★
            </text>
          </g>

          <g
            onMouseEnter={(event) => {
              const position = hoverPosition(event);
              setTooltip({
                x: position.x,
                y: position.y,
                title: "GMVP (Long-only)",
                lines: [
                  `Expected return: ${formatPercent(gmvpLong.return)}`,
                  `Volatility: ${formatPercent(gmvpLong.risk)}`,
                ],
              });
            }}
            onMouseMove={(event) => {
              const position = hoverPosition(event);
              setTooltip((current) => (current ? { ...current, x: position.x, y: position.y } : current));
            }}
            onMouseLeave={() => setTooltip(null)}
            style={{ cursor: "pointer" }}
          >
            <text x={xScale(gmvpLong.risk)} y={yScale(gmvpLong.return) + 6} textAnchor="middle" fontSize="22" fill={theme.gmvpLong}>
              ★
            </text>
          </g>

          <g
            onMouseEnter={(event) => {
              const position = hoverPosition(event);
              setTooltip({
                x: position.x,
                y: position.y,
                title:
                  portfolioMode === "shortSalesAllowed"
                    ? "Selected short-sales portfolio"
                    : "Selected long-only portfolio",
                lines: [
                  `Target return: ${formatPercent(selectedPortfolio.target_return)}`,
                  `Expected return: ${formatPercent(selectedPortfolio.return)}`,
                  `Volatility: ${formatPercent(selectedPortfolio.risk)}`,
                ],
              });
            }}
            onMouseMove={(event) => {
              const position = hoverPosition(event);
              setTooltip((current) => (current ? { ...current, x: position.x, y: position.y } : current));
            }}
            onMouseLeave={() => setTooltip(null)}
          >
            <circle
              cx={xScale(selectedPortfolio.risk)}
              cy={yScale(selectedPortfolio.return)}
              r="10"
              fill="none"
              stroke={theme.selected}
              strokeWidth="2.5"
            />
            <circle
              cx={xScale(selectedPortfolio.risk)}
              cy={yScale(selectedPortfolio.return)}
              r="4.5"
              fill={portfolioMode === "shortSalesAllowed" ? theme.short : theme.long}
            />
          </g>
        </svg>

        {tooltip && (
          <div
            style={{
              position: "absolute",
              left: tooltip.x,
              top: tooltip.y,
              minWidth: 190,
              background: "rgba(23, 33, 40, 0.94)",
              color: "#ffffff",
              borderRadius: 14,
              padding: "10px 12px",
              pointerEvents: "none",
              boxShadow: "0 12px 26px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{tooltip.title}</div>
            {tooltip.lines.map((line) => (
              <div key={line} style={{ fontSize: 13, lineHeight: 1.45 }}>
                {line}
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1.15fr) minmax(280px, 0.85fr)",
          gap: 18,
          marginTop: 20,
        }}
      >
        <div style={{ background: "#ffffff", borderRadius: 22, border: `1px solid ${theme.line}`, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.muted }}>
                Portfolio Inspector
              </div>
              <h3 style={{ margin: "8px 0 4px", fontSize: 24 }}>
                {portfolioMode === "shortSalesAllowed" ? "Short-sales frontier" : "Long-only frontier"}
              </h3>
              <div style={{ color: theme.muted }}>
                Drag the slider to inspect a point on the selected frontier and its fund weights.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignContent: "flex-start" }}>
              <button
                type="button"
                style={buttonStyle(portfolioMode === "longOnly")}
                onClick={() => {
                  setPortfolioMode("longOnly");
                  setPortfolioIndex(0);
                }}
              >
                Long-only
              </button>
              <button
                type="button"
                style={buttonStyle(portfolioMode === "shortSalesAllowed")}
                onClick={() => {
                  setPortfolioMode("shortSalesAllowed");
                  setPortfolioIndex(0);
                }}
              >
                Short sales
              </button>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <input
              type="range"
              min="0"
              max={Math.max(activeFrontier.length - 1, 0)}
              value={boundedIndex}
              onChange={(event) => setPortfolioIndex(Number(event.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(120px, 1fr))",
              gap: 12,
            }}
          >
            <div style={{ background: theme.panel, borderRadius: 16, padding: 12 }}>
              <div style={{ color: theme.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                Target return
              </div>
              <div style={{ marginTop: 6, fontWeight: 700 }}>{formatPercent(selectedPortfolio.target_return)}</div>
            </div>
            <div style={{ background: theme.panel, borderRadius: 16, padding: 12 }}>
              <div style={{ color: theme.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                Expected return
              </div>
              <div style={{ marginTop: 6, fontWeight: 700 }}>{formatPercent(selectedPortfolio.return)}</div>
            </div>
            <div style={{ background: theme.panel, borderRadius: 16, padding: 12 }}>
              <div style={{ color: theme.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                Volatility
              </div>
              <div style={{ marginTop: 6, fontWeight: 700 }}>{formatPercent(selectedPortfolio.risk)}</div>
            </div>
          </div>

          <div style={{ marginTop: 18, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", paddingBottom: 10, fontSize: 13, color: theme.muted }}>Fund</th>
                  <th style={{ textAlign: "right", paddingBottom: 10, fontSize: 13, color: theme.muted }}>Weight</th>
                </tr>
              </thead>
              <tbody>
                {selectedRows.map((row) => (
                  <tr key={row.fund} style={{ borderTop: `1px solid ${theme.line}` }}>
                    <td style={{ padding: "10px 0" }}>{row.fund}</td>
                    <td
                      style={{
                        padding: "10px 0",
                        textAlign: "right",
                        color: row.weight < 0 ? theme.gmvpShort : theme.ink,
                        fontWeight: 600,
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

        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ background: "#ffffff", borderRadius: 22, border: `1px solid ${theme.line}`, padding: 18 }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.muted }}>
              GMVP Snapshot
            </div>
            <h3 style={{ margin: "8px 0 12px", fontSize: 24 }}>What changes when short sales are allowed?</h3>

            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ background: theme.panel, borderRadius: 16, padding: 14 }}>
                <div style={{ fontWeight: 700, color: theme.gmvpShort, marginBottom: 6 }}>Short-sales GMVP</div>
                <div style={{ fontSize: 14, color: theme.muted, marginBottom: 8 }}>
                  Return {formatPercent(gmvpShort.return)} | Volatility {formatPercent(gmvpShort.risk)}
                </div>
                {topShortWeights.map((row) => (
                  <div key={row.fund} style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span>{row.fund}</span>
                    <strong>{formatPercent(row.weight)}</strong>
                  </div>
                ))}
              </div>

              <div style={{ background: theme.panel, borderRadius: 16, padding: 14 }}>
                <div style={{ fontWeight: 700, color: theme.gmvpLong, marginBottom: 6 }}>Long-only GMVP</div>
                <div style={{ fontSize: 14, color: theme.muted, marginBottom: 8 }}>
                  Return {formatPercent(gmvpLong.return)} | Volatility {formatPercent(gmvpLong.risk)}
                </div>
                {topLongWeights.map((row) => (
                  <div key={row.fund} style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span>{row.fund}</span>
                    <strong>{formatPercent(row.weight)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: "#ffffff", borderRadius: 22, border: `1px solid ${theme.line}`, padding: 18 }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.muted }}>
              Fund Legend
            </div>
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {assets.map((asset) => (
                <div key={asset.index} style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: 10 }}>
                  <strong>{asset.index}</strong>
                  <span>{asset.displayName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
