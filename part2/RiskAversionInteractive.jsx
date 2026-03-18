import React, { useMemo, useState } from "react";
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

export default function RiskAversionInteractive({ data = payload }) {
  const questionnaire = data.questionnaire.questionnaire;
  const bounds = useMemo(() => questionnaireBounds(questionnaire), [questionnaire]);

  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("quiz");
  const [portfolioMode, setPortfolioMode] = useState("longOnly");
  const [quizNotice, setQuizNotice] = useState("");

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

  const handleRetake = () => {
    setAnswers({});
    setCurrentIndex(0);
    setActiveTab("quiz");
    setPortfolioMode("longOnly");
    setQuizNotice("");
    smoothScrollToTop();
  };

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
          onRetake={handleRetake}
        />
      )}
    </section>
  );
}
