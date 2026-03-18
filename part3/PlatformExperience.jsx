import React, { startTransition, useEffect, useMemo, useRef, useState } from "react";
import frontierData from "../part1_outputs/efficient_frontier_data.json";
import riskData from "../part2_outputs/part2_risk_profile_data.json";

/* ═══════════════════════════════════════════════════════════════
   Theme & Constants
   ═══════════════════════════════════════════════════════════════ */

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
  { id: "steady", label: "Steady Saver", a: 8.0, blurb: "Capital preservation first, with steady growth as a secondary goal.", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
  { id: "balanced", label: "Balanced Builder", a: 6.0, blurb: "A balanced investor who accepts measured volatility for better returns.", icon: "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" },
  { id: "growth", label: "Growth Explorer", a: 4.6, blurb: "Matches the example investor from Part 2 and targets disciplined long-term growth.", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
  { id: "bold", label: "Bold Navigator", a: 2.0, blurb: "Aggressive growth preference with much higher tolerance for market swings.", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
];

const fundThemes = {
  1: "Singapore equity", 2: "Hong Kong tech", 3: "SGD bond",
  4: "Global technology", 5: "Income fund", 6: "US technology",
  7: "Asian growth", 8: "Gold thematic", 9: "India equity", 10: "SGD low-volatility core",
};

const personaAliases = {
  steady: "steady", conservative: "steady", saver: "steady",
  balanced: "balanced", moderate: "balanced",
  growth: "growth", explorer: "growth",
  bold: "bold", aggressive: "bold", navigator: "bold",
};

const DONUT_COLORS = ["#d07b2a", "#376da3", "#5a9d47", "#8f6846", "#c4a35a", "#607180", "#2a8f7c", "#a05a9d", "#d14949", "#4a90d0"];

const thinkingLabels = [
  "Reviewing the frontier and utility outputs",
  "Checking the live persona and constraint mode",
  "Building a portfolio explanation from Parts 1 and 2",
  "Analyzing fund correlations and weights",
  "Cross-referencing risk aversion parameters",
  "Preparing an insight from the efficient frontier",
];

/* ═══════════════════════════════════════════════════════════════
   Utility Functions
   ═══════════════════════════════════════════════════════════════ */

const cardStyle = {
  background: theme.card,
  border: `1px solid ${theme.line}`,
  borderRadius: 24,
  padding: 22,
  boxShadow: "0 18px 38px rgba(31, 43, 55, 0.08)",
};

const actionButton = (active) => ({
  borderRadius: 999,
  border: `1px solid ${active ? theme.ink : theme.line}`,
  background: active ? `linear-gradient(135deg, ${theme.ink}, #2a4054)` : "#ffffff",
  color: active ? "#ffffff" : theme.ink,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: active ? "0 6px 18px rgba(22, 33, 43, 0.18)" : "none",
});

const formatPercent = (value, digits = 2) => `${(value * 100).toFixed(digits)}%`;
const formatSignedPercent = (value, digits = 2) => `${value > 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;

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
  if (exact) return funds.find((f) => f.index === Number(exact[1])) ?? null;
  return funds.find((f) =>
    [f.shortName, f.displayName, fundThemes[f.index], String(f.index), `fund ${f.index}`]
      .map((s) => s.toLowerCase()).some((s) => lower.includes(s)),
  ) ?? null;
}

function detectFunds(message, funds) {
  const lower = message.toLowerCase();
  const matches = new Map();
  [...lower.matchAll(/\bfund\s*(10|[1-9])\b/g)].forEach((m) => {
    const f = funds.find((x) => x.index === Number(m[1]));
    if (f) matches.set(f.index, f);
  });
  funds.forEach((f) => {
    const aliases = [f.shortName, f.displayName, fundThemes[f.index], String(f.index), `fund ${f.index}`].map((s) => s.toLowerCase());
    if (aliases.some((a) => lower.includes(a))) matches.set(f.index, f);
  });
  return [...matches.values()];
}

function detectPersonas(message) {
  const lower = message.toLowerCase();
  const ids = new Set();
  Object.entries(personaAliases).forEach(([alias, pid]) => { if (lower.includes(alias)) ids.add(pid); });
  return personas.filter((p) => ids.has(p.id));
}

function assistantMessage({ title, text, bullets = [], stats = [], suggestions = [], showChart = false, chartData = null }) {
  return { role: "assistant", title, text, bullets, stats, suggestions, showChart, chartData };
}

function portfolioLeaders(portfolio, count = 3) {
  return positiveWeights(portfolio.weights, count).map((r) => `${r.fund} ${formatPercent(r.weight)}`).join(", ");
}

function buildWelcomeMessage(context) {
  const { activePersona, displayedPortfolio, constraintMode } = context;
  const topWeights = positiveWeights(displayedPortfolio.weights, 5);
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
    showChart: true,
    chartData: topWeights,
  });
}

function makeTicks(min, max, count = 5) {
  if (min === max) return [min];
  return Array.from({ length: count }, (_, i) => min + ((max - min) * i) / (count - 1));
}

function pathFromPoints(points, xScale, yScale) {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.risk)} ${yScale(p.return)}`).join(" ");
}

function hoverPosition(event) {
  const svg = event.currentTarget.ownerSVGElement ?? event.currentTarget;
  const rect = svg.getBoundingClientRect();
  return { x: event.clientX - rect.left + 14, y: event.clientY - rect.top - 14 };
}

/* ═══════════════════════════════════════════════════════════════
   Build Assistant Reply
   ═══════════════════════════════════════════════════════════════ */

function buildAssistantReply(message, context) {
  const lower = message.toLowerCase();
  const { activePersona, activeLongPortfolio, activeShortPortfolio, displayedPortfolio, constraintMode, funds, gmvpLong, gmvpShort } = context;
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
        { label: "Sample", value: `${riskData.metadata.sample_start} – ${riskData.metadata.sample_end}` },
      ],
      suggestions: ["Summarize the current portfolio.", "What is the GMVP and why does it matter?", "Tell me about Fund 8."],
      showChart: true,
      chartData: positiveWeights(displayedPortfolio.weights, 5),
    });
  }

  if ((lower.includes("compare") || lower.includes("difference")) && fundsMentioned.length >= 2) {
    const [f1, f2] = fundsMentioned;
    return assistantMessage({
      title: `Fund comparison: ${f1.index} vs ${f2.index}`,
      text: `${f1.shortName} and ${f2.shortName} contribute very different risk-return trade-offs.`,
      bullets: [
        `${f1.shortName}: ${formatPercent(f1.annualReturn)} return, ${formatPercent(f1.annualVolatility)} vol, weight ${formatPercent(weightOfFund(displayedPortfolio.weights, f1.shortName))}.`,
        `${f2.shortName}: ${formatPercent(f2.annualReturn)} return, ${formatPercent(f2.annualVolatility)} vol, weight ${formatPercent(weightOfFund(displayedPortfolio.weights, f2.shortName))}.`,
        `The optimizer chooses the mix that best fits A = ${activePersona.a.toFixed(2)}.`,
      ],
      suggestions: [
        `Why is ${Math.abs(weightOfFund(displayedPortfolio.weights, f1.shortName)) >= Math.abs(weightOfFund(displayedPortfolio.weights, f2.shortName)) ? f1.shortName : f2.shortName} weighted more heavily?`,
        `Tell me about Fund ${f1.index}.`, `Tell me about Fund ${f2.index}.`,
      ],
    });
  }

  if (fund && (lower.includes("why not") || lower.includes("not selected") || lower.includes("0%"))) {
    const cw = weightOfFund(displayedPortfolio.weights, fund.shortName);
    return assistantMessage({
      title: `Role of ${fund.shortName}`,
      text: Math.abs(cw) < 1e-4 ? `${fund.shortName} is at ${formatPercent(cw)} in the displayed portfolio.` : `${fund.shortName} is included at ${formatPercent(cw)}.`,
      bullets: [`Theme: ${fundThemes[fund.index]}.`, `Return: ${formatPercent(fund.annualReturn)}. Vol: ${formatPercent(fund.annualVolatility)}.`,
        Math.abs(cw) < 1e-4 ? `At A = ${activePersona.a.toFixed(2)}, other funds provide a stronger utility trade-off.` : "Weight is set by portfolio optimization."],
      stats: [{ label: "Weight", value: formatPercent(cw) }],
      suggestions: [`Tell me about Fund ${fund.index}.`, "Summarize the current portfolio.", "Compare long-only and short-sales."],
    });
  }

  if (fund) {
    return assistantMessage({
      title: `${fund.index}. ${fund.shortName}`,
      text: `${fund.shortName} gives exposure to ${fundThemes[fund.index]}.`,
      bullets: [`Return: ${formatPercent(fund.annualReturn)}.`, `Vol: ${formatPercent(fund.annualVolatility)}.`,
        `Long-only weight: ${formatPercent(weightOfFund(activeLongPortfolio.weights, fund.shortName))}.`,
        `Short-sales weight: ${formatPercent(weightOfFund(activeShortPortfolio.weights, fund.shortName))}.`],
      stats: [{ label: "Long-only", value: formatPercent(weightOfFund(activeLongPortfolio.weights, fund.shortName)) },
        { label: "Short-sales", value: formatPercent(weightOfFund(activeShortPortfolio.weights, fund.shortName)) }],
      suggestions: [`Why is ${fund.shortName} weighted this way?`, `Compare Fund ${fund.index} with Fund 8.`, "Summarize the current portfolio."],
    });
  }

  if (lower.includes("questionnaire") || lower.includes("risk aversion") || /\bhow.*\ba\b/.test(lower)) {
    return assistantMessage({
      title: "Questionnaire to A mapping",
      text: "The platform uses the Part 2 questionnaire to convert behavior into a utility input.",
      bullets: ["Each answer is scored × question weight.", "Normalized into risk tolerance T.",
        `A = 10 − 9T → ${activePersona.label} at A = ${activePersona.a.toFixed(2)}.`, "Optimizer maximizes U = r − ½·A·σ²."],
      stats: [{ label: "Questions", value: String(riskData.questionnaire.questionnaire.length) }, { label: "A", value: activePersona.a.toFixed(2) }],
      suggestions: ["What does a higher A mean?", "Summarize the current portfolio.", "Compare conservative and bold."],
    });
  }

  if (lower.includes("gmvp") || lower.includes("frontier")) {
    return assistantMessage({
      title: "Efficient frontier reference points",
      text: "The GMVP is the lowest-volatility portfolio on each frontier.",
      bullets: [`Long-only GMVP: ${formatPercent(gmvpLong.return)} return, ${formatPercent(gmvpLong.risk)} vol.`,
        `Short-sales GMVP: ${formatPercent(gmvpShort.return)} return, ${formatPercent(gmvpShort.risk)} vol.`,
        `Current: ${formatPercent(displayedPortfolio.expected_return)} return, ${formatPercent(displayedPortfolio.risk)} vol.`],
      stats: [{ label: "Utility", value: displayedPortfolio.utility.toFixed(4) }],
      suggestions: ["Why not the GMVP?", "Compare long-only and short-sales.", "Summarize the current portfolio."],
    });
  }

  if (lower.includes("compare") || lower.includes("difference") || personasMentioned.length >= 2 || lower.includes("conservative") || lower.includes("bold")) {
    const [p1, p2] = personasMentioned.length >= 2 ? personasMentioned : [personas[0], personas[3]];
    const l1 = nearestPortfolio(riskData.optimalPortfolios.longOnly, p1.a);
    const l2 = nearestPortfolio(riskData.optimalPortfolios.longOnly, p2.a);
    return assistantMessage({
      title: `${p1.label} vs ${p2.label}`,
      text: "As A falls, the optimizer moves further up the frontier.",
      bullets: [`${p1.label}: A=${p1.a.toFixed(2)}, ${formatPercent(l1.expected_return)} return, ${formatPercent(l1.risk)} vol.`,
        `${p2.label}: A=${p2.a.toFixed(2)}, ${formatPercent(l2.expected_return)} return, ${formatPercent(l2.risk)} vol.`,
        "Lower-A investors accept larger drawdowns for higher expected return."],
      suggestions: [`Summarize for ${activePersona.label}.`, "Explain how A is calculated.", "Why long-only?"],
    });
  }

  if (lower.includes("short") || lower.includes("long-only") || lower.includes("preferred")) {
    return assistantMessage({
      title: "Constraint-set comparison",
      text: "Long-only is the default — more implementable for retail.",
      bullets: [`Long-only: ${formatPercent(activeLongPortfolio.expected_return)} return, ${formatPercent(activeLongPortfolio.risk)} vol.`,
        `Short-sales: ${formatPercent(activeShortPortfolio.expected_return)} return, ${formatPercent(activeShortPortfolio.risk)} vol.`,
        "Long-only avoids leverage and operational friction.",
        shortExposures.length > 0 ? `Short depends on ${shortExposures.map((r) => `${r.fund} ${formatPercent(r.weight)}`).join(", ")}.` : "Same 10-fund universe."],
      stats: [{ label: "Long U", value: activeLongPortfolio.utility.toFixed(4) }, { label: "Short U", value: activeShortPortfolio.utility.toFixed(4) }],
      suggestions: ["Summarize portfolio.", "GMVP?", "Top holdings."],
    });
  }

  if (lower.includes("holdings") || lower.includes("weights") || lower.includes("portfolio") || lower.includes("recommend") || lower.includes("summary")) {
    return assistantMessage({
      title: "Recommendation summary",
      text: `For ${activePersona.label}, the ${constraintMode === "longOnly" ? "implementation" : "benchmark"} portfolio targets ${formatPercent(displayedPortfolio.expected_return)} return at ${formatPercent(displayedPortfolio.risk)} vol.`,
      bullets: [`Utility: ${displayedPortfolio.utility.toFixed(4)}.`, `Top: ${portfolioLeaders(displayedPortfolio)}.`,
        constraintMode === "shortSalesAllowed" && shortExposures.length > 0
          ? `Shorts: ${shortExposures.map((r) => `${r.fund} ${formatPercent(r.weight)}`).join(", ")}.` : "No short positions — practical for retail."],
      stats: [{ label: "A", value: activePersona.a.toFixed(2) }, { label: "Return", value: formatPercent(displayedPortfolio.expected_return) }, { label: "Vol", value: formatPercent(displayedPortfolio.risk) }],
      suggestions: ["Why these leaders?", "Long vs short.", "Tell me about Fund 4."],
      showChart: true, chartData: positiveWeights(displayedPortfolio.weights, 5),
    });
  }

  if (lower.includes("data") || lower.includes("csv") || lower.includes("sample")) {
    return assistantMessage({
      title: "Data scope",
      text: "Platform driven by Part 1 and Part 2 outputs.",
      bullets: [`${funds.length} funds.`, `${riskData.metadata.sample_start} to ${riskData.metadata.sample_end}.`, `${riskData.metadata.return_observations} monthly returns.`],
      suggestions: ["GMVP?", "How is A calculated?", "Summarize portfolio."],
    });
  }

  return assistantMessage({
    title: "Try one of these directions",
    text: "I can answer from the frontier and utility outputs on this page.",
    bullets: ["Ask about a fund by number or name.", "Ask for a recommendation summary or GMVP explanation.", "Ask how the questionnaire maps to A."],
    suggestions: ["Summarize portfolio.", "Tell me about Fund 8.", "What is the GMVP?"],
  });
}

/* ═══════════════════════════════════════════════════════════════
   Sub-Components
   ═══════════════════════════════════════════════════════════════ */

function SvgIcon({ path, size = 18, color = "currentColor", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
      <path d={path} />
    </svg>
  );
}

function MiniDonutChart({ data, size = 100 }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, r) => s + Math.abs(r.weight), 0);
  if (total === 0) return null;
  const cx = size / 2, cy = size / 2, r = size * 0.36, sw = size * 0.18;
  let offset = 0;
  const circumference = 2 * Math.PI * r;
  const segments = data.map((row, i) => {
    const frac = Math.abs(row.weight) / total;
    const dashLen = frac * circumference;
    const seg = (
      <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
        strokeWidth={sw} strokeDasharray={`${dashLen} ${circumference - dashLen}`} strokeDashoffset={-offset + circumference * 0.25} opacity="0.92" />
    );
    offset += dashLen;
    return seg;
  });
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(22,33,43,0.06)" strokeWidth={sw} />
        {segments}
        <circle cx={cx} cy={cy} r={r - sw / 2 + 1} fill="white" />
      </svg>
      <div style={{ display: "grid", gap: 3, fontSize: 12 }}>
        {data.slice(0, 4).map((row, i) => (
          <div key={row.fund} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
            <span style={{ color: theme.muted }}>{row.fund}</span>
            <strong style={{ marginLeft: "auto", color: theme.ink }}>{formatPercent(row.weight, 1)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, note }) {
  return (
    <div className="stat-card">
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: theme.muted, fontWeight: 600 }}>{label}</div>
      <div style={{ marginTop: 6, fontWeight: 700, fontSize: 18 }}>{value}</div>
      {note ? <div style={{ marginTop: 4, color: theme.muted, fontSize: 13 }}>{note}</div> : null}
    </div>
  );
}

function HoldingBar({ label, weight, color, onAsk }) {
  return (
    <div className="holdings-row">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 14 }}>{label}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <strong style={{ fontSize: 14 }}>{formatPercent(weight)}</strong>
          {onAsk ? <button type="button" className="assistant-mini-action" onClick={onAsk}>Ask</button> : null}
        </div>
      </div>
      <div className="mini-meter">
        <span style={{ width: `${Math.min(100, Math.abs(weight) * 100)}%`, background: `linear-gradient(90deg, ${color}, ${color}dd)`, transition: "width 600ms cubic-bezier(0.4,0,0.2,1)" }} />
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="typing-indicator">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </div>
  );
}

function ChatMessage({ message, onSuggestionClick }) {
  if (message.role === "user") {
    return (
      <div className="chat-bubble chat-bubble-user" style={{
        justifySelf: "end", maxWidth: "85%", borderRadius: "18px 18px 4px 18px",
        padding: "12px 16px", background: "linear-gradient(135deg, #1f2d37, #2a4054)",
        color: "#ffffff", whiteSpace: "pre-wrap", lineHeight: 1.55, boxShadow: "0 4px 12px rgba(22,33,43,0.16)",
      }}>
        {message.text}
      </div>
    );
  }
  return (
    <div className="chat-bubble chat-bubble-assistant">
      <div className="assistant-card">
        {message.title ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: `linear-gradient(135deg, ${theme.accent}, ${theme.short})` }} />
            <div className="assistant-title">{message.title}</div>
          </div>
        ) : null}
        <div className="assistant-copy">{message.text}</div>
        {message.showChart && message.chartData?.length > 0 ? <MiniDonutChart data={message.chartData} size={96} /> : null}
        {message.stats?.length ? (
          <div className="assistant-stats">
            {message.stats.map((s) => <div key={`${s.label}-${s.value}`} className="assistant-stat"><span>{s.label}</span><strong>{s.value}</strong></div>)}
          </div>
        ) : null}
        {message.bullets?.length ? (
          <div className="assistant-list">
            {message.bullets.map((b) => <div key={b} className="assistant-list-item">{b}</div>)}
          </div>
        ) : null}
        {message.suggestions?.length ? (
          <div className="assistant-followups">
            {message.suggestions.map((s) => <button key={s} type="button" className="assistant-suggestion" onClick={() => onSuggestionClick(s)}>{s}</button>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SectionHeader({ kicker, title, icon }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      {icon ? (
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, rgba(208,123,42,0.12), rgba(55,109,163,0.08))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
          <SvgIcon path={icon} size={18} color={theme.accent} />
        </div>
      ) : null}
      <div>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: theme.muted, fontWeight: 600 }}>{kicker}</div>
        <h3 style={{ margin: "6px 0 0", fontSize: 24, lineHeight: 1.15 }}>{title}</h3>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

export default function PlatformExperience() {
  const [selectedPersonaId, setSelectedPersonaId] = useState("growth");
  const [constraintMode, setConstraintMode] = useState("longOnly");
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState(thinkingLabels[0]);
  const [chartTooltip, setChartTooltip] = useState(null);
  const chatViewportRef = useRef(null);
  const timerIdsRef = useRef([]);
  const contextRef = useRef({ personaId: "growth", constraintMode: "longOnly" });

  const activePersona = personas.find((p) => p.id === selectedPersonaId) ?? personas[0];
  const activeLongPortfolio = useMemo(() => nearestPortfolio(riskData.optimalPortfolios.longOnly, activePersona.a), [activePersona.a]);
  const activeShortPortfolio = useMemo(() => nearestPortfolio(riskData.optimalPortfolios.shortSalesAllowed, activePersona.a), [activePersona.a]);
  const displayedPortfolio = constraintMode === "longOnly" ? activeLongPortfolio : activeShortPortfolio;
  const topHoldings = positiveWeights(displayedPortfolio.weights, 4);
  const longAnchors = positiveWeights(activeLongPortfolio.weights, 3);
  const shortExposures = negativeWeights(activeShortPortfolio.weights, 3);

  const context = useMemo(() => ({
    activePersona, activeLongPortfolio, activeShortPortfolio, displayedPortfolio, constraintMode,
    funds: riskData.funds, gmvpLong: frontierData.gmvp.longOnly, gmvpShort: frontierData.gmvp.shortSalesAllowed,
  }), [activeLongPortfolio, activePersona, activeShortPortfolio, constraintMode, displayedPortfolio]);

  const [messages, setMessages] = useState(() => [buildWelcomeMessage(context)]);

  const prompts = useMemo(() => [
    `Summarize the recommendation for ${activePersona.label}.`,
    "Explain how the questionnaire converts answers into A.",
    "Why is the long-only portfolio preferred over short sales?",
    "What is the GMVP and why does it matter?",
    "Compare Fund 4 and Fund 8.",
    `Why is ${topHoldings[0]?.fund ?? "the top holding"} weighted so heavily?`,
  ], [activePersona.label, topHoldings]);

  useEffect(() => {
    if (chatViewportRef.current) chatViewportRef.current.scrollTo({ top: chatViewportRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isThinking]);

  useEffect(() => {
    const prev = contextRef.current;
    if (prev.personaId === selectedPersonaId && prev.constraintMode === constraintMode) return;
    contextRef.current = { personaId: selectedPersonaId, constraintMode };
    setMessages((cur) => [...cur, assistantMessage({
      title: "Context updated",
      text: `Now using ${activePersona.label} with ${constraintMode === "longOnly" ? "long-only" : "short-sales"}.`,
      bullets: [`Return: ${formatPercent(displayedPortfolio.expected_return)}.`, `Vol: ${formatPercent(displayedPortfolio.risk)}.`, `Top: ${portfolioLeaders(displayedPortfolio)}.`],
      suggestions: ["Summarize portfolio.", "Compare long vs short.", "Explain A."],
      showChart: true, chartData: positiveWeights(displayedPortfolio.weights, 5),
    })]);
  }, [activePersona.label, constraintMode, displayedPortfolio, selectedPersonaId]);

  useEffect(() => () => { timerIdsRef.current.forEach((id) => window.clearTimeout(id)); }, []);

  const chartDomain = useMemo(() => {
    const allR = riskData.funds.map((f) => f.annualVolatility);
    const allRet = riskData.funds.map((f) => f.annualReturn);
    const frontier = constraintMode === "shortSalesAllowed" ? frontierData.frontiers.shortSalesAllowed : frontierData.frontiers.longOnly;
    const pad = constraintMode === "shortSalesAllowed" ? 0.05 : 0.02;
    return {
      minX: 0,
      maxX: Math.max(...allR, ...frontier.map((p) => p.risk), displayedPortfolio.risk) + pad,
      minY: Math.min(...allRet, 0) - 0.05,
      maxY: Math.max(...allRet, ...frontier.map((p) => p.return), displayedPortfolio.expected_return) + (constraintMode === "shortSalesAllowed" ? 0.2 : 0.04),
    };
  }, [constraintMode, displayedPortfolio.expected_return, displayedPortfolio.risk]);

  const chart = { width: 760, height: 430, left: 74, right: 34, top: 28, bottom: 78 };
  const xScale = (v) => chart.left + ((v - chartDomain.minX) / (chartDomain.maxX - chartDomain.minX || 1)) * (chart.width - chart.left - chart.right);
  const yScale = (v) => chart.height - chart.bottom - ((v - chartDomain.minY) / (chartDomain.maxY - chartDomain.minY || 1)) * (chart.height - chart.top - chart.bottom);
  const xTicks = makeTicks(chartDomain.minX, chartDomain.maxX, 5);
  const yTicks = makeTicks(chartDomain.minY, chartDomain.maxY, 5);

  function submitMessage(rawText) {
    const text = rawText.trim();
    if (!text) return;
    setMessages((cur) => [...cur, { role: "user", text }]);
    setDraft("");
    setIsThinking(true);
    setThinkingLabel(thinkingLabels[Math.floor(Math.random() * thinkingLabels.length)]);
    const delay = 600 + Math.floor(Math.random() * 500);
    const id = window.setTimeout(() => {
      timerIdsRef.current = timerIdsRef.current.filter((t) => t !== id);
      const reply = buildAssistantReply(text, context);
      startTransition(() => { setMessages((cur) => [...cur, reply]); setIsThinking(timerIdsRef.current.length > 0); });
    }, delay);
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

      {/* Hero Row */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1.1fr) minmax(260px, 0.9fr)", gap: 18, alignItems: "start", marginBottom: 22 }}>
        <div className="dashboard-card" style={{ ...cardStyle, background: "rgba(255,255,255,0.82)", backdropFilter: "blur(12px)" }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: theme.muted, fontWeight: 600 }}>Part 3 Platform</p>
          <h2 style={{ margin: "10px 0 12px", fontSize: 36, lineHeight: 1, background: `linear-gradient(135deg, ${theme.ink}, #3a5a7c)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Compass Robo Adviser</h2>
          <p style={{ margin: 0, color: theme.muted, lineHeight: 1.6 }}>A portfolio-ready web platform combining the 10-fund efficient frontier, questionnaire-driven risk engine, and AI chatbot.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            {[`${frontierData.funds.length} funds`, `${riskData.metadata.sample_start} – ${riskData.metadata.sample_end}`, `${riskData.metadata.return_observations} monthly returns`].map((c) => (
              <span key={c} style={{ padding: "8px 14px", borderRadius: 999, background: theme.soft, color: theme.ink, fontSize: 13, fontWeight: 600 }}>{c}</span>
            ))}
          </div>
        </div>
        <div className="dashboard-card" style={{ ...cardStyle, background: "linear-gradient(135deg, #1f2d37, #2a4054)", color: "#ffffff" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#bdcad4" }}>Platform Promise</div>
          <h3 style={{ margin: "10px 0 14px", fontSize: 22, lineHeight: 1.2 }}>One interface, three jobs</h3>
          <div style={{ display: "grid", gap: 12, color: "#e4edf2" }}>
            {["Profile the client with a transparent risk questionnaire.", "Recommend a utility-maximizing portfolio.", "Explain the recommendation through AI chat."].map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(208,123,42,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#f5c87a", flexShrink: 0 }}>{i + 1}</span>
                <span style={{ lineHeight: 1.5 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1.02fr) minmax(320px, 0.98fr)", gap: 18, alignItems: "start" }}>

        {/* Left Column */}
        <div style={{ display: "grid", gap: 18 }}>

          {/* Cockpit */}
          <div className="dashboard-card" style={cardStyle}>
            <SectionHeader kicker="Recommendation Cockpit" title={constraintMode === "longOnly" ? "Implementation Portfolio" : "Short-Sales Benchmark"} icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            <div style={{ marginTop: 6, color: theme.muted }}>Active: <strong style={{ color: theme.ink }}>{activePersona.label}</strong> · A = <strong style={{ color: theme.ink }}>{activePersona.a.toFixed(2)}</strong></div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <button type="button" style={actionButton(constraintMode === "longOnly")} onClick={() => setConstraintMode("longOnly")}>Long-only</button>
              <button type="button" style={actionButton(constraintMode === "shortSalesAllowed")} onClick={() => setConstraintMode("shortSalesAllowed")}>Short sales</button>
            </div>
            <div className="stat-grid" style={{ marginTop: 16 }}>
              <StatCard label="Expected return" value={formatPercent(displayedPortfolio.expected_return)} />
              <StatCard label="Volatility" value={formatPercent(displayedPortfolio.risk)} />
              <StatCard label="Utility" value={displayedPortfolio.utility.toFixed(4)} />
            </div>
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.muted, fontWeight: 600, marginBottom: 12 }}>Leading holdings</div>
              <div className="holdings-list">
                {topHoldings.map((row) => <HoldingBar key={row.fund} label={row.fund} weight={row.weight} color={constraintMode === "longOnly" ? theme.long : theme.short} onAsk={() => submitMessage(`Why is ${row.fund} weighted so heavily?`)} />)}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="dashboard-card" style={cardStyle}>
            <SectionHeader kicker="Visual Allocation" title="Portfolio on the Frontier" icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            <div className="platform-chart-legend" style={{ marginTop: 14 }}>
              <span className="platform-legend-chip"><i style={{ background: theme.short }} />Short-sales</span>
              <span className="platform-legend-chip"><i style={{ background: theme.good }} />Long-only</span>
              <span className="platform-legend-chip"><i style={{ background: constraintMode === "longOnly" ? theme.long : theme.short }} />Selected</span>
            </div>
            <div className="chart-shell platform-chart-shell" style={{ marginTop: 14 }}>
              <svg width={chart.width} height={chart.height} role="img" aria-label="Efficient frontier" style={{ display: "block", overflow: "visible" }}>
                <rect x="0" y="0" width={chart.width} height={chart.height} rx="22" fill="#fffefb" />
                {yTicks.map((t) => (<g key={`y-${t}`}><line x1={chart.left} x2={chart.width - chart.right} y1={yScale(t)} y2={yScale(t)} stroke={theme.line} strokeDasharray="5 6" /><text x={chart.left - 12} y={yScale(t) + 4} textAnchor="end" fontSize="12" fill={theme.muted}>{formatPercent(t)}</text></g>))}
                {xTicks.map((t) => (<g key={`x-${t}`}><line x1={xScale(t)} x2={xScale(t)} y1={chart.top} y2={chart.height - chart.bottom} stroke={theme.line} strokeDasharray="5 6" /><text x={xScale(t)} y={chart.height - chart.bottom + 28} textAnchor="middle" fontSize="12" fill={theme.muted}>{formatPercent(t)}</text></g>))}
                <text x={chart.width / 2} y={chart.height - 18} textAnchor="middle" fontSize="13" fontWeight="700" fill={theme.muted}>Volatility</text>
                <text x="22" y={chart.height / 2} transform={`rotate(-90 22 ${chart.height / 2})`} textAnchor="middle" fontSize="13" fontWeight="700" fill={theme.muted}>Expected Return</text>
                <line x1={chart.left} x2={chart.left} y1={chart.top} y2={chart.height - chart.bottom} stroke={theme.ink} />
                <line x1={chart.left} x2={chart.width - chart.right} y1={chart.height - chart.bottom} y2={chart.height - chart.bottom} stroke={theme.ink} />
                <path d={pathFromPoints(frontierData.frontiers.shortSalesAllowed, xScale, yScale)} fill="none" stroke={theme.short} strokeWidth="3.2" strokeLinecap="round" />
                <path d={pathFromPoints(frontierData.frontiers.longOnly, xScale, yScale)} fill="none" stroke={theme.good} strokeWidth="3.2" strokeDasharray="8 6" strokeLinecap="round" />
                {riskData.funds.map((f) => (
                  <g key={f.index} onMouseEnter={(e) => { const p = hoverPosition(e); setChartTooltip({ x: p.x, y: p.y, title: `${f.index}. ${f.shortName}`, lines: [`Return: ${formatPercent(f.annualReturn)}`, `Vol: ${formatPercent(f.annualVolatility)}`] }); }} onMouseMove={(e) => { const p = hoverPosition(e); setChartTooltip((c) => c ? { ...c, x: p.x, y: p.y } : c); }} onMouseLeave={() => setChartTooltip(null)} style={{ cursor: "pointer" }}>
                    <circle cx={xScale(f.annualVolatility)} cy={yScale(f.annualReturn)} r="6.2" fill={theme.accent} />
                    <text x={xScale(f.annualVolatility) + 8} y={yScale(f.annualReturn) - 8} fontSize="12" fontWeight="700" fill={theme.ink}>{f.index}</text>
                  </g>
                ))}
                <line x1={xScale(displayedPortfolio.risk)} x2={xScale(displayedPortfolio.risk)} y1={chart.height - chart.bottom} y2={yScale(displayedPortfolio.expected_return)} stroke={constraintMode === "longOnly" ? theme.long : theme.short} strokeDasharray="6 6" opacity="0.55" />
                <line x1={chart.left} x2={xScale(displayedPortfolio.risk)} y1={yScale(displayedPortfolio.expected_return)} y2={yScale(displayedPortfolio.expected_return)} stroke={constraintMode === "longOnly" ? theme.long : theme.short} strokeDasharray="6 6" opacity="0.55" />
                <g onMouseEnter={(e) => { const p = hoverPosition(e); setChartTooltip({ x: p.x, y: p.y, title: constraintMode === "longOnly" ? "Long-only recommendation" : "Short-sales benchmark", lines: [`Return: ${formatPercent(displayedPortfolio.expected_return)}`, `Vol: ${formatPercent(displayedPortfolio.risk)}`, `Utility: ${displayedPortfolio.utility.toFixed(4)}`] }); }} onMouseMove={(e) => { const p = hoverPosition(e); setChartTooltip((c) => c ? { ...c, x: p.x, y: p.y } : c); }} onMouseLeave={() => setChartTooltip(null)} style={{ cursor: "pointer" }}>
                  <circle cx={xScale(displayedPortfolio.risk)} cy={yScale(displayedPortfolio.expected_return)} r="22" fill={constraintMode === "longOnly" ? "rgba(143,104,70,0.12)" : "rgba(55,109,163,0.12)"}><animate attributeName="r" values="18;22;18" dur="2s" repeatCount="indefinite" /></circle>
                  <circle cx={xScale(displayedPortfolio.risk)} cy={yScale(displayedPortfolio.expected_return)} r="11" fill={constraintMode === "longOnly" ? theme.long : theme.short} stroke="#fff" strokeWidth="2.5" />
                  <text x={xScale(displayedPortfolio.risk) + 16} y={yScale(displayedPortfolio.expected_return) - 8} fontSize="12" fontWeight="700" fill={theme.ink}>Current</text>
                </g>
              </svg>
              {chartTooltip ? (<div className="chart-tooltip" style={{ left: chartTooltip.x, top: chartTooltip.y }}><div style={{ fontWeight: 700, marginBottom: 6 }}>{chartTooltip.title}</div>{chartTooltip.lines.map((l) => <div key={l} style={{ fontSize: 13, lineHeight: 1.45 }}>{l}</div>)}</div>) : null}
            </div>
            <div className="platform-chart-insights">
              <div className="platform-chart-insight"><span>Current point</span><strong>{formatPercent(displayedPortfolio.expected_return)} return</strong><small>{formatPercent(displayedPortfolio.risk)} volatility</small></div>
              <div className="platform-chart-insight"><span>Constraint</span><strong>{constraintMode === "longOnly" ? "Long-only" : "Short-sales"}</strong><small>Same frontier, different rule</small></div>
              <div className="platform-chart-insight"><span>Top driver</span><strong>{topHoldings[0]?.fund ?? "—"}</strong><small>{topHoldings[0] ? `${formatPercent(topHoldings[0].weight)} weight` : "—"}</small></div>
            </div>
          </div>

          {/* AI Chatbot */}
          <div className="dashboard-card" style={{ ...cardStyle, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, padding: "14px 18px", marginTop: -22, marginLeft: -22, marginRight: -22, background: "linear-gradient(135deg, #1f2d37, #2a4054)", color: "#ffffff", borderRadius: "24px 24px 0 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, rgba(208,123,42,0.3), rgba(55,109,163,0.3))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <SvgIcon path="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" size={20} color="#ffffff" />
                </div>
                <div><div style={{ fontWeight: 700, fontSize: 15 }}>AI Copilot</div><div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Portfolio intelligence assistant</div></div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#5a9d47", boxShadow: "0 0 8px rgba(90,157,71,0.5)", animation: "pulse 2s ease-in-out infinite" }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Online</span>
              </div>
            </div>

            <div className="chat-context">
              <div><strong>Live context</strong><div style={{ marginTop: 4, color: "rgba(255,255,255,0.82)" }}>{activePersona.label} · {constraintMode === "longOnly" ? "Long-only" : "Short-sales"}</div></div>
              <div className="chat-badges">
                <span className="chat-badge">A = {activePersona.a.toFixed(2)}</span>
                <span className="chat-badge">Ret {formatPercent(displayedPortfolio.expected_return)}</span>
                <span className="chat-badge">Vol {formatPercent(displayedPortfolio.risk)}</span>
              </div>
            </div>

            <div className="chat-scenario-strip" style={{ marginTop: 12 }}>
              <div className="chat-scenario-card"><span>Top idea</span><strong>{topHoldings[0]?.fund ?? "—"}</strong></div>
              <div className="chat-scenario-card"><span>GMVP anchor</span><strong>{formatPercent(frontierData.gmvp.longOnly.risk)} vol</strong></div>
              <div className="chat-scenario-card"><span>Data window</span><strong>{riskData.metadata.sample_start} – {riskData.metadata.sample_end}</strong></div>
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: theme.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>Quick prompts</div>
            <div className="prompt-grid" style={{ marginTop: 8 }}>
              {prompts.map((p) => <button key={p} type="button" className="prompt-chip" style={{ ...actionButton(false), fontSize: 12, padding: "8px 12px" }} onClick={() => submitMessage(p)}>{p}</button>)}
            </div>

            <div ref={chatViewportRef} className="chat-log" style={{ borderRadius: 20, border: `1px solid ${theme.line}`, background: "linear-gradient(180deg, rgba(255,254,251,0.95), rgba(248,239,226,0.6))", backdropFilter: "blur(8px)", padding: 16, minHeight: 380, display: "grid", gap: 12, alignContent: "start", marginTop: 12 }}>
              {messages.map((msg, i) => <ChatMessage key={`${msg.role}-${i}`} message={msg} onSuggestionClick={submitMessage} />)}
              {isThinking ? (<div className="chat-bubble chat-bubble-assistant" style={{ display: "grid", gap: 8 }}><TypingIndicator /><div className="chat-status">{thinkingLabel}</div></div>) : null}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); submitMessage(draft); }} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, marginTop: 12 }}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about a fund, the frontier, or the recommendation…" style={{ borderRadius: 16, border: `1px solid ${theme.line}`, padding: "14px 16px", fontSize: 14, background: "#fffefb", transition: "border-color 220ms, box-shadow 220ms" }} onFocus={(e) => { e.target.style.borderColor = "rgba(208,123,42,0.44)"; e.target.style.boxShadow = "0 0 0 4px rgba(208,123,42,0.1)"; }} onBlur={(e) => { e.target.style.borderColor = theme.line; e.target.style.boxShadow = "none"; }} />
              <button type="submit" style={{ ...actionButton(true), display: "flex", alignItems: "center", gap: 6 }}>
                <SvgIcon path="M5 12h14M12 5l7 7-7 7" size={16} color="#fff" />Send
              </button>
              <button type="button" style={{ ...actionButton(false), display: "flex", alignItems: "center", gap: 6 }} onClick={clearChat}>
                <SvgIcon path="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" size={16} color={theme.ink} />New
              </button>
            </form>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: "grid", gap: 18 }}>
          <div className="dashboard-card" style={cardStyle}>
            <SectionHeader kicker="Client Profiles" title="Switch Investor Persona" icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            <div className="persona-grid" style={{ marginTop: 14 }}>
              {personas.map((p) => {
                const active = p.id === selectedPersonaId;
                return (
                  <button key={p.id} type="button" className={active ? "persona-card persona-card-active" : "persona-card"} onClick={() => setSelectedPersonaId(p.id)}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><SvgIcon path={p.icon} size={16} color={active ? "#fff" : theme.ink} /><strong>{p.label}</strong></div>
                      <span style={{ fontSize: 13, opacity: 0.8 }}>A = {p.a.toFixed(1)}</span>
                    </div>
                    <div className="muted-copy" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.45 }}>{p.blurb}</div>
                    <div className="mini-meter" style={{ marginTop: 10 }}>
                      <span style={{ width: `${((10 - p.a) / 8) * 100}%`, background: active ? "linear-gradient(90deg, rgba(255,255,255,0.5), rgba(255,255,255,0.2))" : `linear-gradient(90deg, ${theme.accent}, ${theme.short})` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="dashboard-card" style={cardStyle}>
            <SectionHeader kicker="Frontier Anchors" title="Key Reference Points" icon="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            <div className="stat-grid" style={{ marginTop: 14 }}>
              <StatCard label="Long-only GMVP" value={`${formatPercent(frontierData.gmvp.longOnly.risk)} vol`} note={`${formatPercent(frontierData.gmvp.longOnly.return)} return`} />
              <StatCard label="Short GMVP" value={`${formatPercent(frontierData.gmvp.shortSalesAllowed.risk)} vol`} note={`${formatPercent(frontierData.gmvp.shortSalesAllowed.return)} return`} />
              <StatCard label="Data" value={riskData.metadata.sample_start} note={`to ${riskData.metadata.sample_end}`} />
            </div>
            <div style={{ marginTop: 14, borderRadius: 18, padding: 14, background: "linear-gradient(180deg, #fcf5e8, #f8efe0)", border: `1px solid ${theme.line}`, color: theme.muted, lineHeight: 1.55, fontSize: 14 }}>
              Anchors for {activePersona.label}: {longAnchors.map((r) => `${r.fund} ${formatPercent(r.weight)}`).join(", ")}.
            </div>
          </div>

          <div className="dashboard-card" style={cardStyle}>
            <SectionHeader kicker="Fund Shelf" title="Explore the 10-Fund Universe" icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            <div className="fund-shelf" style={{ marginTop: 14 }}>
              {riskData.funds.map((f) => (
                <button key={f.index} type="button" className="fund-card fund-card-interactive" onClick={() => submitMessage(`Tell me about Fund ${f.index}.`)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <h4 style={{ margin: 0 }}>{f.index}. {f.shortName}</h4>
                    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "rgba(208,123,42,0.08)", color: theme.accent, fontWeight: 600, flexShrink: 0 }}>{fundThemes[f.index]}</span>
                  </div>
                  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 13 }}>
                    <div><span style={{ color: theme.muted }}>Ret:</span> <strong>{formatPercent(f.annualReturn)}</strong></div>
                    <div><span style={{ color: theme.muted }}>Vol:</span> <strong>{formatPercent(f.annualVolatility)}</strong></div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="dashboard-card" style={{ ...cardStyle, background: "linear-gradient(135deg, #1f2d37, #2a4054)", color: "#fff" }}>
            <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#b8c5cf" }}>Why This Works</div>
            <div style={{ display: "grid", gap: 12, marginTop: 14, color: "#e5edf2", lineHeight: 1.55 }}>
              {[{ l: "Transparent", d: "Questionnaire-to-A mapping is explicit." }, { l: "Explainable", d: "Chatbot uses the same frontier outputs." }, { l: "Portfolio-ready", d: "Long-only default is practical for retail." }].map((x) => (
                <div key={x.l} style={{ display: "flex", gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "linear-gradient(135deg, #d07b2a, #376da3)", marginTop: 8, flexShrink: 0 }} />
                  <div><strong>{x.l}:</strong> {x.d}</div>
                </div>
              ))}
            </div>
            {shortExposures.length > 0 ? (<div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.14)", color: "#b8c5cf", fontSize: 13 }}>Short exposures: {shortExposures.map((r) => `${r.fund} ${formatPercent(r.weight)}`).join(", ")}.</div>) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
