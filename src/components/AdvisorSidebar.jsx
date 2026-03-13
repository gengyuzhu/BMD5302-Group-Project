import React, { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  buildAssistantReply,
  buildContextUpdateMessage,
  buildWelcomeMessage,
  defaultPrompts,
  formatPercent,
  resolveChatContext,
  thinkingLabelForView,
} from "./advisorChatUtils.js";

function ChatMessage({ message, onSuggestionClick }) {
  if (message.role === "user") {
    return (
      <div className="chat-bubble chat-bubble-user advisor-chat-bubble-user">
        {message.text}
      </div>
    );
  }

  return (
    <div className="chat-bubble chat-bubble-assistant">
      <div className="assistant-card">
        {message.title ? <div className="assistant-title">{message.title}</div> : null}
        <div className="assistant-copy">{message.text}</div>

        {message.stats?.length ? (
          <div className="assistant-stats">
            {message.stats.map((stat) => (
              <div key={`${stat.label}-${stat.value}`} className="assistant-stat">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>
        ) : null}

        {message.bullets?.length ? (
          <div className="assistant-list">
            {message.bullets.map((bullet) => (
              <div key={bullet} className="assistant-list-item">
                {bullet}
              </div>
            ))}
          </div>
        ) : null}

        {message.suggestions?.length ? (
          <div className="assistant-followups">
            {message.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="assistant-suggestion"
                onClick={() => onSuggestionClick(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AdvisorSidebar({
  activeView,
  viewContext,
  externalRequest,
}) {
  const normalizedContext = useMemo(
    () => resolveChatContext(activeView, viewContext),
    [activeView, viewContext],
  );
  const [isPinned, setIsPinned] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState(
    thinkingLabelForView(activeView),
  );
  const [messages, setMessages] = useState(() => [
    buildWelcomeMessage(activeView, normalizedContext),
  ]);

  const viewportRef = useRef(null);
  const timerIdsRef = useRef([]);
  const signatureRef = useRef(normalizedContext.signature);
  const externalPromptRef = useRef(null);

  const isExpanded = isPinned || isHovering;
  const promptSuggestions = useMemo(
    () => defaultPrompts(activeView, normalizedContext),
    [activeView, normalizedContext],
  );

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTo({
        top: viewportRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isThinking, isExpanded]);

  useEffect(
    () => () => {
      timerIdsRef.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  useEffect(() => {
    if (signatureRef.current === normalizedContext.signature) {
      return;
    }

    signatureRef.current = normalizedContext.signature;
    setMessages((current) => [
      ...current,
      buildContextUpdateMessage(activeView, normalizedContext),
    ]);
  }, [activeView, normalizedContext]);

  function submitMessage(rawText) {
    const text = rawText.trim();
    if (!text) {
      return;
    }

    setMessages((current) => [...current, { role: "user", text }]);
    setDraft("");
    setIsThinking(true);
    setThinkingLabel(thinkingLabelForView(activeView));

    const id = window.setTimeout(() => {
      timerIdsRef.current = timerIdsRef.current.filter(
        (timerId) => timerId !== id,
      );
      const reply = buildAssistantReply(text, activeView, normalizedContext);
      startTransition(() => {
        setMessages((current) => [...current, reply]);
        setIsThinking(timerIdsRef.current.length > 0);
      });
    }, 360);

    timerIdsRef.current = [...timerIdsRef.current, id];
  }

  function clearChat() {
    timerIdsRef.current.forEach((id) => window.clearTimeout(id));
    timerIdsRef.current = [];
    setIsThinking(false);
    setMessages([buildWelcomeMessage(activeView, normalizedContext)]);
  }

  useEffect(() => {
    if (!externalRequest?.id || externalPromptRef.current === externalRequest.id) {
      return;
    }

    externalPromptRef.current = externalRequest.id;
    setIsPinned(true);
    setIsHovering(true);
    submitMessage(externalRequest.text);
  }, [externalRequest, activeView, normalizedContext]);

  return (
    <div className="advisor-dock">
      <div
        className={isExpanded ? "advisor-panel advisor-panel-expanded" : "advisor-panel"}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onFocusCapture={() => setIsHovering(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsHovering(false);
          }
        }}
      >
        <button
          type="button"
          className="advisor-compact-trigger"
          onClick={() => setIsPinned((current) => !current)}
          aria-pressed={isPinned}
          aria-label={isPinned ? "Collapse AI sidebar" : "Expand AI sidebar"}
        >
          <span className="advisor-trigger-orb">AI</span>
          <span className="advisor-trigger-copy">
            <strong>Copilot</strong>
            <small>{activeView === "platform" ? "Platform" : activeView === "frontier" ? "Part 1" : "Part 2"}</small>
          </span>
        </button>

        <div className="advisor-panel-body">
          <div className="advisor-panel-top">
            <div>
              <div className="advisor-panel-kicker">AI Chatbot</div>
              <h3 className="advisor-panel-title">Compass copilot</h3>
              <div className="advisor-panel-subtitle">
                {activeView === "platform"
                  ? "Explains the current recommendation using Parts 1 and 2."
                  : activeView === "frontier"
                    ? "Answers Part 1 frontier, GMVP, statistics, correlation, and covariance questions."
                    : "Answers Part 2 questionnaire, A mapping, and optimal-portfolio questions."}
              </div>
            </div>

            <div className="advisor-panel-actions">
              <button
                type="button"
                className={isPinned ? "advisor-pin advisor-pin-active" : "advisor-pin"}
                onClick={() => setIsPinned((current) => !current)}
              >
                {isPinned ? "Pinned" : "Pin"}
              </button>
            </div>
          </div>

          <div className="chat-context advisor-chat-context">
            <div>
              <strong>Live context</strong>
              <div style={{ marginTop: 4, color: "rgba(255,255,255,0.82)" }}>
                {activeView === "platform"
                  ? `${normalizedContext.activePersona.label} | ${normalizedContext.constraintMode === "longOnly" ? "Long-only implementation" : "Short-sales benchmark"}`
                  : activeView === "frontier"
                    ? `${normalizedContext.constraintMode === "shortSalesAllowed" ? "Short-sales frontier" : "Long-only frontier"} | ${normalizedContext.analyticsView}`
                    : normalizedContext.isComplete
                      ? `A = ${normalizedContext.scoring.riskAversionA.toFixed(2)} | ${normalizedContext.constraintMode === "longOnly" ? "Long-only recommendation" : "Short-sales benchmark"}`
                      : `${normalizedContext.answeredCount}/${normalizedContext.questionnaireLength} answered | Questionnaire mode`}
              </div>
            </div>
            <div className="chat-badges">
              <span className="chat-badge">
                Return {formatPercent(normalizedContext.currentPortfolio.expected_return ?? normalizedContext.currentPortfolio.return ?? 0)}
              </span>
              <span className="chat-badge">
                Vol {formatPercent(normalizedContext.currentPortfolio.risk ?? 0)}
              </span>
            </div>
          </div>

          <div className="prompt-grid advisor-prompt-grid">
            {promptSuggestions.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="assistant-suggestion"
                onClick={() => submitMessage(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div ref={viewportRef} className="chat-log advisor-chat-log">
            {messages.map((message, index) => (
              <ChatMessage
                key={`${message.role}-${index}`}
                message={message}
                onSuggestionClick={submitMessage}
              />
            ))}
            {isThinking ? <div className="chat-status">{thinkingLabel}</div> : null}
          </div>

          <form
            className="advisor-composer"
            onSubmit={(event) => {
              event.preventDefault();
              submitMessage(draft);
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about Part 1, Part 2, a fund, the frontier, or the current portfolio"
              className="advisor-input"
            />
            <button type="submit" className="advisor-send-button">
              Send
            </button>
            <button type="button" className="advisor-clear-button" onClick={clearChat}>
              Clear
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
