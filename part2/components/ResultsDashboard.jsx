import React from "react";
import MetricsGrid from "./MetricsGrid.jsx";
import EfficientFrontierChart from "./EfficientFrontierChart.jsx";
import AllocationBars from "./AllocationBars.jsx";
import WeightBreakdown from "./WeightBreakdown.jsx";
import { formatPercent } from "./riskLabUtils.js";

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
          Long-only recommendation selected
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
          Short-sales benchmark selected
        </button>
      </div>

      <MetricsGrid scoring={scoring} tone={tone} activePortfolio={activePortfolio} />

      <EfficientFrontierChart
        payload={payload}
        scoring={scoring}
        activePortfolio={activePortfolio}
        portfolioMode={portfolioMode}
      />

      <div className="risklab-results-grid">
        <AllocationBars rows={allocationRows} portfolioMode={portfolioMode} />
        <WeightBreakdown rows={weightBreakdownRows} />
      </div>

      <div className="risklab-card">
        <div className="risklab-chart-title">Justification</div>
        <p className="risklab-justification-copy">{justification}</p>
        <div className="risklab-inline-note">
          Active portfolio: {formatPercent(activePortfolio.expected_return)} return, {formatPercent(activePortfolio.risk)} volatility, utility {activePortfolio.utility.toFixed(4)}.
        </div>
      </div>

      <div className="risklab-retake-row">
        <button type="button" className="risklab-retake-button" onClick={onRetake}>
          Retake Questionnaire
        </button>
      </div>
    </div>
  );
}
