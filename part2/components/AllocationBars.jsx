import React from "react";
import { formatPercent } from "./riskLabUtils.js";

export default function AllocationBars({ rows, portfolioMode }) {
  return (
    <div className="risklab-card">
      <div className="risklab-chart-title">
        {portfolioMode === "shortSalesAllowed"
          ? "Optimal Allocation (Short-Sales Benchmark)"
          : "Optimal Allocation (Long Only)"}
      </div>

      <div className="risklab-allocation-list">
        {rows.map((row) => {
          const width = Math.max(8, Math.min(100, Math.abs(row.weight) * 100));
          const negative = row.weight < 0;
          return (
            <div key={row.shortName} className="risklab-allocation-row">
              <div className="risklab-allocation-head">
                <span>{row.fund}</span>
                <strong>{formatPercent(row.weight, 2)}</strong>
              </div>
              <div className="risklab-allocation-track">
                <div
                  className={negative ? "risklab-allocation-fill risklab-allocation-fill-negative" : "risklab-allocation-fill"}
                  style={{ width: `${width}%` }}
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
