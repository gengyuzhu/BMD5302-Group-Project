import React, { useRef } from "react";
import QuestionCard from "./QuestionCard.jsx";

export default function QuizWizard({
  questionnaire,
  currentIndex,
  currentQuestion,
  currentAnswer,
  answers,
  answeredCount,
  bounds,
  notice,
  onSelect,
  onPrev,
  onNext,
  onJump,
}) {
  const prevIndexRef = useRef(currentIndex);
  const slideDirection = currentIndex > prevIndexRef.current
    ? "left"
    : currentIndex < prevIndexRef.current
      ? "right"
      : "";
  prevIndexRef.current = currentIndex;

  const completionPct = questionnaire.length > 0
    ? Math.round((answeredCount / questionnaire.length) * 100)
    : 0;

  // SVG ring dimensions
  const ringRadius = 54;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (completionPct / 100) * ringCircumference;

  return (
    <div className="risklab-stage risklab-quiz-layout">
      <div className="risklab-main-column">
        <div className="risklab-segmented-progress" aria-label="Questionnaire progress">
          {questionnaire.map((question, index) => {
            const answered = Number(answers[question.id] ?? 0) > 0;
            const classes = [
              "risklab-segment",
              answered ? "risklab-segment-complete" : "",
              index === currentIndex ? "risklab-segment-active" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <button
                key={question.id}
                type="button"
                className={classes}
                onClick={() => onJump(index)}
                aria-label={`Question ${index + 1}`}
              />
            );
          })}
        </div>

        {notice && <div className="risklab-notice">{notice}</div>}

        <QuestionCard
          question={currentQuestion}
          totalQuestions={questionnaire.length}
          currentIndex={currentIndex}
          currentAnswer={currentAnswer}
          onSelect={onSelect}
          slideDirection={slideDirection}
        />

        <div className="risklab-nav-row">
          <button
            type="button"
            className="risklab-nav-button risklab-nav-button-secondary"
            onClick={onPrev}
            disabled={currentIndex === 0}
          >
            &larr; Prev
          </button>
          <button
            type="button"
            className="risklab-nav-button risklab-nav-button-primary"
            onClick={onNext}
            disabled={!currentAnswer}
          >
            Next &rarr;
          </button>
        </div>
      </div>

      <div className="risklab-side-column">
        {/* Circular progress ring */}
        <div className="risklab-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 24px" }}>
          <div className="risklab-progress-ring-wrap">
            <svg className="risklab-progress-ring-svg" width="132" height="132" viewBox="0 0 132 132">
              <defs>
                <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#35efe6" />
                  <stop offset="100%" stopColor="#ffb21d" />
                </linearGradient>
              </defs>
              <circle
                className="risklab-progress-ring-bg"
                cx="66"
                cy="66"
                r={ringRadius}
              />
              <circle
                className="risklab-progress-ring-value"
                cx="66"
                cy="66"
                r={ringRadius}
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
              />
              <text
                className="risklab-progress-ring-text"
                x="66"
                y="66"
                textAnchor="middle"
                dominantBaseline="central"
                transform="rotate(90 66 66)"
              >
                {completionPct}%
              </text>
            </svg>
            <div className="risklab-progress-ring-label">Completion</div>
          </div>

          {/* Confidence meter */}
          <div style={{ width: "100%", marginTop: 14 }}>
            <div style={{ fontSize: 12, color: "#8ca1bf", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
              Confidence Meter
            </div>
            <div className="risklab-confidence-meter">
              <div
                className="risklab-confidence-fill"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="risklab-card">
          <div className="risklab-panel-kicker">Question Status</div>
          <h3 className="risklab-panel-title">{answeredCount}/{questionnaire.length} answered</h3>

          <div className="risklab-status-list">
            {questionnaire.map((question, index) => {
              const answered = Number(answers[question.id] ?? 0) > 0;
              const classes = [
                "risklab-status-item",
                answered ? "risklab-status-item-complete" : "",
                index === currentIndex ? "risklab-status-item-active" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={question.id}
                  type="button"
                  className={classes}
                  onClick={() => onJump(index)}
                >
                  <span>
                    {index + 1}. {question.dimension}
                  </span>
                  <strong>{answered ? `${answers[question.id]}/5` : "--"}</strong>
                </button>
              );
            })}
          </div>
        </div>

        <div className="risklab-card risklab-footer-box">
          <div className="risklab-panel-kicker">Interpretation</div>
          <div className="risklab-footer-copy">
            <div>
              <strong>Answered counter:</strong> {answeredCount}/{questionnaire.length} answered
            </div>

            <div className="risklab-formula-block">
              <strong>Formula summary</strong>
              <div className="risklab-formula-equation">S = sum(weight_i x score_i)</div>
              <div className="risklab-formula-equation">
                T = (S - {bounds.min}) / {bounds.max - bounds.min}
              </div>
              <div className="risklab-formula-equation">A = 10 - 9T</div>
              <div className="risklab-formula-equation">U = r - (A x sigma^2) / 2</div>
            </div>

            <div>
              <strong>Questionnaire logic:</strong> the two behavior-based questions carry double weight because drawdown discipline and loss tolerance are the strongest indicators of practical risk capacity.
            </div>
            <div>
              <strong>Implementation choice:</strong> the completed score is mapped into a risk aversion coefficient A, then used to compare the recommended long-only solution against the short-sales benchmark on the same frontier.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
