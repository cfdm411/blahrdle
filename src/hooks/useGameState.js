import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { VALID_WORDS } from '../data/words'
import { TILE, evaluateGuess, computeGreenScore, computeBonus, getRandomWord } from '../lib/gameLogic'

export { TILE }

export const TIMER_SECONDS = 600

export function useGameState({ initialTarget = null } = {}) {
  const [target, setTarget]             = useState(() => initialTarget || getRandomWord())
  const [guesses, setGuesses]           = useState([])
  const [currentGuess, setCurrentGuess] = useState("")
  const [gameOver, setGameOver]         = useState(false)
  const [won, setWon]                   = useState(false)
  const [shakingRow, setShakingRow]     = useState(null)
  const [toast, setToast]               = useState(null)
  const [revealingRow, setRevealingRow] = useState(null)
  const [timeLeft, setTimeLeft]         = useState(TIMER_SECONDS)
  const [timerPaused, setTimerPaused]   = useState(false)
  const lossHandledRef = useRef(false)
  const pendingTimeoutsRef = useRef(new Set())
  const revealTimeoutRef = useRef(null)

  const scheduleTimeout = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      pendingTimeoutsRef.current.delete(id)
      fn()
    }, ms)
    pendingTimeoutsRef.current.add(id)
    return id
  }, [])

  const clearPendingTimeouts = useCallback(() => {
    for (const id of pendingTimeoutsRef.current) clearTimeout(id)
    pendingTimeoutsRef.current.clear()
  }, [])

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
    scheduleTimeout(() => setToast(null), dur)
  }, [scheduleTimeout])

  // Uses functional setScores to avoid depending on myWins/myLosses/myStreak
  const triggerLoss = useCallback((msg = target) => {
    if (lossHandledRef.current) return
    lossHandledRef.current = true
    setGameOver(true)
    showToast(msg, 3500)
    setScores(prev => {
      const next = { wins: prev.wins || 0, losses: (prev.losses || 0) + 1, streak: 0 }
      localStorage.setItem("lordle_scores", JSON.stringify(next))
      return next
    })
  }, [target, showToast])

  const submitGuess = useCallback(() => {
    if (gameOver || timeLeft === 0) return

    if (currentGuess.length < 5) {
      setShakingRow(guesses.length)
      scheduleTimeout(() => setShakingRow(null), 500)
      showToast("Not enough letters")
      return
    }
    if (!VALID_WORDS.has(currentGuess)) {
      setShakingRow(guesses.length)
      scheduleTimeout(() => setShakingRow(null), 500)
      showToast("Not a valid word")
      return
    }

    const states = evaluateGuess(currentGuess, target)
    const newGuesses = [...guesses, { word: currentGuess, states }]

    // last tile: delay 4×200=800ms + 700ms animation → done at 1500ms
    if (revealTimeoutRef.current !== null) {
      clearTimeout(revealTimeoutRef.current)
      pendingTimeoutsRef.current.delete(revealTimeoutRef.current)
    }
    setRevealingRow(guesses.length)
    revealTimeoutRef.current = scheduleTimeout(() => {
      revealTimeoutRef.current = null
      setRevealingRow(null)
    }, 1550)
    setGuesses(newGuesses)
    setCurrentGuess("")

    const isWon = states.every(s => s === TILE.CORRECT)
    if (isWon) {
      setTimerPaused(true)
      scheduleTimeout(() => {
        setWon(true)
        setGameOver(true)
        showToast("Brilliant! 🎉", 3000)
        setScores(prev => {
          const next = { wins: (prev.wins || 0) + 1, losses: prev.losses || 0, streak: (prev.streak || 0) + 1 }
          localStorage.setItem("lordle_scores", JSON.stringify(next))
          return next
        })
      }, 1600)
    } else if (newGuesses.length === 6) {
      setTimerPaused(true)
      scheduleTimeout(() => triggerLoss(), 1600)
    }
  }, [currentGuess, guesses, gameOver, timeLeft, target, showToast, triggerLoss, scheduleTimeout])

  // Countdown — interval runs while game is active; cleanup when gameOver flips true
  useEffect(() => {
    if (gameOver || timerPaused) return
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000)
    return () => clearInterval(id)
  }, [gameOver, timerPaused])

  // Trigger loss when timer hits zero
  useEffect(() => {
    if (timeLeft === 0 && !gameOver) triggerLoss()
  }, [timeLeft, gameOver, triggerLoss])

  const handleKey = useCallback((key) => {
    if (gameOver || timeLeft === 0) return
    // Block input during a terminal reveal (win row or 6th-guess row).
    // revealingRow is the index of the row currently animating; if that row is a
    // win or the last possible guess we lock the board immediately — no ref needed.
    if (revealingRow !== null) {
      const isWinReveal   = guesses[revealingRow]?.states.every(s => s === TILE.CORRECT)
      const isFinalReveal = guesses.length === 6
      if (isWinReveal || isFinalReveal) return
    }
    if (key === "ENTER" || key === "Enter") { submitGuess(); return }
    if (key === "⌫" || key === "Backspace") { setCurrentGuess(p => p.slice(0, -1)); return }
    if (/^[A-Za-z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess(p => p + key.toUpperCase())
    }
  }, [gameOver, timeLeft, revealingRow, guesses, submitGuess, currentGuess])

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
    clearPendingTimeouts()
    setTarget(getRandomWord())
    setGuesses([])
    setCurrentGuess("")
    setGameOver(false)
    setWon(false)
    setShakingRow(null)
    setToast(null)
    setRevealingRow(null)
    setTimerPaused(false)
    lossHandledRef.current = false
    setTimeLeft(TIMER_SECONDS)
  }, [clearPendingTimeouts])

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
