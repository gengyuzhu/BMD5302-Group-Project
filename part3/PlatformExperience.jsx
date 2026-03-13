import React, { startTransition, useEffect, useMemo, useRef, useState } from "react";
import frontierData from "../part1_outputs/efficient_frontier_data.json";
import riskData from "../part2/outputs/part2_risk_profile_data.json";

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

function HoldingBar({ label, weight, color }) {
  return (
    <div className="holdings-row">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span>{label}</span>
        <strong>{formatPercent(weight)}</strong>
      </div>
      <div className="mini-meter">
        <span style={{ width: `${Math.min(100, Math.abs(weight) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function buildAssistantReply(message, context) {
  const lower = message.toLowerCase();
  const { activePersona, activeLongPortfolio, activeShortPortfolio, displayedPortfolio, constraintMode, funds, gmvpLong, gmvpShort } = context;
  const fund = detectFund(message, funds);
  if (/\b(hi|hello|hey)\b/.test(lower)) {
    return `Hello. The active client profile is ${activePersona.label} with A = ${activePersona.a.toFixed(2)}. Ask about the recommendation, the questionnaire, the GMVP, or any fund.`;
  }
  if (fund) {
    return `${fund.index}. ${fund.shortName}. Theme: ${fundThemes[fund.index]}. Annualized return: ${formatPercent(fund.annualReturn)}. Annualized volatility: ${formatPercent(fund.annualVolatility)}.`;
  }
  if (lower.includes("questionnaire") || lower.includes("risk aversion") || /\bhow.*\ba\b/.test(lower)) {
    return `The platform scores eight questions, converts the weighted score into a risk-tolerance index T, then maps it with A = 10 - 9T. For the active client, ${activePersona.label} corresponds to A = ${activePersona.a.toFixed(2)}.`;
  }
  if (lower.includes("gmvp") || lower.includes("frontier")) {
    return `The GMVP is the lowest-volatility point on the frontier. The long-only GMVP is ${formatPercent(gmvpLong.return)} return at ${formatPercent(gmvpLong.risk)} volatility. The short-sales GMVP is ${formatPercent(gmvpShort.return)} return at ${formatPercent(gmvpShort.risk)} volatility.`;
  }
  if (lower.includes("compare") || lower.includes("difference") || lower.includes("conservative") || lower.includes("bold")) {
    return `For ${activePersona.label}, the long-only portfolio targets ${formatPercent(activeLongPortfolio.expected_return)} return with ${formatPercent(activeLongPortfolio.risk)} volatility. The short-sales benchmark targets ${formatPercent(activeShortPortfolio.expected_return)} return with ${formatPercent(activeShortPortfolio.risk)} volatility, but it is less practical for a retail robo-adviser.`;
  }
  if (lower.includes("short") || lower.includes("long-only") || lower.includes("preferred")) {
    return `The platform recommends long-only implementation because it avoids leverage, borrow cost, and operational complexity. The current long-only portfolio delivers ${formatPercent(activeLongPortfolio.expected_return)} expected return at ${formatPercent(activeLongPortfolio.risk)} volatility.`;
  }
  if (lower.includes("holdings") || lower.includes("weights") || lower.includes("portfolio") || lower.includes("recommend") || lower.includes("summary")) {
    const leaders = positiveWeights(displayedPortfolio.weights, 3)
      .map((row) => `${row.fund} ${formatPercent(row.weight)}`)
      .join(", ");
    return `For ${activePersona.label}, the ${constraintMode === "longOnly" ? "implementation portfolio" : "benchmark portfolio"} targets ${formatPercent(displayedPortfolio.expected_return)} expected return with ${formatPercent(displayedPortfolio.risk)} volatility. The main holdings are ${leaders}.`;
  }
  if (lower.includes("data") || lower.includes("csv") || lower.includes("sample")) {
    return `The platform uses the same 10 CSV files as Parts 1 and 2 and is aligned to the common monthly sample from ${riskData.metadata.sample_start} to ${riskData.metadata.sample_end}.`;
  }
  return `I can explain the recommendation, the questionnaire-to-A mapping, the GMVP, or any of the 10 funds. Try asking about Fund 8 or why long-only is preferred.`;
}

export default function PlatformExperience() {
  const initialAssistant = "I'm the robo-adviser copilot. Ask about the current portfolio, how A is calculated, the efficient frontier, or any of the 10 funds.";
  const [selectedPersonaId, setSelectedPersonaId] = useState("growth");
  const [constraintMode, setConstraintMode] = useState("longOnly");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([{ role: "assistant", text: initialAssistant }]);
  const [isThinking, setIsThinking] = useState(false);
  const chatViewportRef = useRef(null);
  const timerIdsRef = useRef([]);

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

  const prompts = useMemo(
    () => [
      `Summarize the recommendation for ${activePersona.label}.`,
      "Explain how the questionnaire converts answers into A.",
      "Why is the long-only portfolio preferred over short sales?",
      "What is the GMVP and why does it matter?",
      "Tell me about Fund 8.",
      "Compare the conservative and bold investor profiles.",
    ],
    [activePersona.label],
  );

  useEffect(() => {
    if (chatViewportRef.current) {
      chatViewportRef.current.scrollTo({ top: chatViewportRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isThinking]);

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
    const id = window.setTimeout(() => {
      timerIdsRef.current = timerIdsRef.current.filter((timerId) => timerId !== id);
      const reply = buildAssistantReply(text, context);
      startTransition(() => {
        setMessages((current) => [...current, { role: "assistant", text: reply }]);
        setIsThinking(timerIdsRef.current.length > 0);
      });
    }, 420);
    timerIdsRef.current = [...timerIdsRef.current, id];
  }

  function clearChat() {
    timerIdsRef.current.forEach((id) => window.clearTimeout(id));
    timerIdsRef.current = [];
    setIsThinking(false);
    setMessages([{ role: "assistant", text: initialAssistant }]);
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
                {topHoldings.map((row) => <HoldingBar key={row.fund} label={row.fund} weight={row.weight} color={constraintMode === "longOnly" ? theme.long : theme.short} />)}
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
              </div>
              <div className="chat-badges">
                <span className="chat-badge">A = {activePersona.a.toFixed(2)}</span>
                <span className="chat-badge">Return {formatPercent(displayedPortfolio.expected_return)}</span>
                <span className="chat-badge">Vol {formatPercent(displayedPortfolio.risk)}</span>
              </div>
            </div>

            <div className="prompt-grid" style={{ marginTop: 12 }}>
              {prompts.map((prompt) => (
                <button key={prompt} type="button" className="prompt-chip" style={actionButton(false)} onClick={() => submitMessage(prompt)}>{prompt}</button>
              ))}
            </div>

            <div ref={chatViewportRef} className="chat-log" style={{ borderRadius: 20, border: `1px solid ${theme.line}`, background: "#fffefb", padding: 14, minHeight: 360, display: "grid", gap: 10, alignContent: "start", marginTop: 12 }}>
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className="chat-bubble" style={{ justifySelf: message.role === "user" ? "end" : "start", maxWidth: "88%", borderRadius: 18, padding: "12px 14px", background: message.role === "user" ? "#1f2d37" : theme.soft, color: message.role === "user" ? "#ffffff" : theme.ink, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                  {message.text}
                </div>
              ))}
              {isThinking ? <div className="chat-status">AI adviser is preparing a reply</div> : null}
            </div>

            <form onSubmit={(event) => { event.preventDefault(); submitMessage(draft); }} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, marginTop: 12 }}>
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
                <div key={fund.index} className="fund-card">
                  <h4>{fund.index}. {fund.shortName}</h4>
                  <div className="muted-copy" style={{ fontSize: 13, lineHeight: 1.45 }}>{fundThemes[fund.index]}</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 4, fontSize: 13 }}>
                    <div>Return: {formatPercent(fund.annualReturn)}</div>
                    <div>Volatility: {formatPercent(fund.annualVolatility)}</div>
                  </div>
                </div>
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
