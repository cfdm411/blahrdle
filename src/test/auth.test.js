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
  // flush the mount-time getSession promise
  await act(async () => {})
  return hook
}

beforeEach(() => {
  vi.clearAllMocks()
  // restore default implementations after clearAllMocks wipes them
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
  supabase.from.mockClear() // forget the call we just made to grab the builder
})

describe('signUp', () => {
  it('saves real email and username on successful registration', async () => {
    const { result } = await mountAuth()

    let response
    await act(async () => {
      response = await result.current.signUp('real@example.com', 'alice', 'secret123')
    })

    expect(response).toEqual({ error: null })
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'alice@lordle.local',
      password: 'secret123',
    })
    const builder = supabase.from.mock.results[0].value
    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(builder.insert).toHaveBeenCalledWith({
      id: 'uid-1',
      username: 'alice',
      email: 'real@example.com',
    })
  })

  it('rejects when username contains @ and never hits the network', async () => {
    const { result } = await mountAuth()

    let response
    await act(async () => {
      response = await result.current.signUp('real@example.com', 'bad@user', 'secret123')
    })

    expect(response.error.message).toBe('Username cannot contain @')
    expect(supabase.auth.signUp).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('translates duplicate-email DB error into a friendly message', async () => {
    const { result } = await mountAuth()
    const builder = supabase.from()
    builder.insert.mockResolvedValueOnce({
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "profiles_email_key" (email)',
      },
    })
    supabase.from.mockClear()

    let response
    await act(async () => {
      response = await result.current.signUp('dup@example.com', 'alice', 'secret123')
    })

    expect(response.error.message).toBe('An account with this email already exists')
  })

  it('trims whitespace from username and email before persisting', async () => {
    const { result } = await mountAuth()

    await act(async () => {
      await result.current.signUp('  Real@Example.COM  ', '  alice  ', 'secret123')
    })

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'alice@lordle.local',
      password: 'secret123',
    })
    const builder = supabase.from.mock.results[0].value
    expect(builder.insert).toHaveBeenCalledWith({
      id: 'uid-1',
      username: 'alice',
      email: 'real@example.com',
    })
  })
})

describe('signIn', () => {
  it('signs in with a username (no profile lookup)', async () => {
    const { result } = await mountAuth()

    let response
    await act(async () => {
      response = await result.current.signIn('alice', 'secret123')
    })

    expect(response).toEqual({ error: null })
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'alice@lordle.local',
      password: 'secret123',
    })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('resolves an email to its username, then signs in', async () => {
    const { result } = await mountAuth()
    const builder = supabase.from()
    builder.maybeSingle.mockResolvedValueOnce({
      data: { username: 'alice' }, error: null,
    })
    supabase.from.mockClear()

    let response
    await act(async () => {
      response = await result.current.signIn('real@example.com', 'secret123')
    })

    expect(response).toEqual({ error: null })
    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(builder.eq).toHaveBeenCalledWith('email', 'real@example.com')
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'alice@lordle.local',
      password: 'secret123',
    })
  })

  it('returns the auth error when the password is wrong', async () => {
    const { result } = await mountAuth()
    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      error: { message: 'Invalid login credentials' },
    })

    let response
    await act(async () => {
      response = await result.current.signIn('alice', 'wrong-password')
    })

    expect(response.error.message).toBe('Invalid login credentials')
  })

  it('returns a clear error when no profile matches the email', async () => {
    const { result } = await mountAuth()
    const builder = supabase.from()
    builder.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    supabase.from.mockClear()

    let response
    await act(async () => {
      response = await result.current.signIn('nobody@example.com', 'secret123')
    })

    expect(response.error.message).toMatch(/no account found/i)
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })
})
