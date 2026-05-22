import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import React, { useEffect } from 'react'

const gameStatsInsert = vi.fn(() => Promise.resolve({ error: null }))
const summaryUpsert = vi.fn(() => Promise.resolve({ error: null }))

function makeBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    insert: gameStatsInsert,
    upsert: summaryUpsert,
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
  }
  return builder
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(() => Promise.resolve()),
    },
    from: vi.fn(() => makeBuilder()),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  },
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    profile: { username: 'alice' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}))

vi.mock('../components/HomeScreen.jsx', () => ({
  HomeScreen: function AutoPlayHome({ onPlay }) {
    useEffect(() => { onPlay() }, [onPlay])
    return null
  },
}))

vi.mock('../lib/gameLogic', async (importOriginal) => {
  const mod = await importOriginal()
  return { ...mod, getRandomWord: vi.fn(() => 'HELLO') }
})

import { supabase } from '../lib/supabase'
import App from '../App.jsx'
import { evaluateGuess, computeGreenScore } from '../lib/gameLogic'

const PARTIAL_GUESS = 'HEART'
const TARGET = 'HELLO'
const expectedScore = computeGreenScore([{
  word: PARTIAL_GUESS,
  states: evaluateGuess(PARTIAL_GUESS, TARGET),
}])

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  gameStatsInsert.mockClear()
  summaryUpsert.mockClear()
  supabase.from.mockImplementation(() => makeBuilder())
})

afterEach(() => {
  vi.useRealTimers()
})

async function pressKey(key) {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

async function typeWord(word) {
  for (const k of word) await pressKey(k)
  await pressKey('Enter')
}

describe('stats save on timer-loss mid-reveal (T7)', () => {
  it('defers game_stats insert until reveal completes, then saves full green score', async () => {
    render(<App />)
    await act(async () => {})

    await act(async () => { vi.advanceTimersByTime(599 * 1000) })

    await typeWord(PARTIAL_GUESS)

    expect(gameStatsInsert).not.toHaveBeenCalled()

    await act(async () => { vi.advanceTimersByTime(1000) })

    expect(gameStatsInsert).not.toHaveBeenCalled()

    await act(async () => { vi.advanceTimersByTime(550) })
    await act(async () => {})

    expect(gameStatsInsert).toHaveBeenCalledTimes(1)
    expect(gameStatsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        score: expectedScore,
        won: false,
        word: TARGET,
      })
    )
    expect(summaryUpsert).toHaveBeenCalledTimes(1)
  })
})
