import React, { useMemo, useState } from "react";
import frontierData from "../part1_outputs/efficient_frontier_data.json";
import riskData from "../part2/outputs/part2_risk_profile_data.json";

const theme = {
  ink: "#16212b",
  muted: "#607180",
  line: "#d8ccb8",
  shell: "#fffdf8",
  card: "#ffffff",
  soft: "#f8efe2",
  accent: "#d07b2a",
  long: "#8f6846",
  short: "#376da3",
  good: "#5a9d47",
  warning: "#cb425f",
};

const personas = [
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

const quickPrompts = [
  "What portfolio do you recommend for the current client profile?",
  "Explain how the questionnaire converts answers into A.",
  "Why is the long-only portfolio preferred over short sales?",
  "What is the GMVP and why does it matter?",
  "Tell me about Fund 8.",
  "How would a conservative investor differ from a bold investor?",
];

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

function nearestPortfolio(portfolios, aValue) {
  return portfolios.reduce((best, current) =>
    Math.abs(current.risk_aversion_a - aValue) < Math.abs(best.risk_aversion_a - aValue) ? current : best,
  );
}

function sortWeights(weightMap) {
  return Object.entries(weightMap)
    .map(([fund, weight]) => ({ fund, weight }))
    .sort((left, right) => Math.abs(right.weight) - Math.abs(left.weight));
}

function positiveWeightSummary(weightMap, count = 3) {
  return sortWeights(weightMap)
    .filter((row) => row.weight > 1e-5)
    .slice(0, count);
}

function negativeWeightSummary(weightMap, count = 3) {
  return sortWeights(weightMap)
    .filter((row) => row.weight < -1e-5)
    .slice(0, count);
}

function fundAliasIndex(funds) {
  return funds.map((fund) => ({
    ...fund,
    aliases: [
      String(fund.index),
      `fund ${fund.index}`,
      fund.shortName.toLowerCase(),
      fund.displayName.toLowerCase(),
      fundThemes[fund.index].toLowerCase(),
    ],
  }));
}

function detectFund(message, funds) {
  const lower = message.toLowerCase();
  const exactNumber = lower.match(/\bfund\s*(10|[1-9])\b/);
  if (exactNumber) {
    return funds.find((fund) => fund.index === Number(exactNumber[1])) ?? null;
  }
  return fundAliasIndex(funds).find((fund) => fund.aliases.some((alias) => lower.includes(alias))) ?? null;
}

function personaFromMessage(message) {
  const lower = message.toLowerCase();
  return (
    personas.find((persona) => {
      const key = persona.label.toLowerCase();
      return lower.includes(key) || lower.includes(persona.id);
    }) ?? null
  );
}

function buildAssistantReply(message, context) {
  const lower = message.toLowerCase();
  const {
    activePersona,
    activeLongPortfolio,
    activeShortPortfolio,
    funds,
    gmvpLong,
    gmvpShort,
  } = context;

  const referencedFund = detectFund(message, funds);
  if (referencedFund) {
    return [
      `${referencedFund.index}. ${referencedFund.shortName}`,
      `Theme: ${fundThemes[referencedFund.index]}.`,
      `Annualized return in the shared sample: ${formatPercent(referencedFund.annualReturn)}.`,
      `Annualized volatility: ${formatPercent(referencedFund.annualVolatility)}.`,
      `This fund is useful when you want to explain what role a single building block plays in the broader portfolio.`,
    ].join(" ");
  }

  const referencedPersona = personaFromMessage(message);
  if (referencedPersona) {
    const personaLong = nearestPortfolio(riskData.optimalPortfolios.longOnly, referencedPersona.a);
    const topHoldings = positiveWeightSummary(personaLong.weights)
      .map((row) => `${row.fund} ${formatPercent(row.weight)}`)
      .join(", ");
    return [
      `${referencedPersona.label} uses risk aversion A = ${referencedPersona.a.toFixed(2)}.`,
      `Its long-only optimal portfolio targets ${formatPercent(personaLong.expected_return)} expected return with ${formatPercent(personaLong.risk)} volatility.`,
      `The main holdings are ${topHoldings}.`,
    ].join(" ");
  }

  if (lower.includes("questionnaire") || lower.includes("risk aversion") || /\bhow.*\ba\b/.test(lower)) {
    return [
      `The platform scores eight questions, with loss tolerance and behaviour under stress weighted twice because they are the strongest behavioural indicators.`,
      `The weighted score S is normalized into a risk-tolerance index T, then mapped by A = 10 - 9T.`,
      `For the current client profile, ${activePersona.label} corresponds to A = ${activePersona.a.toFixed(2)}.`,
    ].join(" ");
  }

  if (lower.includes("gmvp") || lower.includes("frontier")) {
    return [
      `The GMVP is the Global Minimum Variance Portfolio, the lowest-volatility point on the frontier.`,
      `In this dataset the long-only GMVP has return ${formatPercent(gmvpLong.return)} and volatility ${formatPercent(gmvpLong.risk)}.`,
      `Allowing short sales pushes the theoretical GMVP to return ${formatPercent(gmvpShort.return)} with volatility ${formatPercent(gmvpShort.risk)}, but that is less realistic for a retail platform.`,
    ].join(" ");
  }

  if (lower.includes("short") || lower.includes("long-only") || lower.includes("long only") || lower.includes("preferred")) {
    const shortLongs = positiveWeightSummary(activeShortPortfolio.weights)
      .map((row) => `${row.fund} ${formatPercent(row.weight)}`)
      .join(", ");
    const shortShorts = negativeWeightSummary(activeShortPortfolio.weights)
      .map((row) => `${row.fund} ${formatPercent(row.weight)}`)
      .join(", ");
    return [
      `The platform recommends the long-only portfolio because it is implementable for a retail robo-adviser without leverage, borrow cost, or short-sale constraints.`,
      `For the current client, the long-only solution delivers ${formatPercent(activeLongPortfolio.expected_return)} expected return at ${formatPercent(activeLongPortfolio.risk)} volatility.`,
      `The short-sales benchmark is mathematically stronger but far less practical because it relies on large long positions such as ${shortLongs} and short positions such as ${shortShorts}.`,
    ].join(" ");
  }

  if (lower.includes("recommend") || lower.includes("portfolio") || lower.includes("allocate")) {
    const topHoldings = positiveWeightSummary(activeLongPortfolio.weights)
      .map((row) => `${row.fund} ${formatPercent(row.weight)}`)
      .join(", ");
    return [
      `For ${activePersona.label}, I recommend the long-only portfolio with A = ${activePersona.a.toFixed(2)}.`,
      `That portfolio targets ${formatPercent(activeLongPortfolio.expected_return)} expected return with ${formatPercent(activeLongPortfolio.risk)} volatility.`,
      `The main holdings are ${topHoldings}.`,
    ].join(" ");
  }

  if (lower.includes("data") || lower.includes("csv") || lower.includes("sample")) {
    return [
      `The platform is built from the same 10 CSV files used in Parts 1 and 2.`,
      `All portfolio analytics are based on the common monthly sample from ${riskData.metadata.sample_start} to ${riskData.metadata.sample_end}, which gives ${riskData.metadata.return_observations} monthly return observations.`,
      `That keeps the dashboard, optimizer, and chatbot on one consistent dataset.`,
    ].join(" ");
  }

  return [
    `I can help explain the recommended portfolio, the risk-aversion formula, individual funds, the efficient frontier, or why long-only is preferred.`,
    `Try asking about Fund 8, the questionnaire-to-A mapping, or the current client recommendation.`,
  ].join(" ");
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

export default function PlatformExperience() {
  const [selectedPersonaId, setSelectedPersonaId] = useState("growth");
  const [constraintMode, setConstraintMode] = useState("longOnly");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "I’m the robo-adviser copilot. Ask about the current portfolio, how A is calculated, the efficient frontier, or any of the 10 funds.",
    },
  ]);

  const activePersona = personas.find((persona) => persona.id === selectedPersonaId) ?? personas[0];
  const activeLongPortfolio = useMemo(
    () => nearestPortfolio(riskData.optimalPortfolios.longOnly, activePersona.a),
    [activePersona.a],
  );
  const activeShortPortfolio = useMemo(
    () => nearestPortfolio(riskData.optimalPortfolios.shortSalesAllowed, activePersona.a),
    [activePersona.a],
  );
  const displayedPortfolio = constraintMode === "longOnly" ? activeLongPortfolio : activeShortPortfolio;

  const topHoldings = positiveWeightSummary(displayedPortfolio.weights, 4);
  const positiveLongOnly = positiveWeightSummary(activeLongPortfolio.weights, 3);
  const shortRisks = negativeWeightSummary(activeShortPortfolio.weights, 3);
  const fundCount = frontierData.funds.length;

  const context = {
    activePersona,
    activeLongPortfolio,
    activeShortPortfolio,
    funds: riskData.funds,
    gmvpLong: frontierData.gmvp.longOnly,
    gmvpShort: frontierData.gmvp.shortSalesAllowed,
  };

  const chartDomain = useMemo(() => {
    const allRisks = riskData.funds.map((fund) => fund.annualVolatility);
    const allReturns = riskData.funds.map((fund) => fund.annualReturn);
    if (constraintMode === "shortSalesAllowed") {
      return {
        minX: 0,
        maxX:
          Math.max(
            ...allRisks,
            ...frontierData.frontiers.shortSalesAllowed.map((point) => point.risk),
            displayedPortfolio.risk,
          ) + 0.05,
        minY: Math.min(...allReturns, 0) - 0.05,
        maxY:
          Math.max(
            ...allReturns,
            ...frontierData.frontiers.shortSalesAllowed.map((point) => point.return),
            displayedPortfolio.expected_return,
          ) + 0.2,
      };
    }
    return {
      minX: 0,
      maxX:
        Math.max(
          ...allRisks,
          ...frontierData.frontiers.longOnly.map((point) => point.risk),
          displayedPortfolio.risk,
        ) + 0.02,
      minY: Math.min(...allReturns, 0) - 0.05,
      maxY:
        Math.max(
          ...allReturns,
          ...frontierData.frontiers.longOnly.map((point) => point.return),
          displayedPortfolio.expected_return,
        ) + 0.04,
    };
  }, [constraintMode, displayedPortfolio.expected_return, displayedPortfolio.risk]);

  const chart = { width: 760, height: 380, left: 68, right: 30, top: 24, bottom: 50 };
  const xScale = (value) =>
    chart.left +
    ((value - chartDomain.minX) / (chartDomain.maxX - chartDomain.minX || 1)) *
      (chart.width - chart.left - chart.right);
  const yScale = (value) =>
    chart.height -
    chart.bottom -
    ((value - chartDomain.minY) / (chartDomain.maxY - chartDomain.minY || 1)) *
      (chart.height - chart.top - chart.bottom);
  const xTicks = makeTicks(chartDomain.minX, chartDomain.maxX, 5);
  const yTicks = makeTicks(chartDomain.minY, chartDomain.maxY, 5);

  function submitMessage(rawText) {
    const text = rawText.trim();
    if (!text) {
      return;
    }
    const reply = buildAssistantReply(text, context);
    setMessages((current) => [
      ...current,
      { role: "user", text },
      { role: "assistant", text: reply },
    ]);
    setDraft("");
  }

  return (
    <section
      style={{
        background:
          "radial-gradient(circle at top left, rgba(244, 189, 92, 0.25), transparent 28%), linear-gradient(180deg, #fffdf8 0%, #f3e6d1 100%)",
        border: `1px solid ${theme.line}`,
        borderRadius: 32,
        padding: 28,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1.1fr) minmax(260px, 0.9fr)",
          gap: 18,
          alignItems: "start",
          marginBottom: 20,
        }}
      >
        <div style={{ ...cardStyle, background: "rgba(255,255,255,0.76)" }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: theme.muted }}>
            Part 3 Platform
          </p>
          <h2 style={{ margin: "10px 0 12px", fontSize: 38, lineHeight: 1 }}>Compass Robo Adviser</h2>
          <p style={{ margin: 0, color: theme.muted, lineHeight: 1.6, maxWidth: 760 }}>
            A portfolio-ready web platform that combines the 10-fund efficient frontier, a
            questionnaire-driven risk engine, and an AI chatbot for guided explanations. The same
            dataset powers every screen, so the recommendation logic, analytics, and chat answers
            stay numerically aligned.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <span style={{ padding: "8px 12px", borderRadius: 999, background: theme.soft, color: theme.ink, fontSize: 14 }}>
              {fundCount} funds
            </span>
            <span style={{ padding: "8px 12px", borderRadius: 999, background: theme.soft, color: theme.ink, fontSize: 14 }}>
              {riskData.metadata.sample_start} to {riskData.metadata.sample_end}
            </span>
            <span style={{ padding: "8px 12px", borderRadius: 999, background: theme.soft, color: theme.ink, fontSize: 14 }}>
              {riskData.metadata.return_observations} monthly returns
            </span>
          </div>
        </div>

        <div style={{ ...cardStyle, background: "#1f2d37", color: "#ffffff" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#bdcad4" }}>
            Platform Promise
          </div>
          <h3 style={{ margin: "10px 0 12px", fontSize: 24, lineHeight: 1.1 }}>One interface, three jobs</h3>
          <div style={{ display: "grid", gap: 10, color: "#e4edf2" }}>
            <div>1. Profile the client with a transparent risk questionnaire.</div>
            <div>2. Recommend a utility-maximizing portfolio on the frontier.</div>
            <div>3. Explain the recommendation through an AI-style chat workflow.</div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1.02fr) minmax(320px, 0.98fr)",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 18 }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.muted }}>
              Visual Allocation
            </div>
            <h3 style={{ margin: "8px 0 12px", fontSize: 26 }}>Portfolio point on the frontier</h3>
            <div style={{ overflowX: "auto" }}>
              <svg width={chart.width} height={chart.height} role="img" aria-label="Platform efficient frontier chart">
                <rect x="0" y="0" width={chart.width} height={chart.height} rx="18" fill="#fffefb" />

                {yTicks.map((tick) => (
                  <g key={`y-${tick}`}>
                    <line x1={chart.left} x2={chart.width - chart.right} y1={yScale(tick)} y2={yScale(tick)} stroke={theme.line} strokeDasharray="5 6" />
                    <text x={chart.left - 12} y={yScale(tick) + 4} textAnchor="end" fontSize="12" fill={theme.muted}>
                      {formatPercent(tick)}
                    </text>
                  </g>
                ))}

                {xTicks.map((tick) => (
                  <g key={`x-${tick}`}>
                    <line x1={xScale(tick)} x2={xScale(tick)} y1={chart.top} y2={chart.height - chart.bottom} stroke={theme.line} strokeDasharray="5 6" />
                    <text x={xScale(tick)} y={chart.height - chart.bottom + 24} textAnchor="middle" fontSize="12" fill={theme.muted}>
                      {formatPercent(tick)}
                    </text>
                  </g>
                ))}

                <line x1={chart.left} x2={chart.left} y1={chart.top} y2={chart.height - chart.bottom} stroke={theme.ink} />
                <line x1={chart.left} x2={chart.width - chart.right} y1={chart.height - chart.bottom} y2={chart.height - chart.bottom} stroke={theme.ink} />

                <path d={pathFromPoints(frontierData.frontiers.shortSalesAllowed, xScale, yScale)} fill="none" stroke={theme.short} strokeWidth="3.2" />
                <path d={pathFromPoints(frontierData.frontiers.longOnly, xScale, yScale)} fill="none" stroke={theme.good} strokeWidth="3.2" strokeDasharray="8 6" />

                {riskData.funds.map((fund) => (
                  <g key={fund.index}>
                    <circle cx={xScale(fund.annualVolatility)} cy={yScale(fund.annualReturn)} r="6.2" fill={theme.accent} />
                    <text x={xScale(fund.annualVolatility) + 8} y={yScale(fund.annualReturn) - 8} fontSize="12" fontWeight="700" fill={theme.ink}>
                      {fund.index}
                    </text>
                  </g>
                ))}

                <circle
                  cx={xScale(displayedPortfolio.risk)}
                  cy={yScale(displayedPortfolio.expected_return)}
                  r="11"
                  fill={constraintMode === "longOnly" ? theme.long : theme.short}
                  stroke="#111111"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <div style={{ marginTop: 12, color: theme.muted, lineHeight: 1.55 }}>
              The selected client profile is currently plotted as the filled marker. This turns the
              efficient frontier from an abstract finance chart into a client-facing recommendation
              surface.
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.muted }}>
              AI Chatbot
            </div>
            <h3 style={{ margin: "8px 0 12px", fontSize: 26 }}>Explain the portfolio in plain language</h3>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {quickPrompts.map((prompt) => (
                <button key={prompt} type="button" style={actionButton(false)} onClick={() => submitMessage(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>

            <div
              style={{
                borderRadius: 20,
                border: `1px solid ${theme.line}`,
                background: "#fffefb",
                padding: 14,
                minHeight: 360,
                display: "grid",
                gap: 10,
                alignContent: "start",
              }}
            >
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  style={{
                    justifySelf: message.role === "user" ? "end" : "start",
                    maxWidth: "88%",
                    borderRadius: 18,
                    padding: "12px 14px",
                    background: message.role === "user" ? "#1f2d37" : theme.soft,
                    color: message.role === "user" ? "#ffffff" : theme.ink,
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.55,
                  }}
                >
                  {message.text}
                </div>
              ))}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitMessage(draft);
              }}
              style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginTop: 12 }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask about the client profile, a fund, the frontier, or the recommendation"
                style={{
                  borderRadius: 16,
                  border: `1px solid ${theme.line}`,
                  padding: "14px 16px",
                  fontSize: 14,
                }}
              />
              <button type="submit" style={actionButton(true)}>
                Send
              </button>
            </form>

            <div
              style={{
                marginTop: 14,
                borderRadius: 18,
                padding: 14,
                background: "#f4f8fb",
                border: "1px solid #cbd9e5",
                color: theme.muted,
                lineHeight: 1.5,
              }}
            >
              This chatbot is a local AI-style advisory prototype. It does not need external API
              keys and answers from the same Part 1 and Part 2 model outputs used by the dashboard.
            </div>
          </div>

          <div style={{ ...cardStyle, background: "#1f2d37", color: "#ffffff" }}>
            <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#b8c5cf" }}>
              Why This Platform Works
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 12, color: "#e5edf2", lineHeight: 1.55 }}>
              <div>
                <strong>Transparent:</strong> the questionnaire-to-A mapping is explicit and auditable.
              </div>
              <div>
                <strong>Explainable:</strong> the chatbot can justify recommendations using the same
                efficient frontier and utility model shown on screen.
              </div>
              <div>
                <strong>Portfolio-ready:</strong> the long-only default keeps the recommendation
                practical for real-world retail deployment.
              </div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.14)", color: "#b8c5cf" }}>
              Current long-only anchors for {activePersona.label}:{" "}
              {positiveLongOnly.map((row) => `${row.fund} ${formatPercent(row.weight)}`).join(", ")}.
              {shortRisks.length > 0 ? ` Theoretical short exposures: ${shortRisks.map((row) => `${row.fund} ${formatPercent(row.weight)}`).join(", ")}.` : ""}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
