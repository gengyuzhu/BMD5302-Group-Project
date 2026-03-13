import React, { useMemo, useState } from "react";
import data from "./outputs/part2_risk_profile_data.json";

const theme = {
  ink: "#1b2932",
  muted: "#61727d",
  line: "#d7cbb8",
  panel: "#fffaf0",
  soft: "#f6ecdb",
  shell: "#fffdf8",
  long: "#8f6846",
  short: "#376da3",
  accent: "#d58526",
  good: "#5a9d47",
  warning: "#cc3f5c",
};

const cardStyle = {
  background: "#ffffff",
  border: `1px solid ${theme.line}`,
  borderRadius: 22,
  padding: 18,
};

const buttonStyle = (active) => ({
  padding: "10px 14px",
  borderRadius: 999,
  border: `1px solid ${active ? theme.ink : theme.line}`,
  background: active ? theme.ink : "#ffffff",
  color: active ? "#ffffff" : theme.ink,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
});

const formatPercent = (value, digits = 2) => `${(value * 100).toFixed(digits)}%`;

function questionnaireBounds(questionnaire) {
  const min = questionnaire.reduce((sum, question) => sum + question.weight, 0);
  const max = questionnaire.reduce((sum, question) => sum + question.weight * 5, 0);
  return { min, max };
}

function riskProfileLabel(aValue) {
  if (aValue >= 7.5) {
    return "Conservative";
  }
  if (aValue >= 5.0) {
    return "Moderately Conservative";
  }
  if (aValue >= 3.0) {
    return "Moderate Growth";
  }
  return "Aggressive Growth";
}

function scoreAnswers(answers, questionnaire) {
  const bounds = questionnaireBounds(questionnaire);
  const weightedScore = questionnaire.reduce(
    (sum, question) => sum + question.weight * Number(answers[question.id] ?? 1),
    0,
  );
  const riskToleranceIndex = (weightedScore - bounds.min) / (bounds.max - bounds.min);
  const riskAversionA = 10 - 9 * riskToleranceIndex;
  return {
    weightedScore,
    minScore: bounds.min,
    maxScore: bounds.max,
    riskToleranceIndex,
    riskAversionA,
    profileLabel: riskProfileLabel(riskAversionA),
  };
}

function nearestPortfolio(portfolios, aValue) {
  return portfolios.reduce((best, current) =>
    Math.abs(current.risk_aversion_a - aValue) < Math.abs(best.risk_aversion_a - aValue) ? current : best,
  );
}

function makeTicks(min, max, count = 6) {
  if (min === max) {
    return [min];
  }
  return Array.from({ length: count }, (_, index) => min + ((max - min) * index) / (count - 1));
}

function frontierPath(points, xScale, yScale) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xScale(point.risk)} ${yScale(point.return)}`)
    .join(" ");
}

function weightRows(weightMap, fundMap) {
  return Object.entries(weightMap)
    .map(([shortName, weight]) => ({
      shortName,
      weight,
      fund: fundMap[shortName] ?? shortName,
    }))
    .sort((left, right) => Math.abs(right.weight) - Math.abs(left.weight));
}

export default function RiskAversionInteractive({ payload = data }) {
  const questionnaire = payload.questionnaire.questionnaire;
  const defaultAnswers = payload.exampleInvestor.scores;
  const [answers, setAnswers] = useState(defaultAnswers);
  const [portfolioMode, setPortfolioMode] = useState("longOnly");
  const [chartScale, setChartScale] = useState("retail");

  const scoring = useMemo(() => scoreAnswers(answers, questionnaire), [answers, questionnaire]);

  const fundMap = useMemo(
    () =>
      Object.fromEntries(payload.funds.map((fund) => [fund.shortName, `${fund.index}. ${fund.shortName}`])),
    [payload.funds],
  );

  const longPortfolio = useMemo(
    () => nearestPortfolio(payload.optimalPortfolios.longOnly, scoring.riskAversionA),
    [payload.optimalPortfolios.longOnly, scoring.riskAversionA],
  );
  const shortPortfolio = useMemo(
    () => nearestPortfolio(payload.optimalPortfolios.shortSalesAllowed, scoring.riskAversionA),
    [payload.optimalPortfolios.shortSalesAllowed, scoring.riskAversionA],
  );

  const activePortfolio = portfolioMode === "longOnly" ? longPortfolio : shortPortfolio;
  const comparisonPortfolio = portfolioMode === "longOnly" ? shortPortfolio : longPortfolio;
  const activeRows = weightRows(activePortfolio.weights, fundMap);

  const retailDomain = useMemo(() => {
    const assetRisk = Math.max(...payload.funds.map((fund) => fund.annualVolatility));
    const longRisk = Math.max(...payload.frontiers.longOnly.map((point) => point.risk));
    const assetReturn = Math.max(...payload.funds.map((fund) => fund.annualReturn));
    const longReturn = Math.max(...payload.frontiers.longOnly.map((point) => point.return));
    return {
      minX: 0,
      maxX: Math.max(assetRisk, longRisk, longPortfolio.risk) + 0.02,
      minY: Math.min(...payload.funds.map((fund) => fund.annualReturn), 0) - 0.05,
      maxY: Math.max(assetReturn, longReturn, longPortfolio.expected_return) + 0.04,
    };
  }, [longPortfolio.expected_return, longPortfolio.risk, payload.funds, payload.frontiers.longOnly]);

  const fullDomain = useMemo(() => {
    const allRisk = [
      ...payload.funds.map((fund) => fund.annualVolatility),
      ...payload.frontiers.shortSalesAllowed.map((point) => point.risk),
      shortPortfolio.risk,
    ];
    const allReturn = [
      ...payload.funds.map((fund) => fund.annualReturn),
      ...payload.frontiers.shortSalesAllowed.map((point) => point.return),
      shortPortfolio.expected_return,
    ];
    return {
      minX: 0,
      maxX: Math.max(...allRisk) + 0.05,
      minY: Math.min(...payload.funds.map((fund) => fund.annualReturn), 0) - 0.05,
      maxY: Math.max(...allReturn) + 0.2,
    };
  }, [payload.funds, payload.frontiers.shortSalesAllowed, shortPortfolio.expected_return, shortPortfolio.risk]);

  const domain = chartScale === "retail" ? retailDomain : fullDomain;
  const chart = { width: 880, height: 420, left: 70, right: 34, top: 22, bottom: 54 };

  const xScale = (value) =>
    chart.left + ((value - domain.minX) / (domain.maxX - domain.minX || 1)) * (chart.width - chart.left - chart.right);
  const yScale = (value) =>
    chart.height - chart.bottom - ((value - domain.minY) / (domain.maxY - domain.minY || 1)) * (chart.height - chart.top - chart.bottom);

  const xTicks = makeTicks(domain.minX, domain.maxX, 6);
  const yTicks = makeTicks(domain.minY, domain.maxY, 6);
  const activePointVisible =
    activePortfolio.risk >= domain.minX &&
    activePortfolio.risk <= domain.maxX &&
    activePortfolio.expected_return >= domain.minY &&
    activePortfolio.expected_return <= domain.maxY;

  return (
    <section
      className="motion-surface"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(245, 185, 77, 0.22), transparent 30%), linear-gradient(180deg, #fffdf8 0%, #f7ecdb 100%)",
        border: `1px solid ${theme.line}`,
        borderRadius: 28,
        padding: 28,
        color: theme.ink,
        fontFamily: "IBM Plex Sans, Segoe UI, sans-serif",
        boxShadow: "0 18px 42px rgba(29, 41, 50, 0.10)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ maxWidth: 720 }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: theme.muted }}>
            Robot Adviser Part 2
          </p>
          <h2 style={{ margin: "8px 0 10px", fontSize: 34, lineHeight: 1.05 }}>
            Risk Aversion & Optimal Portfolio
          </h2>
          <p style={{ margin: 0, color: theme.muted, lineHeight: 1.55 }}>
            Answer the questionnaire, convert the result into a risk-aversion coefficient{" "}
            <strong>A</strong>, and inspect the utility-maximizing portfolio on the efficient frontier.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
          <button
            type="button"
            style={buttonStyle(portfolioMode === "longOnly")}
            onClick={() => setPortfolioMode("longOnly")}
            aria-pressed={portfolioMode === "longOnly"}
          >
            Long-only recommendation
          </button>
          <button
            type="button"
            style={buttonStyle(portfolioMode === "shortSalesAllowed")}
            onClick={() => setPortfolioMode("shortSalesAllowed")}
            aria-pressed={portfolioMode === "shortSalesAllowed"}
          >
            Short-sales benchmark
          </button>
          <button type="button" style={buttonStyle(false)} onClick={() => setAnswers(defaultAnswers)}>
            Reset example investor
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(360px, 1.08fr) minmax(300px, 0.92fr)",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div className="dashboard-card" style={cardStyle}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.muted }}>
            Questionnaire
          </div>
          <div style={{ marginTop: 14, display: "grid", gap: 16 }}>
            {questionnaire.map((question) => (
              <div key={question.id} style={{ paddingBottom: 14, borderBottom: `1px solid ${theme.line}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{question.dimension}</div>
                    <div style={{ fontSize: 14, color: theme.muted }}>{question.question}</div>
                  </div>
                  <div
                    style={{
                      flexShrink: 0,
                      alignSelf: "flex-start",
                      background: theme.soft,
                      borderRadius: 999,
                      padding: "6px 10px",
                      fontSize: 12,
                      color: theme.muted,
                    }}
                  >
                    Weight {question.weight}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  {question.options.map((option) => {
                    const active = Number(answers[question.id]) === option.score;
                    return (
                      <button
                        key={option.score}
                        type="button"
                        onClick={() =>
                          setAnswers((current) => ({
                            ...current,
                            [question.id]: option.score,
                          }))
                        }
                        style={{
                          textAlign: "left",
                          borderRadius: 16,
                          padding: "10px 12px",
                          border: `1px solid ${active ? theme.ink : theme.line}`,
                          background: active ? theme.ink : "#ffffff",
                          color: active ? "#ffffff" : theme.ink,
                          cursor: "pointer",
                        }}
                      >
                        <strong style={{ marginRight: 8 }}>{option.score}</strong>
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <div className="dashboard-card" style={cardStyle}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.muted }}>
              Scoring Output
            </div>
            <div
              style={{
                marginTop: 14,
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(120px, 1fr))",
                gap: 12,
              }}
            >
              <div style={{ background: theme.panel, borderRadius: 16, padding: 14 }}>
                <div style={{ fontSize: 12, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  Weighted score
                </div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 700 }}>
                  {scoring.weightedScore.toFixed(1)}
                </div>
                <div style={{ color: theme.muted, fontSize: 14 }}>
                  Range {scoring.minScore} to {scoring.maxScore}
                </div>
              </div>

              <div style={{ background: theme.panel, borderRadius: 16, padding: 14 }}>
                <div style={{ fontSize: 12, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  Risk tolerance index
                </div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 700 }}>
                  {scoring.riskToleranceIndex.toFixed(2)}
                </div>
                <div style={{ color: theme.muted, fontSize: 14 }}>Normalized to 0 to 1</div>
              </div>

              <div style={{ background: theme.panel, borderRadius: 16, padding: 14 }}>
                <div style={{ fontSize: 12, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  Risk aversion A
                </div>
                <div style={{ marginTop: 6, fontSize: 28, fontWeight: 700 }}>
                  {scoring.riskAversionA.toFixed(2)}
                </div>
                <div style={{ color: theme.muted, fontSize: 14 }}>A = 10 - 9T</div>
              </div>

              <div style={{ background: theme.panel, borderRadius: 16, padding: 14 }}>
                <div style={{ fontSize: 12, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  Profile
                </div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 700 }}>
                  {scoring.profileLabel}
                </div>
                <div style={{ color: theme.muted, fontSize: 14 }}>Higher A means more risk aversion</div>
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                borderRadius: 18,
                padding: 14,
                background: "#fcf5e8",
                border: `1px solid ${theme.line}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong>Risk profile continuum</strong>
                <span style={{ color: theme.muted }}>
                  T = {scoring.riskToleranceIndex.toFixed(2)} | A = {scoring.riskAversionA.toFixed(2)}
                </span>
              </div>
              <div className="mini-meter" style={{ marginTop: 10 }}>
                <span
                  style={{
                    width: `${Math.max(6, scoring.riskToleranceIndex * 100)}%`,
                    background: "linear-gradient(90deg, #8f6846 0%, #d58526 54%, #376da3 100%)",
                  }}
                />
              </div>
              <div style={{ marginTop: 10, color: theme.muted, fontSize: 14, lineHeight: 1.5 }}>
                Lower questionnaire scores map to a higher A and a more conservative implementation.
                Higher scores reduce A and allow the optimizer to accept more volatility for higher
                expected return.
              </div>
            </div>
          </div>

          <div className="dashboard-card" style={cardStyle}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.muted }}>
              Portfolio Recommendation
            </div>
            <h3 style={{ margin: "8px 0 6px", fontSize: 25 }}>
              {portfolioMode === "longOnly" ? "Recommended long-only portfolio" : "Theoretical short-sales benchmark"}
            </h3>
            <p style={{ margin: 0, color: theme.muted, lineHeight: 1.5 }}>
              {portfolioMode === "longOnly"
                ? payload.recommendedPortfolio.rationale
                : "This benchmark maximizes the same utility function but allows unconstrained short positions, so it should be read as a theoretical comparison rather than a retail implementation."}
            </p>

            <div
              className="stat-grid"
              style={{
                marginTop: 16,
              }}
            >
              <div className="stat-card">
                <div style={{ fontSize: 12, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  Return
                </div>
                <div style={{ marginTop: 6, fontWeight: 700 }}>
                  {formatPercent(activePortfolio.expected_return)}
                </div>
              </div>
              <div className="stat-card">
                <div style={{ fontSize: 12, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  Volatility
                </div>
                <div style={{ marginTop: 6, fontWeight: 700 }}>{formatPercent(activePortfolio.risk)}</div>
              </div>
              <div className="stat-card">
                <div style={{ fontSize: 12, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  Utility
                </div>
                <div style={{ marginTop: 6, fontWeight: 700 }}>{activePortfolio.utility.toFixed(4)}</div>
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                borderRadius: 18,
                padding: 14,
                background: portfolioMode === "longOnly" ? "#f8efe2" : "#eaf2fb",
                border: `1px solid ${portfolioMode === "longOnly" ? "#dbc6a9" : "#bfd2ea"}`,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                Matched optimization record: A = {activePortfolio.risk_aversion_a.toFixed(2)}
              </div>
              <div style={{ color: theme.muted, fontSize: 14, lineHeight: 1.5 }}>
                Comparison portfolio on the other constraint set: return{" "}
                {formatPercent(comparisonPortfolio.expected_return)}, volatility{" "}
                {formatPercent(comparisonPortfolio.risk)}, utility {comparisonPortfolio.utility.toFixed(4)}.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-card" style={{ ...cardStyle, marginTop: 18 }}>
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
          <div>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.muted }}>
              Utility Frontier
            </div>
            <h3 style={{ margin: "8px 0 0", fontSize: 25 }}>Selected portfolio on the efficient frontier</h3>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              style={buttonStyle(chartScale === "retail")}
              onClick={() => setChartScale("retail")}
              aria-pressed={chartScale === "retail"}
            >
              Retail scale
            </button>
            <button
              type="button"
              style={buttonStyle(chartScale === "full")}
              onClick={() => setChartScale("full")}
              aria-pressed={chartScale === "full"}
            >
              Full theoretical scale
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <svg width={chart.width} height={chart.height} role="img" aria-label="Risk aversion frontier chart">
            <rect x="0" y="0" width={chart.width} height={chart.height} rx="18" fill="#fffefb" />

            {yTicks.map((tick) => (
              <g key={`y-${tick}`}>
                <line
                  x1={chart.left}
                  x2={chart.width - chart.right}
                  y1={yScale(tick)}
                  y2={yScale(tick)}
                  stroke={theme.line}
                  strokeDasharray="5 6"
                />
                <text x={chart.left - 12} y={yScale(tick) + 4} textAnchor="end" fontSize="12" fill={theme.muted}>
                  {formatPercent(tick)}
                </text>
              </g>
            ))}

            {xTicks.map((tick) => (
              <g key={`x-${tick}`}>
                <line
                  x1={xScale(tick)}
                  x2={xScale(tick)}
                  y1={chart.top}
                  y2={chart.height - chart.bottom}
                  stroke={theme.line}
                  strokeDasharray="5 6"
                />
                <text x={xScale(tick)} y={chart.height - chart.bottom + 24} textAnchor="middle" fontSize="12" fill={theme.muted}>
                  {formatPercent(tick)}
                </text>
              </g>
            ))}

            <line x1={chart.left} x2={chart.left} y1={chart.top} y2={chart.height - chart.bottom} stroke={theme.ink} />
            <line
              x1={chart.left}
              x2={chart.width - chart.right}
              y1={chart.height - chart.bottom}
              y2={chart.height - chart.bottom}
              stroke={theme.ink}
            />

            <text x={chart.width / 2} y={chart.height - 10} textAnchor="middle" fontSize="13" fill={theme.ink} fontWeight="600">
              Annualized Volatility
            </text>
            <text
              x="18"
              y={chart.height / 2}
              transform={`rotate(-90 18 ${chart.height / 2})`}
              textAnchor="middle"
              fontSize="13"
              fill={theme.ink}
              fontWeight="600"
            >
              Annualized Expected Return
            </text>

            <path
              d={frontierPath(payload.frontiers.shortSalesAllowed, xScale, yScale)}
              fill="none"
              stroke={theme.short}
              strokeWidth="3.5"
            />
            <path
              d={frontierPath(payload.frontiers.longOnly, xScale, yScale)}
              fill="none"
              stroke={theme.good}
              strokeWidth="3.5"
              strokeDasharray="8 7"
            />

            {payload.funds.map((fund) => (
              <g key={fund.index}>
                <circle cx={xScale(fund.annualVolatility)} cy={yScale(fund.annualReturn)} r="6.5" fill={theme.accent} />
                <text x={xScale(fund.annualVolatility) + 8} y={yScale(fund.annualReturn) - 8} fontSize="12" fontWeight="700" fill={theme.ink}>
                  {fund.index}
                </text>
              </g>
            ))}

            {activePointVisible && (
              <g>
                <circle
                  cx={xScale(activePortfolio.risk)}
                  cy={yScale(activePortfolio.expected_return)}
                  r="10"
                  fill={portfolioMode === "longOnly" ? theme.long : theme.short}
                  stroke="#111111"
                  strokeWidth="2"
                />
                <text
                  x={xScale(activePortfolio.risk)}
                  y={yScale(activePortfolio.expected_return) + 4}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#ffffff"
                  fontWeight="700"
                >
                  A
                </text>
              </g>
            )}
          </svg>
        </div>

        {!activePointVisible && (
          <div
            style={{
              marginTop: 12,
              borderRadius: 14,
              padding: 12,
              background: "#fff5f7",
              border: "1px solid #f1c4ce",
              color: theme.warning,
              fontSize: 14,
            }}
          >
            The selected short-sales benchmark lies outside the retail-scale chart. Switch to{" "}
            <strong>Full theoretical scale</strong> to display it.
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "minmax(320px, 0.9fr) minmax(340px, 1.1fr)",
          gap: 18,
        }}
      >
        <div className="dashboard-card" style={cardStyle}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.muted }}>
            Weight Breakdown
          </div>
          <h3 style={{ margin: "8px 0 12px", fontSize: 25 }}>Portfolio weights</h3>

          <div className="holdings-list">
            {activeRows.map((row) => {
              const magnitude = Math.min(100, Math.abs(row.weight) * 100);
              return (
                <div key={row.shortName} className="holdings-row">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 5 }}>
                    <span>{row.fund}</span>
                    <strong style={{ color: row.weight < 0 ? theme.warning : theme.ink }}>
                      {formatPercent(row.weight)}
                    </strong>
                  </div>
                  <div style={{ height: 10, borderRadius: 999, background: theme.soft, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${magnitude}%`,
                        height: "100%",
                        background: row.weight < 0 ? theme.warning : portfolioMode === "longOnly" ? theme.long : theme.short,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="dashboard-card" style={cardStyle}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.muted }}>
            Interpretation
          </div>
          <h3 style={{ margin: "8px 0 12px", fontSize: 25 }}>How to read the result</h3>

          <div style={{ display: "grid", gap: 12, color: theme.muted, lineHeight: 1.55 }}>
            <div>
              <strong style={{ color: theme.ink }}>Questionnaire logic:</strong> the two behavioral questions have double
              weight because the ability to tolerate losses and remain invested during drawdowns has the most direct
              connection to practical risk capacity.
            </div>
            <div>
              <strong style={{ color: theme.ink }}>A mapping:</strong> a higher questionnaire score lowers the risk-aversion
              coefficient <strong>A</strong>, which allows the optimizer to accept more variance for more expected return.
            </div>
            <div>
              <strong style={{ color: theme.ink }}>Implementation choice:</strong> the long-only portfolio is the recommended
              robo-adviser solution because it avoids leverage and borrow constraints. The short-sales solution is shown only
              as a mathematical benchmark.
            </div>
          </div>

          <div style={{ marginTop: 18, padding: 16, borderRadius: 18, background: theme.panel, border: `1px solid ${theme.line}` }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Formula summary</div>
            <div style={{ fontFamily: "IBM Plex Mono, Consolas, monospace", fontSize: 13, lineHeight: 1.6 }}>
              S = sum(weight_i x score_i)
              <br />
              T = (S - 10) / 40
              <br />
              A = 10 - 9T
              <br />
              U = r - (A x sigma^2) / 2
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
