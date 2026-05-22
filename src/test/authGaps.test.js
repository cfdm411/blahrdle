import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../lib/supabase', () => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    insert: vi.fn(() => Promise.resolve({ error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
  }
  return {
    supabase: {
      auth: {
        getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        signInWithPassword: vi.fn(() => Promise.resolve({ error: null })),
        signUp: vi.fn(() => Promise.resolve({
          data: { user: { id: 'uid-1' } }, error: null,
        })),
      },
      from: vi.fn(() => builder),
    },
  }
})

import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

async function mountAuth() {
  const hook = renderHook(() => useAuth())
  await act(async () => {})
  return hook
}

beforeEach(() => {
  vi.clearAllMocks()
  supabase.auth.getSession.mockResolvedValue({ data: { session: null } })
  supabase.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
  supabase.auth.signInWithPassword.mockResolvedValue({ error: null })
  supabase.auth.signUp.mockResolvedValue({
    data: { user: { id: 'uid-1' } }, error: null,
  })
  const builder = supabase.from()
  builder.select.mockImplementation(() => builder)
  builder.eq.mockImplementation(() => builder)
  builder.insert.mockResolvedValue({ error: null })
  builder.maybeSingle.mockResolvedValue({ data: null, error: null })
  supabase.from.mockReturnValue(builder)
  supabase.from.mockClear()
})

describe('signIn — pre-email-era account (A3)', () => {
  it('resolves legacy profiles.email = username@lordle.local and signs in', async () => {
    const { result } = await mountAuth()
    const builder = supabase.from()
    builder.maybeSingle.mockResolvedValueOnce({
      data: { username: 'legacyuser' }, error: null,
    })
    supabase.from.mockClear()

    let response
    await act(async () => {
      response = await result.current.signIn('legacyuser@lordle.local', 'secret123')
    })

    expect(response).toEqual({ error: null })
    expect(builder.eq).toHaveBeenCalledWith('email', 'legacyuser@lordle.local')
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'legacyuser@lordle.local',
      password: 'secret123',
    })
  })
})

describe('signIn — uppercase email input (A4)', () => {
  it('lowercases email before the profiles lookup', async () => {
    const { result } = await mountAuth()
    const builder = supabase.from()
    builder.maybeSingle.mockResolvedValueOnce({
      data: { username: 'alice' }, error: null,
    })
    supabase.from.mockClear()

    await act(async () => {
      await result.current.signIn('Real@Example.COM', 'secret123')
    })

    expect(builder.eq).toHaveBeenCalledWith('email', 'real@example.com')
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'alice@lordle.local',
      password: 'secret123',
    })
  })
})

describe('signIn — @lordle.local input treated as email path (A5)', () => {
  it('queries profiles by email when input contains @lordle.local', async () => {
    const { result } = await mountAuth()
    const builder = supabase.from()
    builder.maybeSingle.mockResolvedValueOnce({
      data: { username: 'bob' }, error: null,
    })
    supabase.from.mockClear()

    await act(async () => {
      await result.current.signIn('bob@lordle.local', 'secret123')
    })

    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(builder.eq).toHaveBeenCalledWith('email', 'bob@lordle.local')
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'bob@lordle.local',
      password: 'secret123',
    })
  })
})

describe('signIn — synthesized address normalization (A6)', () => {
  it('maps mixed-case username to the same lowercase @lordle.local auth email', async () => {
    const { result } = await mountAuth()

    await act(async () => {
      await result.current.signIn('  Alice  ', 'secret123')
    })

    expect(supabase.from).not.toHaveBeenCalled()
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'alice@lordle.local',
      password: 'secret123',
    })
  })

  it('signUp always registers the lowercase synthesized auth email', async () => {
    const { result } = await mountAuth()

    await act(async () => {
      await result.current.signUp('real@example.com', 'Alice', 'secret123')
    })

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'alice@lordle.local',
      password: 'secret123',
    })
  })
})
