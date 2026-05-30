import { memo, useState, useEffect, useMemo } from 'react'
import { useGameState, TILE } from './hooks/useGameState'
import logoLight from './assets/logo-light.svg'
import logoDark from './assets/logo-dark.svg'
import {
  useTweaks, TweaksPanel, TweakSection, TweakToggle, TweakSlider, TweakColor,
} from './components/TweaksPanel'

function formatTime(s) {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`
}

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

const MIN_KEY_HEIGHT = 44
const MIN_TILE_SIZE = 44

function estimateKeyboardHeight(vw) {
  const inner = Math.min(vw, 500) - 16
  const gap = 5
  const unit = (inner - 9 * gap) / 10
  const keyH = Math.max(MIN_KEY_HEIGHT, Math.min(54, unit * 1.42))
  return 16 + 24 + 3 * keyH + 10
}

function computeEffectiveTileSize(configured, vw, vh, { gameOver }) {
  const widthCap = Math.floor((Math.min(vw, 500) - 32 - 16) / 5)
  const keyboardReserved = estimateKeyboardHeight(vw)
  const reserved = 92
    + keyboardReserved
    + (gameOver ? 0 : 36)
    + 20
  const heightCap = Math.floor((vh - reserved - 20) / 6)
  return Math.max(MIN_TILE_SIZE, Math.min(configured, widthCap, heightCap))
}

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
      className={isWide ? 'game-key game-key--wide' : 'game-key'}
      style={{
        background: s.bg,
        color: s.color,
        border: `1.5px solid ${s.border || s.bg}`,
      }}
    >
      {label}
    </button>
  )
})

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

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

export default function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS)
  return <Game tweaks={tweaks} setTweak={setTweak} />
}

function Game({ tweaks, setTweak }) {
  const theme = tweaks.theme
  const isDark = theme === "dark"
  const [tweaksOpen, setTweaksOpen] = useState(false)

  const {
    target, gameOver, won,
    shakingRow, toast, revealingRow, timeLeft,
    myWins, myLosses,
    greenScore, bonus, totalScore,
    letterStates, rows,
    handleKey, resetGame,
  } = useGameState()

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
    () => computeEffectiveTileSize(tweaks.tileSize, viewport.w, viewport.h, { gameOver }),
    [tweaks.tileSize, viewport, gameOver],
  )
  const gap = Math.max(4, Math.round(effectiveTileSize * 0.07))
  const iconColor = isDark ? "#7a7a98" : "#6b7280"

  return (
    <div className="game-shell" style={{
      background: isDark ? "#12121e" : "#f7f7f2",
      userSelect: "none",
    }}>
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
      </header>

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

        {gameOver && (
          <div style={{
            marginTop: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
            animation: "bounce-in 0.4s ease",
          }}>
            <div style={{ fontSize: 13, letterSpacing: "0.06em", color: isDark ? "#7a7a98" : "#6b7280", textTransform: "uppercase" }}>
              {won ? "Well played!" : `The word was ${target}`}
            </div>

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

            <button
              onClick={resetGame}
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
              Nueva Partida
            </button>
          </div>
        )}
      </div>

      <div className="game-keyboard-area">
        {KB_ROWS.map((row, ri) => (
          <div
            key={ri}
            className={`game-kb-row ${ri === 2 ? 'game-kb-row--enter' : 'game-kb-row--10'}`}
          >
            {row.map(key => (
              <Key
                key={`${ri}-${key}`}
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
