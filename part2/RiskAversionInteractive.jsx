import React, { useMemo, useState } from "react";
import data from "../part2_outputs/part2_risk_profile_data.json";

const theme = {
  shell: "#070d1f",
  ink: "#eef5ff",
  muted: "#96a8c5",
  line: "rgba(104, 132, 168, 0.22)",
  cyan: "#35efe6",
  gold: "#ffb21d",
  green: "#46f08c",
  red: "#ff5d4d",
  silver: "#aab8c9",
};

const chart = { width: 980, height: 470, left: 84, right: 28, top: 24, bottom: 58 };

const tickerMap = {
  "Nikko STI ETF": "STI ETF",
  "Lion-OCBC HSTECH ETF": "HSTECH",
  "ABF SG Bond": "ABF SG",
  "Fidelity Global Tech": "FID TECH",
  "PIMCO Income SGD-H": "PIMCO INC",
  "JPM US Tech SGD": "JPM TECH",
  "Schroder Asian Growth": "SCH ASIA",
  "BlackRock World Gold": "BLK GOLD",
  "Franklin India SGD": "FRANK IND",
  "United SGD Fund": "UOB SGD",
};

const formatPercent = (value, digits = 2) => `${(value * 100).toFixed(digits)}%`;

function questionnaireBounds(questionnaire) {
  const min = questionnaire.reduce((sum, question) => sum + question.weight, 0);
  const max = questionnaire.reduce((sum, question) => sum + question.weight * 5, 0);
  return { min, max };
}

function riskProfileLabel(aValue) {
  if (aValue >= 7.5) return "Conservative";
  if (aValue >= 5.0) return "Moderately Conservative";
  if (aValue >= 3.0) return "Moderate Growth";
  return "Aggressive Growth";
}

function displayRiskTone(aValue) {
  if (aValue <= 3.0) {
    return { label: "Aggressive", color: theme.gold };
  }
  if (aValue <= 5.0) {
    return { label: "Growth", color: theme.cyan };
  }
  if (aValue <= 7.0) {
    return { label: "Balanced", color: "#8fd6ff" };
  }
  return { label: "Conservative", color: "#c9d8ff" };
}

function scoreAnswers(answers, questionnaire) {
  const bounds = questionnaireBounds(questionnaire);
  const weightedScore = questionnaire.reduce(
    (sum, question) => sum + question.weight * Number(answers[question.id]),
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
    Math.abs(current.risk_aversion_a - aValue) < Math.abs(best.risk_aversion_a - aValue)
      ? current
      : best,
  );
}

function makeTicks(min, max, count = 5) {
  if (min === max) return [min];
  return Array.from({ length: count }, (_, index) => min + ((max - min) * index) / (count - 1));
}

function pathFromPoints(points, xScale, yScale) {
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

function hoverPosition(event) {
  const svg = event.currentTarget.ownerSVGElement ?? event.currentTarget;
  const rect = svg.getBoundingClientRect();
  return {
    x: event.clientX - rect.left + 12,
    y: event.clientY - rect.top - 12,
  };
}

function buildIndifferenceCurve(aValue, utility, maxRisk, points = 64) {
  return Array.from({ length: points }, (_, index) => {
    const risk = (maxRisk * index) / (points - 1);
    return { risk, return: utility + (aValue * risk * risk) / 2 };
  });
}

function chartCode(shortName) {
  return tickerMap[shortName] ?? shortName.toUpperCase().replace(/\s+/g, "_").slice(0, 9);
}

function buildJustification({ scoring, portfolio, topRows, shortBenchmark }) {
  const tone = displayRiskTone(scoring.riskAversionA);
  const frontierZone =
    portfolio.risk < 0.12
      ? "lower-volatility section"
      : portfolio.risk < 0.22
        ? "middle section"
        : "upper-right growth section";
  const leadText =
    topRows.length === 0
      ? "the long-only opportunity set"
      : topRows
          .slice(0, 2)
          .map((row) => `${row.fund} (${formatPercent(row.weight, 1)})`)
          .join(" and ");
  const benchmarkText = shortBenchmark
    ? `The unconstrained short-sales benchmark for the same A would target ${formatPercent(
        shortBenchmark.expected_return,
      )} return at ${formatPercent(shortBenchmark.risk)} volatility, but the robo-adviser keeps the client recommendation long-only for retail implementation.`
    : "";

  return `Your risk aversion A = ${scoring.riskAversionA.toFixed(
    2,
  )} places you in the ${tone.label.toLowerCase()} segment. The recommended long-only portfolio maximizes U = r - (sigma^2 A)/2 at the tangency between the efficient frontier and your indifference curve, which places the solution in the ${frontierZone}. The biggest allocations are concentrated in ${leadText}, reflecting where the optimizer finds the best return per unit of risk under the long-only retail constraint. ${benchmarkText}`.trim();
}

function scrollToTop() {
  if (typeof window !== "undefined") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

export default function RiskAversionInteractive({ payload = data }) {
  const questionnaire = payload.questionnaire.questionnaire;
  const bounds = useMemo(() => questionnaireBounds(questionnaire), [questionnaire]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("quiz");
  const [chartTooltip, setChartTooltip] = useState(null);

  const currentQuestion = questionnaire[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const isComplete = answeredCount === questionnaire.length;
  const progressRatio = answeredCount / questionnaire.length;
  const currentAnswer = currentQuestion ? Number(answers[currentQuestion.id] ?? 0) : 0;

  const scoring = useMemo(
    () => (isComplete ? scoreAnswers(answers, questionnaire) : null),
    [answers, isComplete, questionnaire],
  );

  const tone = useMemo(
    () => (scoring ? displayRiskTone(scoring.riskAversionA) : null),
    [scoring],
  );

  const fundMap = useMemo(
    () => Object.fromEntries(payload.funds.map((fund) => [fund.shortName, fund.displayName])),
    [payload.funds],
  );

  const longPortfolio = useMemo(
    () =>
      scoring
        ? nearestPortfolio(payload.optimalPortfolios.longOnly, scoring.riskAversionA)
        : null,
    [payload.optimalPortfolios.longOnly, scoring],
  );

  const shortBenchmark = useMemo(
    () =>
      scoring
        ? nearestPortfolio(payload.optimalPortfolios.shortSalesAllowed, scoring.riskAversionA)
        : null,
    [payload.optimalPortfolios.shortSalesAllowed, scoring],
  );

  const positiveRows = useMemo(() => {
    if (!longPortfolio) return [];
    return weightRows(longPortfolio.weights, fundMap).filter((row) => row.weight > 0.001);
  }, [fundMap, longPortfolio]);

  const displayedRows = useMemo(() => {
    if (positiveRows.length <= 6) return positiveRows;
    const visible = positiveRows.slice(0, 5);
    const otherWeight = positiveRows.slice(5).reduce((sum, row) => sum + row.weight, 0);
    return [...visible, { shortName: "Other holdings", fund: "Other holdings", weight: otherWeight }];
  }, [positiveRows]);

  const chartModel = useMemo(() => {
    const frontier = payload.frontiers.longOnly;
    const maxRisk =
      Math.max(
        ...payload.funds.map((fund) => fund.annualVolatility),
        ...frontier.map((point) => point.risk),
        longPortfolio?.risk ?? 0,
      ) + 0.03;
    const curve =
      scoring && longPortfolio
        ? buildIndifferenceCurve(scoring.riskAversionA, longPortfolio.utility, maxRisk)
        : [];

    const minY =
      Math.min(
        ...payload.funds.map((fund) => fund.annualReturn),
        ...frontier.map((point) => point.return),
        ...(curve.length > 0 ? curve.map((point) => point.return) : [0]),
        0,
      ) - 0.04;
    const maxY =
      Math.max(
        ...payload.funds.map((fund) => fund.annualReturn),
        ...frontier.map((point) => point.return),
        ...(curve.length > 0 ? curve.map((point) => point.return) : [0]),
        longPortfolio?.expected_return ?? 0,
      ) + 0.04;

    return { frontier, curve, minX: 0, maxX: maxRisk, minY, maxY };
  }, [longPortfolio, payload.funds, payload.frontiers.longOnly, scoring]);

  const xScale = (value) =>
    chart.left +
    ((value - chartModel.minX) / (chartModel.maxX - chartModel.minX || 1)) *
      (chart.width - chart.left - chart.right);
  const yScale = (value) =>
    chart.height -
    chart.bottom -
    ((value - chartModel.minY) / (chartModel.maxY - chartModel.minY || 1)) *
      (chart.height - chart.top - chart.bottom);

  const xTicks = makeTicks(chartModel.minX, chartModel.maxX, 5);
  const yTicks = makeTicks(chartModel.minY, chartModel.maxY, 5);
  const justification = useMemo(
    () =>
      scoring && longPortfolio
        ? buildJustification({
            scoring,
            portfolio: longPortfolio,
            topRows: positiveRows,
            shortBenchmark,
          })
        : "",
    [longPortfolio, positiveRows, scoring, shortBenchmark],
  );

  const handleAnswerSelect = (score) => {
    setAnswers((current) => ({ ...current, [currentQuestion.id]: score }));
  };

  const handleNext = () => {
    if (!currentQuestion || !currentAnswer) return;
    if (currentIndex === questionnaire.length - 1) {
      setActiveTab("results");
      setChartTooltip(null);
      scrollToTop();
      return;
    }
    setCurrentIndex((index) => Math.min(questionnaire.length - 1, index + 1));
  };

  const handlePrevious = () => {
    setCurrentIndex((index) => Math.max(0, index - 1));
  };

  const handleRetake = () => {
    setAnswers({});
    setCurrentIndex(0);
    setActiveTab("quiz");
    setChartTooltip(null);
    scrollToTop();
  };

  return (
    <section className="motion-surface risk2-shell">
      <div className="risk2-content">
        <div style={{ textAlign: "center", maxWidth: 860, margin: "0 auto" }}>
          <p className="risk2-kicker">Part 2: Risk Aversion & Optimal Portfolio</p>
          <h2 className="risk2-title">Risk Questionnaire to Optimal Portfolio</h2>
          <div className="risk2-subcopy">
            U = r - (sigma^2 A)/2 | 10 FSMOne funds | {payload.metadata.return_observations} monthly returns
          </div>

          <div className="risk2-tabrow">
            <button
              type="button"
              className={activeTab === "quiz" ? "risk2-tab risk2-tab-active" : "risk2-tab"}
              onClick={() => {
                setActiveTab("quiz");
                setChartTooltip(null);
                scrollToTop();
              }}
            >
              Risk Questionnaire
            </button>
            <button
              type="button"
              className={
                activeTab === "results"
                  ? "risk2-tab risk2-tab-active"
                  : isComplete
                    ? "risk2-tab"
                    : "risk2-tab risk2-tab-disabled"
              }
              onClick={() => {
                if (!isComplete) return;
                setActiveTab("results");
                setChartTooltip(null);
                scrollToTop();
              }}
              disabled={!isComplete}
            >
              Optimal Portfolio
            </button>
          </div>
        </div>

        {activeTab === "quiz" && (
          <div className="risk2-quiz-layout">
            <div className="risk2-panel">
              <div className="risk2-question-top">
                <div className="risk2-chip">Question {currentIndex + 1} of {questionnaire.length}</div>
                <div className="risk2-chip">{currentQuestion.dimension}</div>
                <div className="risk2-chip">Weight {currentQuestion.weight}</div>
                {currentAnswer > 0 && <div className="risk2-chip">Selected {currentAnswer}/5</div>}
              </div>

              <div className="risk2-progressbar" style={{ marginTop: 18 }}>
                <div
                  className="risk2-progressfill"
                  style={{
                    width: `${((currentIndex + (currentAnswer > 0 ? 1 : 0)) / questionnaire.length) * 100}%`,
                  }}
                />
              </div>

              <div className="risk2-steprow">
                {questionnaire.map((question, index) => {
                  const answered = Number(answers[question.id] ?? 0) > 0;
                  const classes = [
                    "risk2-stepdot",
                    index === currentIndex ? "risk2-stepdot-active" : "",
                    answered ? "risk2-stepdot-complete" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <button
                      key={question.id}
                      type="button"
                      className={classes}
                      onClick={() => setCurrentIndex(index)}
                      aria-label={`Go to question ${index + 1}`}
                    />
                  );
                })}
              </div>

              <h3 className="risk2-question-title">{currentQuestion.question}</h3>
              <p className="risk2-subcopy" style={{ margin: "12px 0 0" }}>
                Select the statement that best matches the investor profile you want the robo-adviser to serve.
              </p>

              <div className="risk2-options">
                {currentQuestion.options.map((option) => {
                  const active = currentAnswer === option.score;
                  return (
                    <button
                      key={option.score}
                      type="button"
                      className={active ? "risk2-option risk2-option-active" : "risk2-option"}
                      onClick={() => handleAnswerSelect(option.score)}
                      aria-pressed={active}
                    >
                      <span className="risk2-option-score">{option.score}</span>
                      <span style={{ fontSize: 16 }}>{option.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="risk2-controls">
                <button
                  type="button"
                  className="risk2-button risk2-button-secondary"
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="risk2-button risk2-button-primary"
                  onClick={handleNext}
                  disabled={!currentAnswer}
                >
                  {currentIndex === questionnaire.length - 1 ? "Finish questionnaire" : "Next question"}
                </button>
              </div>
            </div>

            <div className="risk2-sidegrid">
              <div className="risk2-panel">
                <div className="risk2-panel-kicker">Question Map</div>
                <h3 className="risk2-panel-title">Answered {answeredCount} of {questionnaire.length}</h3>
                <div className="risk2-progressbar">
                  <div className="risk2-progressfill" style={{ width: `${progressRatio * 100}%` }} />
                </div>

                <div className="risk2-map">
                  {questionnaire.map((question, index) => {
                    const answered = Number(answers[question.id] ?? 0) > 0;
                    const classes = [
                      "risk2-map-item",
                      index === currentIndex ? "risk2-map-item-active" : "",
                      answered ? "risk2-map-item-complete" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <button
                        key={question.id}
                        type="button"
                        className={classes}
                        onClick={() => setCurrentIndex(index)}
                      >
                        <span>{index + 1}. {question.dimension}</span>
                        <strong>{answered ? `${answers[question.id]}/5` : "--"}</strong>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="risk2-panel">
                <div className="risk2-panel-kicker">Scoring Framework</div>
                <h3 className="risk2-panel-title">Utility-driven recommendation</h3>
                <div className="risk2-note-block">
                  <div>S = sum(weight_i x score_i)</div>
                  <div>T = (S - {bounds.min}) / ({bounds.max - bounds.min})</div>
                  <div>A = 10 - 9T</div>
                  <div>U = r - (sigma^2 A)/2</div>
                </div>
                <p className="risk2-subcopy" style={{ margin: "14px 0 0" }}>
                  Once all 8 answers are complete, the page switches into the optimal portfolio view and
                  uses the Part 2 output data to draw the frontier, indifference curve, and long-only allocation.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "results" && isComplete && longPortfolio && (
          <div className="risk2-results">
            <div className="risk2-stats">
              <div className="risk2-stat">
                <div className="risk2-stat-kicker">Risk Aversion (A)</div>
                <div className="risk2-stat-value" style={{ color: tone.color }}>
                  {scoring.riskAversionA.toFixed(2)}
                </div>
                <div className="risk2-stat-note" style={{ color: tone.color, fontWeight: 700 }}>
                  {tone.label}
                </div>
                <div className="risk2-stat-subnote">{scoring.profileLabel}</div>
              </div>

              <div className="risk2-stat">
                <div className="risk2-stat-kicker">Optimal Return</div>
                <div className="risk2-stat-value" style={{ color: theme.green }}>
                  {formatPercent(longPortfolio.expected_return)}
                </div>
                <div className="risk2-stat-note">Volatility: {formatPercent(longPortfolio.risk)}</div>
                <div className="risk2-stat-subnote">Long-only retail implementation</div>
              </div>

              <div className="risk2-stat">
                <div className="risk2-stat-kicker">Maximum Utility (U*)</div>
                <div className="risk2-stat-value" style={{ color: "#ffe27a" }}>
                  {longPortfolio.utility.toFixed(4)}
                </div>
                <div className="risk2-stat-note">U = r - (sigma^2 A)/2</div>
                <div className="risk2-stat-subnote">Tangency of frontier and indifference curve</div>
              </div>
            </div>

            <div className="risk2-panel risk2-chart-card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div className="risk2-chart-title">Efficient Frontier & Your Indifference Curve</div>
                  <div className="risk2-chart-copy">
                    Long-only efficient frontier with the utility curve implied by your completed questionnaire.
                  </div>
                </div>

                <div className="risk2-badges">
                  <span className="risk2-badge">{payload.metadata.sample_start} to {payload.metadata.sample_end}</span>
                  <span className="risk2-badge">{payload.metadata.return_observations} monthly returns</span>
                  <span className="risk2-badge">10 funds</span>
                </div>
              </div>

              <div className="chart-shell" style={{ marginTop: 16 }}>
                <svg width={chart.width} height={chart.height} role="img" aria-label="Efficient frontier and indifference curve">
                  <rect x="0" y="0" width={chart.width} height={chart.height} rx="18" fill="rgba(8, 12, 30, 0.42)" stroke="rgba(83, 111, 147, 0.18)" />

                  {yTicks.map((tick) => (
                    <g key={`y-${tick}`}>
                      <line x1={chart.left} x2={chart.width - chart.right} y1={yScale(tick)} y2={yScale(tick)} stroke="rgba(92, 118, 150, 0.16)" strokeDasharray="4 8" />
                      <text x={chart.left - 12} y={yScale(tick) + 4} textAnchor="end" fontSize="12" fill={theme.muted}>
                        {formatPercent(tick, 0)}
                      </text>
                    </g>
                  ))}

                  {xTicks.map((tick) => (
                    <g key={`x-${tick}`}>
                      <line x1={xScale(tick)} x2={xScale(tick)} y1={chart.top} y2={chart.height - chart.bottom} stroke="rgba(92, 118, 150, 0.16)" strokeDasharray="4 8" />
                      <text x={xScale(tick)} y={chart.height - chart.bottom + 24} textAnchor="middle" fontSize="12" fill={theme.muted}>
                        {formatPercent(tick, 0)}
                      </text>
                    </g>
                  ))}

                  <line x1={chart.left} x2={chart.left} y1={chart.top} y2={chart.height - chart.bottom} stroke="rgba(214, 228, 246, 0.26)" />
                  <line x1={chart.left} x2={chart.width - chart.right} y1={chart.height - chart.bottom} y2={chart.height - chart.bottom} stroke="rgba(214, 228, 246, 0.26)" />

                  <text x={chart.width / 2} y={chart.height - 8} textAnchor="middle" fontSize="13" fill="#87bdf2" fontWeight="600">
                    Volatility (sigma)
                  </text>
                  <text x="22" y={chart.height / 2} transform={`rotate(-90 22 ${chart.height / 2})`} textAnchor="middle" fontSize="13" fill="#87bdf2" fontWeight="600">
                    Return (mu)
                  </text>

                  <path d={pathFromPoints(chartModel.frontier, xScale, yScale)} fill="none" stroke={theme.red} strokeWidth="3.4" strokeLinecap="round" />
                  <path d={pathFromPoints(chartModel.curve, xScale, yScale)} fill="none" stroke={theme.gold} strokeWidth="2.2" strokeDasharray="8 6" strokeLinecap="round" />

                  {payload.funds.map((fund) => (
                    <g
                      key={fund.index}
                      onMouseEnter={(event) => {
                        const position = hoverPosition(event);
                        setChartTooltip({
                          x: position.x,
                          y: position.y,
                          title: fund.displayName,
                          lines: [`Expected return: ${formatPercent(fund.annualReturn)}`, `Volatility: ${formatPercent(fund.annualVolatility)}`],
                        });
                      }}
                      onMouseMove={(event) => {
                        const position = hoverPosition(event);
                        setChartTooltip((current) => (current ? { ...current, x: position.x, y: position.y } : current));
                      }}
                      onMouseLeave={() => setChartTooltip(null)}
                      style={{ cursor: "pointer" }}
                    >
                      <circle cx={xScale(fund.annualVolatility)} cy={yScale(fund.annualReturn)} r="6.5" fill={theme.silver} opacity="0.9" />
                      <text x={xScale(fund.annualVolatility) + 8} y={yScale(fund.annualReturn) - 8} fontSize="11" fill="rgba(212, 223, 241, 0.72)">
                        {chartCode(fund.shortName)}
                      </text>
                    </g>
                  ))}

                  <g
                    onMouseEnter={(event) => {
                      const position = hoverPosition(event);
                      setChartTooltip({
                        x: position.x,
                        y: position.y,
                        title: "Selected optimal portfolio",
                        lines: [`Expected return: ${formatPercent(longPortfolio.expected_return)}`, `Volatility: ${formatPercent(longPortfolio.risk)}`, `Utility: ${longPortfolio.utility.toFixed(4)}`],
                      });
                    }}
                    onMouseMove={(event) => {
                      const position = hoverPosition(event);
                      setChartTooltip((current) => (current ? { ...current, x: position.x, y: position.y } : current));
                    }}
                    onMouseLeave={() => setChartTooltip(null)}
                    style={{ cursor: "pointer" }}
                  >
                    <circle cx={xScale(longPortfolio.risk)} cy={yScale(longPortfolio.expected_return)} r="18" fill="rgba(255, 178, 29, 0.16)" />
                    <circle cx={xScale(longPortfolio.risk)} cy={yScale(longPortfolio.expected_return)} r="11" fill={theme.gold} stroke="#ffffff" strokeWidth="2.5" />
                    <text x={xScale(longPortfolio.risk) + 18} y={yScale(longPortfolio.expected_return) - 6} fill="#ffffff" fontSize="12" fontWeight="700">
                      Optimal
                    </text>
                  </g>
                </svg>

                {chartTooltip && (
                  <div className="chart-tooltip" style={{ left: chartTooltip.x, top: chartTooltip.y }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{chartTooltip.title}</div>
                    {chartTooltip.lines.map((line) => (
                      <div key={line} style={{ fontSize: 13, lineHeight: 1.45 }}>
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="risk2-panel">
              <div className="risk2-chart-title">Optimal Allocation (Long Only)</div>
              <div className="risk2-allocation-list">
                {displayedRows.map((row) => (
                  <div key={row.shortName} className="risk2-allocation-row">
                    <div className="risk2-allocation-head">
                      <span>{row.fund}</span>
                      <strong>{formatPercent(row.weight, 1)}</strong>
                    </div>
                    <div className="risk2-allocation-track">
                      <div className="risk2-allocation-fill" style={{ width: `${Math.max(8, row.weight * 100)}%` }}>
                        {formatPercent(row.weight, 1)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="risk2-panel">
              <div className="risk2-chart-title">Justification</div>
              <p className="risk2-justification-copy">{justification}</p>
              {shortBenchmark && (
                <div className="risk2-inline-note">
                  Short-sales benchmark: {formatPercent(shortBenchmark.expected_return)} return at {formatPercent(shortBenchmark.risk)} volatility.
                </div>
              )}
            </div>

            <div className="risk2-actionbar">
              <button type="button" className="risk2-button risk2-button-outline" onClick={handleRetake}>
                Retake Questionnaire
              </button>
            </div>

            <div className="risk2-footer">
              Financial Modeling — MSc Digital FinTech — Robot Adviser — All data from FSMOne
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
