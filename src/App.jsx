import { Component, Suspense, lazy, useEffect, useMemo, useState } from "react";
import "./app.css";
const GlobalChatbot = lazy(() => import("./GlobalChatbot.jsx"));

const EfficientFrontierInteractive = lazy(() => import("../part1/EfficientFrontierInteractive.jsx"));
const RiskAversionInteractive = lazy(() => import("../part2/RiskAversionInteractive.jsx"));
const PlatformExperience = lazy(() => import("../part3/PlatformExperience.jsx"));

const views = [
  {
    id: "platform",
    title: "Platform",
    eyebrow: "Part 3",
    heading: "Web Platform + AI Chatbot",
    intro:
      "A portfolio-ready interface that unifies the fund universe, risk profiling, recommendation engine, and chatbot guidance into one client-facing workflow.",
    metrics: ["4 client personas", "10-fund recommendation engine", "AI-guided portfolio chat"],
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1",
  },
  {
    id: "frontier",
    title: "Frontier Lab",
    eyebrow: "Part 1",
    heading: "Efficient Frontier Explorer",
    intro:
      "Inspect the 10-fund opportunity set, compare the frontiers with and without short sales, and explore the portfolio weights along each curve.",
    metrics: ["10 funds", "2 frontier constraints", "GMVP comparison"],
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    id: "risk",
    title: "Risk Lab",
    eyebrow: "Part 2",
    heading: "Risk Aversion & Optimal Portfolio",
    intro:
      "Map questionnaire answers into risk aversion A and observe how the optimal portfolio changes when utility maximization is applied to the same frontier.",
    metrics: ["8-question profile", "Utility maximization", "Interactive recommendation"],
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
];

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d07b2a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3>Something went wrong</h3>
          <p>This section encountered an unexpected error. Please try refreshing or switch to another view.</p>
          <button type="button" className="error-boundary-btn" onClick={() => this.setState({ hasError: false })}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoadingState() {
  return (
    <div className="skeleton-shell" aria-busy="true" aria-label="Loading view…">
      <div className="skeleton-hero">
        <div className="skeleton-line skeleton-line-sm" />
        <div className="skeleton-line skeleton-line-lg" />
        <div className="skeleton-line skeleton-line-md" />
        <div className="skeleton-chips">
          <div className="skeleton-chip" />
          <div className="skeleton-chip" />
          <div className="skeleton-chip" />
        </div>
      </div>
      <div className="skeleton-cards">
        <div className="skeleton-card skeleton-card-tall" />
        <div className="skeleton-card" />
        <div className="skeleton-card" />
      </div>
    </div>
  );
}

function NavIcon({ path }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={path} />
    </svg>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState("platform");
  const activeMeta = useMemo(
    () => views.find((view) => view.id === activeView) ?? views[0],
    [activeView],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeView]);

  return (
    <>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <main className="app-shell">
      <header className="app-topbar-frame">
        <div className="app-topbar">
          <div className="topbar-row">
            <div className="topbar-heading">
              <p className="eyebrow">BMD5302 Robot Adviser</p>
              <h1 className="brand-title">Compass Wealth Interface</h1>
            </div>

            <div className="topbar-helper">Project navigation</div>
          </div>

          <div className="nav-banner">
            <div className="nav-copy">
              <span className="nav-kicker">Quick Switch</span>
              <span className="nav-caption">Move across Platform, Frontier Lab, and Risk Lab without losing context.</span>
            </div>

            <nav className="view-nav" aria-label="Primary views">
              {views.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  className={view.id === activeView ? "nav-pill nav-pill-active" : "nav-pill"}
                  onClick={() => setActiveView(view.id)}
                  aria-pressed={view.id === activeView}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  <NavIcon path={view.icon} />
                  {view.title}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <section className="hero" key={`hero-${activeView}`}>
        <p className="eyebrow">{activeMeta.eyebrow}</p>
        <h2>{activeMeta.heading}</h2>
        <p className="intro">{activeMeta.intro}</p>
        <div className="hero-metrics" aria-label="Current view highlights">
          {activeMeta.metrics.map((metric) => (
            <span key={metric} className="metric-chip">
              {metric}
            </span>
          ))}
        </div>
      </section>

      <ErrorBoundary key={activeView}>
        <Suspense fallback={<LoadingState />}>
          <div id="main-content" key={activeView} className="view-stage" tabIndex={-1}>
            {activeView === "platform" && <PlatformExperience />}
            {activeView === "frontier" && <EfficientFrontierInteractive />}
            {activeView === "risk" && <RiskAversionInteractive />}
          </div>
        </Suspense>
      </ErrorBoundary>
    </main>
    <Suspense fallback={null}><GlobalChatbot currentView={activeView} /></Suspense>
    </>
  );
}
