import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameState, TIMER_SECONDS } from '../hooks/useGameState'

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('timer', () => {
  it('starts at TIMER_SECONDS', () => {
    const { result } = renderHook(() => useGameState())
    expect(result.current.timeLeft).toBe(TIMER_SECONDS)
  })

  it('decrements by 1 each second', () => {
    const { result } = renderHook(() => useGameState())
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.timeLeft).toBe(TIMER_SECONDS - 3)
  })

  it('does not go below 0', () => {
    const { result } = renderHook(() => useGameState())
    act(() => { vi.advanceTimersByTime((TIMER_SECONDS + 10) * 1000) })
    expect(result.current.timeLeft).toBeGreaterThanOrEqual(0)
  })

  it('triggers loss when timer reaches 0', () => {
    const { result } = renderHook(() => useGameState())
    act(() => { vi.advanceTimersByTime(TIMER_SECONDS * 1000) })
    expect(result.current.gameOver).toBe(true)
    expect(result.current.won).toBe(false)
  })

  it('stops counting after game over', () => {
    const { result } = renderHook(() => useGameState())
    act(() => { vi.advanceTimersByTime(TIMER_SECONDS * 1000) })
    const frozenTime = result.current.timeLeft
    act(() => { vi.advanceTimersByTime(5000) })
    expect(result.current.timeLeft).toBe(frozenTime)
  })

  it('pauses timer immediately on winning submit, before gameOver flips', async () => {
    const { result } = renderHook(() =>
      useGameState({ initialTarget: 'HELLO' })
    )

    act(() => { vi.advanceTimersByTime((TIMER_SECONDS - 2) * 1000) })
    expect(result.current.timeLeft).toBe(2)

    for (const k of 'HELLO') {
      await act(async () => { result.current.handleKey(k) })
    }
    await act(async () => { result.current.handleKey('Enter') })

    expect(result.current.gameOver).toBe(false)
    expect(result.current.timeLeft).toBe(2)

    act(() => { vi.advanceTimersByTime(5000) })
    expect(result.current.timeLeft).toBe(2)
  })
})
