import React from "react";
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
