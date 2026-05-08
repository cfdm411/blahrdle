# Lordle — project guide for Claude

A Wordle clone with a 10-minute timer, scoring system, and head-to-head match system. Vite + React 19, Supabase for auth and stats. Deployed to Vercel at lordle-gray.vercel.app.

## Run

```bash
npm install
npm run dev          # local dev → :5173
npm run build        # production build
npm test             # Vitest (run once)
npx vercel --prod    # deploy (Vercel project already linked)
```

## Architecture

| File | Owns |
|---|---|
| `src/App.jsx` | Auth gate, screen routing (`'home'` / `'match'` / `'game'`), presentational `Game` component. **No game logic here.** |
| `src/hooks/useGameState.js` | All game state, scoring, timer, keyboard handler. Single source of truth for gameplay. Accepts `{ initialTarget, trackLocalScores }` options. |
| `src/hooks/useAuth.js` | Supabase session, profile fetch, `signIn` / `signUp` / `signOut`. |
| `src/components/AuthScreen.jsx` | Login/register form + "Jugar como invitado" guest link. |
| `src/components/HomeScreen.jsx` | Post-login dashboard: stats cards, Nueva Partida button, Match button with pending-challenge badge. |
| `src/components/MatchScreen.jsx` | Match lobby: player search, challenge/respond flow, sectioned match list, results. |
| `src/components/TweaksPanel.jsx` | Draggable settings panel + `useTweaks` hook (persists to `localStorage` key `lordle_tweaks`). |
| `src/lib/supabase.js` | Supabase client. URL + anon key hardcoded — fine because both are public values. |
| `src/lib/gameLogic.js` | Pure functions: `evaluateGuess`, `computeGreenScore`, `computeBonus`, `WIN_BONUS`, `GREEN_POINTS`. |
| `src/lib/matches.js` | Match service layer — see Match system section below. |
| `src/data/words.js` | Single canonical word list. `WORDS` is the source; `ANSWERS = WORDS`, `VALID_WORDS = new Set(WORDS)`. |
| `src/index.css` | Global theme classes (`body.dark` / `body.light`) and all keyframes. |
| `supabase_schema.sql` | DDL + RLS policies + `award_match_win` RPC. Run once in the Supabase SQL editor. |

## Conventions to preserve

- **Inline styles, not CSS modules.** Theme-aware style maps live inside the components that use them. Don't introduce a CSS-in-JS library.
- **`React.memo` on `Tile` and `Key`.** They render 30× and 27× per game; memoization matters.
- **`useMemo` on `letterStates` and `rows`.** Both are derived from `guesses` and would otherwise recompute on every render (theme tweaks, timer ticks).
- **Stable keyboard listener.** `useGameState.js` uses a `useRef`-pattern: the `keydown` listener attaches once at mount and reads `handleKeyRef.current`. Never put `handleKey` in the listener-effect's dep array — it would re-attach on every keystroke.
- **Don't reintroduce the two-list word system.** `ANSWERS` and `VALID_WORDS` deliberately point at the same data now. Earlier versions had a bigger `VALID_WORDS` superset that included junk like `YOKUL`; that was removed. The curated list is sourced from the `"words"` section of `words_5.ts` only — the `"valid"` section in that file is intentionally ignored.
- **Random word per game, not daily.** Don't reintroduce date-based selection.

## Animation timing (don't drift these out of sync)

The tile reveal sequence is split between CSS keyframes and JS timeouts. They must agree:

- `index.css` → `.tile-reveal { animation: tile-reveal 0.7s ease-in-out both; }`
- `App.jsx` → tile delay = `colIdx * 200` ms (left-to-right stagger)
- `useGameState.js` → `setRevealingRow(null)` at **1550 ms**; win/loss callback at **1600 ms**

Total row reveal = 4 × 200 ms stagger + 700 ms animation = **1500 ms**. Bump per-tile duration or stagger? Bump the two timeouts in `useGameState.js` to match.

The keyframe uses CSS variables (`--pre-bg/border/color`, `--post-bg/border/color`) set by the `Tile` component when `isRevealing` is true. `animation-fill-mode: both` keeps the pre-reveal colors visible during the staggered delay (otherwise the final color flashes briefly before the flip starts).

## Scoring

- **+10** per green tile (correct letter, correct position), counted *after* the row finishes its reveal animation. The score in the UI updates row-by-row in sync with the flip — see `greenScore` `useMemo` in `useGameState.js`, which gates on `revealingRow`.
- **Solve bonus** (only on win) indexed by `guesses.length`: `[_, 100, 80, 60, 40, 20, 10]`.
- Both constants and compute functions live in `src/lib/gameLogic.js` and are unit-tested.

## Supabase

Two manual setup steps that aren't in code:

1. Run `supabase_schema.sql` once in the Supabase SQL editor.
2. **Disable email confirmation** in the Supabase dashboard: Auth → Providers → Email → toggle off "Confirm email". The app synthesizes emails as `username@lordle.local`, which can never receive a confirmation link — leaving this on blocks all logins.

After each regular game ends, `App.jsx` inserts into `game_stats` and read-modify-writes `player_summary`. A `savedRef` flag guards against double-saves and resets when `gameOver` flips back to `false` (new game). The save effect catches errors and logs to console — failures are non-fatal for gameplay.

The local `lordle_scores` localStorage key still drives the header's Wins/Lost/Streak counters — Supabase persistence is additive, not a replacement.

## Guest mode

Clicking "Jugar como invitado" in `AuthScreen` sets `isGuest = true` in `App`. This:

- Skips the HomeScreen entirely — mounts `Game` directly
- Passes `isGuest` and `onGoLogin` to `Game`
- Skips all Supabase writes (save effect guards on `!auth.user`, which is null for guests)
- Passes `trackLocalScores: false` to `useGameState` so wins/losses don't update `lordle_scores`... wait, actually guests DO get `trackLocalScores` from the default (true). Correction: guests skip Supabase but do update localStorage counters. Only match mode sets `trackLocalScores: false`.
- Shows "Guest" in the game header instead of a username
- Hides the "Ir al inicio" button in the game-over CTA (guests have no home screen)
- Shows a subtle banner: "Las estadísticas no se guardan en modo invitado" + "Registrarse →" link that calls `onGoLogin` (sets `isGuest = false`, unmounting Game and returning to AuthScreen)

## Match system

### Database

The `matches` table (in `supabase_schema.sql`) has:
- `challenger_id` / `opponent_id` — both reference `profiles(id)`
- `word` — 5-letter word, same for both players
- `status` — `pending | accepted | completed | expired | rejected`
- `challenger_score` / `opponent_score` — null until that player has played
- `challenger_solved` / `opponent_solved` — boolean, null until played
- `winner_id` — null means draw or unresolved
- `expires_at` — 24 hours after creation

`player_summary` has a `match_wins integer default 0` column.

### RPC: `award_match_win(winner uuid)`

Because RLS prevents a player from updating another player's `player_summary` row, finalization calls this SECURITY DEFINER function via `supabase.rpc('award_match_win', { winner: winnerId })`. It does an atomic upsert on `player_summary.match_wins`. Granted only to `authenticated` role.

### `src/lib/matches.js` — service functions

| Function | Description |
|---|---|
| `searchProfiles(query, userId)` | ilike search on `profiles.username`, excludes self, limit 10 |
| `listMatches(userId)` | All matches involving this user, with joined challenger+opponent usernames, newest first |
| `countPendingReceived(userId)` | Count for the HomeScreen badge |
| `createMatch(challengerId, opponentId)` | Validates: no self-challenge, ≤3 active received by opponent, no existing active match between pair. Picks a random word, sets `expires_at = now + 24h`. |
| `respondToMatch(matchId, accept)` | Sets status to `accepted` or `rejected` |
| `saveMatchResult(match, userId, score, solved)` | Writes the calling player's score/solved columns. If both have now played, calls `finalizeMatch`. |
| `finalizeExpiredMatches(userId)` | Lazy cleanup on MatchScreen mount — marks expired pending matches as `expired`, finalizes accepted ones. |

### Winner logic (`pickWinner` in matches.js)

1. If only one player has played → that player wins
2. If both played: solved beats unsolved; if both solved or both unsolved → higher score wins; if equal → draw (`winner_id = null`)

### Constraints enforced by `createMatch`

- A player cannot challenge themselves
- Recipient cannot have more than **3 active** (pending + accepted) incoming matches
- No two simultaneous active matches between the same pair (checked in either direction)

### Navigation flow

`App` has `screen` state (`'home' | 'match' | 'game'`) and `currentMatch` state.

- **Home → Match:** `onOpenMatches` → `setScreen('match')`
- **Match → play a match:** `onPlayMatch(m)` → `setCurrentMatch(m)`, `setScreen('game')` — Game mounts with `match.word` as `initialTarget` and `trackLocalScores: false`
- **Match game over:** single "Volver a Match" CTA → `onMatchDone` → clears `currentMatch`, `setScreen('match')`
- **Home → regular game:** `onPlay` → clears `currentMatch`, `setScreen('game')`

In match mode, the regular `game_stats` / `player_summary` write is skipped; `saveMatchResult` is called instead. The "vs {opponent}" byline appears in the game header.

## Testing

Tests live in `src/test/`. Run with `npm test`.

| File | Covers |
|---|---|
| `gameLogic.test.js` | `evaluateGuess` — all correct, all absent, present, duplicate-letter handling |
| `scoring.test.js` | `computeGreenScore`, `computeBonus`, `WIN_BONUS` table, boundary values |
| `timer.test.js` | Countdown, floor at 0, loss trigger, stops after game over (fake timers) |
| `words.test.js` | All words 5 letters, uppercase, ANSWERS/VALID_WORDS parity |

## Output style

The user wants terse responses. Don't narrate intent before tool calls; don't summarize after every change. Code itself: no comments unless a non-obvious WHY needs explaining.
