import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameState } from '../hooks/useGameState'

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

// Type each letter and Enter in separate acts so every key re-renders the hook
// before the next call — avoids stale-closure issues with submitGuess reading
// the pre-render currentGuess value.
async function typeWord(result, word) {
  for (const k of word) {
    await act(async () => result.current.handleKey(k))
  }
  await act(async () => result.current.handleKey('Enter'))
}

describe('win input blocking', () => {
  it('blocks all keypresses immediately after the winning guess, before the reveal animation ends', async () => {
    const { result } = renderHook(() =>
      useGameState({ initialTarget: 'HELLO' })
    )

    await typeWord(result, 'HELLO')

    // gameOver is still false — we are in the 1600 ms reveal window
    expect(result.current.gameOver).toBe(false)
    // Confirm the guess actually landed
    expect(result.current.attemptsUsed).toBe(1)

    // Attempt to type during the reveal
    await act(async () => {
      result.current.handleKey('A')
      result.current.handleKey('B')
      result.current.handleKey('C')
    })

    // Row 1 (index 1, after the winning row) is the "current guess" row.
    // If any key went through, its word would start with a letter.
    // Correct behaviour: word is all spaces (empty currentGuess).
    expect(result.current.rows[1].word.trim()).toBe('')
  })

  it('blocks keypresses during the 6th-guess reveal (impending loss)', async () => {
    const { result } = renderHook(() =>
      useGameState({ initialTarget: 'ZZZZZ' })
    )

    const wrongs = ['HELLO', 'WORLD', 'CRANE', 'SLATE', 'AUDIO']
    for (const word of wrongs) {
      await typeWord(result, word)
      // Advance past each reveal so the next row opens
      await act(async () => vi.advanceTimersByTime(1600))
    }

    // Now on the 6th (final) guess — submit a wrong word
    await typeWord(result, 'BRAVE')

    // We are in the 6th-row reveal window; gameOver is still false
    expect(result.current.gameOver).toBe(false)
    expect(result.current.rows[5].word.trim()).toBe('BRAVE')

    // Typing should be blocked: currentGuess must stay ""
    await act(async () => {
      result.current.handleKey('X')
    })

    // After the reveal, gameOver becomes true
    await act(async () => vi.advanceTimersByTime(1600))
    expect(result.current.gameOver).toBe(true)
    expect(result.current.won).toBe(false)
  })

  it('accepts input normally on a non-terminal row reveal', async () => {
    const { result } = renderHook(() =>
      useGameState({ initialTarget: 'ZZZZZ' })
    )

    await typeWord(result, 'HELLO')

    // While the first row is still revealing (non-terminal — game is not over,
    // not the 6th guess), new input should be accepted.
    await act(async () => {
      result.current.handleKey('W')
    })

    // The current-guess row should now contain 'W'
    expect(result.current.rows[1].word[0]).toBe('W')
  })
})
