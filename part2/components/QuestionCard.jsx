import React from "react";

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

      <div className="risklab-options">
        {question.options.map((option) => {
          const active = currentAnswer === option.score;
          return (
            <button
              key={option.score}
              type="button"
              className={active ? "risklab-option risklab-option-active" : "risklab-option"}
              onClick={() => onSelect(option.score)}
              aria-pressed={active}
            >
              <span className="risklab-option-index">{option.score}</span>
              <span>
                {option.label}
                <div className="risklab-option-score-badge">Score: {option.score}/5</div>
              </span>
              <span className="risklab-option-check">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="#35efe6" strokeWidth="2" />
                  <path d="M6 10.5l2.5 2.5 5.5-5.5" stroke="#35efe6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
