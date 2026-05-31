# Blahrdle

Blahrdle is a client-side 5-letter word guessing game. You get up to 6 guesses and a 10-minute timer per round. Each game picks a random word from a fixed list. There is no server, database, or sign-in — everything runs in the browser.

**Live demo:** [blahrdle.vercel.app](https://blahrdle.vercel.app)

---

## Features

- **Wordle-style guesses** — green (correct position), yellow (in word, wrong position), grey (not in word)
- **10-minute timer** — the clock counts down during play; reaching zero ends the game as a loss
- **Scoring** — +10 per green tile (applied as each row finishes its reveal animation); solve bonus by guess count: 1 → 100, 2 → 80, 3 → 60, 4 → 40, 5 → 20, 6 → 10
- **Local stats** — wins, losses, and streak stored in `localStorage` under the key `lordle_scores`; no account required
- **Settings** — dark/light mode, tile size, accent colours (persisted in `localStorage`)

---

## Run locally

Requires Node 18+.

```bash
git clone <repo-url>
cd blahrdle
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Other scripts:

```bash
npm run build    # production build → dist/
npm run preview  # serve dist/ locally
npm test         # Vitest
npm run lint     # ESLint
```

---

## Deploy

Build the static site with `npm run build` and upload the `dist/` folder to any static host (Netlify, GitHub Pages, Cloudflare Pages, etc.).

[Vercel](https://vercel.com) is a straightforward option: connect the repo, set the build command to `npm run build` and the output directory to `dist`. No environment variables or external services are required.

---

## Tech stack

- [Vite](https://vite.dev) — dev server and production build
- [React 19](https://react.dev) — UI
- [Vitest](https://vitest.dev) — unit tests (game logic, scoring, timer, word list, game state)

Game logic lives in `src/hooks/useGameState.js` and `src/lib/gameLogic.js`. Stats are read and written only in the browser via `localStorage`.
