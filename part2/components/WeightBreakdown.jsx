import React from "react";
import { formatPercent } from "./riskLabUtils.js";

const ROW_COLORS = [
  "#35efe6", "#ffb21d", "#ff5d4d", "#46f08c", "#8fd6ff",
  "#ffe27a", "#c9a0ff", "#ff8fa3", "#7dd3fc", "#fbbf24",
];

export default function WeightBreakdown({ rows }) {
  return (
    <div className="risklab-card">
      <div className="risklab-chart-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, opacity: .6 }}>
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
        Weight Breakdown
      </div>

      <div className="risklab-breakdown-list">
        <div className="risklab-breakdown-header">
          <span>Fund</span>
          <span>Weight</span>
        </div>
        {rows.map((row, index) => {
          const color = ROW_COLORS[index % ROW_COLORS.length];
          const isNeg = row.weight < 0;
          return (
            <div
              key={row.shortName}
              className={`risklab-breakdown-row ${index % 2 === 0 ? "risklab-breakdown-row-alt" : ""}`}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: color,
                    flexShrink: 0,
                    boxShadow: `0 0 4px ${color}55`,
                  }}
                />
                {row.fund}
              </span>
              <strong style={{ color: isNeg ? "#ff5d4d" : color, fontVariantNumeric: "tabular-nums" }}>
                {formatPercent(row.weight, 2)}
              </strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}
