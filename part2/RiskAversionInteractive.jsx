import React, { useMemo, useState, useCallback, useEffect } from "react";
import payload from "../part2_outputs/part2_risk_profile_data.json";
import "./risk-lab.css";
import QuizWizard from "./components/QuizWizard.jsx";
import ResultsDashboard from "./components/ResultsDashboard.jsx";
import {
  buildJustification,
  displayRiskTone,
  nearestPortfolio,
  questionnaireBounds,
  scoreAnswers,
  smoothScrollToTop,
  weightRows,
} from "./components/riskLabUtils.js";

/**
 * RiskAversionInteractive
 *
 * Expected data shape (defaults to the imported Part 2 JSON payload):
 * @param {Object} props
 * @param {Object} props.data
 * @param {Object} props.data.questionnaire - Contains { questionnaire: Array<{ id, question, dimension, weight, options }> }
 * @param {Object} props.data.optimalPortfolios - { longOnly: Array, shortSalesAllowed: Array }
 * @param {Array}  props.data.funds - Array of { index, shortName, displayName, annualReturn, annualVolatility }
 * @param {Object} props.data.metadata - { sample_start, sample_end, return_observations }
 */
export default function RiskAversionInteractive({ data = payload }) {
  const questionnaire = data.questionnaire.questionnaire;
  const bounds = useMemo(() => questionnaireBounds(questionnaire), [questionnaire]);

  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("quiz");
  const [portfolioMode, setPortfolioMode] = useState("longOnly");
  const [quizNotice, setQuizNotice] = useState("");
  const [showRetakeConfirm, setShowRetakeConfirm] = useState(false);

  const currentQuestion = questionnaire[currentIndex];
  const currentAnswer = currentQuestion ? Number(answers[currentQuestion.id] ?? 0) : 0;
  const answeredCount = Object.keys(answers).length;
  const isComplete = answeredCount === questionnaire.length;
  const firstUnansweredIndex = questionnaire.findIndex((question) => !answers[question.id]);

  const scoring = useMemo(
    () => (isComplete ? scoreAnswers(answers, questionnaire) : null),
    [answers, isComplete, questionnaire],
  );

  const tone = useMemo(
    () => (scoring ? displayRiskTone(scoring.riskAversionA) : null),
    [scoring],
  );

  const fundMap = useMemo(
    () => Object.fromEntries(data.funds.map((fund) => [fund.shortName, `${fund.index}. ${fund.shortName}`])),
    [data.funds],
  );

  const longPortfolio = useMemo(
    () =>
      scoring
        ? nearestPortfolio(data.optimalPortfolios.longOnly, scoring.riskAversionA)
        : null,
    [data.optimalPortfolios.longOnly, scoring],
  );

  const shortBenchmark = useMemo(
    () =>
      scoring
        ? nearestPortfolio(data.optimalPortfolios.shortSalesAllowed, scoring.riskAversionA)
        : null,
    [data.optimalPortfolios.shortSalesAllowed, scoring],
  );

  const activePortfolio =
    portfolioMode === "shortSalesAllowed" ? shortBenchmark : longPortfolio;
  const comparisonPortfolio =
    portfolioMode === "shortSalesAllowed" ? longPortfolio : shortBenchmark;

  const allWeightRows = useMemo(
    () => (activePortfolio ? weightRows(activePortfolio.weights, fundMap) : []),
    [activePortfolio, fundMap],
  );

  const allocationRows = useMemo(() => {
    if (!activePortfolio) return [];

    if (portfolioMode === "shortSalesAllowed") {
      return allWeightRows.slice(0, 6);
    }

    const positive = allWeightRows.filter((row) => row.weight > 0.0001);
    return positive.length > 0 ? positive : allWeightRows.slice(0, 6);
  }, [activePortfolio, allWeightRows, portfolioMode]);

  const justification = useMemo(
    () =>
      scoring && activePortfolio
        ? buildJustification({
            scoring,
            portfolio: activePortfolio,
            portfolioMode,
            topRows: allocationRows,
            comparisonPortfolio,
          })
        : "",
    [activePortfolio, allocationRows, comparisonPortfolio, portfolioMode, scoring],
  );

  const handleTabChange = (nextTab) => {
    if (nextTab === "results" && !isComplete) {
      setQuizNotice("You still have unanswered questions. Please return and complete every question before opening the optimal portfolio.");
      if (firstUnansweredIndex >= 0) {
        setCurrentIndex(firstUnansweredIndex);
      }
      setActiveTab("quiz");
      smoothScrollToTop();
      return;
    }
    setQuizNotice("");
    setActiveTab(nextTab);
    smoothScrollToTop();
  };

  const handleAnswerSelect = (score) => {
    const nextAnswers = { ...answers, [currentQuestion.id]: score };
    const nextAnsweredCount = Object.keys(nextAnswers).length;
    setAnswers(nextAnswers);
    setQuizNotice("");

    if (currentIndex === questionnaire.length - 1 && nextAnsweredCount === questionnaire.length) {
      setActiveTab("results");
      setPortfolioMode("longOnly");
      smoothScrollToTop();
    }
  };

  const handleNext = () => {
    if (!currentAnswer) return;
    if (currentIndex === questionnaire.length - 1) {
      if (!isComplete) {
        setQuizNotice("You still have unanswered questions. Please return and complete every question before opening the optimal portfolio.");
        if (firstUnansweredIndex >= 0) {
          setCurrentIndex(firstUnansweredIndex);
        }
        return;
      }
      setQuizNotice("");
      setActiveTab("results");
      setPortfolioMode("longOnly");
      smoothScrollToTop();
      return;
    }
    setQuizNotice("");
    setCurrentIndex((index) => Math.min(questionnaire.length - 1, index + 1));
  };

  const handlePrevious = () => {
    setQuizNotice("");
    setCurrentIndex((index) => Math.max(0, index - 1));
  };

  const handleRetakeRequest = useCallback(() => {
    setShowRetakeConfirm(true);
  }, []);

  const handleRetakeConfirm = useCallback(() => {
    setShowRetakeConfirm(false);
    setAnswers({});
    setCurrentIndex(0);
    setActiveTab("quiz");
    setPortfolioMode("longOnly");
    setQuizNotice("");
    smoothScrollToTop();
  }, []);

  const handleRetakeCancel = useCallback(() => {
    setShowRetakeConfirm(false);
  }, []);

  // Escape key closes the retake modal
  useEffect(() => {
    if (!showRetakeConfirm) return;
    function onKeyDown(e) {
      if (e.key === "Escape") handleRetakeCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showRetakeConfirm, handleRetakeCancel]);

  return (
    <section className="motion-surface risklab-shell">
      <div className="risklab-header">
        <p className="risklab-kicker">Part 2: Risk Aversion &amp; Optimal Portfolio</p>
        <h2 className="risklab-title">Risk Aversion &amp; Optimal Portfolio</h2>
        <p className="risklab-subtitle">
          Quadratic utility framework&nbsp;
          <span style={{ opacity: .6 }}>(U&nbsp;=&nbsp;r&nbsp;&minus;&nbsp;&frac12;A&sigma;&sup2;)</span>&nbsp;
          applied to 10 FSMOne funds using {data.metadata.return_observations} monthly return observations.
        </p>

        <div className="risklab-tabs">
          <button
            type="button"
            className={activeTab === "quiz" ? "risklab-tab risklab-tab-active" : "risklab-tab"}
            onClick={() => handleTabChange("quiz")}
            aria-pressed={activeTab === "quiz"}
            aria-label={`Risk Questionnaire — ${answeredCount} of ${questionnaire.length} answered`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
            Risk Questionnaire
            {answeredCount > 0 && !isComplete && (
              <span style={{
                marginLeft: 8,
                fontSize: ".7rem",
                background: "rgba(255,255,255,.1)",
                padding: "2px 8px",
                borderRadius: 10,
                fontVariantNumeric: "tabular-nums",
              }}>
                {answeredCount}/{questionnaire.length}
              </span>
            )}
          </button>
          <button
            type="button"
            className={
              activeTab === "results"
                ? "risklab-tab risklab-tab-active"
                : isComplete
                  ? "risklab-tab"
                  : "risklab-tab risklab-tab-disabled"
            }
            onClick={() => handleTabChange("results")}
            disabled={!isComplete}
            aria-pressed={activeTab === "results"}
            aria-label={isComplete ? "View Optimal Portfolio results" : "Complete questionnaire first to unlock Optimal Portfolio"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
            </svg>
            Optimal Portfolio
            {isComplete && (
              <span style={{
                marginLeft: 8,
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#46f08c",
                display: "inline-block",
                boxShadow: "0 0 6px #46f08c88",
              }} />
            )}
          </button>
        </div>
      </div>

      {activeTab === "quiz" && (
        <QuizWizard
          questionnaire={questionnaire}
          currentIndex={currentIndex}
          currentQuestion={currentQuestion}
          currentAnswer={currentAnswer}
          answers={answers}
          answeredCount={answeredCount}
          bounds={bounds}
          notice={quizNotice}
          onSelect={handleAnswerSelect}
          onPrev={handlePrevious}
          onNext={handleNext}
          onJump={(index) => {
            setQuizNotice("");
            setCurrentIndex(index);
          }}
        />
      )}

      {activeTab === "results" && isComplete && scoring && activePortfolio && tone && (
        <ResultsDashboard
          payload={data}
          scoring={scoring}
          tone={tone}
          portfolioMode={portfolioMode}
          onPortfolioModeChange={setPortfolioMode}
          activePortfolio={activePortfolio}
          allocationRows={allocationRows}
          weightBreakdownRows={allWeightRows}
          justification={justification}
          onRetake={handleRetakeRequest}
        />
      )}
      {/* ── Retake Confirmation Modal ── */}
      {showRetakeConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="retake-dialog-title"
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(4, 8, 22, 0.72)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <div style={{
            background: "linear-gradient(145deg, #0f1a2e, #141e34)",
            border: "1px solid rgba(53, 239, 230, 0.18)",
            borderRadius: 20,
            padding: "36px 40px",
            maxWidth: 400,
            width: "90vw",
            boxShadow: "0 32px 80px rgba(4, 8, 22, 0.7)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            animation: "stage-in 240ms cubic-bezier(0.22, 1, 0.36, 1) both",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: "rgba(255, 178, 29, 0.14)",
                border: "1px solid rgba(255, 178, 29, 0.28)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffb21d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3 id="retake-dialog-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#eef5ff" }}>
                Retake Questionnaire?
              </h3>
            </div>
            <p style={{ margin: 0, color: "#b8cce4", lineHeight: 1.65, fontSize: 14 }}>
              All {questionnaire.length} answers and your current optimal portfolio result will be cleared. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <button
                type="button"
                onClick={handleRetakeCancel}
                style={{
                  padding: "10px 20px", borderRadius: 10,
                  border: "1px solid rgba(86, 112, 145, 0.28)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#b8cce4", fontSize: 14, fontWeight: 600,
                  cursor: "pointer", transition: "background 200ms",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRetakeConfirm}
                autoFocus
                style={{
                  padding: "10px 22px", borderRadius: 10,
                  border: "1px solid rgba(255, 93, 77, 0.4)",
                  background: "rgba(255, 93, 77, 0.14)",
                  color: "#ff8075", fontSize: 14, fontWeight: 700,
                  cursor: "pointer", transition: "background 200ms, box-shadow 200ms",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,93,77,0.26)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(255,93,77,0.25)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,93,77,0.14)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                Yes, Retake
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
