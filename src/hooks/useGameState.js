import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { ANSWERS, VALID_WORDS } from '../data/words'
import { TILE, evaluateGuess, computeGreenScore, computeBonus } from '../lib/gameLogic'

export { TILE }

const ANSWER_POOL = [...new Set(ANSWERS)]

export const TIMER_SECONDS = 600

function getRandomWord() {
  return ANSWER_POOL[Math.floor(Math.random() * ANSWER_POOL.length)]
}

export function useGameState({ initialTarget = null, trackLocalScores = true } = {}) {
  const [target, setTarget]             = useState(() => initialTarget || getRandomWord())
  const [guesses, setGuesses]           = useState([])
  const [currentGuess, setCurrentGuess] = useState("")
  const [gameOver, setGameOver]         = useState(false)
  const [won, setWon]                   = useState(false)
  const [shakingRow, setShakingRow]     = useState(null)
  const [toast, setToast]               = useState(null)
  const [revealingRow, setRevealingRow] = useState(null)
  const [timeLeft, setTimeLeft]         = useState(TIMER_SECONDS)
  const [scores, setScores] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lordle_scores") || "{}") } catch { return {} }
  })

  const myWins   = scores.wins   || 0
  const myLosses = scores.losses || 0
  const myStreak = scores.streak || 0

  const letterStates = useMemo(() => {
    const map = {}
    guesses.forEach(({ word, states }) => {
      word.split("").forEach((l, i) => {
        const prev = map[l]
        const cur = states[i]
        if (prev === TILE.CORRECT) return
        if (prev === TILE.PRESENT && cur === TILE.ABSENT) return
        map[l] = cur
      })
    })
    return map
  }, [guesses])

  // Green-letter score updates row-by-row as each guess finishes its reveal animation.
  // While a row is revealing, it doesn't count yet — the score syncs with the visual flip.
  const greenScore = useMemo(() => {
    const revealedCount = revealingRow !== null ? revealingRow : guesses.length
    return computeGreenScore(guesses.slice(0, revealedCount))
  }, [guesses, revealingRow])

  const bonus = computeBonus(won, guesses.length)
  const totalScore = greenScore + bonus

  const rows = useMemo(() => Array(6).fill(null).map((_, rowIdx) => {
    if (rowIdx < guesses.length) return guesses[rowIdx]
    if (rowIdx === guesses.length) {
      return { word: currentGuess.padEnd(5, " "), states: Array(5).fill(TILE.FILLED), isCurrent: true }
    }
    return { word: "     ", states: Array(5).fill(TILE.EMPTY), isEmpty: true }
  }), [guesses, currentGuess])

  const showToast = useCallback((msg, dur = 1800) => {
    setToast(msg)
    setTimeout(() => setToast(null), dur)
  }, [])

  // Uses functional setScores to avoid depending on myWins/myLosses/myStreak
  const triggerLoss = useCallback((msg = target) => {
    setGameOver(true)
    showToast(msg, 3500)
    if (!trackLocalScores) return
    setScores(prev => {
      const next = { wins: prev.wins || 0, losses: (prev.losses || 0) + 1, streak: 0 }
      localStorage.setItem("lordle_scores", JSON.stringify(next))
      return next
    })
  }, [target, showToast, trackLocalScores])

  const submitGuess = useCallback(() => {
    if (gameOver) return

    if (currentGuess.length < 5) {
      setShakingRow(guesses.length)
      setTimeout(() => setShakingRow(null), 500)
      showToast("Not enough letters")
      return
    }
    if (!VALID_WORDS.has(currentGuess)) {
      setShakingRow(guesses.length)
      setTimeout(() => setShakingRow(null), 500)
      showToast("Not a valid word")
      return
    }

    const states = evaluateGuess(currentGuess, target)
    const newGuesses = [...guesses, { word: currentGuess, states }]

    // last tile: delay 4×200=800ms + 700ms animation → done at 1500ms
    setRevealingRow(guesses.length)
    setTimeout(() => setRevealingRow(null), 1550)
    setGuesses(newGuesses)
    setCurrentGuess("")

    const isWon = states.every(s => s === TILE.CORRECT)
    if (isWon) {
      setTimeout(() => {
        setWon(true)
        setGameOver(true)
        showToast("Brilliant! 🎉", 3000)
        if (!trackLocalScores) return
        setScores(prev => {
          const next = { wins: (prev.wins || 0) + 1, losses: prev.losses || 0, streak: (prev.streak || 0) + 1 }
          localStorage.setItem("lordle_scores", JSON.stringify(next))
          return next
        })
      }, 1600)
    } else if (newGuesses.length === 6) {
      setTimeout(() => triggerLoss(), 1600)
    }
  }, [currentGuess, guesses, gameOver, target, showToast, triggerLoss, trackLocalScores])

  // Countdown — interval runs while game is active; cleanup when gameOver flips true
  useEffect(() => {
    if (gameOver) return
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000)
    return () => clearInterval(id)
  }, [gameOver])

  // Trigger loss when timer hits zero
  useEffect(() => {
    if (timeLeft === 0 && !gameOver) triggerLoss()
  }, [timeLeft, gameOver, triggerLoss])

  const handleKey = useCallback((key) => {
    if (gameOver) return
    if (key === "ENTER" || key === "Enter") { submitGuess(); return }
    if (key === "⌫" || key === "Backspace") { setCurrentGuess(p => p.slice(0, -1)); return }
    if (/^[A-Za-z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess(p => p + key.toUpperCase())
    }
  }, [gameOver, submitGuess, currentGuess])

  // Sync ref on every render so the stable listener always calls the latest handleKey
  const handleKeyRef = useRef(handleKey)
  useEffect(() => { handleKeyRef.current = handleKey })

  // Attaches once — no re-attachment on state changes
  useEffect(() => {
    const handler = e => { if (!e.ctrlKey && !e.metaKey && !e.altKey) handleKeyRef.current(e.key) }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const resetGame = useCallback(() => {
    setTarget(getRandomWord())
    setGuesses([])
    setCurrentGuess("")
    setGameOver(false)
    setWon(false)
    setTimeLeft(TIMER_SECONDS)
  }, [])

  return {
    target, gameOver, won,
    shakingRow, toast, revealingRow, timeLeft,
    myWins, myLosses, myStreak,
    greenScore, bonus, totalScore,
    attemptsUsed: guesses.length,
    letterStates, rows,
    handleKey, resetGame,
  }
}
