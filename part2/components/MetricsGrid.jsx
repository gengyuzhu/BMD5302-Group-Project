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

      {/* Card 1 — Risk Aversion: zigzag shape reflects volatile risk appetite */}
      <div className="risklab-metric-card risklab-metric-card-glow" style={{ "--metric-glow": tone.color }}>
        <div className="risklab-panel-kicker">Risk Aversion (A)</div>
        <div className="risklab-metric-value" style={{ color: tone.color }}>
          <AnimatedValue target={scoring.riskAversionA} decimals={2} />
        </div>
        <div className="risklab-metric-label" style={{ color: tone.color }}>{tone.label}</div>
        <div className="risklab-metric-sparkline" aria-hidden="true">
          <svg width="100%" height="28" viewBox="0 0 120 28" preserveAspectRatio="none">
            <defs>
              <linearGradient id="spark-a-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={tone.color} stopOpacity="0.30" />
                <stop offset="100%" stopColor={tone.color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,26 L0,22 L20,14 L40,18 L60,8 L80,12 L100,4 L120,10 L120,26 Z"
              fill="url(#spark-a-fill)"
            />
            <path
              d="M0,22 L20,14 L40,18 L60,8 L80,12 L100,4 L120,10"
              fill="none" stroke={tone.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"
            />
          </svg>
        </div>
      </div>

      {/* Card 2 — Optimal Return: consistent uptrend */}
      <div className="risklab-metric-card risklab-metric-card-glow" style={{ "--metric-glow": "#46f08c" }}>
        <div className="risklab-panel-kicker">Optimal Return</div>
        <div className="risklab-metric-value" style={{ color: "#46f08c" }}>
          <AnimatedValue target={activePortfolio.expected_return * 100} decimals={2} suffix="%" />
        </div>
        <div className="risklab-metric-subcopy">Volatility: {formatPercent(activePortfolio.risk)}</div>
        <div className="risklab-metric-sparkline" aria-hidden="true">
          <svg width="100%" height="28" viewBox="0 0 120 28" preserveAspectRatio="none">
            <defs>
              <linearGradient id="spark-ret-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#46f08c" stopOpacity="0.30" />
                <stop offset="100%" stopColor="#46f08c" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,26 L0,24 L30,18 L60,12 L90,6 L120,2 L120,26 Z"
              fill="url(#spark-ret-fill)"
            />
            <path
              d="M0,24 L30,18 L60,12 L90,6 L120,2"
              fill="none" stroke="#46f08c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.82"
            />
          </svg>
        </div>
      </div>

      {/* Card 3 — Utility: gentle convex curve */}
      <div className="risklab-metric-card risklab-metric-card-glow" style={{ "--metric-glow": "#ffe27a" }}>
        <div className="risklab-panel-kicker">Maximum Utility (U*)</div>
        <div className="risklab-metric-value" style={{ color: "#ffe27a" }}>
          <AnimatedValue target={activePortfolio.utility} decimals={4} />
        </div>
        <div className="risklab-metric-subcopy">U = r − ½·A·σ²</div>
        <div className="risklab-metric-sparkline" aria-hidden="true">
          <svg width="100%" height="28" viewBox="0 0 120 28" preserveAspectRatio="none">
            <defs>
              <linearGradient id="spark-u-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffe27a" stopOpacity="0.30" />
                <stop offset="100%" stopColor="#ffe27a" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,26 L0,26 L20,22 L40,16 L60,14 L80,10 L100,7 L120,4 L120,26 Z"
              fill="url(#spark-u-fill)"
            />
            <path
              d="M0,26 L20,22 L40,16 L60,14 L80,10 L100,7 L120,4"
              fill="none" stroke="#ffe27a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.75"
            />
          </svg>
        </div>
      </div>

    </div>
  );
}
