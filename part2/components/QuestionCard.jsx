import React from "react";

export default function QuestionCard({
  question,
  totalQuestions,
  currentIndex,
  currentAnswer,
  onSelect,
}) {
  return (
    <div className="risklab-card risklab-question-card">
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
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
