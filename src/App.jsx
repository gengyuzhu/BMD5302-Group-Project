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
  },
  {
    id: "frontier",
    title: "Frontier Lab",
    eyebrow: "Part 1",
    heading: "Efficient Frontier",
    intro:
      "Inspect the 10-fund opportunity set, compare the frontiers with and without short sales, and explore the portfolio weights along each curve.",
  },
  {
    id: "risk",
    title: "Risk Lab",
    eyebrow: "Part 2",
    heading: "Risk Aversion & Optimal Portfolio",
    intro:
      "Map questionnaire answers into risk aversion A and observe how the optimal portfolio changes when utility maximization is applied to the same frontier.",
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
      </section>

      <Suspense fallback={<section className="loading-card">Loading experience…</section>}>
        {activeView === "platform" && <PlatformExperience />}
        {activeView === "frontier" && <EfficientFrontierInteractive />}
        {activeView === "risk" && <RiskAversionInteractive />}
      </Suspense>
    </main>
  );
}
