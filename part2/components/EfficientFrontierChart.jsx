import React, { useMemo, useState } from "react";
import {
  buildChartModel,
  chartCode,
  chartFrame,
  formatPercent,
  hoverPosition,
  makeTicks,
  pathFromPoints,
} from "./riskLabUtils.js";

export default function EfficientFrontierChart({
  payload,
  scoring,
  activePortfolio,
  portfolioMode,
}) {
  const [tooltip, setTooltip] = useState(null);

  const chartModel = useMemo(
    () => buildChartModel({ payload, scoring, activePortfolio, portfolioMode }),
    [payload, scoring, activePortfolio, portfolioMode],
  );

  const xScale = (value) =>
    chartFrame.left +
    ((value - chartModel.minX) / (chartModel.maxX - chartModel.minX || 1)) *
      (chartFrame.width - chartFrame.left - chartFrame.right);

  const yScale = (value) =>
    chartFrame.height -
    chartFrame.bottom -
    ((value - chartModel.minY) / (chartModel.maxY - chartModel.minY || 1)) *
      (chartFrame.height - chartFrame.top - chartFrame.bottom);

  const xTicks = makeTicks(chartModel.minX, chartModel.maxX, 5);
  const yTicks = makeTicks(chartModel.minY, chartModel.maxY, 5);

  return (
    <div className="risklab-card">
      <div className="risklab-chart-header">
        <div>
          <div className="risklab-chart-title">Efficient Frontier &amp; Your Indifference Curve</div>
          <div className="risklab-chart-copy">
            {portfolioMode === "shortSalesAllowed"
              ? "Theoretical short-sales frontier with the same investor utility curve."
              : "Long-only efficient frontier with the investor utility curve implied by the questionnaire."}
          </div>
        </div>
      </div>

      <div className="chart-shell" style={{ marginTop: 14 }}>
        <svg
          width={chartFrame.width}
          height={chartFrame.height}
          role="img"
          aria-label="Efficient frontier chart"
        >
          <rect
            x="0"
            y="0"
            width={chartFrame.width}
            height={chartFrame.height}
            rx="18"
            fill="rgba(8, 12, 30, 0.42)"
            stroke="rgba(83, 111, 147, 0.18)"
          />

          {yTicks.map((tick) => (
            <g key={`y-${tick}`}>
              <line
                x1={chartFrame.left}
                x2={chartFrame.width - chartFrame.right}
                y1={yScale(tick)}
                y2={yScale(tick)}
                stroke="rgba(92, 118, 150, 0.16)"
                strokeDasharray="4 8"
              />
              <text
                x={chartFrame.left - 12}
                y={yScale(tick) + 4}
                textAnchor="end"
                fontSize="12"
                fill="#96a8c5"
              >
                {formatPercent(tick, 0)}
              </text>
            </g>
          ))}

          {xTicks.map((tick) => (
            <g key={`x-${tick}`}>
              <line
                x1={xScale(tick)}
                x2={xScale(tick)}
                y1={chartFrame.top}
                y2={chartFrame.height - chartFrame.bottom}
                stroke="rgba(92, 118, 150, 0.16)"
                strokeDasharray="4 8"
              />
              <text
                x={xScale(tick)}
                y={chartFrame.height - chartFrame.bottom + 24}
                textAnchor="middle"
                fontSize="12"
                fill="#96a8c5"
              >
                {formatPercent(tick, 0)}
              </text>
            </g>
          ))}

          <line
            x1={chartFrame.left}
            x2={chartFrame.left}
            y1={chartFrame.top}
            y2={chartFrame.height - chartFrame.bottom}
            stroke="rgba(214, 228, 246, 0.26)"
          />
          <line
            x1={chartFrame.left}
            x2={chartFrame.width - chartFrame.right}
            y1={chartFrame.height - chartFrame.bottom}
            y2={chartFrame.height - chartFrame.bottom}
            stroke="rgba(214, 228, 246, 0.26)"
          />

          <text
            x={chartFrame.width / 2}
            y={chartFrame.height - 8}
            textAnchor="middle"
            fontSize="13"
            fill="#87bdf2"
            fontWeight="600"
          >
            Volatility
          </text>
          <text
            x="22"
            y={chartFrame.height / 2}
            transform={`rotate(-90 22 ${chartFrame.height / 2})`}
            textAnchor="middle"
            fontSize="13"
            fill="#87bdf2"
            fontWeight="600"
          >
            Expected Return
          </text>

          <path
            d={pathFromPoints(chartModel.frontier, xScale, yScale)}
            fill="none"
            stroke="#ff5d4d"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          <path
            d={pathFromPoints(chartModel.curve, xScale, yScale)}
            fill="none"
            stroke="#ffb21d"
            strokeWidth="2.2"
            strokeDasharray="8 6"
            strokeLinecap="round"
          />

          {payload.funds.map((fund) => (
            <g
              key={fund.index}
              onMouseEnter={(event) => {
                const position = hoverPosition(event);
                setTooltip({
                  x: position.x,
                  y: position.y,
                  title: fund.displayName,
                  lines: [
                    `Expected return: ${formatPercent(fund.annualReturn)}`,
                    `Volatility: ${formatPercent(fund.annualVolatility)}`,
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
              <circle
                cx={xScale(fund.annualVolatility)}
                cy={yScale(fund.annualReturn)}
                r="6.5"
                fill="#aab8c9"
                opacity="0.9"
              />
              <text
                x={xScale(fund.annualVolatility) + 8}
                y={yScale(fund.annualReturn) - 8}
                fontSize="11"
                fill="rgba(212, 223, 241, 0.72)"
              >
                {chartCode(fund.shortName)}
              </text>
            </g>
          ))}

          <g
            onMouseEnter={(event) => {
              const position = hoverPosition(event);
              setTooltip({
                x: position.x,
                y: position.y,
                title:
                  portfolioMode === "shortSalesAllowed"
                    ? "Selected short-sales benchmark"
                    : "Selected optimal portfolio",
                lines: [
                  `Expected return: ${formatPercent(activePortfolio.expected_return)}`,
                  `Volatility: ${formatPercent(activePortfolio.risk)}`,
                  `Utility: ${activePortfolio.utility.toFixed(4)}`,
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
            <circle
              cx={xScale(activePortfolio.risk)}
              cy={yScale(activePortfolio.expected_return)}
              r="18"
              fill="rgba(255, 178, 29, 0.16)"
            />
            <circle
              cx={xScale(activePortfolio.risk)}
              cy={yScale(activePortfolio.expected_return)}
              r="11"
              fill="#ffb21d"
              stroke="#ffffff"
              strokeWidth="2.5"
            />
            <text
              x={xScale(activePortfolio.risk) + 18}
              y={yScale(activePortfolio.expected_return) - 6}
              fill="#ffffff"
              fontSize="12"
              fontWeight="700"
            >
              Optimal
            </text>
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
    </div>
  );
}
