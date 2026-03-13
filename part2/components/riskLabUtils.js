export const chartFrame = {
  width: 980,
  height: 470,
  left: 84,
  right: 28,
  top: 24,
  bottom: 58,
};

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

export function formatPercent(value, digits = 2) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function questionnaireBounds(questionnaire) {
  const min = questionnaire.reduce((sum, question) => sum + question.weight, 0);
  const max = questionnaire.reduce((sum, question) => sum + question.weight * 5, 0);
  return { min, max };
}

export function riskProfileLabel(aValue) {
  if (aValue >= 7.5) return "Conservative";
  if (aValue >= 5.0) return "Moderately Conservative";
  if (aValue >= 3.0) return "Moderate Growth";
  return "Aggressive Growth";
}

export function displayRiskTone(aValue) {
  if (aValue <= 3.0) {
    return { label: "Aggressive", color: "#ffb21d" };
  }
  if (aValue <= 5.0) {
    return { label: "Growth", color: "#35efe6" };
  }
  if (aValue <= 7.0) {
    return { label: "Balanced", color: "#8fd6ff" };
  }
  return { label: "Conservative", color: "#c9d8ff" };
}

export function scoreAnswers(answers, questionnaire) {
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

export function nearestPortfolio(portfolios, aValue) {
  return portfolios.reduce((best, current) =>
    Math.abs(current.risk_aversion_a - aValue) < Math.abs(best.risk_aversion_a - aValue)
      ? current
      : best,
  );
}

export function weightRows(weightMap, fundMap) {
  return Object.entries(weightMap)
    .map(([shortName, weight]) => ({
      shortName,
      weight,
      fund: fundMap[shortName] ?? shortName,
    }))
    .sort((left, right) => Math.abs(right.weight) - Math.abs(left.weight));
}

export function makeTicks(min, max, count = 5) {
  if (min === max) return [min];
  return Array.from({ length: count }, (_, index) => min + ((max - min) * index) / (count - 1));
}

export function pathFromPoints(points, xScale, yScale) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xScale(point.risk)} ${yScale(point.return)}`)
    .join(" ");
}

export function hoverPosition(event) {
  const svg = event.currentTarget.ownerSVGElement ?? event.currentTarget;
  const rect = svg.getBoundingClientRect();
  return {
    x: event.clientX - rect.left + 12,
    y: event.clientY - rect.top - 12,
  };
}

export function buildIndifferenceCurve(aValue, utility, maxRisk, points = 72) {
  return Array.from({ length: points }, (_, index) => {
    const risk = (maxRisk * index) / (points - 1);
    return {
      risk,
      return: utility + (aValue * risk * risk) / 2,
    };
  });
}

export function chartCode(shortName) {
  return tickerMap[shortName] ?? shortName.toUpperCase().replace(/\s+/g, "_").slice(0, 9);
}

export function buildChartModel({ payload, scoring, activePortfolio, portfolioMode }) {
  const frontier =
    portfolioMode === "shortSalesAllowed"
      ? payload.frontiers.shortSalesAllowed
      : payload.frontiers.longOnly;

  const maxRisk =
    Math.max(
      ...payload.funds.map((fund) => fund.annualVolatility),
      ...frontier.map((point) => point.risk),
      activePortfolio?.risk ?? 0,
    ) + 0.03;

  const curve =
    scoring && activePortfolio
      ? buildIndifferenceCurve(scoring.riskAversionA, activePortfolio.utility, maxRisk)
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
      activePortfolio?.expected_return ?? 0,
    ) + 0.04;

  return {
    frontier,
    curve,
    minX: 0,
    maxX: maxRisk,
    minY,
    maxY,
  };
}

export function buildJustification({
  scoring,
  portfolio,
  portfolioMode,
  topRows,
  comparisonPortfolio,
}) {
  const tone = displayRiskTone(scoring.riskAversionA);
  const constraintNote =
    portfolioMode === "shortSalesAllowed"
      ? "This view shows the theoretical short-sales benchmark."
      : "This view shows the recommended long-only retail implementation.";
  const topText =
    topRows.length === 0
      ? "the available fund universe"
      : topRows
          .slice(0, 3)
          .map((row) => `${row.fund} (${formatPercent(row.weight, 1)})`)
          .join(", ");
  const comparisonText = comparisonPortfolio
    ? `The alternate constraint set would imply ${formatPercent(
        comparisonPortfolio.expected_return,
      )} return at ${formatPercent(comparisonPortfolio.risk)} volatility.`
    : "";

  return `Risk aversion A = ${scoring.riskAversionA.toFixed(
    2,
  )} classifies the investor as ${tone.label.toLowerCase()}. The selected portfolio maximizes U = r - (sigma^2 A)/2 at the tangency between the efficient frontier and the investor's indifference curve. The optimizer concentrates in ${topText} because those exposures deliver the strongest utility trade-off at this level of risk aversion. ${constraintNote} ${comparisonText}`.trim();
}

export function smoothScrollToTop() {
  if (typeof window !== "undefined") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}
