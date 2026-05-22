import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameState, TIMER_SECONDS } from '../hooks/useGameState'
import { evaluateGuess, computeGreenScore } from '../lib/gameLogic'

const PARTIAL_GUESS = 'HEART'
const TARGET = 'HELLO'
const expectedGreenScore = computeGreenScore([{
  word: PARTIAL_GUESS,
  states: evaluateGuess(PARTIAL_GUESS, TARGET),
}])

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  localStorage.setItem('lordle_scores', JSON.stringify({ wins: 0, losses: 0, streak: 0 }))
})

afterEach(() => {
  vi.useRealTimers()
})

async function typeWord(result, word) {
  for (const k of word) {
    await act(async () => { result.current.handleKey(k) })
  }
  await act(async () => { result.current.handleKey('Enter') })
}

async function playFiveWrongs(result) {
  const wrongs = ['HELLO', 'WORLD', 'CRANE', 'SLATE', 'AUDIO']
  for (const word of wrongs) {
    await typeWord(result, word)
    await act(async () => { vi.advanceTimersByTime(1600) })
  }
}

describe('timer vs win race', () => {
  it('winning submit at timeLeft=1 pauses timer and records a win, not a loss', async () => {
    const { result } = renderHook(() =>
      useGameState({ initialTarget: 'HELLO' })
    )

    act(() => { vi.advanceTimersByTime((TIMER_SECONDS - 1) * 1000) })
    expect(result.current.timeLeft).toBe(1)

    await typeWord(result, 'HELLO')

    expect(result.current.gameOver).toBe(false)
    expect(result.current.timeLeft).toBe(1)

    act(() => { vi.advanceTimersByTime(5000) })
    expect(result.current.timeLeft).toBe(1)

    await act(async () => { vi.advanceTimersByTime(1600) })

    expect(result.current.won).toBe(true)
    expect(result.current.gameOver).toBe(true)
    expect(result.current.myLosses).toBe(0)
    expect(result.current.myWins).toBe(1)
  })
})

describe('double triggerLoss', () => {
  it('increments losses only once when timer hits 0 and 6th-guess loss fire together', async () => {
    const { result } = renderHook(() =>
      useGameState({ initialTarget: 'ZZZZZ' })
    )

    await playFiveWrongs(result)

    const timeBurnedByFiveGuesses = 5 * 1600
    act(() => {
      vi.advanceTimersByTime((TIMER_SECONDS - 1) * 1000 - timeBurnedByFiveGuesses)
    })
    expect(result.current.timeLeft).toBe(1)

    await act(async () => {
      for (const k of 'BRAVE') result.current.handleKey(k)
      result.current.handleKey('Enter')
      vi.advanceTimersByTime(1600)
    })

    expect(result.current.gameOver).toBe(true)
    expect(result.current.won).toBe(false)
    expect(result.current.myLosses).toBe(1)

    const stored = JSON.parse(localStorage.getItem('lordle_scores'))
    expect(stored.losses).toBe(1)
  })
})

describe('reset during non-terminal reveal (R1)', () => {
  it('clears revealingRow, guesses, and greenScore when resetGame runs mid-reveal', async () => {
    const { result } = renderHook(() =>
      useGameState({ initialTarget: 'ZZZZZ' })
    )

    await typeWord(result, 'HELLO')

    expect(result.current.revealingRow).toBe(0)
    expect(result.current.attemptsUsed).toBe(1)

    await act(async () => { result.current.resetGame() })

    expect(result.current.revealingRow).toBeNull()
    expect(result.current.attemptsUsed).toBe(0)
    expect(result.current.greenScore).toBe(0)
    expect(result.current.gameOver).toBe(false)
    expect(result.current.timeLeft).toBe(TIMER_SECONDS)
    expect(result.current.rows[0].word.trim()).toBe('')
  })
})

describe('totalScore during timer-loss mid-reveal', () => {
  it('excludes in-flight row greens until reveal completes, then includes them', async () => {
    const { result } = renderHook(() =>
      useGameState({ initialTarget: TARGET })
    )

    act(() => { vi.advanceTimersByTime((TIMER_SECONDS - 1) * 1000) })
    expect(result.current.timeLeft).toBe(1)

    await typeWord(result, PARTIAL_GUESS)

    expect(result.current.revealingRow).toBe(0)
    expect(result.current.greenScore).toBe(0)
    expect(result.current.totalScore).toBe(0)

    act(() => { vi.advanceTimersByTime(1000) })

    expect(result.current.gameOver).toBe(true)
    expect(result.current.revealingRow).toBe(0)
    expect(result.current.totalScore).toBe(0)

    await act(async () => { vi.advanceTimersByTime(550) })

    expect(result.current.revealingRow).toBeNull()
    expect(result.current.greenScore).toBe(expectedGreenScore)
    expect(result.current.totalScore).toBe(expectedGreenScore)
  })
})
