# BMD5302 Group Project

Robot Adviser project for BMD5302, covering:

- Part 1: Efficient Frontier
- Part 2: Risk Aversion & Optimal Portfolio
- Part 3: Web Platform + AI Chatbot

## Live Site

GitHub Pages deployment target:

- [https://gengyuzhu.github.io/BMD5302-Group-Project/](https://gengyuzhu.github.io/BMD5302-Group-Project/)

## Local Run

```bash
npm install
npm run dev
```

Then open:

`http://127.0.0.1:5173`

## Project Structure

- `funds/`: the 10 source CSV files
- `part1_efficient_frontier.py`: Part 1 analysis pipeline
- `part1_outputs/`: Part 1 generated statistics, frontier data, and charts
- `part2/`: Part 2 risk-aversion analysis, outputs, and JSX component
- `part3/`: Part 3 platform page and report
- `src/`: Vite + React app entry

## Notes

- The web app is built with React and Vite.
- GitHub Pages deployment is handled by GitHub Actions.
- The platform defaults to the client-facing Part 3 experience, with Part 1 and Part 2 available as analytical views.
