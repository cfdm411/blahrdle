# Lordle — product decisions

A running log of the load-bearing choices behind Lordle. Each entry is the *why*, not the *what* — the code is the source of truth for behavior; this file is the source of truth for intent.

---

## Gameplay

### Random word per game, not daily
The game picks a fresh word from `ANSWERS` every time `useGameState` mounts. No date-based selection.

**Why:** Lordle is meant to be played repeatedly in a sitting, especially in match mode. A once-a-day word would gate replay and turn the match feature into "wait until tomorrow." It also avoids the spoiler problem (a friend who has played today knows your word).

**Trade-off accepted:** No global daily leaderboard. Each player's history is per-game, not per-day.

### 10-minute timer per game
Hard cap. Running out of time ends the game as a loss; the bonus is forfeit. The clock pulses red under 60 seconds.

**Why:** The 10-minute cap creates urgency without the per-guess pressure of speed-typing games. It's long enough that a careful solver can win on a hard word, short enough that a stuck game ends rather than dragging.

### Scoring: green points + solve bonus
- **+10 per green tile**, awarded as each row finishes its flip animation (not all at once at game end).
- **Solve bonus** indexed by guess count: 1 → 100, 2 → 80, 3 → 60, 4 → 40, 5 → 20, 6 → 10. Only on a win.

**Why:** Awarding green points row-by-row makes incremental progress feel rewarded, even on losses. The decreasing solve bonus rewards efficiency without making the first guess a coinflip-or-bust (a 6-guess solve still earns 10 + green points, not zero).

### One curated word list (`ANSWERS = VALID_WORDS`)
There is no separate "guessable but not answer" superset. Earlier prototypes had a larger `VALID_WORDS` set imported from a Wordle word file's `"valid"` section, which contained junk like `YOKUL`. That was removed.

**Why:** Players were guessing words they didn't recognize and getting "letter not in word" feedback for nonsense, which felt unfair. A single curated list means every guess and every answer comes from the same vocabulary the player can reasonably know.

---

## Auth

### Username-based identity, real email optional but stored
The user signs up with `(real email, username, password)`. The Supabase auth identity is the synthesized `username@lordle.local`; the real email is stored separately in `profiles.email` (with a unique constraint).

**Why:** Synthesized emails were the original design — they let people register without giving up a real address, and they bypassed Supabase's email confirmation flow (which is disabled because `@lordle.local` can't receive mail). Real-email storage was added later for the email-or-username login feature: it's optional from the user's perspective (any string is fine), but enabled via the `profiles.email` lookup in `signIn`.

**Trade-off accepted:** Existing accounts created before this change have `profiles.email = username@lordle.local`. Email login for them only works if they type that synthesized address. Harmless but confusing if anyone ever notices.

### Login accepts email or username in one field
Single input on the login screen labeled "Email or username." If the input contains `@`, `signIn` queries `profiles.email`; otherwise it's treated as a username.

**Why:** Two separate fields would be one click of friction for no benefit — the `@` heuristic is reliable because usernames are validated to forbid `@`.

### Guest mode skips auth and Supabase entirely
"Jugar como invitado" mounts the game directly with no account. Stats persist only to `localStorage`.

**Why:** First-time visitors should be able to try the game without a sign-up wall. The home-screen dashboard, match system, and Supabase persistence are explicit account features; guests get the core gameplay loop and nothing else.

---

## Match system

### Head-to-head on the same word, async
Both players solve the same 5-letter word. Results are combined when both have played (or when the 24-hour expiry triggers cleanup).

**Why:** Sync multiplayer would require WebSockets, presence, and a much heavier infra footprint. Async match mode runs entirely on Supabase REST + RLS. The "same word for both" mechanic preserves the puzzle's fairness — the comparison is on solving skill, not on luck of the draw.

### 24-hour expiry; lazy cleanup
Matches expire 24h after creation. Cleanup runs when either player opens the Match screen, not on a server-side cron.

**Why:** Vercel's free tier has no persistent background jobs. Lazy cleanup is "good enough" because the only consumer of match state is the Match screen itself — no one notices a stale `pending` row until they go look at it. When they do, it gets resolved.

### ≤3 active incoming challenges per recipient
A player cannot have more than 3 pending+accepted challenges as opponent.

**Why:** Stops one player from spamming another with challenges. The limit is on the *recipient* (incoming), not on the challenger (outgoing) — sending many challenges to many people is fine, receiving 50 from one person is not.

### One active match per pair, in either direction
Backed by a partial unique index `matches_active_pair_idx on (least, greatest) where status in ('pending','accepted')`.

**Why:** Two players should resolve their current game before starting the next. The application-level check is best-effort (TOCTOU under concurrent challenges), but the partial unique index is the actual guarantee.

### Both players can read the word
RLS lets either player select the row, including the `word` column.

**Why:** The challenged player needs the word to play. Server-mediated reveal would mean a separate "start match" endpoint that hands out the word and starts a per-player timer, which the async model doesn't support cleanly. The trade-off: anyone with DevTools can peek at the word before typing. We accept that fairness within Lordle's social context is enforced socially, not technically.

### Winner crediting via SECURITY DEFINER RPC
`award_match_win(uuid)` runs as the function owner so it can write to the winner's `player_summary` row even though the caller is the loser. Only the call site in `finalizeMatch` (now idempotent) invokes it.

**Why:** RLS prevents cross-user writes by design — that protects player stats from tampering. The RPC is the controlled exception, scoped narrowly to incrementing one column.

---

## UI / UX

### Inline styles, no CSS-in-JS library
Theme-aware style maps live inside the components that use them.

**Why:** The app is small enough that a styling library (styled-components, Emotion, Tailwind) would add bundle weight, build complexity, and a learning curve for nothing in return. Inline styles plus `index.css` for keyframes covers everything.

**Constraint:** A few duplicated patterns (button styles in `MatchScreen` vs `AuthScreen`) are accepted as the cost. If duplication grows past a handful of sites, revisit.

### Spanish UI, English-friendly internals
User-facing copy is Spanish ("Volver", "Nueva Partida", "Jugar como invitado"). Code, comments, and commit messages are English.

**Why:** The target audience is Spanish-speaking. Internals stay English so the codebase remains accessible to any contributor and matches the surrounding ecosystem (React, Supabase, etc., all docs in English).

### Random colour accents are user-configurable
Tweaks panel persists tile colour, accent green, accent yellow, and tile size to `localStorage` (key `lordle_tweaks`).

**Why:** The default green/yellow scheme has accessibility issues for some forms of colourblindness. Letting players swap to their own palette is cheaper than implementing colourblind-specific schemes and respects users who already know what works for them.

### Accessibility floor: WCAG AA contrast, ARIA labels, `lang="es"`
Dim labels are `#7a7a98` (dark) / `#6b7280` (light) to clear 4.5:1. Form inputs and icon-only buttons all have `aria-label`. The HTML `lang` is `es`.

**Why:** A 92 PageSpeed Accessibility score is the agreed floor. Game-state colours on absent tiles and absent keyboard keys are *intentionally* low-contrast (visual feedback for ruled-out letters) — that's gameplay information, not a label, and was preserved during the contrast pass.

---

## Engineering

### Vite + React 19, no SSR, no router
SPA, client-side routing via `screen` state in `App`, hosted as a static site on Vercel.

**Why:** Lordle has three "screens" (home, match, game) and an auth gate. A router would be three lines of `if (screen === ...)` replaced with three `<Route>` declarations. SSR adds complexity for a game that needs JS to do anything.

### Pre-commit hook runs the full test suite
`.husky/pre-commit` calls `npx vitest run`. Failed tests block the commit.

**Why:** This is a solo project with no CI gating merges to `main`. The pre-commit hook is the only thing standing between a broken commit and production. Bypassing it with `--no-verify` is forbidden in CLAUDE.md.

### `develop → main` two-branch flow
All work commits to `develop` (which auto-deploys to Vercel staging). Promotion to production is an explicit `develop → main` merge.

**Why:** One branch (`main`-only) means every commit ships to production, which is too eager for a side project. Three branches (`feature/*` PRs into `develop` into `main`) is too much ceremony for a solo dev. Two branches give a "try it on staging first" beat without a PR queue.

### Test scope: pure logic + auth integration
Unit tests cover game logic (`evaluateGuess`, scoring, timer, words). Integration tests cover auth via mocked Supabase. Match logic, UI rendering, and database interactions are not tested.

**Why:** The pure logic is high-value to test (regressions would be silent and break gameplay) and cheap to test (no mocking needed). Auth is high-value enough to justify the mocking ceremony. Match logic and UI are deferred — they would require either heavier mocking or a real Supabase test instance, and the failure modes are visible to a human exercising the app.

### Deferred ESLint errors are known and intentional
9 errors (TweaksPanel ref reads during render, several `setState` calls inside `useEffect` bodies, one empty catch) are deliberately left in place. CLAUDE.md notes them with a "do not silently fix" instruction.

**Why:** React 19's compiler-aware lint flags patterns that *could* be problems. Each of the deferred items is a place where the author has read the rule and judged the current code acceptable for now (e.g., the timer→loss `useEffect` is a genuine external→React sync). They'll be revisited as a batch when there's appetite for the cleanup, not piecemeal whenever lint is run.
