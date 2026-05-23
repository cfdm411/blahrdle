# Lordle

A Wordle clone with a 10-minute countdown timer, a scoring system, and an async match system to challenge other players.

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
- **Home screen** — Mis Stats dashboard + Match Wins ranking tab (top 20 by `match_wins`); error feedback on failed loads; first-game prompt for new users
- **Timer** — 10-minute countdown; running out ends the game as a loss
- **Scoring** — green-tile points + solve bonus, persisted to Supabase
- **Match system** — async head-to-head duels on the same word (24h expiry); matches awaiting server finalization show as "Finalizando"; player search shows empty/error messages
- **Browser back** — hardware/software back navigates home ↔ match ↔ game (guest back → login screen) without leaving the app
- **Offline-aware saves** — failed stat persistence shows an in-game error banner instead of failing silently
- **Settings panel** — dark/light mode, tile size, accent colours (persisted to `localStorage`)
- **Accessible UI** — `lang="es"`, ARIA labels on all form inputs and icon-only buttons, WCAG AA color contrast
- **Tests** — 71 Vitest tests across game logic, scoring, words, timer, auth, game state, matches, save flow, and documented gap coverage (Supabase mocked)
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

The app requires a Supabase project. Run these in the Supabase SQL Editor, in order:

**1. `supabase_schema.sql`**

Creates:
- `profiles` — one row per user (username, real email; both unique, email also case-insensitively unique)
- `game_stats` — one row per completed game
- `player_summary` — aggregate stats per player (total games, wins, points, streaks, match wins)
- `matches` — head-to-head match records (word, scores, status, winner). Partial unique index `matches_active_pair_idx` blocks duplicate active matches between the same pair.
- RLS policies for all tables

**2. `supabase_migration_security.sql`**

`save_match_result` / `process_expired_matches` RPCs; match update trigger; drops legacy `award_match_win`.

**3. `supabase_leaderboard.sql`**

RLS policy for cross-user `match_wins` reads (Ranking tab).

**4. `supabase_profiles_rls.sql`**

Tighter profiles SELECT policies; drops open anon read policy.

**5. Disable email confirmation**

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
├── supabase_schema.sql
├── supabase_migration_security.sql
├── supabase_leaderboard.sql
├── supabase_profiles_rls.sql
├── src/
│   ├── App.jsx                # Auth gate, screen routing, Game component
│   ├── index.css              # Global theme classes + keyframe animations
│   ├── hooks/
│   │   ├── useGameState.js    # All game logic: state, scoring, timer, keyboard
│   │   ├── useAuth.js         # Supabase session, signIn/signUp/signOut
│   │   └── useBrowserHistory.js  # popstate history layer for screen routing
│   ├── components/
│   │   ├── AuthScreen.jsx     # Login/register form + guest link
│   │   ├── HomeScreen.jsx     # Post-login dashboard: Mis Stats + Ranking tabs
│   │   ├── MatchScreen.jsx    # Match lobby: search, challenge, accept/reject, Finalizando + results
│   │   └── TweaksPanel.jsx    # Draggable settings panel + useTweaks hook
│   ├── lib/
│   │   ├── supabase.js        # Supabase client
│   │   ├── supabaseHelpers.js # throwIfSupabaseError helper
│   │   ├── gameLogic.js       # Pure functions: evaluateGuess, scoring, getRandomWord
│   │   └── matches.js         # Match service: createMatch, respondToMatch, saveMatchResult, …
│   ├── data/
│   │   └── words.js           # WORDS array → ANSWERS + VALID_WORDS (Set)
│   └── test/
│       ├── setup.js
│       ├── appSave.test.jsx
│       ├── auth.test.js          # signUp / signIn with mocked Supabase
│       ├── authGaps.test.js
│       ├── gameState.test.js
│       ├── gameStateGaps.test.js
│       ├── gameLogic.test.js
│       ├── matches.test.js
│       ├── matchesGaps.test.js
│       ├── scoring.test.js
│       ├── timer.test.js
│       └── words.test.js
└── public/
```
