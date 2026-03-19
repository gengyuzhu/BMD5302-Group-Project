import React, { startTransition, useEffect, useMemo, useRef, useState, useCallback } from "react";
import frontierData from "../part1_outputs/efficient_frontier_data.json";
import riskData from "../part2_outputs/part2_risk_profile_data.json";

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

const personas = [
  { id: "steady", label: "Steady Saver", a: 8.0 },
  { id: "balanced", label: "Balanced Builder", a: 6.0 },
  { id: "growth", label: "Growth Explorer", a: 4.6 },
  { id: "bold", label: "Bold Navigator", a: 2.0 },
];

const fundThemes = {
  1: "Singapore equity", 2: "Hong Kong tech", 3: "SGD bond",
  4: "Global technology", 5: "Income fund", 6: "US technology",
  7: "Asian growth", 8: "Gold thematic", 9: "India equity",
  10: "SGD low-volatility core",
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
  "Building a portfolio explanation from Parts 1 & 2",
  "Analyzing fund correlations and weights",
  "Cross-referencing risk aversion parameters",
  "Preparing an insight from the efficient frontier",
];

const viewLabels = { platform: "Platform", frontier: "Frontier Lab", risk: "Risk Lab" };

const viewPrompts = {
  platform: [
    "Summarize the current recommendation.",
    "Why is long-only preferred?",
    "Compare Fund 4 and Fund 8.",
    "What is the GMVP?",
  ],
  frontier: [
    "What does the efficient frontier show?",
    "Compare the two frontier constraints.",
    "Tell me about Fund 4.",
    "Where is the GMVP?",
  ],
  risk: [
    "How does the questionnaire map to A?",
    "Explain the utility formula.",
    "What happens with a higher A?",
    "Summarize the optimal portfolio.",
  ],
};

/* ═══════════════════════════════════════════════════════════════
   Utility Functions
   ═══════════════════════════════════════════════════════════════ */

const formatPercent = (v, d = 2) => `${(v * 100).toFixed(d)}%`;

function nearestPortfolio(portfolios, aValue) {
  return portfolios.reduce((best, cur) =>
    Math.abs(cur.risk_aversion_a - aValue) < Math.abs(best.risk_aversion_a - aValue) ? cur : best,
  );
}

function sortedWeights(wm) {
  return Object.entries(wm).map(([fund, weight]) => ({ fund, weight })).sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
}
function positiveWeights(wm, n = 3) { return sortedWeights(wm).filter((r) => r.weight > 1e-5).slice(0, n); }
function negativeWeights(wm, n = 3) { return sortedWeights(wm).filter((r) => r.weight < -1e-5).slice(0, n); }
function weightOfFund(wm, name) { return wm[name] ?? 0; }
function portfolioLeaders(p, n = 3) {
  const leaders = positiveWeights(p.weights, n).map((r) => `${r.fund} ${formatPercent(r.weight)}`).join(", ");
  return leaders || "No significant positive allocations";
}

function detectFund(msg, funds) {
  const lower = msg.toLowerCase();
  const exact = lower.match(/\bfund\s*(10|[1-9])\b/);
  if (exact) return funds.find((f) => f.index === Number(exact[1])) ?? null;
  return funds.find((f) => {
    const patterns = [f.shortName, f.displayName, fundThemes[f.index], String(f.index), `fund ${f.index}`];
    return patterns.some((s) => {
      const low = s.toLowerCase();
      if (low.length < 6) {
        const escaped = low.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escaped}\\b`).test(lower);
      }
      return lower.includes(low);
    });
  }) ?? null;
}

function detectFunds(msg, funds) {
  const lower = msg.toLowerCase();
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

function detectPersonas(msg) {
  const lower = msg.toLowerCase();
  const ids = new Set();
  Object.entries(personaAliases).forEach(([alias, pid]) => { if (lower.includes(alias)) ids.add(pid); });
  return personas.filter((p) => ids.has(p.id));
}

/* ═══════════════════════════════════════════════════════════════
   Response Builder
   ═══════════════════════════════════════════════════════════════ */

function assistantMessage({ title, text, bullets = [], stats = [], suggestions = [], showChart = false, chartData = null }) {
  return { role: "assistant", title, text, bullets, stats, suggestions, showChart, chartData };
}

function buildWelcomeMessage(context, currentView) {
  const { activePersona, displayedPortfolio } = context;
  const topWeights = positiveWeights(displayedPortfolio.weights, 5);
  const viewIntros = {
    platform: `I can explain the current recommendation for ${activePersona.label}, compare constraints, break down any fund, and translate the questionnaire into risk aversion A.`,
    frontier: `I can explain any point on the efficient frontier, compare the two constraint paths, break down fund contributions, and highlight the GMVP.`,
    risk: `I can explain the questionnaire scoring, walk through the A-mapping formula, compare personas, and break down the optimal portfolio.`,
  };
  return assistantMessage({
    title: "Compass AI Copilot",
    text: viewIntros[currentView] ?? viewIntros.platform,
    bullets: [
      `Active persona: ${activePersona.label} (A = ${activePersona.a.toFixed(2)}).`,
      `Portfolio: ${formatPercent(displayedPortfolio.expected_return)} return at ${formatPercent(displayedPortfolio.risk)} vol.`,
      `Top holdings: ${portfolioLeaders(displayedPortfolio)}.`,
    ],
    stats: [
      { label: "A", value: activePersona.a.toFixed(2) },
      { label: "Utility", value: displayedPortfolio.utility.toFixed(4) },
    ],
    suggestions: viewPrompts[currentView] ?? viewPrompts.platform,
    showChart: true,
    chartData: topWeights,
  });
}

function buildAssistantReply(message, context) {
  const lower = message.toLowerCase();
  const { activePersona, activeLongPortfolio, activeShortPortfolio, displayedPortfolio, constraintMode, funds, gmvpLong, gmvpShort } = context;
  const fundsMentioned = detectFunds(message, funds);
  const fund = fundsMentioned[0] ?? detectFund(message, funds);
  const personasMentioned = detectPersonas(message);
  const shortExposures = negativeWeights(activeShortPortfolio.weights, 3);

  /* Greeting */
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
        { label: "Sample", value: `${riskData.metadata.sample_start} \u2013 ${riskData.metadata.sample_end}` },
      ],
      suggestions: ["Summarize the current portfolio.", "What is the GMVP and why does it matter?", "Tell me about Fund 8."],
      showChart: true,
      chartData: positiveWeights(displayedPortfolio.weights, 5),
    });
  }

  /* NEW: Efficient frontier concept */
  if (/efficient\s*frontier|what does the frontier/.test(lower)) {
    return assistantMessage({
      title: "The efficient frontier",
      text: "The efficient frontier is the set of portfolios that offer the highest expected return for each level of risk (volatility).",
      bullets: [
        "Every point on the curve is a unique mix of the 10 funds.",
        "Portfolios below the frontier are sub-optimal \u2014 a better return exists at the same risk.",
        `Long-only frontier: practical constraint (no negative weights). Short-sales frontier: theoretical upper bound.`,
        `Current portfolio sits at ${formatPercent(displayedPortfolio.expected_return)} return, ${formatPercent(displayedPortfolio.risk)} vol.`,
      ],
      stats: [{ label: "Funds", value: String(funds.length) }, { label: "Observations", value: String(riskData.metadata.return_observations) }],
      suggestions: ["Where is the GMVP?", "Compare the two constraints.", "Summarize portfolio."],
    });
  }

  /* NEW: Utility formula explanation */
  if (/\butility\b.*\bformula\b|\bformula\b.*\butility\b|\bexplain.*utility\b|\bu\s*=/.test(lower)) {
    return assistantMessage({
      title: "Quadratic utility framework",
      text: "The optimizer maximizes U = r \u2212 \u00bdA\u03c3\u00b2, where r is expected return, \u03c3\u00b2 is variance, and A is risk aversion.",
      bullets: [
        "Higher A \u2192 penalty for variance grows \u2192 optimizer picks a lower-risk portfolio.",
        "Lower A \u2192 willing to accept more volatility for higher return.",
        `Currently A = ${activePersona.a.toFixed(2)} \u2192 U = ${displayedPortfolio.utility.toFixed(4)}.`,
        "The formula ensures the recommendation is consistent with the investor's risk tolerance.",
      ],
      stats: [{ label: "A", value: activePersona.a.toFixed(2) }, { label: "U", value: displayedPortfolio.utility.toFixed(4) }],
      suggestions: ["What happens with higher A?", "How is A calculated?", "Summarize portfolio."],
    });
  }

  /* NEW: Higher/lower A sensitivity */
  if (/higher\s*a\b|lower\s*a\b|more\s*(conservative|aggressive)|less\s*(conservative|aggressive)/.test(lower)) {
    const maxA = Math.max(...personas.map(p => p.a));
    const minA = Math.min(...personas.map(p => p.a));
    const conservative = nearestPortfolio(riskData.optimalPortfolios.longOnly, maxA);
    const aggressive = nearestPortfolio(riskData.optimalPortfolios.longOnly, minA);
    return assistantMessage({
      title: "Risk aversion sensitivity",
      text: "As A changes, the optimal portfolio moves along the efficient frontier.",
      bullets: [
        `High A (\u22489): ${formatPercent(conservative.expected_return)} return, ${formatPercent(conservative.risk)} vol \u2014 near the GMVP.`,
        `Low A (\u22482): ${formatPercent(aggressive.expected_return)} return, ${formatPercent(aggressive.risk)} vol \u2014 far up the frontier.`,
        `Current: A = ${activePersona.a.toFixed(2)} \u2192 ${formatPercent(displayedPortfolio.expected_return)} return, ${formatPercent(displayedPortfolio.risk)} vol.`,
        "Switch the persona above to see the effect live.",
      ],
      stats: [{ label: "Conservative U", value: conservative.utility.toFixed(4) }, { label: "Aggressive U", value: aggressive.utility.toFixed(4) }],
      suggestions: ["Explain utility formula.", "Compare steady and bold.", "Summarize portfolio."],
    });
  }

  /* Fund comparison */
  if ((lower.includes("compare") || lower.includes("difference")) && fundsMentioned.length >= 2) {
    const [f1, f2] = fundsMentioned;
    let text = `${f1.shortName} and ${f2.shortName} contribute very different risk-return trade-offs.`;
    if (fundsMentioned.length > 2) {
      text += `\n\n_Note: I compared the first two funds mentioned. You can ask about other pairs separately._`;
    }
    return assistantMessage({
      title: `Fund comparison: ${f1.index} vs ${f2.index}`,
      text,
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

  /* Fund not selected */
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

  /* Single fund */
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

  /* Questionnaire / A mapping */
  if (lower.includes("questionnaire") || lower.includes("risk aversion") || /\bhow.*\ba\b/.test(lower)) {
    return assistantMessage({
      title: "Questionnaire to A mapping",
      text: "The platform uses the Part 2 questionnaire to convert behavior into a utility input.",
      bullets: ["Each answer is scored \u00d7 question weight.", "Normalized into risk tolerance T.",
        `A = 10 \u2212 9T \u2192 ${activePersona.label} at A = ${activePersona.a.toFixed(2)}.`, "Optimizer maximizes U = r \u2212 \u00bdA\u03c3\u00b2."],
      stats: [{ label: "Questions", value: String(riskData.questionnaire.questionnaire.length) }, { label: "A", value: activePersona.a.toFixed(2) }],
      suggestions: ["What does a higher A mean?", "Summarize the current portfolio.", "Compare conservative and bold."],
    });
  }

  /* GMVP / frontier */
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

  /* Persona comparison */
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

  /* Long vs short */
  if (lower.includes("short") || lower.includes("long-only") || lower.includes("preferred")) {
    return assistantMessage({
      title: "Constraint-set comparison",
      text: "Long-only is the default \u2014 more implementable for retail.",
      bullets: [`Long-only: ${formatPercent(activeLongPortfolio.expected_return)} return, ${formatPercent(activeLongPortfolio.risk)} vol.`,
        `Short-sales: ${formatPercent(activeShortPortfolio.expected_return)} return, ${formatPercent(activeShortPortfolio.risk)} vol.`,
        "Long-only avoids leverage and operational friction.",
        shortExposures.length > 0 ? `Short depends on ${shortExposures.map((r) => `${r.fund} ${formatPercent(r.weight)}`).join(", ")}.` : "Same 10-fund universe."],
      stats: [{ label: "Long U", value: activeLongPortfolio.utility.toFixed(4) }, { label: "Short U", value: activeShortPortfolio.utility.toFixed(4) }],
      suggestions: ["Summarize portfolio.", "GMVP?", "Top holdings."],
    });
  }

  /* Holdings / portfolio / summary */
  if (lower.includes("holdings") || lower.includes("weights") || lower.includes("portfolio") || lower.includes("recommend") || lower.includes("summary")) {
    return assistantMessage({
      title: "Recommendation summary",
      text: `For ${activePersona.label}, the ${constraintMode === "longOnly" ? "implementation" : "benchmark"} portfolio targets ${formatPercent(displayedPortfolio.expected_return)} return at ${formatPercent(displayedPortfolio.risk)} vol.`,
      bullets: [`Utility: ${displayedPortfolio.utility.toFixed(4)}.`, `Top: ${portfolioLeaders(displayedPortfolio)}.`,
        constraintMode === "shortSalesAllowed" && shortExposures.length > 0
          ? `Shorts: ${shortExposures.map((r) => `${r.fund} ${formatPercent(r.weight)}`).join(", ")}.` : "No short positions \u2014 practical for retail."],
      stats: [{ label: "A", value: activePersona.a.toFixed(2) }, { label: "Return", value: formatPercent(displayedPortfolio.expected_return) }, { label: "Vol", value: formatPercent(displayedPortfolio.risk) }],
      suggestions: ["Why these leaders?", "Long vs short.", "Tell me about Fund 4."],
      showChart: true, chartData: positiveWeights(displayedPortfolio.weights, 5),
    });
  }

  /* Data scope */
  if (lower.includes("data") || lower.includes("csv") || lower.includes("sample")) {
    return assistantMessage({
      title: "Data scope",
      text: "Platform driven by Part 1 and Part 2 outputs.",
      bullets: [`${funds.length} funds.`, `${riskData.metadata.sample_start} to ${riskData.metadata.sample_end}.`, `${riskData.metadata.return_observations} monthly returns.`],
      suggestions: ["GMVP?", "How is A calculated?", "Summarize portfolio."],
    });
  }

  /* Default */
  return assistantMessage({
    title: "Try one of these directions",
    text: "I can answer from the frontier and utility outputs across all three views.",
    bullets: ["Ask about a fund by number or name.", "Ask for a recommendation summary or GMVP explanation.", "Ask how the questionnaire maps to A.", "Ask about the utility formula or efficient frontier concept."],
    suggestions: ["Summarize portfolio.", "Tell me about Fund 8.", "What is the GMVP?", "Explain the utility formula."],
  });
}

/* ═══════════════════════════════════════════════════════════════
   Sub-Components
   ═══════════════════════════════════════════════════════════════ */

function SvgIcon({ d, size = 18, color = "currentColor", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
      <path d={d} />
    </svg>
  );
}

const MiniDonutChart = React.memo(function MiniDonutChart({ data, size = 90 }) {
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
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(22,33,43,0.06)" strokeWidth={sw} />
        {segments}
        <circle cx={cx} cy={cy} r={r - sw / 2 + 1} fill="white" />
      </svg>
      <div style={{ display: "grid", gap: 2, fontSize: 11 }}>
        {data.slice(0, 4).map((row, i) => (
          <div key={row.fund} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
            <span style={{ color: "#607180", whiteSpace: "nowrap" }}>{row.fund}</span>
            <strong style={{ marginLeft: "auto", color: "#16212b" }}>{formatPercent(row.weight, 1)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
});

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
      <div className="gcb-bubble gcb-bubble-user">
        {message.text}
      </div>
    );
  }
  return (
    <div className="gcb-bubble gcb-bubble-assistant">
      <div className="gcb-msg-card">
        {message.title && (
          <div className="gcb-msg-header">
            <span className="gcb-msg-dot" />
            <span className="gcb-msg-title">{message.title}</span>
          </div>
        )}
        <div className="gcb-msg-text">{message.text}</div>
        {message.showChart && message.chartData?.length > 0 && <MiniDonutChart data={message.chartData} size={88} />}
        {message.stats?.length > 0 && (
          <div className="gcb-msg-stats">
            {message.stats.map((s) => (
              <div key={`${s.label}-${s.value}`} className="gcb-msg-stat">
                <span>{s.label}</span><strong>{s.value}</strong>
              </div>
            ))}
          </div>
        )}
        {message.bullets?.length > 0 && (
          <div className="gcb-msg-bullets">
            {message.bullets.map((b) => <div key={b} className="gcb-msg-bullet">{b}</div>)}
          </div>
        )}
        {message.suggestions?.length > 0 && (
          <div className="gcb-msg-suggestions">
            {message.suggestions.map((s) => (
              <button key={s} type="button" className="gcb-suggestion-chip" onClick={() => onSuggestionClick(s)}>{s}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

export default function GlobalChatbot({ currentView }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState("growth");
  const [constraintMode, setConstraintMode] = useState("longOnly");
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState(thinkingLabels[0]);
  const chatEndRef = useRef(null);
  const timerIdsRef = useRef([]);
  const inputRef = useRef(null);
  const prevContextRef = useRef({ personaId: "growth", constraintMode: "longOnly" });

  const activePersona = personas.find((p) => p.id === selectedPersonaId) ?? personas[0];
  const activeLongPortfolio = useMemo(() => nearestPortfolio(riskData.optimalPortfolios.longOnly, activePersona.a), [activePersona.a]);
  const activeShortPortfolio = useMemo(() => nearestPortfolio(riskData.optimalPortfolios.shortSalesAllowed, activePersona.a), [activePersona.a]);
  const displayedPortfolio = constraintMode === "longOnly" ? activeLongPortfolio : activeShortPortfolio;

  const context = useMemo(() => ({
    activePersona, activeLongPortfolio, activeShortPortfolio, displayedPortfolio, constraintMode,
    funds: riskData.funds, gmvpLong: frontierData.gmvp.longOnly, gmvpShort: frontierData.gmvp.shortSalesAllowed,
  }), [activeLongPortfolio, activePersona, activeShortPortfolio, constraintMode, displayedPortfolio]);

  const [messages, setMessages] = useState(() => [buildWelcomeMessage(context, currentView)]);

  const prompts = useMemo(() => viewPrompts[currentView] ?? viewPrompts.platform, [currentView]);

  /* Auto-scroll */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  /* Context change message */
  useEffect(() => {
    const prev = prevContextRef.current;
    if (prev.personaId === selectedPersonaId && prev.constraintMode === constraintMode) return;
    prevContextRef.current = { personaId: selectedPersonaId, constraintMode };
    setMessages((cur) => [...cur, assistantMessage({
      title: "Context updated",
      text: `Now using ${activePersona.label} with ${constraintMode === "longOnly" ? "long-only" : "short-sales"}.`,
      bullets: [`Return: ${formatPercent(displayedPortfolio.expected_return)}.`, `Vol: ${formatPercent(displayedPortfolio.risk)}.`, `Top: ${portfolioLeaders(displayedPortfolio)}.`],
      suggestions: ["Summarize portfolio.", "Compare long vs short.", "Explain A."],
      showChart: true, chartData: positiveWeights(displayedPortfolio.weights, 5),
    })]);
  }, [activePersona.label, constraintMode, displayedPortfolio, selectedPersonaId]);

  /* View change welcome */
  const prevViewRef = useRef(currentView);
  useEffect(() => {
    if (prevViewRef.current === currentView) return;
    prevViewRef.current = currentView;
    setMessages((cur) => [...cur, assistantMessage({
      title: `Switched to ${viewLabels[currentView] ?? currentView}`,
      text: `I've updated my suggestions for this view. Ask me anything about ${currentView === "frontier" ? "the efficient frontier" : currentView === "risk" ? "risk profiling" : "the platform"}.`,
      suggestions: viewPrompts[currentView] ?? viewPrompts.platform,
    })]);
  }, [currentView]);

  /* Timer cleanup */
  useEffect(() => () => { timerIdsRef.current.forEach((id) => window.clearTimeout(id)); }, []);

  /* Submit handler */
  const submitMessage = useCallback((rawText) => {
    const text = (rawText ?? "").trim();
    if (!text) return;
    setMessages((cur) => [...cur, { role: "user", text }]);
    setDraft("");
    setIsThinking(true);
    setThinkingLabel(thinkingLabels[Math.floor(Math.random() * thinkingLabels.length)]);
    const delay = 600 + Math.floor(Math.random() * 500);
    const id = window.setTimeout(() => {
      timerIdsRef.current = timerIdsRef.current.filter((t) => t !== id);
      let reply;
      try {
        reply = buildAssistantReply(text, context);
      } catch (err) {
        console.error("Chatbot reply error:", err);
        reply = { role: "assistant", text: "I encountered an issue processing your question. Please try rephrasing or ask about a specific fund, persona, or portfolio concept." };
      }
      startTransition(() => {
        setMessages((cur) => [...cur, reply]);
        setIsThinking(timerIdsRef.current.length > 0);
      });
    }, delay);
    timerIdsRef.current = [...timerIdsRef.current, id];
  }, [context]);

  /* External ask event from other components */
  useEffect(() => {
    function handler(e) {
      submitMessage(e.detail);
      setIsOpen(true);
    }
    window.addEventListener("chatbot-ask", handler);
    return () => window.removeEventListener("chatbot-ask", handler);
  }, [submitMessage]);

  /* Clear chat */
  function clearChat() {
    timerIdsRef.current.forEach((id) => window.clearTimeout(id));
    timerIdsRef.current = [];
    setIsThinking(false);
    setMessages([buildWelcomeMessage(context, currentView)]);
  }

  /* Keyboard shortcut: Escape closes panel */
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape" && isOpen) setIsOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  /* Focus input when panel opens */
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <>
      {/* ──── Floating Action Button ──── */}
      <button
        type="button"
        className={`gcb-fab ${isOpen ? "gcb-fab-open" : ""}`}
        onClick={() => setIsOpen((o) => !o)}
        aria-label={isOpen ? "Close AI assistant" : "Open AI assistant"}
      >
        <span className="gcb-fab-pulse" />
        <span className="gcb-fab-icon">
          {isOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
            </svg>
          )}
        </span>
      </button>

      {/* ──── Chat Panel ──── */}
      <div className={`gcb-panel ${isOpen ? "gcb-panel-open" : ""}`} role="dialog" aria-label="AI Copilot chat" aria-hidden={!isOpen}>
        {/* Panel Header */}
        <div className="gcb-panel-header">
          <div className="gcb-header-left">
            <div className="gcb-avatar">
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <path d="M16 6 L26 11 L26 21 L16 26 L6 21 L6 11 Z" fill="none" stroke="#fff" strokeWidth="2" />
                <circle cx="16" cy="16" r="4" fill="#fff" />
              </svg>
            </div>
            <div>
              <div className="gcb-header-title">Compass AI</div>
              <div className="gcb-header-sub">
                <span className="gcb-status-dot" />
                {viewLabels[currentView] ?? "Platform"}
              </div>
            </div>
          </div>
          <div className="gcb-header-actions">
            <button type="button" className="gcb-header-btn" onClick={clearChat} aria-label="New chat" title="New chat">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <button type="button" className="gcb-header-btn" onClick={() => setIsOpen(false)} aria-label="Close chat" title="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        </div>

        {/* Persona & Mode Quick-Switch */}
        <div className="gcb-context-bar">
          <div className="gcb-persona-row">
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`gcb-persona-pill ${p.id === selectedPersonaId ? "gcb-persona-pill-active" : ""}`}
                onClick={() => setSelectedPersonaId(p.id)}
                title={`${p.label} (A = ${p.a})`}
              >
                {p.label.split(" ")[0]}
              </button>
            ))}
          </div>
          <div className="gcb-mode-row">
            <button
              type="button"
              className={`gcb-mode-pill ${constraintMode === "longOnly" ? "gcb-mode-pill-active" : ""}`}
              onClick={() => setConstraintMode("longOnly")}
            >Long-only</button>
            <button
              type="button"
              className={`gcb-mode-pill ${constraintMode === "shortSalesAllowed" ? "gcb-mode-pill-active" : ""}`}
              onClick={() => setConstraintMode("shortSalesAllowed")}
            >Short sales</button>
          </div>
        </div>

        {/* Messages */}
        <div className="gcb-messages">
          {messages.map((msg, i) => (
            <ChatMessage key={`${msg.role}-${i}`} message={msg} onSuggestionClick={submitMessage} />
          ))}
          {isThinking && (
            <div className="gcb-bubble gcb-bubble-assistant" style={{ display: "grid", gap: 6 }}>
              <TypingIndicator />
              <div className="gcb-thinking-label">{thinkingLabel}</div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Prompts */}
        <div className="gcb-prompt-strip">
          {prompts.map((p) => (
            <button key={p} type="button" className="gcb-prompt-chip" onClick={() => submitMessage(p)}>
              {p}
            </button>
          ))}
        </div>

        {/* Input */}
        <form
          className="gcb-input-bar"
          onSubmit={(e) => { e.preventDefault(); submitMessage(draft); }}
        >
          <textarea
            ref={inputRef}
            value={draft}
            rows={1}
            onChange={(e) => {
              setDraft(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitMessage(draft);
                e.target.style.height = "auto";
              }
            }}
            placeholder="Ask about funds, frontier, risk..."
            aria-label="Chat message"
            className="gcb-input"
          />
          <button type="submit" className="gcb-send-btn" disabled={!draft.trim()} aria-label="Send message">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && <div className="gcb-backdrop" onClick={() => setIsOpen(false)} />}
    </>
  );
}
