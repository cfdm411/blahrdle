# Lordle

A Wordle clone with a 10-minute countdown timer, a scoring system, and a real-time match system to challenge other players.

**Repo:** [github.com/cfdm411/lorde](https://github.com/cfdm411/lorde)

| Environment | URL |
|---|---|
| Production | [lordle-gray.vercel.app](https://lordle-gray.vercel.app) |
| Staging | [lordle-git-develop-cfdm411-7437s-projects.vercel.app](https://lordle-git-develop-cfdm411-7437s-projects.vercel.app) |

---

## What is Lordle?

Lordle is a 5-letter word guessing game. You have up to 6 guesses and 10 minutes on the clock. Each game uses a random word chosen at game start.

**Tile colours after a guess:**

| Colour | Meaning |
|--------|---------|
| Green  | Correct letter, correct position |
| Yellow | Letter is in the word, wrong position |
| Grey   | Letter is not in the word |

**Scoring:**
- **+10** per green tile, awarded as each row's flip animation completes
- **Solve bonus** by number of guesses: 1 → 100 pts, 2 → 80, 3 → 60, 4 → 40, 5 → 20, 6 → 10

---

## Features

- **Auth** — register with email + username + password; log in with **either email or username**
- **Guest mode** — play without an account; no stats saved
- **Home screen** — player stats dashboard (games played/won, best score, streak, match wins)
- **Timer** — 10-minute countdown; running out ends the game as a loss
- **Scoring** — green-tile points + solve bonus, persisted to Supabase
- **Match system** — challenge registered players to head-to-head duels on the same word
- **Settings panel** — dark/light mode, tile size, accent colours (persisted to `localStorage`)
- **Accessible UI** — `lang="es"`, ARIA labels on all form inputs and icon-only buttons, WCAG AA color contrast
- **Tests** — 40 Vitest tests across game logic, scoring, words, timer, and auth (Supabase mocked)
- **Pre-commit hook** — husky runs `vitest run` automatically; failing tests block the commit

### PageSpeed Insights (production)

| Metric | Score |
|---|---|
| Performance | 94 |
| Accessibility | 92 |
| Best Practices | 100 |
| SEO | 100 |

---

## Git workflow

```
develop  →  staging (auto-deployed by Vercel on push)
main     →  production (auto-deployed by Vercel on push)
```

- Do all work on `develop`
- Merge to `main` when ready to ship to production
- A pre-commit hook (husky) runs `npx vitest run` before every commit — the commit is blocked if any test fails

## Running locally

**Requirements:** Node 18+

```bash
git clone <repo-url>
cd lordle
npm install
npm run dev        # → http://localhost:5173
npm run build      # production build → dist/
npm run preview    # serve the production build locally
npm run lint       # ESLint
npm test           # Vitest (run once)
```

---

## Supabase setup

The app requires a Supabase project. Two manual steps:

**1. Run the schema SQL**

Open `supabase_schema.sql` and paste its full contents into the Supabase SQL Editor, then click Run. This creates:
- `profiles` — one row per user (username, real email; both unique, email also case-insensitively unique)
- `game_stats` — one row per completed game
- `player_summary` — aggregate stats per player (total games, wins, points, streaks, match wins)
- `matches` — head-to-head match records (word, scores, status, winner). Partial unique index `matches_active_pair_idx` blocks duplicate active matches between the same pair.
- RLS policies for all tables
- `award_match_win(uuid)` — SECURITY DEFINER RPC that increments match wins across the RLS boundary

**2. Disable email confirmation**

In the Supabase dashboard: **Auth → Providers → Email → toggle off "Confirm email"**.

The app synthesises addresses as `username@lordle.local`, which can never receive a confirmation link — leaving this on blocks all logins.

---

## Deploying to Vercel

The Vercel project is already linked. To deploy:

```bash
npx vercel --prod
```

---

## Project structure

```
lordle/
├── index.html
├── supabase_schema.sql        # Full DDL — run once in Supabase SQL editor
├── src/
│   ├── App.jsx                # Auth gate, screen routing, Game component
│   ├── index.css              # Global theme classes + keyframe animations
│   ├── hooks/
│   │   ├── useGameState.js    # All game logic: state, scoring, timer, keyboard
│   │   └── useAuth.js         # Supabase session, signIn/signUp/signOut
│   ├── components/
│   │   ├── AuthScreen.jsx     # Login/register form + guest link
│   │   ├── HomeScreen.jsx     # Post-login dashboard with stats and action buttons
│   │   ├── MatchScreen.jsx    # Match lobby: search, challenge, accept/reject, results
│   │   └── TweaksPanel.jsx    # Draggable settings panel + useTweaks hook
│   ├── lib/
│   │   ├── supabase.js        # Supabase client
│   │   ├── gameLogic.js       # Pure functions: evaluateGuess, computeGreenScore, computeBonus, WIN_BONUS
│   │   └── matches.js         # Match service: createMatch, respondToMatch, saveMatchResult, …
│   ├── data/
│   │   └── words.js           # WORDS array → ANSWERS + VALID_WORDS (Set)
│   └── test/
│       ├── setup.js
│       ├── auth.test.js          # signUp / signIn with mocked Supabase
│       ├── gameLogic.test.js
│       ├── scoring.test.js
│       ├── timer.test.js
│       └── words.test.js
└── public/
```
<!-- staging -->
