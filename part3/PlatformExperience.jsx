import React, { startTransition, useEffect, useMemo, useRef, useState } from "react";
import frontierData from "../part1_outputs/efficient_frontier_data.json";
import riskData from "../part2_outputs/part2_risk_profile_data.json";

const theme = {
  ink: "#16212b",
  muted: "#607180",
  line: "#d8ccb8",
  card: "#ffffff",
  soft: "#f8efe2",
  long: "#8f6846",
  short: "#376da3",
  good: "#5a9d47",
  accent: "#d07b2a",
};

const personas = [
  { id: "steady", label: "Steady Saver", a: 8.0, blurb: "Capital preservation first, with steady growth as a secondary goal." },
  { id: "balanced", label: "Balanced Builder", a: 6.0, blurb: "A balanced investor who accepts measured volatility for better returns." },
  { id: "growth", label: "Growth Explorer", a: 4.6, blurb: "Matches the example investor from Part 2 and targets disciplined long-term growth." },
  { id: "bold", label: "Bold Navigator", a: 2.0, blurb: "Aggressive growth preference with much higher tolerance for market swings." },
];

const fundThemes = {
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

const cardStyle = {
  background: theme.card,
  border: `1px solid ${theme.line}`,
  borderRadius: 24,
  padding: 20,
  boxShadow: "0 18px 38px rgba(31, 43, 55, 0.08)",
};

const actionButton = (active) => ({
  borderRadius: 999,
  border: `1px solid ${active ? theme.ink : theme.line}`,
  background: active ? theme.ink : "#ffffff",
  color: active ? "#ffffff" : theme.ink,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
});

const formatPercent = (value, digits = 2) => `${(value * 100).toFixed(digits)}%`;
const formatSignedPercent = (value, digits = 2) =>
  `${value > 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;

function nearestPortfolio(portfolios, aValue) {
  return portfolios.reduce((best, current) =>
    Math.abs(current.risk_aversion_a - aValue) < Math.abs(best.risk_aversion_a - aValue) ? current : best,
  );
}

function sortedWeights(weightMap) {
  return Object.entries(weightMap)
    .map(([fund, weight]) => ({ fund, weight }))
    .sort((left, right) => Math.abs(right.weight) - Math.abs(left.weight));
}

function positiveWeights(weightMap, count = 3) {
  return sortedWeights(weightMap).filter((row) => row.weight > 1e-5).slice(0, count);
}

function negativeWeights(weightMap, count = 3) {
  return sortedWeights(weightMap).filter((row) => row.weight < -1e-5).slice(0, count);
}

function weightOfFund(weightMap, fundName) {
  return weightMap[fundName] ?? 0;
}

function detectFund(message, funds) {
  const lower = message.toLowerCase();
  const exact = lower.match(/\bfund\s*(10|[1-9])\b/);
  if (exact) {
    return funds.find((fund) => fund.index === Number(exact[1])) ?? null;
  }
  return (
    funds.find((fund) =>
      [fund.shortName, fund.displayName, fundThemes[fund.index], String(fund.index), `fund ${fund.index}`]
        .map((item) => item.toLowerCase())
        .some((item) => lower.includes(item)),
    ) ?? null
  );
}

function detectFunds(message, funds) {
  const lower = message.toLowerCase();
  const matches = new Map();
  const explicitNumbers = [...lower.matchAll(/\bfund\s*(10|[1-9])\b/g)].map((match) => Number(match[1]));

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

function assistantMessage({ title, text, bullets = [], stats = [], suggestions = [] }) {
  return {
    role: "assistant",
    title,
    text,
    bullets,
    stats,
    suggestions,
  };
}

function portfolioLeaders(portfolio, count = 3) {
  return positiveWeights(portfolio.weights, count)
    .map((row) => `${row.fund} ${formatPercent(row.weight)}`)
    .join(", ");
}

function buildWelcomeMessage(context) {
  const { activePersona, displayedPortfolio, constraintMode } = context;
  return assistantMessage({
    title: "Robo-adviser copilot",
    text: `I can explain the current recommendation for ${activePersona.label}, compare long-only against the short-sales benchmark, break down any fund, and translate the questionnaire into risk aversion A.`,
    bullets: [
      `Current mode: ${constraintMode === "longOnly" ? "Long-only implementation" : "Short-sales benchmark"}.`,
      `Displayed portfolio: ${formatPercent(displayedPortfolio.expected_return)} expected return at ${formatPercent(displayedPortfolio.risk)} volatility.`,
      `Top holdings right now: ${portfolioLeaders(displayedPortfolio)}.`,
    ],
    stats: [
      { label: "A", value: activePersona.a.toFixed(2) },
      { label: "Utility", value: displayedPortfolio.utility.toFixed(4) },
    ],
    suggestions: [
      `Summarize the recommendation for ${activePersona.label}.`,
      "Why is the long-only portfolio preferred?",
      "Explain how the questionnaire converts answers into A.",
      "Compare Fund 4 and Fund 8.",
    ],
  });
}

function makeTicks(min, max, count = 5) {
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

function StatCard({ label, value, note }) {
  return (
    <div className="stat-card">
      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.muted }}>{label}</div>
      <div style={{ marginTop: 6, fontWeight: 700 }}>{value}</div>
      {note ? <div style={{ marginTop: 4, color: theme.muted, fontSize: 13 }}>{note}</div> : null}
    </div>
  );
}

function HoldingBar({ label, weight, color, onAsk }) {
  return (
    <div className="holdings-row">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <span>{label}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <strong>{formatPercent(weight)}</strong>
          {onAsk ? (
            <button type="button" className="assistant-mini-action" onClick={onAsk}>
              Ask
            </button>
          ) : null}
        </div>
      </div>
      <div className="mini-meter">
        <span style={{ width: `${Math.min(100, Math.abs(weight) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function ChatMessage({ message, onSuggestionClick }) {
  if (message.role === "user") {
    return (
      <div
        className="chat-bubble chat-bubble-user"
        style={{
          justifySelf: "end",
          maxWidth: "88%",
          borderRadius: 18,
          padding: "12px 14px",
          background: "#1f2d37",
          color: "#ffffff",
          whiteSpace: "pre-wrap",
          lineHeight: 1.55,
        }}
      >
        {message.text}
      </div>
    );
  }

  return (
    <div className="chat-bubble chat-bubble-assistant">
      <div className="assistant-card">
        {message.title ? <div className="assistant-title">{message.title}</div> : null}
        <div className="assistant-copy">{message.text}</div>

        {message.stats?.length ? (
          <div className="assistant-stats">
            {message.stats.map((stat) => (
              <div key={`${stat.label}-${stat.value}`} className="assistant-stat">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>
        ) : null}

        {message.bullets?.length ? (
          <div className="assistant-list">
            {message.bullets.map((bullet) => (
              <div key={bullet} className="assistant-list-item">
                {bullet}
              </div>
            ))}
          </div>
        ) : null}

        {message.suggestions?.length ? (
          <div className="assistant-followups">
            {message.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="assistant-suggestion"
                onClick={() => onSuggestionClick(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function buildAssistantReply(message, context) {
  const lower = message.toLowerCase();
  const {
    activePersona,
    activeLongPortfolio,
    activeShortPortfolio,
    displayedPortfolio,
    constraintMode,
    funds,
    gmvpLong,
    gmvpShort,
  } = context;
  const fundsMentioned = detectFunds(message, funds);
  const fund = fundsMentioned[0] ?? detectFund(message, funds);
  const personasMentioned = detectPersonas(message);
  const shortExposures = negativeWeights(activeShortPortfolio.weights, 3);

  if (/\b(hi|hello|hey)\b/.test(lower)) {
    return assistantMessage({
      title: "Active client snapshot",
      text: `${activePersona.label} is currently selected with A = ${activePersona.a.toFixed(2)}.`,
      bullets: [
        `Displayed mode: ${constraintMode === "longOnly" ? "Long-only implementation" : "Short-sales benchmark"}.`,
        `Recommendation: ${formatPercent(displayedPortfolio.expected_return)} expected return at ${formatPercent(displayedPortfolio.risk)} volatility.`,
        "Ask about a fund, the GMVP, the questionnaire, or the current allocation.",
      ],
      stats: [
        { label: "Utility", value: displayedPortfolio.utility.toFixed(4) },
        { label: "Sample", value: `${riskData.metadata.sample_start} to ${riskData.metadata.sample_end}` },
      ],
      suggestions: [
        "Summarize the current portfolio.",
        "What is the GMVP and why does it matter?",
        "Tell me about Fund 8.",
      ],
    });
  }

  if ((lower.includes("compare") || lower.includes("difference")) && fundsMentioned.length >= 2) {
    const [firstFund, secondFund] = fundsMentioned;
    return assistantMessage({
      title: `Fund comparison: ${firstFund.index} vs ${secondFund.index}`,
      text: `${firstFund.shortName} and ${secondFund.shortName} contribute very different risk-return trade-offs.`,
      bullets: [
        `${firstFund.shortName}: ${formatPercent(firstFund.annualReturn)} annualized return, ${formatPercent(firstFund.annualVolatility)} volatility, current weight ${formatPercent(weightOfFund(displayedPortfolio.weights, firstFund.shortName))}.`,
        `${secondFund.shortName}: ${formatPercent(secondFund.annualReturn)} annualized return, ${formatPercent(secondFund.annualVolatility)} volatility, current weight ${formatPercent(weightOfFund(displayedPortfolio.weights, secondFund.shortName))}.`,
        `The optimizer chooses the mix that best fits A = ${activePersona.a.toFixed(2)}, not simply the highest raw return.`,
      ],
      suggestions: [
        `Why is ${Math.abs(weightOfFund(displayedPortfolio.weights, firstFund.shortName)) >= Math.abs(weightOfFund(displayedPortfolio.weights, secondFund.shortName)) ? firstFund.shortName : secondFund.shortName} weighted more heavily?`,
        `Tell me about Fund ${firstFund.index}.`,
        `Tell me about Fund ${secondFund.index}.`,
      ],
    });
  }

  if (fund && (lower.includes("why not") || lower.includes("not selected") || lower.includes("0%"))) {
    const currentWeight = weightOfFund(displayedPortfolio.weights, fund.shortName);
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
          ? `At A = ${activePersona.a.toFixed(2)}, other funds provide a stronger utility trade-off on the same frontier.`
          : "Its weight is set by how it improves the total portfolio, not by a standalone ranking.",
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
        `Weight in the long-only recommendation: ${formatPercent(weightOfFund(activeLongPortfolio.weights, fund.shortName))}.`,
        `Weight in the short-sales benchmark: ${formatPercent(weightOfFund(activeShortPortfolio.weights, fund.shortName))}.`,
      ],
      stats: [
        { label: "Long-only weight", value: formatPercent(weightOfFund(activeLongPortfolio.weights, fund.shortName)) },
        { label: "Short-sales weight", value: formatPercent(weightOfFund(activeShortPortfolio.weights, fund.shortName)) },
      ],
      suggestions: [
        `Why is ${fund.shortName} weighted this way?`,
        `Compare Fund ${fund.index} with Fund 8.`,
        "Summarize the current portfolio.",
      ],
    });
  }

  if (lower.includes("questionnaire") || lower.includes("risk aversion") || /\bhow.*\ba\b/.test(lower)) {
    return assistantMessage({
      title: "Questionnaire to A mapping",
      text: "The platform uses the Part 2 questionnaire to convert behavior into a utility input.",
      bullets: [
        "Each answer is scored and multiplied by the question weight.",
        "The weighted score is normalized into risk tolerance T.",
        `Risk aversion is then mapped with A = 10 - 9T, which places ${activePersona.label} at A = ${activePersona.a.toFixed(2)}.`,
        "The optimizer then selects the portfolio that maximizes expected return minus one half of A multiplied by variance.",
      ],
      stats: [
        { label: "Questions", value: String(riskData.questionnaire.questionnaire.length) },
        { label: "A", value: activePersona.a.toFixed(2) },
      ],
      suggestions: [
        "What does a higher A mean?",
        "Summarize the current portfolio.",
        "Compare the conservative and bold investor profiles.",
      ],
    });
  }

  if (lower.includes("gmvp") || lower.includes("frontier")) {
    return assistantMessage({
      title: "Efficient frontier reference points",
      text: "The GMVP is the lowest-volatility portfolio on each frontier and acts as a baseline for comparison.",
      bullets: [
        `Long-only GMVP: ${formatPercent(gmvpLong.return)} return at ${formatPercent(gmvpLong.risk)} volatility.`,
        `Short-sales GMVP: ${formatPercent(gmvpShort.return)} return at ${formatPercent(gmvpShort.risk)} volatility.`,
        `Current displayed portfolio: ${formatPercent(displayedPortfolio.expected_return)} return at ${formatPercent(displayedPortfolio.risk)} volatility.`,
      ],
      stats: [{ label: "Current utility", value: displayedPortfolio.utility.toFixed(4) }],
      suggestions: [
        "Why is the current portfolio not the GMVP?",
        "Compare long-only and short-sales.",
        "Summarize the current portfolio.",
      ],
    });
  }

  if (
    lower.includes("compare") ||
    lower.includes("difference") ||
    personasMentioned.length >= 2 ||
    lower.includes("conservative") ||
    lower.includes("bold")
  ) {
    const [firstPersona, secondPersona] =
      personasMentioned.length >= 2 ? personasMentioned : [personas[0], personas[3]];
    const firstLong = nearestPortfolio(riskData.optimalPortfolios.longOnly, firstPersona.a);
    const secondLong = nearestPortfolio(riskData.optimalPortfolios.longOnly, secondPersona.a);

    return assistantMessage({
      title: `Persona comparison: ${firstPersona.label} vs ${secondPersona.label}`,
      text: "As A falls, the optimizer can move further up the frontier and accept more volatility.",
      bullets: [
        `${firstPersona.label}: A = ${firstPersona.a.toFixed(2)}, ${formatPercent(firstLong.expected_return)} return, ${formatPercent(firstLong.risk)} volatility.`,
        `${secondPersona.label}: A = ${secondPersona.a.toFixed(2)}, ${formatPercent(secondLong.expected_return)} return, ${formatPercent(secondLong.risk)} volatility.`,
        "The lower-A investor is willing to accept larger drawdowns for a higher expected return.",
      ],
      suggestions: [
        `Summarize the recommendation for ${activePersona.label}.`,
        "Explain how A is calculated.",
        "Why is long-only preferred?",
      ],
    });
  }

  if (lower.includes("short") || lower.includes("long-only") || lower.includes("preferred")) {
    return assistantMessage({
      title: "Constraint-set comparison",
      text: "The platform defaults to long-only because that is the more implementable retail recommendation.",
      bullets: [
        `Long-only recommendation: ${formatPercent(activeLongPortfolio.expected_return)} expected return at ${formatPercent(activeLongPortfolio.risk)} volatility.`,
        `Short-sales benchmark: ${formatPercent(activeShortPortfolio.expected_return)} expected return at ${formatPercent(activeShortPortfolio.risk)} volatility.`,
        "Long-only avoids leverage, shorting constraints, and operational friction.",
        shortExposures.length > 0
          ? `The short-sales benchmark also depends on negative exposures such as ${shortExposures.map((row) => `${row.fund} ${formatPercent(row.weight)}`).join(", ")}.`
          : "The benchmark still uses the same 10-fund universe.",
      ],
      stats: [
        { label: "Long utility", value: activeLongPortfolio.utility.toFixed(4) },
        { label: "Short utility", value: activeShortPortfolio.utility.toFixed(4) },
      ],
      suggestions: [
        "Summarize the current portfolio.",
        "What is the GMVP and why does it matter?",
        "Explain the top holdings.",
      ],
    });
  }

  if (lower.includes("holdings") || lower.includes("weights") || lower.includes("portfolio") || lower.includes("recommend") || lower.includes("summary")) {
    return assistantMessage({
      title: "Recommendation summary",
      text: `For ${activePersona.label}, the ${constraintMode === "longOnly" ? "implementation portfolio" : "benchmark portfolio"} targets ${formatPercent(displayedPortfolio.expected_return)} expected return with ${formatPercent(displayedPortfolio.risk)} volatility.`,
      bullets: [
        `Utility score: ${displayedPortfolio.utility.toFixed(4)}.`,
        `Top exposures: ${portfolioLeaders(displayedPortfolio)}.`,
        constraintMode === "shortSalesAllowed" && shortExposures.length > 0
          ? `Largest short positions: ${shortExposures.map((row) => `${row.fund} ${formatPercent(row.weight)}`).join(", ")}.`
          : "This implementation avoids short positions and stays practical for a retail adviser.",
      ],
      stats: [
        { label: "A", value: activePersona.a.toFixed(2) },
        { label: "Return", value: formatPercent(displayedPortfolio.expected_return) },
        { label: "Volatility", value: formatPercent(displayedPortfolio.risk) },
      ],
      suggestions: [
        "Why are these funds the leaders?",
        "Compare long-only and short-sales.",
        "Tell me about Fund 4.",
      ],
    });
  }

  if (lower.includes("data") || lower.includes("csv") || lower.includes("sample")) {
    return assistantMessage({
      title: "Data scope",
      text: "The web platform is driven by the same Part 1 and Part 2 outputs shown elsewhere in the project.",
      bullets: [
        `Fund universe: ${funds.length} funds from the uploaded CSV history set.`,
        `Common monthly sample: ${riskData.metadata.sample_start} to ${riskData.metadata.sample_end}.`,
        `Return observations used in the optimization: ${riskData.metadata.return_observations}.`,
      ],
      suggestions: [
        "What is the GMVP and why does it matter?",
        "Explain how A is calculated.",
        "Summarize the current portfolio.",
      ],
    });
  }

  return assistantMessage({
    title: "Try one of these directions",
    text: "I can answer from the same frontier and utility outputs shown on the page.",
    bullets: [
      "Ask about a fund by number or name, such as Fund 8 or Fidelity Global Tech.",
      "Ask for a recommendation summary, a GMVP explanation, or a long-only versus short-sales comparison.",
      "Ask how the questionnaire is converted into risk aversion A.",
    ],
    suggestions: [
      "Summarize the current portfolio.",
      "Tell me about Fund 8.",
      "What is the GMVP and why does it matter?",
    ],
  });
}

export default function PlatformExperience() {
  const [selectedPersonaId, setSelectedPersonaId] = useState("growth");
  const [constraintMode, setConstraintMode] = useState("longOnly");
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState("Reviewing the current client context");
  const chatViewportRef = useRef(null);
  const timerIdsRef = useRef([]);
  const contextRef = useRef({
    personaId: "growth",
    constraintMode: "longOnly",
  });

  const activePersona = personas.find((persona) => persona.id === selectedPersonaId) ?? personas[0];
  const activeLongPortfolio = useMemo(() => nearestPortfolio(riskData.optimalPortfolios.longOnly, activePersona.a), [activePersona.a]);
  const activeShortPortfolio = useMemo(() => nearestPortfolio(riskData.optimalPortfolios.shortSalesAllowed, activePersona.a), [activePersona.a]);
  const displayedPortfolio = constraintMode === "longOnly" ? activeLongPortfolio : activeShortPortfolio;
  const topHoldings = positiveWeights(displayedPortfolio.weights, 4);
  const longAnchors = positiveWeights(activeLongPortfolio.weights, 3);
  const shortExposures = negativeWeights(activeShortPortfolio.weights, 3);

  const context = useMemo(
    () => ({
      activePersona,
      activeLongPortfolio,
      activeShortPortfolio,
      displayedPortfolio,
      constraintMode,
      funds: riskData.funds,
      gmvpLong: frontierData.gmvp.longOnly,
      gmvpShort: frontierData.gmvp.shortSalesAllowed,
    }),
    [activeLongPortfolio, activePersona, activeShortPortfolio, constraintMode, displayedPortfolio],
  );

  const [messages, setMessages] = useState(() => [buildWelcomeMessage(context)]);

  const prompts = useMemo(
    () => [
      `Summarize the recommendation for ${activePersona.label}.`,
      "Explain how the questionnaire converts answers into A.",
      "Why is the long-only portfolio preferred over short sales?",
      "What is the GMVP and why does it matter?",
      "Compare Fund 4 and Fund 8.",
      `Why is ${topHoldings[0]?.fund ?? "the top holding"} weighted so heavily?`,
    ],
    [activePersona.label, topHoldings],
  );

  useEffect(() => {
    if (chatViewportRef.current) {
      chatViewportRef.current.scrollTo({ top: chatViewportRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isThinking]);

  useEffect(() => {
    const previous = contextRef.current;
    if (
      previous.personaId === selectedPersonaId &&
      previous.constraintMode === constraintMode
    ) {
      return;
    }

    contextRef.current = {
      personaId: selectedPersonaId,
      constraintMode,
    };

    setMessages((current) => [
      ...current,
      assistantMessage({
        title: "Context updated",
        text: `Replies now use ${activePersona.label} with ${constraintMode === "longOnly" ? "the long-only implementation" : "the short-sales benchmark"}.`,
        bullets: [
          `Expected return: ${formatPercent(displayedPortfolio.expected_return)}.`,
          `Volatility: ${formatPercent(displayedPortfolio.risk)}.`,
          `Top holdings: ${portfolioLeaders(displayedPortfolio)}.`,
        ],
        suggestions: [
          "Summarize the current portfolio.",
          "Compare long-only and short-sales.",
          "Explain how the questionnaire converts answers into A.",
        ],
      }),
    ]);
  }, [
    activePersona.label,
    constraintMode,
    displayedPortfolio,
    selectedPersonaId,
  ]);

  useEffect(() => () => {
    timerIdsRef.current.forEach((id) => window.clearTimeout(id));
  }, []);

  const chartDomain = useMemo(() => {
    const allRisks = riskData.funds.map((fund) => fund.annualVolatility);
    const allReturns = riskData.funds.map((fund) => fund.annualReturn);
    if (constraintMode === "shortSalesAllowed") {
      return {
        minX: 0,
        maxX: Math.max(...allRisks, ...frontierData.frontiers.shortSalesAllowed.map((point) => point.risk), displayedPortfolio.risk) + 0.05,
        minY: Math.min(...allReturns, 0) - 0.05,
        maxY: Math.max(...allReturns, ...frontierData.frontiers.shortSalesAllowed.map((point) => point.return), displayedPortfolio.expected_return) + 0.2,
      };
    }
    return {
      minX: 0,
      maxX: Math.max(...allRisks, ...frontierData.frontiers.longOnly.map((point) => point.risk), displayedPortfolio.risk) + 0.02,
      minY: Math.min(...allReturns, 0) - 0.05,
      maxY: Math.max(...allReturns, ...frontierData.frontiers.longOnly.map((point) => point.return), displayedPortfolio.expected_return) + 0.04,
    };
  }, [constraintMode, displayedPortfolio.expected_return, displayedPortfolio.risk]);

  const chart = { width: 760, height: 380, left: 68, right: 30, top: 24, bottom: 50 };
  const xScale = (value) => chart.left + ((value - chartDomain.minX) / (chartDomain.maxX - chartDomain.minX || 1)) * (chart.width - chart.left - chart.right);
  const yScale = (value) => chart.height - chart.bottom - ((value - chartDomain.minY) / (chartDomain.maxY - chartDomain.minY || 1)) * (chart.height - chart.top - chart.bottom);
  const xTicks = makeTicks(chartDomain.minX, chartDomain.maxX, 5);
  const yTicks = makeTicks(chartDomain.minY, chartDomain.maxY, 5);

  function submitMessage(rawText) {
    const text = rawText.trim();
    if (!text) {
      return;
    }
    setMessages((current) => [...current, { role: "user", text }]);
    setDraft("");
    setIsThinking(true);
    setThinkingLabel(
      [
        "Reviewing the frontier and utility outputs",
        "Checking the live persona and constraint mode",
        "Building a portfolio explanation from Parts 1 and 2",
      ][Math.floor(Math.random() * 3)],
    );
    const id = window.setTimeout(() => {
      timerIdsRef.current = timerIdsRef.current.filter((timerId) => timerId !== id);
      const reply = buildAssistantReply(text, context);
      startTransition(() => {
        setMessages((current) => [...current, reply]);
        setIsThinking(timerIdsRef.current.length > 0);
      });
    }, 420);
    timerIdsRef.current = [...timerIdsRef.current, id];
  }

  function clearChat() {
    timerIdsRef.current.forEach((id) => window.clearTimeout(id));
    timerIdsRef.current = [];
    setIsThinking(false);
    setMessages([buildWelcomeMessage(context)]);
  }

  return (
    <section className="motion-surface" style={{ background: "radial-gradient(circle at top left, rgba(244, 189, 92, 0.25), transparent 28%), linear-gradient(180deg, #fffdf8 0%, #f3e6d1 100%)", border: `1px solid ${theme.line}`, borderRadius: 32, padding: 28 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1.1fr) minmax(260px, 0.9fr)", gap: 18, alignItems: "start", marginBottom: 20 }}>
        <div className="dashboard-card" style={{ ...cardStyle, background: "rgba(255,255,255,0.76)" }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: theme.muted }}>Part 3 Platform</p>
          <h2 style={{ margin: "10px 0 12px", fontSize: 38, lineHeight: 1 }}>Compass Robo Adviser</h2>
          <p style={{ margin: 0, color: theme.muted, lineHeight: 1.6 }}>
            A portfolio-ready web platform that combines the 10-fund efficient frontier, a questionnaire-driven risk engine, and an AI chatbot for guided explanations.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <span style={{ padding: "8px 12px", borderRadius: 999, background: theme.soft, color: theme.ink, fontSize: 14 }}>{frontierData.funds.length} funds</span>
            <span style={{ padding: "8px 12px", borderRadius: 999, background: theme.soft, color: theme.ink, fontSize: 14 }}>{riskData.metadata.sample_start} to {riskData.metadata.sample_end}</span>
            <span style={{ padding: "8px 12px", borderRadius: 999, background: theme.soft, color: theme.ink, fontSize: 14 }}>{riskData.metadata.return_observations} monthly returns</span>
          </div>
        </div>

        <div className="dashboard-card" style={{ ...cardStyle, background: "#1f2d37", color: "#ffffff" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#bdcad4" }}>Platform Promise</div>
          <h3 style={{ margin: "10px 0 12px", fontSize: 24, lineHeight: 1.1 }}>One interface, three jobs</h3>
          <div style={{ display: "grid", gap: 10, color: "#e4edf2" }}>
            <div>1. Profile the client with a transparent risk questionnaire.</div>
            <div>2. Recommend a utility-maximizing portfolio on the frontier.</div>
            <div>3. Explain the recommendation through an AI-style chat workflow.</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1.02fr) minmax(320px, 0.98fr)", gap: 18, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18 }}>
          <div className="dashboard-card" style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.muted }}>Recommendation Cockpit</div>
                <h3 style={{ margin: "8px 0 6px", fontSize: 26 }}>{constraintMode === "longOnly" ? "Implementation portfolio" : "Short-sales benchmark"}</h3>
                <div style={{ color: theme.muted }}>Active client: <strong style={{ color: theme.ink }}>{activePersona.label}</strong> with A = <strong style={{ color: theme.ink }}>{activePersona.a.toFixed(2)}</strong>.</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={actionButton(constraintMode === "longOnly")} onClick={() => setConstraintMode("longOnly")} aria-pressed={constraintMode === "longOnly"}>Long-only</button>
                <button type="button" style={actionButton(constraintMode === "shortSalesAllowed")} onClick={() => setConstraintMode("shortSalesAllowed")} aria-pressed={constraintMode === "shortSalesAllowed"}>Short sales</button>
              </div>
            </div>

            <div className="stat-grid" style={{ marginTop: 16 }}>
              <StatCard label="Expected return" value={formatPercent(displayedPortfolio.expected_return)} />
              <StatCard label="Volatility" value={formatPercent(displayedPortfolio.risk)} />
              <StatCard label="Utility" value={displayedPortfolio.utility.toFixed(4)} />
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.muted }}>Leading holdings</div>
              <div className="holdings-list" style={{ marginTop: 12 }}>
                {topHoldings.map((row) => (
                  <HoldingBar
                    key={row.fund}
                    label={row.fund}
                    weight={row.weight}
                    color={constraintMode === "longOnly" ? theme.long : theme.short}
                    onAsk={() => submitMessage(`Why is ${row.fund} weighted so heavily in the current portfolio?`)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="dashboard-card" style={cardStyle}>
            <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.muted }}>Visual Allocation</div>
            <h3 style={{ margin: "8px 0 12px", fontSize: 26 }}>Portfolio point on the frontier</h3>
            <div style={{ overflowX: "auto" }}>
              <svg width={chart.width} height={chart.height} role="img" aria-label="Platform efficient frontier chart">
                <rect x="0" y="0" width={chart.width} height={chart.height} rx="18" fill="#fffefb" />
                {yTicks.map((tick) => (
                  <g key={`y-${tick}`}>
                    <line x1={chart.left} x2={chart.width - chart.right} y1={yScale(tick)} y2={yScale(tick)} stroke={theme.line} strokeDasharray="5 6" />
                    <text x={chart.left - 12} y={yScale(tick) + 4} textAnchor="end" fontSize="12" fill={theme.muted}>{formatPercent(tick)}</text>
                  </g>
                ))}
                {xTicks.map((tick) => (
                  <g key={`x-${tick}`}>
                    <line x1={xScale(tick)} x2={xScale(tick)} y1={chart.top} y2={chart.height - chart.bottom} stroke={theme.line} strokeDasharray="5 6" />
                    <text x={xScale(tick)} y={chart.height - chart.bottom + 24} textAnchor="middle" fontSize="12" fill={theme.muted}>{formatPercent(tick)}</text>
                  </g>
                ))}
                <line x1={chart.left} x2={chart.left} y1={chart.top} y2={chart.height - chart.bottom} stroke={theme.ink} />
                <line x1={chart.left} x2={chart.width - chart.right} y1={chart.height - chart.bottom} y2={chart.height - chart.bottom} stroke={theme.ink} />
                <path d={pathFromPoints(frontierData.frontiers.shortSalesAllowed, xScale, yScale)} fill="none" stroke={theme.short} strokeWidth="3.2" />
                <path d={pathFromPoints(frontierData.frontiers.longOnly, xScale, yScale)} fill="none" stroke={theme.good} strokeWidth="3.2" strokeDasharray="8 6" />
                {riskData.funds.map((fund) => (
                  <g key={fund.index}>
                    <circle cx={xScale(fund.annualVolatility)} cy={yScale(fund.annualReturn)} r="6.2" fill={theme.accent} />
                    <text x={xScale(fund.annualVolatility) + 8} y={yScale(fund.annualReturn) - 8} fontSize="12" fontWeight="700" fill={theme.ink}>{fund.index}</text>
                  </g>
                ))}
                <circle cx={xScale(displayedPortfolio.risk)} cy={yScale(displayedPortfolio.expected_return)} r="11" fill={constraintMode === "longOnly" ? theme.long : theme.short} stroke="#111111" strokeWidth="2" />
              </svg>
            </div>
            <div style={{ marginTop: 12, color: theme.muted, lineHeight: 1.55 }}>The filled marker shows the selected client recommendation directly on the efficient frontier.</div>
          </div>

          <div className="dashboard-card" style={cardStyle}>
            <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.muted }}>AI Chatbot</div>
            <h3 style={{ margin: "8px 0 12px", fontSize: 26 }}>Explain the portfolio in plain language</h3>
            <div className="chat-context">
              <div>
                <strong>Live context</strong>
                <div style={{ marginTop: 4, color: "rgba(255,255,255,0.82)" }}>{activePersona.label} | {constraintMode === "longOnly" ? "Long-only implementation" : "Short-sales benchmark"}</div>
                <div style={{ marginTop: 6, color: "rgba(255,255,255,0.72)", fontSize: 13 }}>Future replies always use the currently selected persona and constraint set.</div>
              </div>
              <div className="chat-badges">
                <span className="chat-badge">A = {activePersona.a.toFixed(2)}</span>
                <span className="chat-badge">Return {formatPercent(displayedPortfolio.expected_return)}</span>
                <span className="chat-badge">Vol {formatPercent(displayedPortfolio.risk)}</span>
              </div>
            </div>

            <div className="chat-scenario-strip" style={{ marginTop: 12 }}>
              <div className="chat-scenario-card">
                <span>Current top idea</span>
                <strong>{topHoldings[0]?.fund ?? "No active holding"}</strong>
              </div>
              <div className="chat-scenario-card">
                <span>GMVP anchor</span>
                <strong>{formatPercent(frontierData.gmvp.longOnly.risk)} vol</strong>
              </div>
              <div className="chat-scenario-card">
                <span>Data window</span>
                <strong>{riskData.metadata.sample_start} to {riskData.metadata.sample_end}</strong>
              </div>
            </div>

            <div className="prompt-grid" style={{ marginTop: 12 }}>
              {prompts.map((prompt) => (
                <button key={prompt} type="button" className="prompt-chip" style={actionButton(false)} onClick={() => submitMessage(prompt)}>{prompt}</button>
              ))}
            </div>

            <div ref={chatViewportRef} className="chat-log" style={{ borderRadius: 20, border: `1px solid ${theme.line}`, background: "#fffefb", padding: 14, minHeight: 360, display: "grid", gap: 10, alignContent: "start", marginTop: 12 }}>
              {messages.map((message, index) => (
                <ChatMessage key={`${message.role}-${index}`} message={message} onSuggestionClick={submitMessage} />
              ))}
              {isThinking ? <div className="chat-status">{thinkingLabel}</div> : null}
            </div>

            <form onSubmit={(event) => { event.preventDefault(); submitMessage(draft); }} className="chat-composer" style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, marginTop: 12 }}>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about the client profile, a fund, the frontier, or the recommendation" style={{ borderRadius: 16, border: `1px solid ${theme.line}`, padding: "14px 16px", fontSize: 14 }} />
              <button type="submit" style={actionButton(true)}>Send</button>
              <button type="button" style={actionButton(false)} onClick={clearChat}>Clear</button>
            </form>
          </div>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <div className="dashboard-card" style={cardStyle}>
            <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.muted }}>Client Profiles</div>
            <h3 style={{ margin: "8px 0 12px", fontSize: 26 }}>Switch investor persona</h3>
            <div className="persona-grid">
              {personas.map((persona) => {
                const active = persona.id === selectedPersonaId;
                return (
                  <button key={persona.id} type="button" className={active ? "persona-card persona-card-active" : "persona-card"} onClick={() => setSelectedPersonaId(persona.id)} aria-pressed={active}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <strong>{persona.label}</strong>
                      <span>A = {persona.a.toFixed(1)}</span>
                    </div>
                    <div className="muted-copy" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.45 }}>{persona.blurb}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="dashboard-card" style={cardStyle}>
            <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.muted }}>Frontier Anchors</div>
            <h3 style={{ margin: "8px 0 12px", fontSize: 26 }}>Key reference points</h3>
            <div className="stat-grid">
              <StatCard label="Long-only GMVP" value={`${formatPercent(frontierData.gmvp.longOnly.risk)} vol`} note={`${formatPercent(frontierData.gmvp.longOnly.return)} return`} />
              <StatCard label="Short-sales GMVP" value={`${formatPercent(frontierData.gmvp.shortSalesAllowed.risk)} vol`} note={`${formatPercent(frontierData.gmvp.shortSalesAllowed.return)} return`} />
              <StatCard label="Data window" value={riskData.metadata.sample_start} note={`to ${riskData.metadata.sample_end}`} />
            </div>
            <div style={{ marginTop: 14, borderRadius: 18, padding: 14, background: "#fcf5e8", border: `1px solid ${theme.line}`, color: theme.muted, lineHeight: 1.5 }}>
              Current long-only anchors for {activePersona.label}: {longAnchors.map((row) => `${row.fund} ${formatPercent(row.weight)}`).join(", ")}.
            </div>
          </div>

          <div className="dashboard-card" style={cardStyle}>
            <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.muted }}>Fund Shelf</div>
            <h3 style={{ margin: "8px 0 12px", fontSize: 26 }}>Explore the 10-fund universe</h3>
            <div className="fund-shelf">
              {riskData.funds.map((fund) => (
                <button key={fund.index} type="button" className="fund-card fund-card-interactive" onClick={() => submitMessage(`Tell me about Fund ${fund.index} and its role in the current recommendation.`)}>
                  <h4>{fund.index}. {fund.shortName}</h4>
                  <div className="muted-copy" style={{ fontSize: 13, lineHeight: 1.45 }}>{fundThemes[fund.index]}</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 4, fontSize: 13 }}>
                    <div>Return: {formatPercent(fund.annualReturn)}</div>
                    <div>Volatility: {formatPercent(fund.annualVolatility)}</div>
                    <div style={{ color: theme.muted }}>Relative spread: {formatSignedPercent(fund.annualReturn - displayedPortfolio.risk, 1)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="dashboard-card" style={{ ...cardStyle, background: "#1f2d37", color: "#ffffff" }}>
            <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#b8c5cf" }}>Why This Platform Works</div>
            <div style={{ display: "grid", gap: 10, marginTop: 12, color: "#e5edf2", lineHeight: 1.55 }}>
              <div><strong>Transparent:</strong> the questionnaire-to-A mapping is explicit and auditable.</div>
              <div><strong>Explainable:</strong> the chatbot answers from the same frontier and utility outputs shown on screen.</div>
              <div><strong>Portfolio-ready:</strong> the long-only default keeps the recommendation practical for real-world retail deployment.</div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.14)", color: "#b8c5cf" }}>
              {shortExposures.length > 0 ? `Theoretical short exposures include ${shortExposures.map((row) => `${row.fund} ${formatPercent(row.weight)}`).join(", ")}.` : "The implementation view does not use short exposures."}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
