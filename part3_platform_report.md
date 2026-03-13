# Part 3: The Platform

## Platform Choice

For Part 3, the platform is implemented as:

- **Web page**: a local React + Vite single-page interface
- **AI Chatbot**: a built-in advisory copilot embedded in the platform

This directly matches the project direction: **Web page + AI Chatbot**.

## Design Goal

The platform is designed to be:

- intuitive for a first-time investor
- visually polished enough for portfolio and interview demonstration
- consistent with the quantitative outputs from Part 1 and Part 2
- explainable, so a user can understand both the recommendation and the logic behind it

## Information Architecture

The application is now organized into three views:

1. **Platform**
   - the full client-facing Part 3 experience
   - includes persona selection, recommendation cockpit, frontier visualization, fund shelf, and AI chatbot
2. **Frontier Lab**
   - the Part 1 analytical interface
   - shows the efficient frontier and GMVP results
3. **Risk Lab**
   - the Part 2 analytical interface
   - shows the questionnaire, risk-aversion mapping, and utility-maximizing portfolio

This structure is deliberate:

- the **Platform** view is what a client or interviewer should see first
- the two **Lab** views provide transparency and evidence behind the recommendation

## Web Page Features

### 1. Persona-based onboarding

The platform lets the user switch among four client archetypes:

- Steady Saver
- Balanced Builder
- Growth Explorer
- Bold Navigator

Each profile maps to a different risk-aversion coefficient `A`, which changes the recommended portfolio.

### 2. Recommendation cockpit

The interface displays:

- selected risk aversion `A`
- expected return
- volatility
- utility
- top portfolio allocations

It also allows the user to compare:

- the **retail long-only recommendation**
- the **theoretical short-sales benchmark**

This is important because it shows both financial rigor and implementation realism.

The cockpit is now more interactive than a static dashboard. It includes:

- a live switch between long-only implementation and short-sales benchmark
- dynamic holding bars with direct `Ask` actions that send a question to the chatbot
- persona-linked portfolio metrics that refresh immediately when the active investor profile changes

### 3. Frontier visualization

The platform includes a compact efficient-frontier chart with:

- individual fund points
- long-only frontier
- short-sales frontier
- the currently selected portfolio point

This gives the user a visual anchor for how their profile sits on the opportunity set.

The current chart module also includes:

- hover tooltips for funds and the selected portfolio point
- a legend for the long-only frontier, short-sales frontier, and active point
- projected guide lines to the selected point
- supporting insight cards below the chart summarizing the current point, the active constraint mode, and the leading driver of the portfolio

### 4. Fund shelf

All 10 funds are shown in a clean overview panel with:

- fund number
- short name
- theme
- annualized return
- annualized volatility

This makes the platform easier to navigate than forcing the user to memorize the original CSV file names.

## AI Chatbot Design

### Purpose

The chatbot is designed as an **AI-style advisory copilot** for demo and educational use. It helps the user ask natural questions such as:

- What portfolio do you recommend?
- How do you calculate `A`?
- Why is long-only preferred?
- What is the GMVP?
- Tell me about Fund 8.

### Why this is effective

The chatbot is connected to the same outputs used by the platform:

- Part 1 frontier data
- Part 2 risk-aversion data
- current selected investor persona

That means the chatbot does not invent a different recommendation from the dashboard. It is explainable and internally consistent.

### Current implementation choice

The chatbot is implemented locally without requiring external API keys. This keeps the platform:

- easy to run in VSCode
- stable for grading and demonstration
- independent of paid external services

For future enhancement, the same interface can later be connected to a live LLM API.

### Current chatbot capabilities

The latest website version upgrades the chatbot from a plain response box into a structured advisory module. Each assistant reply can contain:

- a short title
- a direct answer
- bullet-point explanation
- compact statistic badges
- follow-up prompt suggestions

The chatbot also includes:

- live context binding to the currently selected persona and constraint mode
- automatic `Context updated` messages when the user changes the persona or the long-only / short-sales setting
- prompt chips for common questions
- `Send` and `Clear` controls
- clickable `Ask` shortcuts from the top holdings area and the fund shelf

The assistant can currently explain:

- the current recommendation
- the difference between long-only and short-sales portfolios
- the GMVP
- how the questionnaire maps into `A`
- the role of an individual fund
- comparisons between funds
- comparisons between investor personas

This makes the chatbot much more useful for classroom demonstration because it behaves like an explainable copilot rather than a static FAQ.

## Why the Platform Meets the Rubric

### Intuitive

- clear top navigation
- default client-facing landing view
- visible metrics and portfolio cards
- suggested prompts for the chatbot

### User-friendly

- all key numbers are summarized in cards
- visual hierarchy is strong
- the user can compare personas without re-running any scripts
- deeper analytical views remain accessible via tabs
- the chatbot offers follow-up prompts instead of requiring the user to invent every question from scratch

### Portfolio-ready

- the interface is polished enough for interview/demo use
- it is not only visual; it is backed by reproducible data and optimization outputs
- the recommendation logic is practical because the long-only implementation is clearly prioritized

## Main Files

- [`part3/PlatformExperience.jsx`](part3/PlatformExperience.jsx)
- [`part3_platform_report.md`](part3_platform_report.md)

## Integration Files

- [`src/App.jsx`](src/App.jsx)
- [`src/app.css`](src/app.css)

## Data Sources Used by the Platform

- [`part1_outputs/efficient_frontier_data.json`](part1_outputs/efficient_frontier_data.json)
- [`part2_outputs/part2_risk_profile_data.json`](part2_outputs/part2_risk_profile_data.json)

## Run Instructions

From the project root:

```bash
npm run dev
```

Then open:

`http://127.0.0.1:5173`

The platform view is the default entry screen, and the user can switch to the Part 1 and Part 2 lab views from the top navigation.

## Final Positioning

This Part 3 deliverable is not just a static dashboard. It is a coherent robo-adviser prototype with:

- a web-based front-end
- a recommendation engine already computed from the fund universe
- a chatbot layer that explains the recommendation in plain language

That makes it suitable for classroom submission, portfolio presentation, and interview demonstration.
