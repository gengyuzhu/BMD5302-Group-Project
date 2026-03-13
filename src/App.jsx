import { Suspense, lazy, useMemo, useState } from "react";
import "./app.css";

const EfficientFrontierInteractive = lazy(() => import("../EfficientFrontierInteractive.jsx"));
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
  },
  {
    id: "frontier",
    title: "Frontier Lab",
    eyebrow: "Part 1",
    heading: "Efficient Frontier",
    intro:
      "Inspect the 10-fund opportunity set, compare the frontiers with and without short sales, and explore the portfolio weights along each curve.",
    metrics: ["10 funds", "2 frontier constraints", "GMVP comparison"],
  },
  {
    id: "risk",
    title: "Risk Lab",
    eyebrow: "Part 2",
    heading: "Risk Aversion & Optimal Portfolio",
    intro:
      "Map questionnaire answers into risk aversion A and observe how the optimal portfolio changes when utility maximization is applied to the same frontier.",
    metrics: ["8-question profile", "Utility maximization", "Interactive portfolio recommendation"],
  },
];

export default function App() {
  const [activeView, setActiveView] = useState("platform");
  const activeMeta = useMemo(
    () => views.find((view) => view.id === activeView) ?? views[0],
    [activeView],
  );

  return (
    <main className="app-shell">
      <header className="app-topbar">
        <div>
          <p className="eyebrow">BMD5302 Robot Adviser</p>
          <h1 className="brand-title">Compass Wealth Interface</h1>
        </div>

        <nav className="view-nav" aria-label="Primary views">
          {views.map((view) => (
            <button
              key={view.id}
              type="button"
              className={view.id === activeView ? "nav-pill nav-pill-active" : "nav-pill"}
              onClick={() => setActiveView(view.id)}
              aria-pressed={view.id === activeView}
            >
              {view.title}
            </button>
          ))}
        </nav>
      </header>

      <section className="hero">
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

      <Suspense fallback={<section className="loading-card">Loading interface...</section>}>
        <div key={activeView} className="view-stage">
          {activeView === "platform" && <PlatformExperience />}
          {activeView === "frontier" && <EfficientFrontierInteractive />}
          {activeView === "risk" && <RiskAversionInteractive />}
        </div>
      </Suspense>
    </main>
  );
}
