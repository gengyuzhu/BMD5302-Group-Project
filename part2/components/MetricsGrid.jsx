import React from "react";
import { formatPercent } from "./riskLabUtils.js";

export default function MetricsGrid({ scoring, tone, activePortfolio }) {
  return (
    <div className="risklab-metrics-grid">
      <div className="risklab-metric-card">
        <div className="risklab-panel-kicker">Risk Aversion (A)</div>
        <div className="risklab-metric-value" style={{ color: tone.color }}>
          {scoring.riskAversionA.toFixed(2)}
        </div>
        <div className="risklab-metric-label" style={{ color: tone.color }}>
          {tone.label}
        </div>
      </div>

      <div className="risklab-metric-card">
        <div className="risklab-panel-kicker">Optimal Return</div>
        <div className="risklab-metric-value" style={{ color: "#46f08c" }}>
          {formatPercent(activePortfolio.expected_return)}
        </div>
        <div className="risklab-metric-subcopy">
          Volatility: {formatPercent(activePortfolio.risk)}
        </div>
      </div>

      <div className="risklab-metric-card">
        <div className="risklab-panel-kicker">Maximum Utility (U*)</div>
        <div className="risklab-metric-value" style={{ color: "#ffe27a" }}>
          {activePortfolio.utility.toFixed(4)}
        </div>
        <div className="risklab-metric-subcopy">U = r - (σ²A)/2</div>
      </div>
    </div>
  );
}
