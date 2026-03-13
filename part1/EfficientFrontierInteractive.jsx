import React, { useEffect, useMemo, useState } from "react";
import frontierData from "../part1_outputs/efficient_frontier_data.json";
import covarianceAnnualizedCsv from "../part1_outputs/covariance_matrix_annualized.csv?raw";

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

function elementHoverPosition(event, containerClassName) {
  const container =
    event.currentTarget.closest(`.${containerClassName}`) ?? event.currentTarget.parentElement;
  const rect = container.getBoundingClientRect();
  return {
    x: event.clientX - rect.left + 14,
    y: event.clientY - rect.top - 14,
  };
}

function tickerCode(shortName) {
  return tickerMap[shortName] ?? shortName.toUpperCase().replace(/[^\w]+/g, "_").slice(0, 10);
}

function parseMatrixCsv(raw) {
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(",").slice(1);
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(",");
    return {
      rowLabel: cells[0],
      values: cells.slice(1).map((value) => Number(value)),
    };
  });
  return { headers, rows };
}

function buildCorrelationMatrix(covarianceMatrix, funds) {
  const volatilityMap = Object.fromEntries(
    funds.map((fund) => [fund.shortName, fund.annualVolatility]),
  );

  return {
    headers: covarianceMatrix.headers,
    rows: covarianceMatrix.rows.map((row) => ({
      rowLabel: row.rowLabel,
      values: row.values.map((value, columnIndex) => {
        const columnLabel = covarianceMatrix.headers[columnIndex];
        const denominator =
          (volatilityMap[row.rowLabel] ?? 0) * (volatilityMap[columnLabel] ?? 0);
        return denominator ? value / denominator : 0;
      }),
    })),
  };
}

export default function EfficientFrontierInteractive({
  data = frontierData,
  onChatContextChange,
}) {
  const [viewMode, setViewMode] = useState("both");
  const [portfolioMode, setPortfolioMode] = useState("longOnly");
  const [portfolioIndex, setPortfolioIndex] = useState(0);
  const [tooltip, setTooltip] = useState(null);
  const [analyticsView, setAnalyticsView] = useState("statistics");
  const [statsSort, setStatsSort] = useState({ key: "annualReturn", direction: "desc" });
  const [statsSearch, setStatsSearch] = useState("");
  const [matrixHover, setMatrixHover] = useState(null);
  const [matrixTooltip, setMatrixTooltip] = useState(null);

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

    return {
      riskMin: Math.max(0, Math.min(...risks) - 0.01),
      riskMax: Math.max(...risks) + 0.02,
      returnMin: Math.min(...returns) - 0.03,
      returnMax: Math.max(...returns) + 0.03,
    };
  }, [assets, displayedSeries, gmvpLong, gmvpShort]);

  const xScale = (value) => {
    const { paddingLeft, width, paddingRight } = chartSize;
    const usable = width - paddingLeft - paddingRight;
    return paddingLeft + ((value - chartDomain.riskMin) / (chartDomain.riskMax - chartDomain.riskMin || 1)) * usable;
  };

  const yScale = (value) => {
    const { paddingTop, height, paddingBottom } = chartSize;
    const usable = height - paddingTop - paddingBottom;
    return height - paddingBottom - ((value - chartDomain.returnMin) / (chartDomain.returnMax - chartDomain.returnMin || 1)) * usable;
  };

  const xTicks = makeTicks(chartDomain.riskMin, chartDomain.riskMax, 6);
  const yTicks = makeTicks(chartDomain.returnMin, chartDomain.returnMax, 6);
  const selectedRows = weightsToRows(selectedPortfolio.weights);
  const topShortWeights = weightsToRows(gmvpShort.weights).slice(0, 3);
  const topLongWeights = weightsToRows(gmvpLong.weights).slice(0, 3);
  const selectedTopRows = selectedRows.filter((row) => Math.abs(row.weight) > 1e-4).slice(0, 4);
  const frontierProgress = activeFrontier.length > 1 ? boundedIndex / (activeFrontier.length - 1) : 0;
  const activeRiskBudget = selectedRows
    .filter((row) => row.weight > 1e-5)
    .reduce((sum, row) => sum + row.weight, 0);

  const gmvpShortX = xScale(gmvpShort.risk);
  const gmvpShortY = yScale(gmvpShort.return);
  const gmvpLongX = xScale(gmvpLong.risk);
  const gmvpLongY = yScale(gmvpLong.return);

  const covarianceMatrix = useMemo(() => parseMatrixCsv(covarianceAnnualizedCsv), []);
  const correlationMatrix = useMemo(
    () => buildCorrelationMatrix(covarianceMatrix, assets),
    [assets, covarianceMatrix],
  );

  const fundStatisticsRows = useMemo(
    () =>
      assets.map((asset) => ({
        ...asset,
        ticker: tickerCode(asset.shortName),
        sharpe: asset.annualVolatility ? asset.annualReturn / asset.annualVolatility : 0,
      })),
    [assets],
  );

  const sortedFundStatistics = useMemo(() => {
    const direction = statsSort.direction === "asc" ? 1 : -1;
    const search = statsSearch.trim().toLowerCase();
    const filteredRows = search
      ? fundStatisticsRows.filter((row) =>
          [row.displayName, row.shortName, row.ticker]
            .map((value) => value.toLowerCase())
            .some((value) => value.includes(search)),
        )
      : fundStatisticsRows;

    return [...filteredRows].sort((left, right) => {
      const leftValue = left[statsSort.key];
      const rightValue = right[statsSort.key];

      if (typeof leftValue === "string" && typeof rightValue === "string") {
        return leftValue.localeCompare(rightValue) * direction;
      }

      return ((leftValue ?? 0) - (rightValue ?? 0)) * direction;
    });
  }, [fundStatisticsRows, statsSearch, statsSort]);

  const covarianceMaxAbs = useMemo(
    () =>
      Math.max(
        ...covarianceMatrix.rows.flatMap((row) => row.values.map((value) => Math.abs(value))),
        1,
      ),
    [covarianceMatrix],
  );

  const activeAnalyticsMeta = useMemo(() => {
    if (analyticsView === "statistics") {
      const topSharpe = [...fundStatisticsRows].sort((a, b) => b.sharpe - a.sharpe)[0];
      const highestReturn = [...fundStatisticsRows].sort((a, b) => b.annualReturn - a.annualReturn)[0];
      return {
        title: `Annualized Fund Statistics (${data.metadata.return_observations} months real data)`,
        copy:
          "Use the annualized return, volatility, and Sharpe ratio to compare the 10-fund universe before moving to the frontier itself.",
        highlights: [
          {
            label: "Highest return",
            value: `${highestReturn.shortName} ${formatPercent(highestReturn.annualReturn)}`,
          },
          {
            label: "Best Sharpe",
            value: `${topSharpe.shortName} ${topSharpe.sharpe.toFixed(3)}`,
          },
          {
            label: "Sort mode",
            value: `${statsSort.key} ${statsSort.direction}`,
          },
        ],
      };
    }

    if (analyticsView === "correlation") {
      return {
        title: `Correlation Matrix (Annualized, ${data.metadata.return_observations} months)`,
        copy:
          "Correlation highlights which funds tend to move together and where diversification is stronger or weaker inside the shared sample window.",
        highlights: [
          { label: "Matrix size", value: `${correlationMatrix.headers.length} x ${correlationMatrix.headers.length}` },
          {
            label: "Hover insight",
            value: matrixHover
              ? `${tickerCode(matrixHover.rowLabel)} vs ${tickerCode(matrixHover.columnLabel)} ${matrixHover.value.toFixed(3)}`
              : "Hover a cell",
          },
          { label: "Sample window", value: `${data.metadata.sample_start} to ${data.metadata.sample_end}` },
        ],
      };
    }

    return {
      title: "Variance-Covariance Matrix (Annualized)",
      copy:
        "Variance sits on the diagonal and pairwise annualized covariance fills the off-diagonal cells, showing how fund risks interact inside optimization.",
      highlights: [
        { label: "Matrix size", value: `${covarianceMatrix.headers.length} x ${covarianceMatrix.headers.length}` },
        {
          label: "Hover insight",
          value: matrixHover
            ? `${tickerCode(matrixHover.rowLabel)} vs ${tickerCode(matrixHover.columnLabel)} ${matrixHover.value.toFixed(4)}`
            : "Hover a cell",
        },
        { label: "Annualization", value: `${data.metadata.annualization_factor}x monthly` },
      ],
    };
  }, [
    analyticsView,
    correlationMatrix.headers.length,
    covarianceMatrix.headers.length,
    data.metadata.annualization_factor,
    data.metadata.return_observations,
    data.metadata.sample_end,
    data.metadata.sample_start,
    fundStatisticsRows,
    matrixHover,
    statsSort.direction,
    statsSort.key,
  ]);

  function toggleStatsSort(nextKey) {
    setStatsSort((current) => {
      if (current.key === nextKey) {
        return {
          key: nextKey,
          direction: current.direction === "desc" ? "asc" : "desc",
        };
      }
      return {
        key: nextKey,
        direction: nextKey === "displayName" || nextKey === "ticker" ? "asc" : "desc",
      };
    });
  }

  function matrixCellStyle(value, diagonal, matrixType) {
    if (diagonal) {
      return {
        background: "rgba(208, 123, 42, 0.18)",
        color: theme.ink,
        fontWeight: 700,
      };
    }

    const denominator = matrixType === "correlation" ? 1 : covarianceMaxAbs;
    const normalized = Math.min(1, Math.abs(value) / (denominator || 1));

    if (value < 0) {
      return {
        background: `rgba(209, 73, 91, ${0.08 + normalized * 0.2})`,
        color: "#8b2336",
        fontWeight: 600,
      };
    }

    return {
      background: `rgba(55, 109, 163, ${0.06 + normalized * 0.18})`,
      color: theme.ink,
      fontWeight: value > 0.5 && matrixType === "correlation" ? 700 : 500,
    };
  }

  const analyticsPanel = (
    <div
      className="dashboard-card"
      style={{
        background: "#ffffff",
        borderRadius: 22,
        border: `1px solid ${theme.line}`,
        padding: 20,
        marginTop: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div style={{ maxWidth: 720 }}>
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: theme.muted,
            }}
          >
            Frontier Analytics
          </div>
          <h3 style={{ margin: "8px 0 8px", fontSize: 28 }}>{activeAnalyticsMeta.title}</h3>
          <div style={{ color: theme.muted, lineHeight: 1.55 }}>{activeAnalyticsMeta.copy}</div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(140px, 1fr))",
            gap: 12,
            minWidth: 320,
          }}
        >
          {activeAnalyticsMeta.highlights.map((item) => (
            <div
              key={`${item.label}-${item.value}`}
              className="platform-chart-insight"
              style={{ minHeight: 92 }}
            >
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
        <button
          type="button"
          style={buttonStyle(analyticsView === "statistics")}
          onClick={() => setAnalyticsView("statistics")}
          aria-pressed={analyticsView === "statistics"}
        >
          Fund Statistics
        </button>
        <button
          type="button"
          style={buttonStyle(analyticsView === "correlation")}
          onClick={() => setAnalyticsView("correlation")}
          aria-pressed={analyticsView === "correlation"}
        >
          Correlation
        </button>
        <button
          type="button"
          style={buttonStyle(analyticsView === "covariance")}
          onClick={() => setAnalyticsView("covariance")}
          aria-pressed={analyticsView === "covariance"}
        >
          Covariance
        </button>
      </div>

      {analyticsView === "statistics" ? (
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <div style={{ color: theme.muted, fontSize: 14 }}>
              Search funds by display name, short name, or ticker.
            </div>
            <input
              type="search"
              value={statsSearch}
              onChange={(event) => setStatsSearch(event.target.value)}
              placeholder="Search fund or ticker"
              className="platform-search-input"
            />
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="platform-data-table">
              <thead>
                <tr>
                  {[
                    { key: "displayName", label: "Fund" },
                    { key: "ticker", label: "Ticker" },
                    { key: "annualReturn", label: "Return" },
                    { key: "annualVolatility", label: "Volatility" },
                    { key: "sharpe", label: "Sharpe*" },
                  ].map((column) => {
                    const active = statsSort.key === column.key;
                    return (
                      <th
                        key={column.key}
                        style={{
                          textAlign:
                            column.key === "displayName" || column.key === "ticker"
                              ? "left"
                              : "right",
                        }}
                      >
                        <button
                          type="button"
                          className={
                            active
                              ? "platform-sort-button platform-sort-button-active"
                              : "platform-sort-button"
                          }
                          onClick={() => toggleStatsSort(column.key)}
                        >
                          {column.label}
                          {active ? (statsSort.direction === "desc" ? " ↓" : " ↑") : ""}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedFundStatistics.map((row) => (
                  <tr key={row.index}>
                    <td>
                      <div style={{ display: "grid", gap: 4 }}>
                        <strong>{row.displayName}</strong>
                        <span style={{ color: theme.muted, fontSize: 13 }}>{row.shortName}</span>
                      </div>
                    </td>
                    <td
                      style={{
                        fontFamily: "IBM Plex Mono, Consolas, monospace",
                        color: theme.muted,
                      }}
                    >
                      {row.ticker}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        color: row.annualReturn >= 0 ? theme.long : theme.gmvpShort,
                      }}
                    >
                      {formatPercent(row.annualReturn)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>
                      {formatPercent(row.annualVolatility)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 600,
                        color: row.sharpe >= 0 ? theme.ink : theme.gmvpShort,
                      }}
                    >
                      {row.sharpe.toFixed(3)}
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
            <table className="platform-matrix-table">
              <thead>
                <tr>
                  <th className="platform-matrix-corner">Fund</th>
                  {(analyticsView === "correlation"
                    ? correlationMatrix.headers
                    : covarianceMatrix.headers
                  ).map((header) => (
                    <th key={header}>{tickerCode(header)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(analyticsView === "correlation"
                  ? correlationMatrix.rows
                  : covarianceMatrix.rows
                ).map((row, rowIndex) => (
                  <tr key={row.rowLabel}>
                    <th>{tickerCode(row.rowLabel)}</th>
                    {row.values.map((value, columnIndex) => {
                      const diagonal = rowIndex === columnIndex;
                      const columnLabel =
                        analyticsView === "correlation"
                          ? correlationMatrix.headers[columnIndex]
                          : covarianceMatrix.headers[columnIndex];
                      const tone = matrixCellStyle(
                        value,
                        diagonal,
                        analyticsView === "correlation" ? "correlation" : "covariance",
                      );

                      return (
                        <td key={`${row.rowLabel}-${columnLabel}`}>
                          <button
                            type="button"
                            className="platform-matrix-cell"
                            style={tone}
                            onMouseEnter={(event) => {
                              const position = elementHoverPosition(event, "platform-matrix-shell");
                              setMatrixHover({
                                rowLabel: row.rowLabel,
                                columnLabel,
                                value,
                                diagonal,
                              });
                              setMatrixTooltip({
                                x: position.x,
                                y: position.y,
                                title: `${tickerCode(row.rowLabel)} vs ${tickerCode(columnLabel)}`,
                                lines: [
                                  analyticsView === "correlation"
                                    ? `Correlation: ${value.toFixed(3)}`
                                    : `Covariance: ${value.toFixed(4)}`,
                                  diagonal
                                    ? "Diagonal cell"
                                    : value < 0
                                      ? "Negative co-movement"
                                      : "Positive co-movement",
                                ],
                              });
                            }}
                            onMouseMove={(event) => {
                              const position = elementHoverPosition(event, "platform-matrix-shell");
                              setMatrixTooltip((current) =>
                                current ? { ...current, x: position.x, y: position.y } : current,
                              );
                            }}
                            onMouseLeave={() => setMatrixTooltip(null)}
                            onFocus={(event) => {
                              const position = elementHoverPosition(event, "platform-matrix-shell");
                              setMatrixHover({
                                rowLabel: row.rowLabel,
                                columnLabel,
                                value,
                                diagonal,
                              });
                              setMatrixTooltip({
                                x: position.x,
                                y: position.y,
                                title: `${tickerCode(row.rowLabel)} vs ${tickerCode(columnLabel)}`,
                                lines: [
                                  analyticsView === "correlation"
                                    ? `Correlation: ${value.toFixed(3)}`
                                    : `Covariance: ${value.toFixed(4)}`,
                                  diagonal
                                    ? "Diagonal cell"
                                    : value < 0
                                      ? "Negative co-movement"
                                      : "Positive co-movement",
                                ],
                              });
                            }}
                            onBlur={() => setMatrixTooltip(null)}
                          >
                            {analyticsView === "correlation" ? value.toFixed(3) : value.toFixed(4)}
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
            <div className="chart-tooltip" style={{ left: matrixTooltip.x, top: matrixTooltip.y }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{matrixTooltip.title}</div>
              {matrixTooltip.lines.map((line) => (
                <div key={line} style={{ fontSize: 13, lineHeight: 1.45 }}>
                  {line}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <span className="platform-legend-chip">
              <i style={{ background: "rgba(208, 123, 42, 0.85)" }} />
              Diagonal = variance / self-correlation
            </span>
            <span className="platform-legend-chip">
              <i style={{ background: "rgba(55, 109, 163, 0.85)" }} />
              Positive co-movement
            </span>
            <span className="platform-legend-chip">
              <i style={{ background: "rgba(209, 73, 91, 0.85)" }} />
              Negative co-movement
            </span>
          </div>

          <div style={{ marginTop: 12, color: theme.muted, fontSize: 13, lineHeight: 1.5 }}>
            Hover any matrix cell to inspect the pair. The diagonal cells represent each fund&apos;s own variance in the annualized covariance matrix and self-correlation in the correlation matrix.
          </div>
        </div>
      )}
    </div>
  );

  useEffect(() => {
    onChatContextChange?.({
      viewMode,
      analyticsView,
      portfolioMode,
      selectedPortfolio,
      selectedIndex: boundedIndex,
      frontierCount: activeFrontier.length,
    });
  }, [
    activeFrontier.length,
    analyticsView,
    boundedIndex,
    onChatContextChange,
    portfolioMode,
    selectedPortfolio,
    viewMode,
  ]);

  return (
    <section
      className="motion-surface"
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
          <div className="dashboard-card" style={{ background: theme.panel, borderRadius: 18, padding: 14, border: `1px solid ${theme.line}` }}>
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

          <div className="dashboard-card" style={{ background: theme.panel, borderRadius: 18, padding: 14, border: `1px solid ${theme.line}` }}>
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
        <button type="button" style={buttonStyle(viewMode === "both")} onClick={() => setViewMode("both")} aria-pressed={viewMode === "both"}>
          Compare both
        </button>
        <button type="button" style={buttonStyle(viewMode === "short")} onClick={() => setViewMode("short")} aria-pressed={viewMode === "short"}>
          Short sales only
        </button>
        <button type="button" style={buttonStyle(viewMode === "long")} onClick={() => setViewMode("long")} aria-pressed={viewMode === "long"}>
          Long-only only
        </button>
      </div>

      <div
        className="dashboard-card chart-shell"
        style={{
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
              <text x={xScale(tick)} y={chartSize.height - chartSize.paddingBottom + 24} textAnchor="middle" fontSize="12" fill={theme.muted}>
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
            <line
              x1={xScale(selectedPortfolio.risk)}
              x2={xScale(selectedPortfolio.risk)}
              y1={chartSize.height - chartSize.paddingBottom}
              y2={yScale(selectedPortfolio.return)}
              stroke="rgba(29, 42, 52, 0.18)"
              strokeDasharray="6 6"
            />
            <line
              x1={chartSize.paddingLeft}
              x2={xScale(selectedPortfolio.risk)}
              y1={yScale(selectedPortfolio.return)}
              y2={yScale(selectedPortfolio.return)}
              stroke="rgba(29, 42, 52, 0.18)"
              strokeDasharray="6 6"
            />
            <circle
              cx={xScale(selectedPortfolio.risk)}
              cy={yScale(selectedPortfolio.return)}
              r="18"
              fill={portfolioMode === "shortSalesAllowed" ? "rgba(47, 108, 173, 0.14)" : "rgba(92, 159, 69, 0.14)"}
            />
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
          <div className="chart-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{tooltip.title}</div>
            {tooltip.lines.map((line) => (
              <div key={line} style={{ fontSize: 13, lineHeight: 1.45 }}>
                {line}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="insight-grid" style={{ marginTop: 16 }}>
        <div className="insight-card">
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.muted }}>
            Frontier position
          </div>
          <strong>{boundedIndex + 1}</strong>
          <div style={{ marginTop: 6, color: theme.muted, lineHeight: 1.45 }}>
            Point {boundedIndex + 1} of {activeFrontier.length} on the selected frontier.
          </div>
          <div className="frontier-progress-track" style={{ marginTop: 12 }}>
            <div className="frontier-progress-fill" style={{ width: `${frontierProgress * 100}%` }} />
          </div>
        </div>
        <div className="insight-card">
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.muted }}>
            Positive exposure
          </div>
          <strong>{formatPercent(activeRiskBudget)}</strong>
          <div style={{ marginTop: 6, color: theme.muted, lineHeight: 1.45 }}>
            Sum of positive portfolio weights for the currently selected point.
          </div>
        </div>
        <div className="insight-card">
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.muted }}>
            Top holdings
          </div>
          <strong>{selectedTopRows.length}</strong>
          <div style={{ marginTop: 6, color: theme.muted, lineHeight: 1.45 }}>
            {selectedTopRows.map((row) => `${row.fund} ${formatPercent(row.weight)}`).join(", ")}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1.15fr) minmax(280px, 0.85fr)",
          gap: 18,
          marginTop: 20,
        }}
      >
        <div className="dashboard-card" style={{ background: "#ffffff", borderRadius: 22, border: `1px solid ${theme.line}`, padding: 18 }}>
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
                aria-pressed={portfolioMode === "longOnly"}
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
                aria-pressed={portfolioMode === "shortSalesAllowed"}
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

          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: theme.muted, fontSize: 14 }}>
              <span>{portfolioMode === "shortSalesAllowed" ? "Short-sales path" : "Long-only path"}</span>
              <span>{formatPercent(frontierProgress, 0)} explored</span>
            </div>
            <div className="frontier-progress-track" style={{ marginTop: 8 }}>
              <div className="frontier-progress-fill" style={{ width: `${frontierProgress * 100}%` }} />
            </div>
          </div>

          <div
            className="stat-grid"
            style={{
              marginTop: 14,
            }}
          >
            <div className="stat-card">
              <div style={{ color: theme.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                Target return
              </div>
              <div style={{ marginTop: 6, fontWeight: 700 }}>{formatPercent(selectedPortfolio.target_return)}</div>
            </div>
            <div className="stat-card">
              <div style={{ color: theme.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                Expected return
              </div>
              <div style={{ marginTop: 6, fontWeight: 700 }}>{formatPercent(selectedPortfolio.return)}</div>
            </div>
            <div className="stat-card">
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
          <div className="dashboard-card" style={{ background: "#ffffff", borderRadius: 22, border: `1px solid ${theme.line}`, padding: 18 }}>
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

          <div className="dashboard-card" style={{ background: "#ffffff", borderRadius: 22, border: `1px solid ${theme.line}`, padding: 18 }}>
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

      {analyticsPanel}
    </section>
  );
}
