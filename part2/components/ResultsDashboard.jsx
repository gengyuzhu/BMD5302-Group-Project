import React, { useEffect, useState } from "react";
import MetricsGrid from "./MetricsGrid.jsx";
import EfficientFrontierChart from "./EfficientFrontierChart.jsx";
import AllocationBars from "./AllocationBars.jsx";
import WeightBreakdown from "./WeightBreakdown.jsx";
import { formatPercent, buildGaugeData, buildDonutData } from "./riskLabUtils.js";

/* ── tiny fade-in wrapper ── */
function FadeIn({ children, delay = 0, className = "" }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(id);
  }, [delay]);

  return (
    <div
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(18px)",
        transition: "opacity .5s cubic-bezier(.22,1,.36,1), transform .5s cubic-bezier(.22,1,.36,1)",
      }}
    >
      {children}
    </div>
  );
}

/* ── SVG gauge component ── */
function RiskGauge({ aValue, tone }) {
  const g = buildGaugeData(aValue);

  return (
    <svg width={g.svgWidth} height={g.svgHeight} viewBox={`0 0 ${g.svgWidth} ${g.svgHeight}`} style={{ overflow: "visible" }}>
      {/* background arc */}
      <path d={g.backgroundArc} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="14" strokeLinecap="round" />
      {/* value arc */}
      <path d={g.valueArc} fill="none" stroke={tone.color} strokeWidth="14" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${tone.color}55)` }} />
      {/* needle dot */}
      <circle cx={g.needleX} cy={g.needleY} r="6" fill={tone.color} stroke="#0d1117" strokeWidth="2" />
      {/* center label */}
      <text x={g.cx} y={g.cy - 8} textAnchor="middle" fill={tone.color} fontSize="26" fontWeight="700" fontFamily="inherit">
        {aValue.toFixed(2)}
      </text>
      <text x={g.cx} y={g.cy + 12} textAnchor="middle" fill="rgba(255,255,255,.5)" fontSize="11" fontFamily="inherit">
        Risk Aversion (A)
      </text>
    </svg>
  );
}

/* ── SVG donut component ── */
function AllocationDonut({ rows, size = 160 }) {
  const donutData = buildDonutData(rows);
  if (donutData.length === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const circumference = 2 * Math.PI * r;

  let cumOffset = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {donutData.map((seg) => {
          const dash = seg.fraction * circumference;
          const gap = circumference - dash;
          const offset = -cumOffset;
          cumOffset += dash;
          return (
            <circle
              key={seg.shortName}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="18"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ filter: `drop-shadow(0 0 3px ${seg.color}44)` }}
            />
          );
        })}
        {/* inner circle */}
        <circle cx={cx} cy={cy} r={r - 16} fill="rgba(13,17,23,.6)" />
      </svg>
      <div className="risklab-donut-legend">
        {donutData.map((seg) => (
          <div key={seg.shortName} className="risklab-donut-legend-row">
            <span className="risklab-donut-dot" style={{ background: seg.color }} />
            <span className="risklab-donut-legend-label">{seg.fund || seg.shortName}</span>
            <span className="risklab-donut-legend-pct">{(seg.fraction * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── profile summary card ── */
function ProfileSummary({ scoring, tone, activePortfolio, allocationRows }) {
  return (
    <div className="risklab-card risklab-profile-summary">
      <div className="risklab-profile-summary-inner">
        <div className="risklab-profile-gauge-col">
          <RiskGauge aValue={scoring.riskAversionA} tone={tone} />
          <div className="risklab-profile-badge" style={{ color: tone.color, borderColor: `${tone.color}44` }}>
            {tone.label} Investor
          </div>
        </div>
        <div className="risklab-profile-donut-col">
          <div className="risklab-panel-kicker" style={{ marginBottom: 8 }}>Portfolio Allocation</div>
          <AllocationDonut rows={allocationRows} size={140} />
        </div>
      </div>
    </div>
  );
}

export default function ResultsDashboard({
  payload,
  scoring,
  tone,
  portfolioMode,
  onPortfolioModeChange,
  activePortfolio,
  allocationRows,
  weightBreakdownRows,
  justification,
  onRetake,
}) {
  return (
    <div className="risklab-stage risklab-results-layout">
      <FadeIn delay={0}>
        <div className="risklab-mode-row">
          <button
            type="button"
            className={
              portfolioMode === "longOnly"
                ? "risklab-mode-button risklab-mode-button-active"
                : "risklab-mode-button"
            }
            onClick={() => onPortfolioModeChange("longOnly")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Long-Only Recommendation
          </button>
          <button
            type="button"
            className={
              portfolioMode === "shortSalesAllowed"
                ? "risklab-mode-button risklab-mode-button-active"
                : "risklab-mode-button"
            }
            onClick={() => onPortfolioModeChange("shortSalesAllowed")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            Short-Sales Benchmark
          </button>
        </div>
      </FadeIn>

      <FadeIn delay={80}>
        <ProfileSummary scoring={scoring} tone={tone} activePortfolio={activePortfolio} allocationRows={allocationRows} />
      </FadeIn>

      <FadeIn delay={160}>
        <MetricsGrid scoring={scoring} tone={tone} activePortfolio={activePortfolio} />
      </FadeIn>

      <FadeIn delay={240}>
        <EfficientFrontierChart
          payload={payload}
          scoring={scoring}
          activePortfolio={activePortfolio}
          portfolioMode={portfolioMode}
        />
      </FadeIn>

      <FadeIn delay={320}>
        <div className="risklab-results-grid">
          <AllocationBars rows={allocationRows} portfolioMode={portfolioMode} />
          <WeightBreakdown rows={weightBreakdownRows} />
        </div>
      </FadeIn>

      <FadeIn delay={400}>
        <div className="risklab-card risklab-justification-card">
          <div className="risklab-chart-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, verticalAlign: "middle", opacity: .6 }}>
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
            Justification
          </div>
          <p className="risklab-justification-copy">{justification}</p>
          <div className="risklab-inline-note">
            Active portfolio: {formatPercent(activePortfolio.expected_return)} return, {formatPercent(activePortfolio.risk)} volatility, utility {activePortfolio.utility.toFixed(4)}.
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={480}>
        <div className="risklab-retake-row">
          <button type="button" className="risklab-retake-button" onClick={onRetake}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 105.64-12.36L1 10"/>
            </svg>
            Retake Questionnaire
          </button>
        </div>
      </FadeIn>
    </div>
  );
}
