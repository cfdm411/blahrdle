import { memo, useState, useEffect, useRef, useMemo } from 'react'
import { useGameState, TILE } from './hooks/useGameState'
import { useAuth } from './hooks/useAuth'
import { useBrowserHistory } from './hooks/useBrowserHistory'
import { AuthScreen } from './components/AuthScreen'
import { HomeScreen } from './components/HomeScreen'
import { MatchScreen } from './components/MatchScreen'
import { saveMatchResult } from './lib/matches'
import { supabase } from './lib/supabase'
import { throwIfSupabaseError } from './lib/supabaseHelpers'
import logoLight from './assets/logo-light.svg'
import logoDark from './assets/logo-dark.svg'

const SAVE_FAILED_MSG = 'Tus estadísticas no se guardaron'

function formatTime(s) {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`
}
import {
  useTweaks, TweaksPanel, TweakSection, TweakToggle, TweakSlider, TweakColor,
} from './components/TweaksPanel'

const KB_ROWS = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["ENTER","Z","X","C","V","B","N","M","⌫"],
]

const TWEAK_DEFAULTS = {
  theme: "dark",
  accentCorrect: "#4ade80",
  accentPresent: "#facc15",
  tileSize: 62,
}

function estimateKeyboardHeight(vw) {
  const keyH = Math.min(54, ((Math.min(vw, 500) - 61) / 10) * 1.42)
  return 16 + 24 + 3 * keyH + 10
}

function computeEffectiveTileSize(configured, vw, vh, { isGuest, gameOver, saveError }) {
  const widthCap = Math.floor((Math.min(vw, 500) - 32 - 16) / 5)
  const reserved = 92
    + estimateKeyboardHeight(vw)
    + (gameOver ? 0 : 36)
    + (isGuest ? 44 : 0)
    + (saveError ? 46 : 0)
    + 20
  const heightCap = Math.floor((vh - reserved - 20) / 6)
  return Math.max(48, Math.min(configured, widthCap, heightCap))
}

// ─── Tile ─────────────────────────────────────────────────────────────────────
const Tile = memo(function Tile({ letter, state, theme, accentCorrect, accentPresent, size, animClass, delay = 0, isRevealing = false }) {
  const isDark = theme === "dark"
  const styleMap = {
    [TILE.EMPTY]:   { bg: "transparent", border: isDark ? "#2e2e42" : "#d1d5db", color: "inherit" },
    [TILE.FILLED]:  { bg: "transparent", border: isDark ? "#7a7a98" : "#6b7280", color: "inherit" },
    [TILE.CORRECT]: { bg: accentCorrect, border: accentCorrect, color: "#12121e" },
    [TILE.PRESENT]: { bg: accentPresent, border: accentPresent, color: "#12121e" },
    [TILE.ABSENT]:  { bg: isDark ? "#2a2a3c" : "#d1d5db", border: isDark ? "#2a2a3c" : "#d1d5db", color: isDark ? "#6b6b88" : "#6b7280" },
  }
  const s = styleMap[state] || styleMap[TILE.EMPTY]
  const pre = styleMap[TILE.FILLED]

  // CSS vars drive the keyframe color transition: pre-reveal → post-reveal at the invisible midpoint
  const revealVars = isRevealing ? {
    '--pre-bg': pre.bg, '--pre-border': pre.border, '--pre-color': pre.color,
    '--post-bg': s.bg,  '--post-border': s.border,  '--post-color': s.color,
  } : {}

  return (
    <div
      className={animClass || ""}
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `2px solid ${s.border}`,
        borderRadius: 6,
        background: s.bg,
        color: s.color,
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
        letterSpacing: "0.05em",
        userSelect: "none",
        transition: "border-color 0.1s",
        animationDelay: `${delay}ms`,
        ...revealVars,
      }}
    >
      {letter}
    </div>
  )
})

// ─── Key ──────────────────────────────────────────────────────────────────────
const Key = memo(function Key({ label, state, onPress, theme, accentCorrect, accentPresent }) {
  const isDark = theme === "dark"
  const isWide = label === "ENTER" || label === "⌫"
  const stateStyle = {
    [TILE.CORRECT]: { bg: accentCorrect, color: "#12121e", border: "transparent" },
    [TILE.PRESENT]: { bg: accentPresent, color: "#12121e", border: "transparent" },
    [TILE.ABSENT]:  { bg: isDark ? "#111120" : "#6b7280", color: isDark ? "#5a5a78" : "#f3f4f6", border: "transparent" },
  }
  const def = { bg: isDark ? "#2a2a3c" : "#e5e7eb", color: isDark ? "#c8c8e0" : "#374151", border: isDark ? "#3a3a52" : "#d1d5db" }
  const s = stateStyle[state] || def

  return (
    <button
      onClick={() => onPress(label)}
      aria-label={label === "ENTER" ? "Enter" : label === "⌫" ? "Borrar" : undefined}
      style={{
        // fluid width/height: fills naturally on desktop (≥500 px), shrinks on mobile
        // formula: (keyboard-container-width − h-padding−16px − row1-gaps−45px) / 10 keys
        width: isWide
          ? "min(62px, calc((min(100vw, 500px) - 61px) / 10 * 1.63))"
          : "min(38px, calc((min(100vw, 500px) - 61px) / 10))",
        height: "min(54px, calc((min(100vw, 500px) - 61px) / 10 * 1.42))",
        padding: "0 6px",
        background: s.bg,
        color: s.color,
        border: `1.5px solid ${s.border || s.bg}`,
        borderRadius: 6,
        fontSize: isWide
          ? "clamp(9px,  calc((min(100vw, 500px) - 61px) / 10 * 0.316), 12px)"
          : "clamp(11px, calc((min(100vw, 500px) - 61px) / 10 * 0.395), 15px)",
        fontWeight: 600,
        fontFamily: "'Outfit', sans-serif",
        cursor: "pointer",
        letterSpacing: isWide ? "0.04em" : "0.05em",
        transition: "background 0.15s, transform 0.08s",
        flexShrink: 0,
      }}
      onMouseDown={e => { e.currentTarget.style.transform = "scale(0.93)" }}
      onMouseUp={e => { e.currentTarget.style.transform = "scale(1)" }}
    >
      {label}
    </button>
  )
})

// ─── ScoreBadge ───────────────────────────────────────────────────────────────
function ScoreBadge({ label, value, theme }) {
  const isDark = theme === "dark"
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <span className="header-badge-value" style={{ fontWeight: 800, letterSpacing: "-0.02em", color: isDark ? "#e8e8f0" : "#1a1a2e" }}>
        {value}
      </span>
      <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: isDark ? "#7a7a98" : "#6b7280" }}>
        {label}
      </span>
    </div>
  )
}

// ─── SettingsIcon ─────────────────────────────────────────────────────────────
function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

// ─── App (auth gate) ──────────────────────────────────────────────────────────
export default function App() {
  const auth = useAuth()
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS)
  const [screen, setScreen] = useState('home')
  const [isGuest, setIsGuest] = useState(false)
  const [currentMatch, setCurrentMatch] = useState(null)

  useBrowserHistory({
    enabled: !auth.loading && (!!auth.user || isGuest),
    screen,
    isGuest,
    currentMatch,
    setScreen,
    setCurrentMatch,
    setIsGuest,
  })

  if (auth.loading) {
    const isDark = tweaks.theme === 'dark'
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isDark ? '#12121e' : '#f7f7f2', color: isDark ? '#7a7a98' : '#6b7280',
        fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>Loading…</div>
    )
  }

  if (!auth.user && !isGuest) {
    return (
      <AuthScreen
        theme={tweaks.theme}
        onSignIn={auth.signIn}
        onSignUp={auth.signUp}
        onGuest={() => setIsGuest(true)}
      />
    )
  }

  // Guest: skip home screen, go straight to game
  if (isGuest) {
    return (
      <Game
        auth={auth}
        tweaks={tweaks}
        setTweak={setTweak}
        isGuest
        onGoLogin={() => setIsGuest(false)}
      />
    )
  }

  if (screen === 'home') {
    return (
      <HomeScreen
        auth={auth}
        theme={tweaks.theme}
        onPlay={() => { setCurrentMatch(null); setScreen('game') }}
        onOpenMatches={() => setScreen('match')}
      />
    )
  }

  if (screen === 'match') {
    return (
      <MatchScreen
        auth={auth}
        theme={tweaks.theme}
        onBack={() => setScreen('home')}
        onPlayMatch={(m) => { setCurrentMatch(m); setScreen('game') }}
      />
    )
  }

  return (
    <Game
      auth={auth}
      tweaks={tweaks}
      setTweak={setTweak}
      match={currentMatch}
      onGoHome={() => { setCurrentMatch(null); setScreen('home') }}
      onMatchDone={() => { setCurrentMatch(null); setScreen('match') }}
    />
  )
}

// ─── Game ─────────────────────────────────────────────────────────────────────
function Game({ auth, tweaks, setTweak, isGuest = false, match = null, onGoHome, onGoLogin, onMatchDone }) {
  const theme = tweaks.theme
  const isDark = theme === "dark"
  const isMatch = !!match
  const [tweaksOpen, setTweaksOpen] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const saveErrorTimerRef = useRef(null)

  const [challengerName] = useState(() => localStorage.getItem("lordle_challenger") || "")

  const {
    target, gameOver, won,
    shakingRow, toast, revealingRow, timeLeft,
    myWins, myLosses,
    greenScore, bonus, totalScore,
    attemptsUsed,
    letterStates, rows,
    handleKey, resetGame,
  } = useGameState({
    initialTarget: match?.word || null,
    trackLocalScores: !isMatch,
  })

  // Persist game result once per game (game_stats + player_summary, OR match row).
  // Reset the saved-flag whenever a new game starts (gameOver flips to false).
  const savedRef = useRef(false)
  useEffect(() => {
    if (!gameOver) {
      savedRef.current = false
      setSaveError(null)
      if (saveErrorTimerRef.current !== null) {
        clearTimeout(saveErrorTimerRef.current)
        saveErrorTimerRef.current = null
      }
      return
    }
    if (revealingRow !== null) return
    if (savedRef.current || !auth.user) return

    ;(async () => {
      try {
        if (isMatch) {
          await saveMatchResult(match, auth.user.id, totalScore, won)
        } else {
          throwIfSupabaseError(await supabase.from('game_stats').insert({
            user_id: auth.user.id,
            score: totalScore,
            attempts_used: attemptsUsed,
            word: target,
            won,
            time_remaining: timeLeft,
          }))

          const curResult = await supabase
            .from('player_summary').select('*')
            .eq('user_id', auth.user.id).maybeSingle()
          throwIfSupabaseError(curResult)
          const cur = curResult.data

          const newStreak = won ? (cur?.current_streak || 0) + 1 : 0
          throwIfSupabaseError(await supabase.from('player_summary').upsert({
            user_id: auth.user.id,
            total_games:    (cur?.total_games    || 0) + 1,
            total_wins:     (cur?.total_wins     || 0) + (won ? 1 : 0),
            total_points:   (cur?.total_points   || 0) + totalScore,
            best_score:     Math.max(cur?.best_score  || 0, totalScore),
            current_streak: newStreak,
            max_streak:     Math.max(cur?.max_streak  || 0, newStreak),
          }))
        }
        savedRef.current = true
      } catch (e) {
        console.error('Failed to save game stats:', e)
        savedRef.current = false
        setSaveError(SAVE_FAILED_MSG)
        if (saveErrorTimerRef.current !== null) clearTimeout(saveErrorTimerRef.current)
        saveErrorTimerRef.current = setTimeout(() => {
          saveErrorTimerRef.current = null
          setSaveError(null)
        }, 2800)
      }
    })()
  }, [gameOver, revealingRow, auth.user, target, attemptsUsed, won, totalScore, timeLeft, isMatch, match])

  useEffect(() => () => {
    if (saveErrorTimerRef.current !== null) clearTimeout(saveErrorTimerRef.current)
  }, [])

  useEffect(() => {
    document.body.className = theme
  }, [theme])

  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 500,
    h: typeof window !== 'undefined' ? (window.visualViewport?.height ?? window.innerHeight) : 800,
  }))

  useEffect(() => {
    const update = () => setViewport({
      w: window.innerWidth,
      h: window.visualViewport?.height ?? window.innerHeight,
    })
    update()
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [])

  const effectiveTileSize = useMemo(
    () => computeEffectiveTileSize(tweaks.tileSize, viewport.w, viewport.h, { isGuest, gameOver, saveError }),
    [tweaks.tileSize, viewport, isGuest, gameOver, saveError],
  )
  const gap = Math.max(4, Math.round(effectiveTileSize * 0.07))
  const iconColor = isDark ? "#7a7a98" : "#6b7280"

  return (
    <div className="game-shell" style={{
      background: isDark ? "#12121e" : "#f7f7f2",
      userSelect: "none",
    }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 80, left: "50%",
          transform: "translateX(-50%)",
          background: isDark ? "#e8e8f0" : "#1a1a2e",
          color: isDark ? "#12121e" : "#f7f7f2",
          padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600,
          zIndex: 1000, animation: "toast-in 0.2s ease",
          letterSpacing: "0.04em", whiteSpace: "nowrap",
        }}>
          {toast}
        </div>
      )}

      {/* ── HEADER ── */}
      <header style={{
        width: "100%",
        flexShrink: 0,
        borderBottom: `1px solid ${isDark ? "#1e1e2e" : "#e5e7eb"}`,
        padding: "0 8px",
      }}>
        <div className="header-stats-row">
          <div className="header-side">
            <ScoreBadge label="Wins" value={myWins} theme={theme} />
            <ScoreBadge label="Lost" value={myLosses} theme={theme} />
          </div>

          <div className="header-center">
            <img
              src={isDark ? logoDark : logoLight}
              alt="Blahrdle"
              height={28}
            />
          </div>

          <div className="header-side header-side-right">
            {auth.user && (
            <button
              onClick={auth.signOut}
              title="Log out"
              className="header-logout"
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: iconColor, padding: "4px 6px", display: "flex", alignItems: "center",
                borderRadius: 6, transition: "color 0.15s", fontSize: 11, fontWeight: 600,
                letterSpacing: "0.08em", textTransform: "uppercase",
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Log out
            </button>
            )}
            <button
              onClick={() => setTweaksOpen(o => !o)}
              title="Settings"
              aria-label="Open settings"
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: iconColor, padding: 4, display: "flex", alignItems: "center",
                borderRadius: 6, transition: "color 0.15s",
              }}
            >
              <SettingsIcon />
            </button>
          </div>
        </div>

        {/* Player row */}
        <div className="header-player-row">
          <span style={{
            fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", color: isDark ? "#c8c8e0" : "#374151",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            maxWidth: isMatch || challengerName ? "min(140px, 40vw)" : "100%",
            flex: isMatch || challengerName ? "0 1 auto" : "1 1 auto",
            minWidth: 0,
          }}>
            {isGuest ? 'Guest' : (auth.profile?.username || '…')}
          </span>
          {(isMatch || challengerName) && (
            <>
              <span style={{ fontSize: 11, color: isDark ? "#3a3a52" : "#d1d5db", letterSpacing: "0.06em", flexShrink: 0 }}>vs</span>
              <span style={{
                fontSize: 12, fontWeight: 500, letterSpacing: "0.06em", color: isDark ? "#7a7a98" : "#6b7280",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                maxWidth: "min(140px, 40vw)",
                flex: "0 1 auto",
                minWidth: 0,
              }}>
                {isMatch
                  ? (match.challenger_id === auth.user.id ? match.opponent?.username : match.challenger?.username)
                  : challengerName}
              </span>
            </>
          )}
        </div>
      </header>

      {saveError && (
        <div style={{
          flexShrink: 0,
          width: "100%", maxWidth: 500, margin: "0 auto 12px",
          padding: "10px 14px",
          background: isDark ? "#3b1c1c" : "#fee2e2",
          color: "#f87171",
          border: `1px solid ${isDark ? "#7f1d1d" : "#fecaca"}`,
          borderRadius: 8, fontSize: 12, letterSpacing: "0.04em",
        }}>
          {saveError}
        </div>
      )}

      {/* ── GRID ── */}
      <div className="game-grid-area">
        <div style={{ display: "flex", flexDirection: "column", gap }}>
          {rows.map((row, rowIdx) => {
            const isRevealing = revealingRow === rowIdx
            const isShaking   = shakingRow === rowIdx
            return (
              <div
                key={rowIdx}
                className={isShaking ? "row-shake" : ""}
                style={{ display: "flex", gap }}
              >
                {row.word.split("").map((letter, colIdx) => {
                  const state = (row.isCurrent && letter === " ") ? TILE.EMPTY
                    : row.isCurrent ? TILE.FILLED
                    : row.isEmpty   ? TILE.EMPTY
                    : row.states[colIdx]

                  let animClass = ""
                  if (row.isCurrent && letter !== " ") animClass = "tile-pop"
                  if (isRevealing) animClass = "tile-reveal"

                  return (
                    <Tile
                      key={colIdx}
                      letter={letter === " " ? "" : letter}
                      state={state}
                      theme={theme}
                      accentCorrect={tweaks.accentCorrect}
                      accentPresent={tweaks.accentPresent}
                      size={effectiveTileSize}
                      animClass={animClass}
                      delay={isRevealing ? colIdx * 200 : 0}
                      isRevealing={isRevealing}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Score + Timer row */}
        {!gameOver && (
          <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 28 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{
                fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                color: isDark ? "#7a7a98" : "#6b7280", fontWeight: 500,
              }}>
                Score
              </span>
              <span style={{
                fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                color: isDark ? "#e8e8f0" : "#1a1a2e",
              }}>
                {totalScore}
              </span>
            </div>
            <div
              className={timeLeft < 60 ? "timer-pulse" : ""}
              style={{
                fontSize: 18,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: "0.06em",
                color: timeLeft < 60
                  ? (isDark ? "#f87171" : "#ef4444")
                  : timeLeft < 180
                    ? "#f59e0b"
                    : (isDark ? "#7a7a98" : "#6b7280"),
              }}
            >
              {formatTime(timeLeft)}
            </div>
          </div>
        )}

        {/* Game over CTA */}
        {gameOver && (
          <div style={{
            marginTop: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
            animation: "bounce-in 0.4s ease",
          }}>
            <div style={{ fontSize: 13, letterSpacing: "0.06em", color: isDark ? "#7a7a98" : "#6b7280", textTransform: "uppercase" }}>
              {won ? "Well played!" : `The word was ${target}`}
            </div>

            {/* Score breakdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 220 }}>
              <div style={{
                display: "flex", justifyContent: "space-between", fontSize: 12,
                color: isDark ? "#8a8aa6" : "#6b7280",
              }}>
                <span>Green letters</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>+{greenScore}</span>
              </div>
              {bonus > 0 && (
                <div style={{
                  display: "flex", justifyContent: "space-between", fontSize: 12,
                  color: isDark ? "#8a8aa6" : "#6b7280",
                }}>
                  <span>Solve bonus</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>+{bonus}</span>
                </div>
              )}
              <div style={{
                height: 1, background: isDark ? "#2a2a3c" : "#e5e7eb", margin: "4px 0",
              }} />
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                color: isDark ? "#e8e8f0" : "#1a1a2e",
              }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Total
                </span>
                <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {totalScore}
                </span>
              </div>
            </div>

            {isMatch ? (
              <button
                onClick={onMatchDone}
                style={{
                  width: "100%",
                  padding: "12px 0",
                  background: tweaks.accentCorrect,
                  color: "#12121e",
                  border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700,
                  fontFamily: "'Outfit', sans-serif", letterSpacing: "0.08em",
                  textTransform: "uppercase", cursor: "pointer",
                }}
              >
                Volver a Match
              </button>
            ) : (
              <div style={{ display: "flex", gap: 10, width: "100%" }}>
                <button
                  onClick={resetGame}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    background: tweaks.accentCorrect,
                    color: "#12121e",
                    border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    fontFamily: "'Outfit', sans-serif", letterSpacing: "0.08em",
                    textTransform: "uppercase", cursor: "pointer",
                  }}
                >
                  Nueva Partida
                </button>
                {!isGuest && (
                  <button
                    onClick={onGoHome}
                    style={{
                      flex: 1,
                      padding: "12px 0",
                      background: "transparent",
                      color: isDark ? "#c8c8e0" : "#374151",
                      border: `1.5px solid ${isDark ? "#2e2e42" : "#d1d5db"}`,
                      borderRadius: 8, fontSize: 12, fontWeight: 700,
                      fontFamily: "'Outfit', sans-serif", letterSpacing: "0.08em",
                      textTransform: "uppercase", cursor: "pointer",
                    }}
                  >
                    Ir al inicio
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── GUEST BANNER ── */}
      {isGuest && (
        <div style={{
          flexShrink: 0,
          width: "100%", maxWidth: 500,
          padding: "10px 16px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          borderTop: `1px solid ${isDark ? "#1e1e2e" : "#e5e7eb"}`,
        }}>
          <span style={{ fontSize: 11, color: isDark ? "#3a3a52" : "#c0c0cc", letterSpacing: "0.04em" }}>
            Las estadísticas no se guardan en modo invitado.
          </span>
          <button
            onClick={onGoLogin}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: isDark ? "#7a7a98" : "#6b7280",
              fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
              fontFamily: "'Outfit', sans-serif",
              textDecoration: "underline", textUnderlineOffset: 3, padding: 0,
            }}
          >
            Registrarse →
          </button>
        </div>
      )}

      {/* ── KEYBOARD ── */}
      <div className="game-keyboard-area">
        {KB_ROWS.map((row, ri) => (
          <div key={ri} style={{
            display: "flex", justifyContent: "center",
            gap: 5, marginBottom: ri < 2 ? 5 : 0,
          }}>
            {row.map(key => (
              <Key
                key={key}
                label={key}
                state={letterStates[key]}
                onPress={handleKey}
                theme={theme}
                accentCorrect={tweaks.accentCorrect}
                accentPresent={tweaks.accentPresent}
              />
            ))}
          </div>
        ))}
      </div>

      {/* ── TWEAKS PANEL ── */}
      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)}>
        <TweakSection label="Appearance">
          <TweakToggle
            label="Dark mode"
            value={tweaks.theme === "dark"}
            onChange={v => setTweak("theme", v ? "dark" : "light")}
          />
          <TweakSlider
            label="Tile size"
            value={tweaks.tileSize}
            min={48} max={80} step={2}
            unit="px"
            onChange={v => setTweak("tileSize", v)}
          />
        </TweakSection>
        <TweakSection label="Colors">
          <TweakColor
            label="Correct letter"
            value={tweaks.accentCorrect}
            onChange={v => setTweak("accentCorrect", v)}
          />
          <TweakColor
            label="Present letter"
            value={tweaks.accentPresent}
            onChange={v => setTweak("accentPresent", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  )
}
