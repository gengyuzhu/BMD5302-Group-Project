import React, { useEffect, useState } from "react";
import { formatPercent } from "./riskLabUtils.js";

const BAR_COLORS = [
  "#35efe6", "#ffb21d", "#ff5d4d", "#46f08c", "#8fd6ff",
  "#ffe27a", "#c9a0ff", "#ff8fa3", "#7dd3fc", "#fbbf24",
];

export default function AllocationBars({ rows, portfolioMode }) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => {
      cancelAnimationFrame(id);
      setAnimate(false);
    };
  }, [rows]);

  return (
    <div className="risklab-card">
      <div className="risklab-chart-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, opacity: .6 }}>
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
        </svg>
        {portfolioMode === "shortSalesAllowed"
          ? "Optimal Allocation (Short-Sales Benchmark)"
          : "Optimal Allocation (Long Only)"}
      </div>

      <div className="risklab-allocation-list">
        {rows.map((row, index) => {
          const width = Math.max(8, Math.min(100, Math.abs(row.weight) * 100));
          const negative = row.weight < 0;
          const color = BAR_COLORS[index % BAR_COLORS.length];
          return (
            <div key={row.shortName} className="risklab-allocation-row" style={{ animationDelay: `${index * 60}ms` }}>
              <div className="risklab-allocation-head">
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="risklab-alloc-dot" style={{ background: color }} />
                  {row.fund}
                </span>
                <strong style={{ color: negative ? "#ff5d4d" : color }}>{formatPercent(row.weight, 2)}</strong>
              </div>
              <div className="risklab-allocation-track">
                <div
                  className={negative ? "risklab-allocation-fill risklab-allocation-fill-negative" : "risklab-allocation-fill"}
                  style={{
                    width: animate ? `${width}%` : "0%",
                    background: negative
                      ? "linear-gradient(90deg, #ff5d4d88, #ff5d4d)"
                      : `linear-gradient(90deg, ${color}44, ${color})`,
                    transition: `width .7s cubic-bezier(.22,1,.36,1) ${index * 60}ms`,
                    boxShadow: `0 0 8px ${negative ? "#ff5d4d33" : color + "33"}`,
                  }}
                >
                  {formatPercent(row.weight, 1)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
