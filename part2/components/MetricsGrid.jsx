import React, { useEffect, useState } from "react";
import { formatPercent } from "./riskLabUtils.js";

function AnimatedValue({ target, decimals = 2, suffix = "", prefix = "" }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 800;
    const start = performance.now();
    const from = 0;
    const to = target;

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, [target]);

  return <>{prefix}{display.toFixed(decimals)}{suffix}</>;
}

export default function MetricsGrid({ scoring, tone, activePortfolio }) {
  return (
    <div className="risklab-metrics-grid">
      <div
        className="risklab-metric-card risklab-metric-card-glow"
        style={{ "--metric-glow": tone.color }}
      >
        <div className="risklab-panel-kicker">Risk Aversion (A)</div>
        <div className="risklab-metric-value" style={{ color: tone.color }}>
          <AnimatedValue target={scoring.riskAversionA} decimals={2} />
        </div>
        <div className="risklab-metric-label" style={{ color: tone.color }}>
          {tone.label}
        </div>
        {/* Sparkline decoration */}
        <div className="risklab-metric-sparkline">
          <svg width="100%" height="24" viewBox="0 0 120 24" preserveAspectRatio="none">
            <line x1="0" y1="20" x2="30" y2="8" stroke={tone.color} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            <line x1="30" y1="8" x2="60" y2="14" stroke={tone.color} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            <line x1="60" y1="14" x2="90" y2="4" stroke={tone.color} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            <line x1="90" y1="4" x2="120" y2="12" stroke={tone.color} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          </svg>
        </div>
      </div>

      <div className="risklab-metric-card" style={{ "--metric-glow": "#46f08c" }}>
        <div className="risklab-panel-kicker">Optimal Return</div>
        <div className="risklab-metric-value" style={{ color: "#46f08c" }}>
          <AnimatedValue target={activePortfolio.expected_return * 100} decimals={2} suffix="%" />
        </div>
        <div className="risklab-metric-subcopy">
          Volatility: {formatPercent(activePortfolio.risk)}
        </div>
        <div className="risklab-metric-sparkline">
          <svg width="100%" height="24" viewBox="0 0 120 24" preserveAspectRatio="none">
            <line x1="0" y1="18" x2="40" y2="10" stroke="#46f08c" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            <line x1="40" y1="10" x2="80" y2="6" stroke="#46f08c" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            <line x1="80" y1="6" x2="120" y2="2" stroke="#46f08c" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          </svg>
        </div>
      </div>

      <div className="risklab-metric-card" style={{ "--metric-glow": "#ffe27a" }}>
        <div className="risklab-panel-kicker">Maximum Utility (U*)</div>
        <div className="risklab-metric-value" style={{ color: "#ffe27a" }}>
          <AnimatedValue target={activePortfolio.utility} decimals={4} />
        </div>
        <div className="risklab-metric-subcopy">
          Expected return minus one half of A multiplied by variance
        </div>
        <div className="risklab-metric-sparkline">
          <svg width="100%" height="24" viewBox="0 0 120 24" preserveAspectRatio="none">
            <line x1="0" y1="22" x2="30" y2="16" stroke="#ffe27a" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            <line x1="30" y1="16" x2="60" y2="12" stroke="#ffe27a" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            <line x1="60" y1="12" x2="90" y2="8" stroke="#ffe27a" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            <line x1="90" y1="8" x2="120" y2="4" stroke="#ffe27a" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}
