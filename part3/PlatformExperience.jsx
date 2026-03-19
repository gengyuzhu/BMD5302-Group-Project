import React, { useEffect, useMemo, useRef, useState } from "react";
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

/* Helper: dispatch a message to the global chatbot */
function askChatbot(text) {
  window.dispatchEvent(new CustomEvent("chatbot-ask", { detail: text }));
}

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

function portfolioLeaders(portfolio, count = 3) {
  return positiveWeights(portfolio.weights, count).map((r) => `${r.fund} ${formatPercent(r.weight)}`).join(", ");
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
   Sub-Components
   ═══════════════════════════════════════════════════════════════ */

function SvgIcon({ path, size = 18, color = "currentColor", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
      <path d={path} />
    </svg>
  );
}

/* Animated counter — smoothly counts from 0 → target on mount/change */
function AnimatedNumber({ value, decimals = 2, suffix = "" }) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef(null);

  useEffect(() => {
    const start = performance.now();
    const from = display;
    const to = value;
    const duration = 600;

    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{display.toFixed(decimals)}{suffix}</>;
}

function StatCard({ label, value, note, animate = false, decimals = 2, suffix = "" }) {
  const numericVal = parseFloat(value);
  const isNumeric = animate && !isNaN(numericVal);
  return (
    <div className="stat-card">
      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.10em", color: theme.muted, fontWeight: 600 }}>{label}</div>
      <div style={{ marginTop: 6, fontWeight: 700, fontSize: 18 }}>
        {isNumeric ? <AnimatedNumber value={numericVal} decimals={decimals} suffix={suffix} /> : value}
      </div>
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
  const [chartTooltip, setChartTooltip] = useState(null);

  const activeButtonStyle = useMemo(() => actionButton(true), []);
  const inactiveButtonStyle = useMemo(() => actionButton(false), []);

  const activePersona = personas.find((p) => p.id === selectedPersonaId) ?? personas[0];
  const activeLongPortfolio = useMemo(() => nearestPortfolio(riskData.optimalPortfolios.longOnly, activePersona.a), [activePersona.a]);
  const activeShortPortfolio = useMemo(() => nearestPortfolio(riskData.optimalPortfolios.shortSalesAllowed, activePersona.a), [activePersona.a]);
  const displayedPortfolio = constraintMode === "longOnly" ? activeLongPortfolio : activeShortPortfolio;
  const topHoldings = positiveWeights(displayedPortfolio.weights, 4);
  const longAnchors = positiveWeights(activeLongPortfolio.weights, 3);
  const shortExposures = negativeWeights(activeShortPortfolio.weights, 3);

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

  return (
    <section className="motion-surface" style={{ background: "radial-gradient(circle at top left, rgba(244, 189, 92, 0.25), transparent 28%), linear-gradient(180deg, #fffdf8 0%, #f3e6d1 100%)", border: `1px solid ${theme.line}`, borderRadius: 32, padding: 28 }}>

      {/* Hero Row */}
      <div className="platform-hero-grid" style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1.1fr) minmax(260px, 0.9fr)", gap: 18, alignItems: "start", marginBottom: 22 }}>
        <div className="dashboard-card" style={{ ...cardStyle, background: "rgba(255,255,255,0.82)", backdropFilter: "blur(12px)" }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: theme.muted, fontWeight: 600 }}>Part 3 Platform</p>
          <h2 style={{ margin: "10px 0 12px", fontSize: 36, lineHeight: 1, background: `linear-gradient(135deg, ${theme.ink}, #3a5a7c)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Compass Wealth Interface</h2>
          <p style={{ margin: 0, color: theme.muted, lineHeight: 1.6 }}>A portfolio-ready web platform combining the 10-fund efficient frontier, questionnaire-driven risk engine, and AI chatbot.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            {[`${frontierData.funds.length} funds`, `${riskData.metadata.sample_start} – ${riskData.metadata.sample_end}`, `${riskData.metadata.return_observations} monthly returns`].map((c) => (
              <span key={c} style={{ padding: "8px 14px", borderRadius: 999, background: theme.soft, color: theme.ink, fontSize: 13, fontWeight: 600 }}>{c}</span>
            ))}
          </div>
        </div>
        <div className="dashboard-card" style={{ ...cardStyle, background: "linear-gradient(135deg, #1f2d37, #2a4054)", color: "#ffffff" }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#bdcad4", fontWeight: 600 }}>Platform Promise</p>
          <p style={{ margin: "10px 0 14px", fontSize: 22, lineHeight: 1.2, fontWeight: 700, color: "#ffffff" }}>One interface, three jobs</p>
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
      <div className="platform-main-grid" style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1.02fr) minmax(320px, 0.98fr)", gap: 18, alignItems: "start" }}>

        {/* Left Column */}
        <div style={{ display: "grid", gap: 18 }}>

          {/* Cockpit */}
          <div className="dashboard-card" style={cardStyle}>
            <SectionHeader kicker="Recommendation Cockpit" title={constraintMode === "longOnly" ? "Implementation Portfolio" : "Short-Sales Benchmark"} icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            <div style={{ marginTop: 6, color: theme.muted }}>Active: <strong style={{ color: theme.ink }}>{activePersona.label}</strong> · A = <strong style={{ color: theme.ink }}>{activePersona.a.toFixed(2)}</strong></div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <button type="button" style={constraintMode === "longOnly" ? activeButtonStyle : inactiveButtonStyle} onClick={() => setConstraintMode("longOnly")}>Long-only</button>
              <button type="button" style={constraintMode === "shortSalesAllowed" ? activeButtonStyle : inactiveButtonStyle} onClick={() => setConstraintMode("shortSalesAllowed")}>Short sales</button>
            </div>
            <div className="stat-grid" style={{ marginTop: 16 }}>
              <StatCard label="Expected return" value={displayedPortfolio.expected_return * 100} animate decimals={2} suffix="%" />
              <StatCard label="Volatility" value={displayedPortfolio.risk * 100} animate decimals={2} suffix="%" />
              <StatCard label="Utility" value={displayedPortfolio.utility} animate decimals={4} />
            </div>
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.muted, fontWeight: 600, marginBottom: 12 }}>Leading holdings</div>
              <div className="holdings-list">
                {topHoldings.map((row) => <HoldingBar key={row.fund} label={row.fund} weight={row.weight} color={constraintMode === "longOnly" ? theme.long : theme.short} onAsk={() => askChatbot(`Why is ${row.fund} weighted so heavily?`)} />)}
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
            <div className="chart-shell platform-chart-shell platform-chart-scroll" style={{ marginTop: 14 }}>
              <svg
                width={chart.width}
                height={chart.height}
                viewBox={`0 0 ${chart.width} ${chart.height}`}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="Efficient frontier — portfolio opportunity set with long-only and short-sales curves"
                style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
              >
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
              {chartTooltip ? (
                <div
                  className="chart-tooltip"
                  style={{
                    left: Math.min(chartTooltip.x, chart.width - 170),
                    top: Math.max(chartTooltip.y - 10, 4),
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{chartTooltip.title}</div>
                  {chartTooltip.lines.map((l) => <div key={l} style={{ fontSize: 13, lineHeight: 1.45 }}>{l}</div>)}
                </div>
              ) : null}
            </div>
            <div className="platform-chart-insights">
              <div className="platform-chart-insight"><span>Current point</span><strong>{formatPercent(displayedPortfolio.expected_return)} return</strong><small>{formatPercent(displayedPortfolio.risk)} volatility</small></div>
              <div className="platform-chart-insight"><span>Constraint</span><strong>{constraintMode === "longOnly" ? "Long-only" : "Short-sales"}</strong><small>Same frontier, different rule</small></div>
              <div className="platform-chart-insight"><span>Top driver</span><strong>{topHoldings[0]?.fund ?? "—"}</strong><small>{topHoldings[0] ? `${formatPercent(topHoldings[0].weight)} weight` : "—"}</small></div>
            </div>
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
                <button key={f.index} type="button" className="fund-card fund-card-interactive" onClick={() => askChatbot(`Tell me about Fund ${f.index}.`)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <h4 style={{ margin: 0 }}>{f.index}. {f.shortName}</h4>
                    <span className="badge-pill">{fundThemes[f.index]}</span>
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
