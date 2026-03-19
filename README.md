# BMD5302 Group Project — Compass Wealth Interface

This repository contains our **Robot Adviser** project for **BMD5302**, developed as a full workflow from quantitative portfolio analysis to a client-facing digital platform.

The project is organized into three major parts:

- **Part 1: Efficient Frontier** — interactive mean-variance portfolio analysis
- **Part 2: Risk Aversion & Optimal Portfolio** — questionnaire-driven utility maximization
- **Part 3: Web Platform + AI Chatbot** — premium client-facing robo-adviser interface

## Live Demo

GitHub Pages:

- [https://gengyuzhu.github.io/BMD5302-Group-Project/](https://gengyuzhu.github.io/BMD5302-Group-Project/)

GitHub Repository:

- [https://github.com/gengyuzhu/BMD5302-Group-Project](https://github.com/gengyuzhu/BMD5302-Group-Project)

---

## Project Overview

The objective of this project is to design a robo-advisory prototype that:

- analyzes a 10-fund investment universe
- constructs and visualizes the efficient frontier (with and without short sales)
- estimates investor risk aversion through a weighted questionnaire
- recommends an optimal portfolio using a quadratic utility-maximization framework
- presents the result through a polished web interface with an AI-style chatbot

The same underlying dataset and optimization outputs are reused across all three parts, so analysis, recommendation logic, and user interface remain numerically consistent.

---

## Fund Universe

The project uses historical price data from the following 10 funds:

| # | Fund | Short Name |
|---|------|------------|
| 1 | Nikko AM Singapore STI ETF | STI ETF |
| 2 | Lion-OCBC Hang Seng TECH ETF | HST ETF |
| 3 | ABF SG Bond Index Fund | Bond ETF |
| 4 | Fidelity Global Technology A-ACC-USD | Fid Tech |
| 5 | PIMCO Income Fund Cl E Inc SGD-H | PIMCO Inc |
| 6 | JPMorgan US Technology A (acc) SGD | JPM Tech |
| 7 | Schroder Asian Growth A Dis SGD | Schroder |
| 8 | BlackRock World Gold Fund A2 SGD-H | Gold Fund |
| 9 | FTIF - Franklin India A (acc) SGD | India Fund |
| 10 | United SGD Fund - Class A SGD Acc | SGD Fund |

All source CSV files are stored in [`funds/`](./funds/).

All 10 funds were aligned to a **common monthly sample window from March 2022 to March 2026**:

- `49` monthly price observations
- `48` monthly return observations

---

## Part 1: Efficient Frontier

Part 1 focuses on classical mean-variance portfolio construction.

### Tasks completed

- Normalized all 10 fund price series into a shared monthly dataset
- Computed monthly average returns and annualized expected returns
- Constructed and annualized the variance-covariance matrix
- Plotted the efficient frontier **with short sales** and **without short sales** (long-only)
- Identified the **Global Minimum Variance Portfolio (GMVP)** in both settings
- Built an interactive JSX visualization (`part1/EfficientFrontierInteractive.jsx`) with:
  - Dual-frontier comparison chart (gradient-filled curves, individual fund scatter points)
  - Tabbed analytics panels: Covariance Matrix, Statistics, Returns, and Weights
  - Sortable weight breakdown table with colored dot indicators
  - Slider with floating tooltip to explore any point on the frontier
  - `aria-valuetext` on slider (return % and volatility % for each position)
  - WCAG-compliant ARIA tab roles (`role="tablist"`, `role="tab"`, `role="tabpanel"`)
  - Responsive SVG chart with `viewBox` + `width="100%"` + `overflow: visible`
  - `prefers-reduced-motion` support

### Key outputs

**1. Efficient Frontier Comparison**

<p>
  <img src="./part1_outputs/efficient_frontier_comparison.png" alt="Efficient Frontier Comparison" width="960" loading="lazy">
</p>

**2. Efficient Frontier with Short Sales**

<p>
  <img src="./part1_outputs/efficient_frontier_short_sales.png" alt="Efficient Frontier with Short Sales" width="960" loading="lazy">
</p>

**3. Efficient Frontier without Short Sales (Long-Only)**

<p>
  <img src="./part1_outputs/efficient_frontier_long_only.png" alt="Efficient Frontier without Short Sales" width="960" loading="lazy">
</p>

### Highlights

- The **long-only GMVP** concentrates heavily in **United SGD Fund**, which had the lowest volatility in the shared sample.
- The **short-sales GMVP** achieves lower theoretical volatility by combining a large long position in the low-volatility fund with offsetting short positions in higher-volatility funds.
- The frontier clearly shows the return/risk trade-off across the 10-fund universe.

---

## Part 2: Risk Aversion & Optimal Portfolio

Part 2 extends the frontier by introducing investor preferences through the quadratic utility function:

```
U = r − (A × σ²) / 2
```

where:

- `r` = expected portfolio return
- `σ²` = portfolio variance
- `A` = investor risk-aversion coefficient

### Tasks completed

- Designed an **8-question investor risk questionnaire** covering five behavioral and preference dimensions
- Assigned question weights (behavioral questions carry 2× weight) to reflect practical risk capacity
- Mapped questionnaire scores into risk-aversion coefficient `A` using the formula:

  ```
  T = (S − S_min) / (S_max − S_min)
  A = 10 − 9T
  ```

- Optimized the portfolio by maximizing investor utility `U` along the efficient frontier
- Compared:
  - **Recommended long-only portfolio** (practical implementation)
  - **Theoretical short-sales benchmark** (mathematical reference)
- Built an interactive JSX interface (`part2/RiskAversionInteractive.jsx`) with:
  - Step-wizard quiz (`QuizWizard.jsx`) with animated segmented progress bar and circular completion ring
  - Keyboard navigation: arrow keys ← / → to move between questions; number keys 1–5 to select options
  - `role="radiogroup"` + `aria-label` on each option card for screen-reader compatibility
  - Keyboard shortcut hint row visible below each question
  - Retake confirmation modal (`role="dialog"`, backdrop blur, Escape-to-close)
  - SVG gauge chart for risk aversion (`role="img"`, `aria-label` with A value and investor tone)
  - SVG donut chart for portfolio allocation with animated stroke-dashoffset transition
  - Animated metric cards with unique area-fill sparklines per metric (using `<linearGradient>`)
  - Color-coded allocation bars with gradient fills and glow effects (`AllocationBars.jsx`)
  - Weight breakdown table with accessible `role="list"` / `role="listitem"` markup (`WeightBreakdown.jsx`)
  - Staggered fade-in results dashboard with profile summary
  - Mode toggle (Long-Only / Short-Sales) with `aria-pressed` states

### Key outputs

**1. Utility Maximization on the Efficient Frontier**

<p>
  <img src="./part2_outputs/utility_frontier_example.png" alt="Utility Maximization on the Efficient Frontier" width="960" loading="lazy">
</p>

**2. Recommended Long-Only Portfolio Weights**

<p>
  <img src="./part2_outputs/recommended_long_only_weights.png" alt="Recommended Long-Only Portfolio Weights" width="960" loading="lazy">
</p>

**3. Optimal Portfolio vs Risk Aversion**

<p>
  <img src="./part2_outputs/optimal_portfolio_vs_risk_aversion.png" alt="Optimal Portfolio vs Risk Aversion" width="960" loading="lazy">
</p>

**4. Example Investor Weight Comparison**

<p>
  <img src="./part2_outputs/example_investor_weight_comparison.png" alt="Example Investor Weight Comparison" width="960" loading="lazy">
</p>

### Highlights

- The questionnaire converts investor answers into a transparent, numerically grounded risk-aversion score rather than an arbitrary label.
- A higher questionnaire score implies greater risk tolerance → lower `A` → more aggressive frontier point selected.
- For the example investor profile, the recommended long-only portfolio is primarily allocated to:
  - **Fidelity Global Tech**
  - **BlackRock World Gold**
  - **Nikko STI ETF**
- The short-sales solution is retained as a mathematical benchmark; the long-only solution is the recommended practical implementation.

---

## Part 3: Web Platform + AI Chatbot

Part 3 converts the analytical work into a client-facing digital platform with enterprise-grade UI.

### Platform architecture

The web application is a **React 18 + Vite 5** single-page interface:

```
src/
  main.jsx          — Vite entry point
  App.jsx           — top-level shell: nav, lazy view loading, error boundary, skip link
  GlobalChatbot.jsx — floating AI chatbot (available on all 3 views)
  app.css           — global design tokens, layout, chat, animations
part1/
  EfficientFrontierInteractive.jsx   — Frontier Lab view
part2/
  RiskAversionInteractive.jsx        — Risk Lab view
  risk-lab.css                       — Risk Lab scoped styles
  components/
    QuizWizard.jsx          — step-wizard questionnaire UI
    QuestionCard.jsx        — animated option cards with keyboard shortcuts
    ResultsDashboard.jsx    — results layout orchestrator
    MetricsGrid.jsx         — animated sparkline metric cards
    EfficientFrontierChart.jsx — mini frontier chart in results
    AllocationBars.jsx      — gradient allocation bar chart
    WeightBreakdown.jsx     — sortable weight table
    riskLabUtils.js         — shared formatters and chart frame constants
part3/
  PlatformExperience.jsx   — Platform view (persona selector, cockpit, chatbot)
```

### Three navigation views

**1. Platform**
- Client-facing robo-adviser experience with glassmorphism card design
- Persona selector with mini risk-meter bars (Conservative / Balanced / Growth)
- Portfolio recommendation cockpit with animated count-up StatCards
- Compact efficient frontier chart with clamped tooltip positioning
- Fund shelf (10-fund universe) with theme badges and "Ask about fund" quick links
- Auto-growing textarea chatbot with typing indicator and SVG donut chart responses
- Pre-set suggestion chips with keyboard (Enter/Space) activation

**2. Frontier Lab**
- Full interactive Part 1 efficient-frontier analysis
- Glassmorphism panels, gradient-filled frontier areas, animated value transitions
- ARIA-accessible tabbed analytics with `role="tablist"` / `role="tab"` / `role="tabpanel"`
- Slider with descriptive `aria-valuetext` (return % + volatility %)
- Responsive SVG with `viewBox`, `preserveAspectRatio`, `overflow: visible`

**3. Risk Lab**
- Full interactive Part 2 questionnaire with step-wizard UI
- SVG gauge, donut chart, sparkline metric cards, allocation bars
- Full keyboard navigation (arrow keys + 1-5 number shortcuts)
- WCAG-compliant focus rings, `aria-pressed`, `aria-label`, `role="dialog"` modal

### Design system

All visual tokens are defined in `app.css` (`:root`) and `risk-lab.css` (`.risklab-shell`):

| Token | Value | Purpose |
|-------|-------|---------|
| `--app-radius-pill` | `999px` | Chip / badge radius |
| `--app-radius-md` | `18px` | Card / insight block |
| `--rl-radius-card` | `24px` | Risk Lab cards |
| `--rl-radius-btn` | `14px` | Risk Lab buttons |
| `--rl-cyan` | `#35efe6` | Primary accent |
| `--rl-orange` | `#ffb21d` | Secondary accent |
| `--metric-glow` | per-card color | Sparkline card radial glow |

### Premium UI features

| Feature | Implementation |
|---------|---------------|
| Glassmorphism panels | `backdrop-filter: blur()` + semi-transparent backgrounds |
| Skeleton loaders | `@keyframes shimmer-slide` CSS animation on lazy-loaded views |
| Count-up animation | RAF-based `AnimatedNumber` component (600 ms cubic easing) |
| Reduced-motion support | `@media (prefers-reduced-motion: reduce)` kills all animations |
| WCAG focus rings | `4px` cyan `rgba(53,239,230,0.65)` rings on all interactive elements |
| Skip navigation link | `<a href="#main-content">Skip to content</a>` before `<main>` |
| Error boundary | `ErrorBoundary` class component with friendly recovery UI |
| Auto-grow textarea | `scrollHeight` measurement capped at `120px` |
| Responsive charts | `viewBox` + `width="100%"` + `height="auto"` on all SVG charts |
| Tooltip clamping | `Math.min(x, containerWidth − 170)` prevents off-screen overflow |

### AI chatbot (Global Floating Assistant)

The chatbot is an **AI-style advisory copilot** available across all three views, grounded in Part 1 and Part 2 outputs:

- **Global scope** — `GlobalChatbot.jsx` is lazy-loaded at the `App.jsx` level, so the assistant persists while switching between Platform, Frontier Lab, and Risk Lab
- **Floating action button (FAB)** — bottom-right corner with animated pulse ring and hover scale effect
- **Sliding glass-morphism panel** — `backdrop-filter: blur(28px)` with gradient border, 400 ms slide-in transition
- **View-aware context** — detects `currentView` changes and displays view-specific welcome messages and suggestion prompts
- **Cross-component communication** — PlatformExperience dispatches `CustomEvent("chatbot-ask")` events; the chatbot listens and opens automatically
- Typing indicator: three bouncing dots with randomized thinking labels
- In-chat SVG donut charts rendered directly in assistant messages
- Auto-growing `<textarea>` input: Enter submits, Shift+Enter inserts newline
- Pre-set suggestion chips (keyboard accessible: Enter / Space), dynamic per view
- Quick "Ask" links on portfolio holdings and fund shelf cards
- Context-update messages when persona or constraint mode changes
- 13 response pattern-matching rules covering funds, personas, frontier concepts, utility formulas, and sensitivity analysis
- All responses remain numerically consistent with the dashboard data

### Accessibility (WCAG 2.1)

- **1.4.3 Contrast** — all muted text upgraded to ≥ 4.5:1 ratio (`#b8cce4` on dark shell)
- **2.1.1 Keyboard** — all interactive elements reachable via Tab; quiz supports arrow + number keys
- **2.4.1 Bypass Blocks** — skip-link to `#main-content`
- **2.4.3 Focus Order** — logical DOM order; `tabIndex=-1` on main view for skip-link target
- **4.1.2 Name/Role/Value** — `aria-label`, `aria-pressed`, `aria-selected`, `aria-valuetext`, `role="tablist"`, `role="dialog"`, `role="list"` throughout

---

## Local Development

Install dependencies:

```bash
npm install
```

Run the local development server:

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:5173
```

Build for production:

```bash
npm run build
```

---

## Repository Structure

```text
funds/                          Source CSV files for the 10 funds
part1/                          Part 1 Python scripts + JSX component
part1_outputs/                  Part 1 statistics, charts, and JSON data
part2/                          Part 2 Python scripts + JSX components
part2_outputs/                  Part 2 statistics, charts, and JSON data
part3/                          Part 3 platform JSX component
src/                            React application shell (App.jsx, GlobalChatbot.jsx, app.css, main.jsx)
part1_efficient_frontier_report.md
part2_risk_aversion_report.md
part3_platform_report.md
package.json
vite.config.js
```

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Front-end framework | React 18.3.1 |
| Build tool | Vite 5.4.10 |
| Styling | Pure CSS (custom properties, no frameworks) |
| Charts | Custom SVG (no external charting libraries) |
| Fonts | IBM Plex Sans + IBM Plex Mono (Google Fonts) |
| Analytics | Python 3, NumPy, Pandas, SciPy, Matplotlib |
| Deployment | GitHub Pages via GitHub Actions |

The deployed site uses GitHub Pages workflow automation and is configured for static hosting with `base` path set in `vite.config.js`.
