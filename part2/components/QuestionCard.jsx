import React, { useEffect } from "react";

const DIMENSION_ICONS = {
  "Risk Tolerance": "\u{1F3AF}",
  "Investment Horizon": "\u{23F3}",
  "Loss Aversion": "\u{1F6E1}\uFE0F",
  "Drawdown Discipline": "\u{1F4C9}",
  "Return Expectation": "\u{1F4C8}",
};

function iconForDimension(dimension) {
  for (const [key, icon] of Object.entries(DIMENSION_ICONS)) {
    if (dimension.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return "\u{1F4CA}";
}

export default function QuestionCard({
  question,
  totalQuestions,
  currentIndex,
  currentAnswer,
  onSelect,
  slideDirection,
}) {
  const icon = iconForDimension(question.dimension);
  const slideClass = slideDirection === "left"
    ? "risklab-slide-left"
    : slideDirection === "right"
      ? "risklab-slide-right"
      : "";

  // Keyboard shortcut: press 1–5 to select that score
  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
      const score = parseInt(e.key, 10);
      if (score >= 1 && score <= 5) {
        const match = question.options.find((o) => o.score === score);
        if (match) onSelect(match.score);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [question, onSelect]);

  return (
    <div
      className={`risklab-card risklab-question-card ${slideClass}`}
      key={`q-${question.id}-${slideDirection}`}
    >
      <div className="risklab-question-icon">{icon}</div>

      <div className="risklab-question-meta">
        <span>Q{currentIndex + 1}/{totalQuestions}</span>
        <span>{question.dimension}</span>
        <span>weight: {question.weight}x</span>
      </div>

      <h3 className="risklab-question-title">{question.question}</h3>

      <div className="risklab-options" role="radiogroup" aria-label={question.question}>
        {question.options.map((option) => {
          const active = currentAnswer === option.score;
          return (
            <button
              key={option.score}
              type="button"
              className={active ? "risklab-option risklab-option-active" : "risklab-option"}
              onClick={() => onSelect(option.score)}
              aria-pressed={active}
              aria-label={`Option ${option.score}: ${option.label}`}
            >
              <span className="risklab-option-index" aria-hidden="true">{option.score}</span>
              <span>
                {option.label}
                <div className="risklab-option-score-badge">Score: {option.score}/5</div>
              </span>
              <span className="risklab-option-check" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="#35efe6" strokeWidth="2" />
                  <path d="M6 10.5l2.5 2.5 5.5-5.5" stroke="#35efe6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          );
        })}
      </div>
      <p className="risklab-keyboard-hint" aria-live="polite">
        <kbd>1</kbd>–<kbd>5</kbd> to select &nbsp;·&nbsp; <kbd>→</kbd> Next &nbsp;·&nbsp; <kbd>←</kbd> Prev
      </p>
    </div>
  );
}
