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

## Git workflow

```
develop  →  staging  (lordle-git-develop-cfdm411-7437s-projects.vercel.app)
main     →  production  (lordle-gray.vercel.app)
```

- **Always commit to `develop` first.** Merge to `main` only to ship to production.
- Repo: https://github.com/cfdm411/lorde
- Git identity must be `cfdm411 <cfdm411@gmail.com>` — Vercel ties deploys to this account and will block pushes from other committer emails.

```bash
git config user.email "cfdm411@gmail.com"
git config user.name "cfdm411"
```

## Pre-commit hook (husky)

`npx vitest run` fires automatically before every commit via `.husky/pre-commit`. If any test fails the commit is blocked with:

```
❌ Tests failed. Commit blocked.
   Fix the failing tests and try again.
```

Never skip the hook with `--no-verify` unless you have a specific reason. The hook is committed to the repo and installed via the `prepare` script in `package.json`.

## Architecture

| File | Owns |
|---|---|
| `src/App.jsx` | Auth gate, screen routing (`'home'` / `'match'` / `'game'`), presentational `Game` component. **No game logic here.** |
| `src/hooks/useGameState.js` | All game state, scoring, timer, keyboard handler. Single source of truth for gameplay. Accepts `{ initialTarget, trackLocalScores }` options. |
| `src/hooks/useAuth.js` | Supabase session, profile fetch, `signIn(usernameOrEmail, password)` / `signUp(email, username, password)` / `signOut`. Real email is stored in `profiles.email`; the Supabase auth identity stays as the synthesized `username@lordle.local`. |
| `src/components/AuthScreen.jsx` | Login/register form + "Jugar como invitado" guest link. |
| `src/components/HomeScreen.jsx` | Post-login dashboard: Mis Stats / Ranking tabs, Nueva Partida button, Match button with pending-challenge badge. |
| `src/components/MatchScreen.jsx` | Match lobby: player search, challenge/respond flow, sectioned match list, results. |
| `src/components/TweaksPanel.jsx` | Draggable settings panel + `useTweaks` hook (persists to `localStorage` key `lordle_tweaks`). |
| `src/lib/supabase.js` | Supabase client. URL + anon key hardcoded — fine because both are public values. |
| `src/lib/gameLogic.js` | Pure functions: `evaluateGuess`, `computeGreenScore`, `computeBonus`, `getRandomWord`, `WIN_BONUS`, `GREEN_POINTS`. |
| `src/lib/matches.js` | Match service layer — see Match system section below. |
| `src/data/words.js` | Single canonical word list. `WORDS` is the source; `ANSWERS = WORDS`, `VALID_WORDS = new Set(WORDS)`. |
| `src/index.css` | Global theme classes (`body.dark` / `body.light`) and all keyframes. |
| `supabase_schema.sql` | Base DDL + RLS. Run once, then apply migrations below in order. |
| `supabase_migration_security.sql` | Match RPCs (`save_match_result`, `process_expired_matches`), drops `award_match_win`, match update trigger. |
| `supabase_leaderboard.sql` | Leaderboard RLS + FK for `player_summary` → `profiles` embed. |
| `supabase_profiles_rls.sql` | Tightens profiles SELECT policies; drops open anon read policy. |

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

## Auth

- **Registration** takes a real email + username + password (+ confirm). Username may not contain `@` (would collide with the email-detection branch in `signIn`).
- **Login** accepts either the username or the real email. If the input contains `@`, `signIn` queries `profiles.email` to resolve the username, then signs in with the synthesized `username@lordle.local`.
- `profiles.email` has a unique constraint plus a case-insensitive `unique index on lower(email)`. `signUp` translates Postgres `23505` on email into "An account with this email already exists".
- Existing accounts created before the email field was added have `profiles.email = username@lordle.local`. Email login for those works only if the user types that synthesized address (harmless).

## Supabase

Manual setup (in order):

1. Run `supabase_schema.sql` in the Supabase SQL editor.
2. Run `supabase_migration_security.sql`.
3. Run `supabase_leaderboard.sql` (required for HomeScreen Ranking tab).
4. Run `supabase_profiles_rls.sql`.
5. **Disable email confirmation** in the Supabase dashboard: Auth → Providers → Email → toggle off "Confirm email". The app synthesizes emails as `username@lordle.local`, which can never receive a confirmation link — leaving this on blocks all logins.

After each regular game ends, `App.jsx` inserts into `game_stats` and read-modify-writes `player_summary`. A `savedRef` flag guards against double-saves and resets when `gameOver` flips back to `false` (new game). The save effect also waits until `revealingRow === null` so `totalScore` includes the last row's greens. The save effect catches errors and logs to console — failures are non-fatal for gameplay.

The local `lordle_scores` localStorage key still drives the header's Wins/Lost/Streak counters — Supabase persistence is additive, not a replacement.

## Guest mode

Clicking "Jugar como invitado" in `AuthScreen` sets `isGuest = true` in `App`. This:

- Skips the HomeScreen entirely — mounts `Game` directly
- Passes `isGuest` and `onGoLogin` to `Game`
- Skips all Supabase writes (save effect guards on `!auth.user`, which is null for guests)
- Skips Supabase writes but does update `lordle_scores` in localStorage (guests keep local Wins/Lost/Streak counters). Only match mode sets `trackLocalScores: false`.
- Shows "Guest" in the game header instead of a username
- Hides the "Ir al inicio" button in the game-over CTA (guests have no home screen)
- Shows a subtle banner: "Las estadísticas no se guardan en modo invitado" + "Registrarse →" link that calls `onGoLogin` (sets `isGuest = false`, unmounting Game and returning to AuthScreen)
- Hides the header "Log out" button when `auth.user` is null (guest mode)

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

### `src/lib/matches.js` — service functions

| Function | Description |
|---|---|
| `searchProfiles(query, userId)` | ilike search on `profiles.username`, excludes self, limit 10 |
| `listMatches(userId)` | All matches involving this user, with joined challenger+opponent usernames, newest first |
| `countPendingReceived(userId)` | Count for the HomeScreen badge |
| `createMatch(challengerId, opponentId)` | Validates: no self-challenge, ≤3 active received by opponent, no existing active match between pair. Picks a random word, sets `expires_at = now + 24h`. |
| `respondToMatch(matchId, accept, userId)` | Sets status to `accepted` or `rejected`. Scoped to `status='pending' AND opponent_id=userId` so the challenger cannot accept their own match and a status flip cannot regress. Throws if no row matched. |
| `saveMatchResult(match, userId, score, solved)` | Calls `save_match_result` RPC. Returns `null` on no-op (already saved / not accepted). Finalization + `match_wins` credit happen server-side when both players have submitted. |
| `finalizeExpiredMatches(userId)` | Calls `process_expired_matches` RPC on MatchScreen mount. Errors are non-fatal. |

### Winner logic (`save_match_result` RPC in `supabase_migration_security.sql`)

1. If only one player has played → that player wins
2. If both played: solved beats unsolved; if both solved or both unsolved → higher score wins; if equal → draw (`winner_id = null`)

### Constraints enforced by `createMatch`

- A player cannot challenge themselves
- Recipient cannot have more than **3 active** (pending + accepted) incoming matches
- No two simultaneous active matches between the same pair (checked in either direction). Backed by partial unique index `matches_active_pair_idx on (least, greatest) where status in ('pending','accepted')` — the application-level check is best-effort, the index is the real guarantee.

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
| `timer.test.js` | Countdown, floor at 0, loss trigger, timer pause on winning submit, stops after game over (fake timers) |
| `words.test.js` | All words 5 letters, uppercase, ANSWERS/VALID_WORDS parity |
| `auth.test.js` | `signUp` (success, `@`-in-username, duplicate email, whitespace trim) and `signIn` (username path, email→username resolution, wrong password, unknown email). Mocks `src/lib/supabase` with a chainable query-builder stub. |
| `gameState.test.js` | Win/6th-guess input blocking during reveal; non-terminal reveal allows input |
| `matches.test.js` | `searchProfiles`, `createMatch`, `respondToMatch`, `saveMatchResult`, `finalizeExpiredMatches` (mocked Supabase) |

58 tests across 7 files at last count.

## Accessibility

- `index.html` has `lang="es"` (UI is Spanish), plus `meta description` and `theme-color`.
- All form inputs and icon-only buttons have `aria-label` (placeholders alone are not accessible names).
- Dim label colors meet WCAG AA 4.5:1: dark mode `#7a7a98`, light mode `#6b7280`. Game-state colors on absent tiles and absent keyboard keys are intentionally low-contrast (visual feedback for ruled-out letters) and were not changed.

## ESLint

`npm run lint` currently reports **9 deferred errors**, all flagged for a future cleanup session — do not silently "fix" these without asking:

- `react-hooks/refs` ×3 in `src/components/TweaksPanel.jsx:139` — reads `offsetRef.current` during render to position the panel. Needs to move to state or a CSS variable updated in an effect.
- `react-hooks/set-state-in-effect` ×4 in `useAuth.js:26`, `useGameState.js:156`, `MatchScreen.jsx:103,107` — React 19's compiler-aware lint flags effects that call `setState` in their body. Several of these are genuine external→React syncs (timer→loss, debounced search) and may be acceptable as-is.
- `no-empty` ×1 in `TweaksPanel.jsx` — empty `catch {}` block.

## Output style

The user wants terse responses. Don't narrate intent before tool calls; don't summarize after every change. Code itself: no comments unless a non-obvious WHY needs explaining.

## Known bugs (unresolved)

- T1a (FIXED): Reset corruption — pendingTimeoutsRef + clearPendingTimeouts()
  at top of resetGame; shakingRow, toast, revealingRow cleared on reset.
- T1b (FIXED): Stacked reveal timers — `revealTimeoutRef` cancels previous 1550ms timer before scheduling a new one in `submitGuess`.
- T7 (FIXED): Save effect in `App.jsx` waits for `revealingRow === null` before persisting stats.
- M1: Schema/docs drift — `supabase_schema.sql` still references `award_match_win`;
  live DB uses `save_match_result` + `process_expired_matches`. Runtime is correct;
  risk is onboarding and future migrations from stale base schema file.

## Known architecture debt

- `App.jsx` (~660 lines) co-locates Tile, Key, Game UI, and routing. Intentional for now.
- Game persistence (Supabase writes) lives in `App.jsx` useEffect, not a service layer.
- `HomeScreen` queries Supabase directly for stats and ranking.
- `TILE` exported from `useGameState.js`, not `gameLogic.js`.
- `lordle_challenger` localStorage read in `App.jsx` (~233) — dead code, never written; remove before extending.

## Known security decisions

- Match scores and game stats are client-trusted (no server-side replay). Acceptable at current scale.
- `profiles` RLS tightening in `supabase_profiles_rls.sql` — apply in production if not already done.
- `createMatch` word chosen client-side; DB enforces `length(word) = 5` only.
