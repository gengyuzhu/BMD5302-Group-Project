import React from "react";
import { formatPercent } from "./riskLabUtils.js";

export default function WeightBreakdown({ rows }) {
  return (
    <div className="risklab-card">
      <div className="risklab-chart-title">Weight Breakdown</div>

      <div className="risklab-breakdown-list">
        {rows.map((row) => (
          <div key={row.shortName} className="risklab-breakdown-row">
            <span>{row.fund}</span>
            <strong>{formatPercent(row.weight, 2)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
