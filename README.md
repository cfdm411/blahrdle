# Lordle

A Wordle clone with a 10-minute countdown timer, a scoring system, and a real-time match system to challenge other players.

**Live:** [lordle-gray.vercel.app](https://lordle-gray.vercel.app)

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

- **Auth** — username/password login and registration (no email required)
- **Guest mode** — play without an account; no stats saved
- **Home screen** — player stats dashboard (games played/won, best score, streak, match wins)
- **Timer** — 10-minute countdown; running out ends the game as a loss
- **Scoring** — green-tile points + solve bonus, persisted to Supabase
- **Match system** — challenge registered players to head-to-head duels on the same word
- **Settings panel** — dark/light mode, tile size, accent colours (persisted to `localStorage`)
- **Tests** — Vitest suite covering game logic, scoring, words, and timer

---

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
- `profiles` — one row per user (username, email)
- `game_stats` — one row per completed game
- `player_summary` — aggregate stats per player (total games, wins, points, streaks, match wins)
- `matches` — head-to-head match records (word, scores, status, winner)
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
│       ├── gameLogic.test.js
│       ├── scoring.test.js
│       ├── timer.test.js
│       └── words.test.js
└── public/
```
<!-- staging -->
