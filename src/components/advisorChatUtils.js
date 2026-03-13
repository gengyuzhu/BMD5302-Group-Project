import frontierData from "../../part1_outputs/efficient_frontier_data.json";
import riskData from "../../part2_outputs/part2_risk_profile_data.json";

export const personas = [
  {
    id: "steady",
    label: "Steady Saver",
    a: 8.0,
    blurb: "Capital preservation first, with steady growth as a secondary goal.",
  },
  {
    id: "balanced",
    label: "Balanced Builder",
    a: 6.0,
    blurb: "A balanced investor who accepts measured volatility for better returns.",
  },
  {
    id: "growth",
    label: "Growth Explorer",
    a: 4.6,
    blurb: "Matches the example investor from Part 2 and targets disciplined long-term growth.",
  },
  {
    id: "bold",
    label: "Bold Navigator",
    a: 2.0,
    blurb: "Aggressive growth preference with much higher tolerance for market swings.",
  },
];

export const fundThemes = {
  1: "Singapore equity",
  2: "Hong Kong tech",
  3: "SGD bond",
  4: "Global technology",
  5: "Income fund",
  6: "US technology",
  7: "Asian growth",
  8: "Gold thematic",
  9: "India equity",
  10: "SGD low-volatility core",
};

const personaAliases = {
  steady: "steady",
  conservative: "steady",
  saver: "steady",
  balanced: "balanced",
  moderate: "balanced",
  growth: "growth",
  explorer: "growth",
  bold: "bold",
  aggressive: "bold",
  navigator: "bold",
};

export const formatPercent = (value, digits = 2) =>
  `${((value ?? 0) * 100).toFixed(digits)}%`;

export const formatSignedPercent = (value, digits = 2) =>
  `${value > 0 ? "+" : ""}${((value ?? 0) * 100).toFixed(digits)}%`;

export function nearestPortfolio(portfolios, aValue) {
  return portfolios.reduce((best, current) =>
    Math.abs(current.risk_aversion_a - aValue) <
    Math.abs(best.risk_aversion_a - aValue)
      ? current
      : best,
  );
}

export function sortedWeights(weightMap = {}) {
  return Object.entries(weightMap)
    .map(([fund, weight]) => ({ fund, weight }))
    .sort((left, right) => Math.abs(right.weight) - Math.abs(left.weight));
}

export function positiveWeights(weightMap = {}, count = 3) {
  return sortedWeights(weightMap)
    .filter((row) => row.weight > 1e-5)
    .slice(0, count);
}

export function negativeWeights(weightMap = {}, count = 3) {
  return sortedWeights(weightMap)
    .filter((row) => row.weight < -1e-5)
    .slice(0, count);
}

export function weightOfFund(weightMap = {}, fundName) {
  return weightMap[fundName] ?? 0;
}

export function assistantMessage({
  title,
  text,
  bullets = [],
  stats = [],
  suggestions = [],
}) {
  return {
    role: "assistant",
    title,
    text,
    bullets,
    stats,
    suggestions,
  };
}

function portfolioReturn(portfolio) {
  return portfolio?.expected_return ?? portfolio?.return ?? 0;
}

function portfolioRisk(portfolio) {
  return portfolio?.risk ?? 0;
}

function portfolioLeaders(portfolio, count = 3) {
  return positiveWeights(portfolio?.weights ?? {}, count)
    .map((row) => `${row.fund} ${formatPercent(row.weight)}`)
    .join(", ");
}

function classifyRiskLabel(aValue) {
  if (aValue <= 3) return "Aggressive";
  if (aValue <= 5) return "Moderate Growth";
  if (aValue <= 7) return "Balanced";
  return "Conservative";
}

function detectFund(message, funds) {
  const lower = message.toLowerCase();
  const exact = lower.match(/\bfund\s*(10|[1-9])\b/);
  if (exact) {
    return funds.find((fund) => fund.index === Number(exact[1])) ?? null;
  }

  return (
    funds.find((fund) =>
      [
        fund.shortName,
        fund.displayName,
        fundThemes[fund.index],
        String(fund.index),
        `fund ${fund.index}`,
      ]
        .map((item) => item.toLowerCase())
        .some((item) => lower.includes(item)),
    ) ?? null
  );
}

function detectFunds(message, funds) {
  const lower = message.toLowerCase();
  const matches = new Map();
  const explicitNumbers = [...lower.matchAll(/\bfund\s*(10|[1-9])\b/g)].map(
    (match) => Number(match[1]),
  );

  explicitNumbers.forEach((index) => {
    const fund = funds.find((item) => item.index === index);
    if (fund) {
      matches.set(fund.index, fund);
    }
  });

  funds.forEach((fund) => {
    const aliases = [
      fund.shortName,
      fund.displayName,
      fundThemes[fund.index],
      String(fund.index),
      `fund ${fund.index}`,
    ].map((item) => item.toLowerCase());

    if (aliases.some((alias) => lower.includes(alias))) {
      matches.set(fund.index, fund);
    }
  });

  return [...matches.values()];
}

function detectPersonas(message) {
  const lower = message.toLowerCase();
  const ids = new Set();

  Object.entries(personaAliases).forEach(([alias, personaId]) => {
    if (lower.includes(alias)) {
      ids.add(personaId);
    }
  });

  return personas.filter((persona) => ids.has(persona.id));
}

function defaultPersona(viewContext) {
  if (viewContext.selectedPersonaId) {
    return (
      personas.find((persona) => persona.id === viewContext.selectedPersonaId) ?? personas[2]
    );
  }
  if (typeof viewContext.scoring?.riskAversionA === "number") {
    const aValue = viewContext.scoring.riskAversionA;
    return (
      [...personas].sort(
        (left, right) => Math.abs(left.a - aValue) - Math.abs(right.a - aValue),
      )[0] ?? personas[2]
    );
  }
  return personas[2];
}

export function resolveChatContext(activeView, viewContext = {}) {
  const activePersona = defaultPersona(viewContext);
  const riskA = viewContext.scoring?.riskAversionA ?? activePersona.a;
  const activeLongPortfolio =
    viewContext.activeLongPortfolio ??
    nearestPortfolio(riskData.optimalPortfolios.longOnly, riskA);
  const activeShortPortfolio =
    viewContext.activeShortPortfolio ??
    nearestPortfolio(riskData.optimalPortfolios.shortSalesAllowed, riskA);

  const currentPortfolio =
    activeView === "frontier"
      ? viewContext.selectedPortfolio ?? frontierData.gmvp.longOnly
      : activeView === "risk"
        ? viewContext.activePortfolio ?? activeLongPortfolio
        : viewContext.displayedPortfolio ?? activeLongPortfolio;

  const constraintMode =
    viewContext.constraintMode ??
    viewContext.portfolioMode ??
    "longOnly";

  const answeredCount = viewContext.answeredCount ?? 0;
  const questionnaireLength =
    viewContext.questionnaireLength ??
    riskData.questionnaire.questionnaire.length;

  const signature = JSON.stringify({
    activeView,
    personaId: activePersona.id,
    constraintMode,
    activeTab: viewContext.activeTab ?? "results",
    currentIndex: viewContext.currentIndex ?? 0,
    answeredCount,
    questionnaireLength,
    analyticsView: viewContext.analyticsView ?? "statistics",
    viewMode: viewContext.viewMode ?? "both",
    currentReturn: portfolioReturn(currentPortfolio).toFixed(4),
    currentRisk: portfolioRisk(currentPortfolio).toFixed(4),
    currentUtility:
      currentPortfolio?.utility?.toFixed?.(4) ??
      viewContext.scoring?.riskAversionA?.toFixed?.(2) ??
      "",
  });

  return {
    activeView,
    activePersona,
    activeLongPortfolio,
    activeShortPortfolio,
    currentPortfolio,
    constraintMode,
    funds: riskData.funds,
    gmvpLong: frontierData.gmvp.longOnly,
    gmvpShort: frontierData.gmvp.shortSalesAllowed,
    frontierMode: viewContext.viewMode ?? "both",
    analyticsView: viewContext.analyticsView ?? "statistics",
    selectedIndex: viewContext.selectedIndex ?? 0,
    frontierCount: viewContext.frontierCount ?? 0,
    currentQuestion: viewContext.currentQuestion ?? null,
    currentIndex: viewContext.currentIndex ?? 0,
    answeredCount,
    questionnaireLength,
    isComplete: viewContext.isComplete ?? false,
    scoring: viewContext.scoring ?? null,
    tone: viewContext.tone ?? null,
    signature,
  };
}

export function defaultPrompts(activeView, context) {
  if (activeView === "frontier") {
    return [
      "What is the GMVP and why does it matter?",
      "Explain the difference between long-only and short-sales frontiers.",
      "What does the correlation matrix tell us?",
      "Which fund has the best risk-return trade-off?",
    ];
  }

  if (activeView === "risk") {
    return context.isComplete
      ? [
          "Summarize the current optimal portfolio.",
          "Explain how the questionnaire converts answers into A.",
          "Compare long-only and short-sales for this risk profile.",
          "Why are the top weights selected this way?",
        ]
      : [
          "What does a higher A mean?",
          "Explain the questionnaire formula summary.",
          "Why do some questions carry more weight?",
          "What happens after all 8 questions are answered?",
        ];
  }

  return [
    `Summarize the recommendation for ${context.activePersona.label}.`,
    "Explain how the questionnaire converts answers into A.",
    "Why is the long-only portfolio preferred over short sales?",
    "Compare Fund 4 and Fund 8.",
  ];
}

export function buildWelcomeMessage(activeView, context) {
  if (activeView === "frontier") {
    return assistantMessage({
      title: "Frontier Lab copilot",
      text:
        "I can explain the efficient frontier, GMVP, fund statistics, correlation, covariance, and the current selected frontier point.",
      bullets: [
        `Current frontier mode: ${context.constraintMode === "shortSalesAllowed" ? "Short-sales frontier" : "Long-only frontier"}.`,
        `Current selected point: ${formatPercent(portfolioReturn(context.currentPortfolio))} expected return at ${formatPercent(portfolioRisk(context.currentPortfolio))} volatility.`,
        `Current analytics tab: ${context.analyticsView}.`,
      ],
      stats: [
        { label: "Funds", value: String(context.funds.length) },
        { label: "Sample", value: `${frontierData.metadata.return_observations} months` },
      ],
      suggestions: defaultPrompts(activeView, context),
    });
  }

  if (activeView === "risk") {
    if (!context.isComplete) {
      return assistantMessage({
        title: "Risk Lab copilot",
        text:
          "I can explain the questionnaire, the formula summary, and what each answer means before the final portfolio is unlocked.",
        bullets: [
          `Progress: ${context.answeredCount}/${context.questionnaireLength} answered.`,
          context.currentQuestion
            ? `Current question: ${context.currentQuestion.dimension} (weight ${context.currentQuestion.weight}x).`
            : "Current question context is available on this page.",
          "Complete all questions to unlock the optimal portfolio dashboard.",
        ],
        stats: [
          { label: "Questions", value: String(context.questionnaireLength) },
          { label: "Mode", value: "Questionnaire" },
        ],
        suggestions: defaultPrompts(activeView, context),
      });
    }

    return assistantMessage({
      title: "Risk Lab copilot",
      text:
        "I can explain the completed risk profile, the indifference-curve chart, the portfolio weights, and the long-only versus short-sales comparison.",
      bullets: [
        `Current A: ${context.scoring.riskAversionA.toFixed(2)} (${classifyRiskLabel(context.scoring.riskAversionA)}).`,
        `Displayed portfolio: ${formatPercent(portfolioReturn(context.currentPortfolio))} expected return at ${formatPercent(portfolioRisk(context.currentPortfolio))} volatility.`,
        `Top weights: ${portfolioLeaders(context.currentPortfolio)}.`,
      ],
      stats: [
        { label: "A", value: context.scoring.riskAversionA.toFixed(2) },
        {
          label: "Utility",
          value: context.currentPortfolio.utility.toFixed(4),
        },
      ],
      suggestions: defaultPrompts(activeView, context),
    });
  }

  return assistantMessage({
    title: "Robo-adviser copilot",
    text: `I can explain the current recommendation for ${context.activePersona.label}, compare long-only against the short-sales benchmark, break down any fund, and connect the answer back to Parts 1 and 2.`,
    bullets: [
      `Current mode: ${context.constraintMode === "longOnly" ? "Long-only implementation" : "Short-sales benchmark"}.`,
      `Displayed portfolio: ${formatPercent(portfolioReturn(context.currentPortfolio))} expected return at ${formatPercent(portfolioRisk(context.currentPortfolio))} volatility.`,
      `Top holdings right now: ${portfolioLeaders(context.currentPortfolio)}.`,
    ],
    stats: [
      { label: "A", value: context.activePersona.a.toFixed(2) },
      { label: "Utility", value: context.currentPortfolio.utility.toFixed(4) },
    ],
    suggestions: defaultPrompts(activeView, context),
  });
}

export function buildContextUpdateMessage(activeView, context) {
  if (activeView === "frontier") {
    return assistantMessage({
      title: "Context updated",
      text: `Replies now use the ${context.constraintMode === "shortSalesAllowed" ? "short-sales" : "long-only"} frontier and the ${context.analyticsView} analytics view.`,
      bullets: [
        `Selected point: ${formatPercent(portfolioReturn(context.currentPortfolio))} return, ${formatPercent(portfolioRisk(context.currentPortfolio))} volatility.`,
        `Frontier position: point ${context.selectedIndex + 1}${context.frontierCount ? ` of ${context.frontierCount}` : ""}.`,
      ],
      suggestions: defaultPrompts(activeView, context),
    });
  }

  if (activeView === "risk") {
    return assistantMessage({
      title: "Context updated",
      text:
        context.isComplete
          ? `Replies now use the completed Risk Lab result with ${context.constraintMode === "longOnly" ? "the long-only recommendation" : "the short-sales benchmark"}.`
          : "Replies now use the live questionnaire state in Risk Lab.",
      bullets: context.isComplete
        ? [
            `A = ${context.scoring.riskAversionA.toFixed(2)}.`,
            `Displayed portfolio: ${formatPercent(portfolioReturn(context.currentPortfolio))} return, ${formatPercent(portfolioRisk(context.currentPortfolio))} volatility.`,
          ]
        : [
            `Progress: ${context.answeredCount}/${context.questionnaireLength} answered.`,
            context.currentQuestion
              ? `Current question: ${context.currentQuestion.dimension}.`
              : "Question context available.",
          ],
      suggestions: defaultPrompts(activeView, context),
    });
  }

  return assistantMessage({
    title: "Context updated",
    text: `Replies now use ${context.activePersona.label} with ${context.constraintMode === "longOnly" ? "the long-only implementation" : "the short-sales benchmark"}.`,
    bullets: [
      `Expected return: ${formatPercent(portfolioReturn(context.currentPortfolio))}.`,
      `Volatility: ${formatPercent(portfolioRisk(context.currentPortfolio))}.`,
      `Top holdings: ${portfolioLeaders(context.currentPortfolio)}.`,
    ],
    suggestions: defaultPrompts(activeView, context),
  });
}

export function thinkingLabelForView(activeView) {
  const labels = {
    frontier: [
      "Reviewing the efficient frontier inputs",
      "Checking the current GMVP and selected point",
      "Linking the frontier to the analytics tabs",
    ],
    risk: [
      "Reviewing the questionnaire and utility inputs",
      "Checking the current risk-aversion mapping",
      "Preparing a portfolio explanation from Part 2",
    ],
    platform: [
      "Reviewing the live persona and constraint mode",
      "Checking the frontier and utility outputs",
      "Building a portfolio explanation from Parts 1 and 2",
    ],
  };

  const choices = labels[activeView] ?? labels.platform;
  return choices[Math.floor(Math.random() * choices.length)];
}

export function buildAssistantReply(message, activeView, context) {
  const lower = message.toLowerCase();
  const funds = context.funds;
  const fund = detectFund(message, funds);
  const fundsMentioned = detectFunds(message, funds);
  const personasMentioned = detectPersonas(message);
  const currentWeight = fund
    ? weightOfFund(context.currentPortfolio.weights ?? {}, fund.shortName)
    : 0;
  const highestReturnFund = [...funds].sort(
    (left, right) => right.annualReturn - left.annualReturn,
  )[0];
  const lowestVolFund = [...funds].sort(
    (left, right) => left.annualVolatility - right.annualVolatility,
  )[0];
  const bestSharpeFund = [...funds].sort(
    (left, right) =>
      right.annualReturn / right.annualVolatility -
      left.annualReturn / left.annualVolatility,
  )[0];
  const shortExposures = negativeWeights(context.activeShortPortfolio.weights, 3);

  if (/\b(hi|hello|hey|help)\b/.test(lower)) {
    return buildWelcomeMessage(activeView, context);
  }

  if (
    activeView === "risk" &&
    !context.isComplete &&
    (lower.includes("current question") ||
      lower.includes("which question") ||
      lower.includes("progress"))
  ) {
    return assistantMessage({
      title: "Current questionnaire state",
      text: `You are on Question ${context.currentIndex + 1} of ${context.questionnaireLength}.`,
      bullets: [
        context.currentQuestion
          ? `Current dimension: ${context.currentQuestion.dimension}.`
          : "Question dimension is available on the page.",
        `Answered so far: ${context.answeredCount}/${context.questionnaireLength}.`,
        "The results dashboard opens automatically after all questions are completed.",
      ],
      suggestions: defaultPrompts(activeView, context),
    });
  }

  if (
    lower.includes("formula") ||
    lower.includes("utility function") ||
    lower.includes("sigma") ||
    lower.includes("quadratic utility")
  ) {
    return assistantMessage({
      title: "Formula summary",
      text:
        "The project uses a weighted questionnaire to produce risk aversion A, then applies quadratic utility to select the portfolio.",
      bullets: [
        "S = sum(weight_i x score_i).",
        "T = (S - 10) / 40.",
        "A = 10 - 9T.",
        "U = r - (A x sigma^2) / 2.",
      ],
      stats: [
        {
          label: "Questions",
          value: String(riskData.questionnaire.questionnaire.length),
        },
        { label: "Sample", value: `${riskData.metadata.return_observations} returns` },
      ],
      suggestions: [
        "Explain how the questionnaire converts answers into A.",
        "What does a higher A mean?",
        "Summarize the current portfolio.",
      ],
    });
  }

  if (lower.includes("correlation")) {
    return assistantMessage({
      title: "Correlation matrix",
      text:
        "The correlation matrix shows which funds tend to move together inside the common sample window.",
      bullets: [
        "Higher positive correlation means weaker diversification between the pair.",
        "Lower or negative correlation means stronger diversification potential.",
        "In Frontier Lab, the matrix is interactive and each cell can be hovered to inspect a specific pair.",
      ],
      stats: [
        {
          label: "Window",
          value: `${frontierData.metadata.return_observations} months`,
        },
        { label: "Funds", value: String(funds.length) },
      ],
      suggestions: [
        "What does the covariance matrix add beyond correlation?",
        "Which fund has the lowest volatility?",
        "Explain the efficient frontier.",
      ],
    });
  }

  if (lower.includes("covariance")) {
    return assistantMessage({
      title: "Variance-covariance matrix",
      text:
        "The annualized covariance matrix is the core risk input used in the frontier and utility optimization.",
      bullets: [
        "The diagonal entries are each fund's own annualized variance.",
        "The off-diagonal entries show how pairs of funds move together in risk terms.",
        "This matrix is what determines portfolio volatility for every weight combination on the frontier.",
      ],
      stats: [
        {
          label: "Annualization",
          value: `${frontierData.metadata.annualization_factor}x`,
        },
        { label: "GMVP", value: formatPercent(frontierData.gmvp.longOnly.risk) },
      ],
      suggestions: [
        "Explain the correlation matrix.",
        "Why is the long-only GMVP so concentrated?",
        "Summarize the current frontier point.",
      ],
    });
  }

  if (
    lower.includes("statistics") ||
    lower.includes("sharpe") ||
    lower.includes("highest return") ||
    lower.includes("lowest volatility")
  ) {
    return assistantMessage({
      title: "Annualized fund statistics",
      text:
        "The fund-statistics view compares annualized return, annualized volatility, and an approximate Sharpe ratio across all 10 funds.",
      bullets: [
        `Highest annualized return: ${highestReturnFund.shortName} at ${formatPercent(highestReturnFund.annualReturn)}.`,
        `Lowest annualized volatility: ${lowestVolFund.shortName} at ${formatPercent(lowestVolFund.annualVolatility)}.`,
        `Best approximate Sharpe ratio: ${bestSharpeFund.shortName}.`,
      ],
      suggestions: [
        "Compare Fund 4 and Fund 8.",
        "Explain the correlation matrix.",
        "Why is United SGD Fund important for the GMVP?",
      ],
    });
  }

  if (
    lower.includes("frontier position") ||
    lower.includes("selected point") ||
    lower.includes("current point")
  ) {
    return assistantMessage({
      title: "Current frontier position",
      text: `The current point is positioned at ${formatPercent(portfolioReturn(context.currentPortfolio))} expected return and ${formatPercent(portfolioRisk(context.currentPortfolio))} volatility.`,
      bullets: [
        activeView === "frontier"
          ? `This is point ${context.selectedIndex + 1}${context.frontierCount ? ` of ${context.frontierCount}` : ""} on the active frontier.`
          : "This point reflects the portfolio currently shown in the page context.",
        `Constraint mode: ${context.constraintMode === "shortSalesAllowed" ? "Short-sales allowed" : "Long-only"}.`,
        `Largest positive weights: ${portfolioLeaders(context.currentPortfolio)}.`,
      ],
      suggestions: [
        "Explain long-only versus short-sales.",
        "What is the GMVP and why does it matter?",
        "Tell me about the top holding.",
      ],
    });
  }

  if (
    lower.includes("questionnaire") ||
    lower.includes("risk aversion") ||
    /\bhow.*\ba\b/.test(lower) ||
    lower.includes("higher a")
  ) {
    const activeA = context.scoring?.riskAversionA ?? context.activePersona.a;
    return assistantMessage({
      title: "Questionnaire to A mapping",
      text:
        "The questionnaire converts behavior into a risk-aversion input, and that A value determines how much variance is penalized in utility maximization.",
      bullets: [
        "Each answer is scored from 1 to 5 and multiplied by the question weight.",
        "The weighted score is normalized into risk tolerance T.",
        `Risk aversion is then mapped with A = 10 - 9T. In the current context, A = ${activeA.toFixed(2)}.`,
        "Higher A means a more conservative portfolio choice on the same frontier.",
      ],
      stats: [
        { label: "A", value: activeA.toFixed(2) },
        {
          label: "Profile",
          value: classifyRiskLabel(activeA),
        },
      ],
      suggestions: [
        "Summarize the current portfolio.",
        "Why does a lower A take more risk?",
        "Compare long-only and short-sales.",
      ],
    });
  }

  if (
    lower.includes("gmvp") ||
    lower.includes("global minimum variance") ||
    lower.includes("minimum variance")
  ) {
    return assistantMessage({
      title: "GMVP reference points",
      text:
        "The GMVP is the lowest-volatility portfolio available under a given constraint set.",
      bullets: [
        `Long-only GMVP: ${formatPercent(frontierData.gmvp.longOnly.return)} return at ${formatPercent(frontierData.gmvp.longOnly.risk)} volatility.`,
        `Short-sales GMVP: ${formatPercent(frontierData.gmvp.shortSalesAllowed.return)} return at ${formatPercent(frontierData.gmvp.shortSalesAllowed.risk)} volatility.`,
        "The long-only GMVP is fully concentrated in United SGD Fund because it has the lowest volatility in the shared sample.",
      ],
      suggestions: [
        "Why is the current portfolio not the GMVP?",
        "Explain long-only versus short-sales.",
        "Tell me about United SGD Fund.",
      ],
    });
  }

  if (
    lower.includes("long-only") ||
    lower.includes("short sales") ||
    lower.includes("short-sales") ||
    lower.includes("constraint")
  ) {
    return assistantMessage({
      title: "Constraint-set comparison",
      text:
        "The project shows both the long-only implementation and the short-sales benchmark, but the long-only version is the practical retail recommendation.",
      bullets: [
        `Long-only reference: ${formatPercent(portfolioReturn(context.activeLongPortfolio))} expected return at ${formatPercent(portfolioRisk(context.activeLongPortfolio))} volatility.`,
        `Short-sales benchmark: ${formatPercent(portfolioReturn(context.activeShortPortfolio))} expected return at ${formatPercent(portfolioRisk(context.activeShortPortfolio))} volatility.`,
        "Long-only avoids leverage, shorting frictions, and operational complexity.",
        shortExposures.length > 0
          ? `The short-sales benchmark also depends on negative exposures such as ${shortExposures.map((row) => `${row.fund} ${formatPercent(row.weight)}`).join(", ")}.`
          : "The benchmark still uses the same 10-fund universe.",
      ],
      suggestions: [
        "Summarize the current portfolio.",
        "What is the GMVP and why does it matter?",
        "Explain the top holdings.",
      ],
    });
  }

  if (
    (lower.includes("compare") || lower.includes("difference")) &&
    fundsMentioned.length >= 2
  ) {
    const [firstFund, secondFund] = fundsMentioned;
    return assistantMessage({
      title: `Fund comparison: ${firstFund.index} vs ${secondFund.index}`,
      text:
        `${firstFund.shortName} and ${secondFund.shortName} offer different positions on the risk-return spectrum.`,
      bullets: [
        `${firstFund.shortName}: ${formatPercent(firstFund.annualReturn)} annualized return and ${formatPercent(firstFund.annualVolatility)} volatility.`,
        `${secondFund.shortName}: ${formatPercent(secondFund.annualReturn)} annualized return and ${formatPercent(secondFund.annualVolatility)} volatility.`,
        `Current portfolio weights: ${firstFund.shortName} ${formatPercent(weightOfFund(context.currentPortfolio.weights ?? {}, firstFund.shortName))}, ${secondFund.shortName} ${formatPercent(weightOfFund(context.currentPortfolio.weights ?? {}, secondFund.shortName))}.`,
      ],
      suggestions: [
        `Tell me about Fund ${firstFund.index}.`,
        `Tell me about Fund ${secondFund.index}.`,
        "Why is one weighted more heavily than the other?",
      ],
    });
  }

  if (
    personasMentioned.length >= 2 ||
    lower.includes("compare personas") ||
    lower.includes("investor profiles")
  ) {
    const [firstPersona, secondPersona] =
      personasMentioned.length >= 2 ? personasMentioned : [personas[0], personas[3]];
    const firstLong = nearestPortfolio(riskData.optimalPortfolios.longOnly, firstPersona.a);
    const secondLong = nearestPortfolio(riskData.optimalPortfolios.longOnly, secondPersona.a);

    return assistantMessage({
      title: `Persona comparison: ${firstPersona.label} vs ${secondPersona.label}`,
      text:
        "As A falls, the optimizer can move further up the frontier and accept more volatility.",
      bullets: [
        `${firstPersona.label}: A = ${firstPersona.a.toFixed(2)}, ${formatPercent(firstLong.expected_return)} return, ${formatPercent(firstLong.risk)} volatility.`,
        `${secondPersona.label}: A = ${secondPersona.a.toFixed(2)}, ${formatPercent(secondLong.expected_return)} return, ${formatPercent(secondLong.risk)} volatility.`,
        "The lower-A investor is willing to accept larger drawdowns for a higher expected return.",
      ],
      suggestions: [
        "Explain how A is calculated.",
        "Why is long-only preferred?",
        "Summarize the current portfolio.",
      ],
    });
  }

  if (
    fund &&
    (lower.includes("why not") || lower.includes("not selected") || lower.includes("0%"))
  ) {
    return assistantMessage({
      title: `Role of ${fund.shortName}`,
      text:
        Math.abs(currentWeight) < 1e-4
          ? `${fund.shortName} is currently at ${formatPercent(currentWeight)} in the displayed portfolio.`
          : `${fund.shortName} is already included at ${formatPercent(currentWeight)} in the displayed portfolio.`,
      bullets: [
        `Theme: ${fundThemes[fund.index]}.`,
        `Annualized return: ${formatPercent(fund.annualReturn)}. Annualized volatility: ${formatPercent(fund.annualVolatility)}.`,
        Math.abs(currentWeight) < 1e-4
          ? "It is not chosen because other funds provide a stronger utility trade-off at the current point on the frontier."
          : "Its weight is determined by total portfolio fit rather than a standalone ranking.",
      ],
      stats: [{ label: "Current weight", value: formatPercent(currentWeight) }],
      suggestions: [
        `Tell me about Fund ${fund.index}.`,
        "Summarize the current portfolio.",
        "Compare long-only and short-sales.",
      ],
    });
  }

  if (fund) {
    return assistantMessage({
      title: `${fund.index}. ${fund.shortName}`,
      text: `${fund.shortName} gives exposure to ${fundThemes[fund.index]}.`,
      bullets: [
        `Annualized return: ${formatPercent(fund.annualReturn)}.`,
        `Annualized volatility: ${formatPercent(fund.annualVolatility)}.`,
        `Weight in the current context: ${formatPercent(currentWeight)}.`,
        `Long-only reference weight: ${formatPercent(weightOfFund(context.activeLongPortfolio.weights, fund.shortName))}.`,
      ],
      suggestions: [
        `Why is ${fund.shortName} weighted this way?`,
        `Compare Fund ${fund.index} with Fund 8.`,
        "Summarize the current portfolio.",
      ],
    });
  }

  if (
    lower.includes("summary") ||
    lower.includes("recommend") ||
    lower.includes("portfolio") ||
    lower.includes("allocation")
  ) {
    const utilityValue =
      context.currentPortfolio?.utility != null
        ? context.currentPortfolio.utility.toFixed(4)
        : "n/a";
    return assistantMessage({
      title: "Recommendation summary",
      text:
        activeView === "frontier"
          ? `The selected frontier point currently targets ${formatPercent(portfolioReturn(context.currentPortfolio))} expected return with ${formatPercent(portfolioRisk(context.currentPortfolio))} volatility.`
          : `The current portfolio targets ${formatPercent(portfolioReturn(context.currentPortfolio))} expected return with ${formatPercent(portfolioRisk(context.currentPortfolio))} volatility.`,
      bullets: [
        `Top exposures: ${portfolioLeaders(context.currentPortfolio)}.`,
        `Constraint mode: ${context.constraintMode === "shortSalesAllowed" ? "Short-sales benchmark" : "Long-only implementation"}.`,
        utilityValue !== "n/a"
          ? `Utility score: ${utilityValue}.`
          : "The current point is evaluated directly on the frontier view.",
      ],
      stats: [
        {
          label: "Return",
          value: formatPercent(portfolioReturn(context.currentPortfolio)),
        },
        {
          label: "Volatility",
          value: formatPercent(portfolioRisk(context.currentPortfolio)),
        },
      ],
      suggestions: [
        "Why are these funds the leaders?",
        "Compare long-only and short-sales.",
        "What is the GMVP and why does it matter?",
      ],
    });
  }

  return assistantMessage({
    title: "Try one of these directions",
    text:
      "I can answer from the same Part 1 and Part 2 outputs shown in the site, including the frontier, GMVP, questionnaire, risk aversion A, and current portfolio weights.",
    bullets: [
      "Ask about a fund by number or name, such as Fund 8 or Fidelity Global Tech.",
      "Ask about the current frontier point, the GMVP, or the correlation and covariance matrices.",
      "Ask how the questionnaire maps into A and how that changes the optimal portfolio.",
    ],
    suggestions: defaultPrompts(activeView, context),
  });
}
