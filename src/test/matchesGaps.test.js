import { describe, it, expect, beforeEach, vi } from 'vitest'

function chain(defaults = {}) {
  const res = { data: null, count: 0, error: null, ...defaults }
  const b = {
    select:     vi.fn(() => b),
    eq:         vi.fn(() => b),
    neq:        vi.fn(() => b),
    in:         vi.fn(() => b),
    or:         vi.fn(() => b),
    in:         vi.fn(() => b),
    limit:      vi.fn(() => b),
    ilike:      vi.fn(() => b),
    insert:     vi.fn(() => b),
    single:     vi.fn(() => Promise.resolve(res)),
    then: (resolve, reject) => Promise.resolve(res).then(resolve, reject),
  }
  return b
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => chain()),
    rpc:  vi.fn(() => Promise.resolve({ data: null, error: null })),
  },
}))

import { supabase } from '../lib/supabase'
import { createMatch, finalizeExpiredMatches } from '../lib/matches'

const MATCH_DURATION_MS = 24 * 60 * 60 * 1000

beforeEach(() => {
  vi.clearAllMocks()
  supabase.from.mockReturnValue(chain())
  supabase.rpc.mockResolvedValue({ data: null, error: null })
})

describe('createMatch expiry boundary (M2)', () => {
  it('sets expires_at approximately 24 hours from creation', async () => {
    const mockMatch = {
      id: 'match-1', challenger_id: 'uid-c', opponent_id: 'uid-o',
      word: 'HELLO', status: 'pending',
    }
    const insertChain = chain({ data: mockMatch, error: null })

    supabase.from
      .mockReturnValueOnce(chain({ count: 0, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain)

    const before = Date.now()
    await createMatch('uid-c', 'uid-o')
    const after = Date.now()

    const payload = insertChain.insert.mock.calls[0][0]
    const expiresAt = new Date(payload.expires_at).getTime()

    expect(expiresAt).toBeGreaterThanOrEqual(before + MATCH_DURATION_MS - 1000)
    expect(expiresAt).toBeLessThanOrEqual(after + MATCH_DURATION_MS + 1000)
    expect(payload.status).toBe('pending')
  })
})

describe('finalizeExpiredMatches concurrency (M3)', () => {
  it('allows parallel sweeper calls without throwing', async () => {
    await expect(Promise.all([
      finalizeExpiredMatches('uid-1'),
      finalizeExpiredMatches('uid-1'),
      finalizeExpiredMatches('uid-1'),
    ])).resolves.toEqual([undefined, undefined, undefined])

    expect(supabase.rpc).toHaveBeenCalledTimes(3)
    expect(supabase.rpc).toHaveBeenCalledWith('process_expired_matches', {
      p_user_id: 'uid-1',
    })
  })

  it('still resolves when one parallel call returns an RPC error', async () => {
    supabase.rpc
      .mockResolvedValueOnce({ data: null, error: { message: 'busy' } })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'busy' } })

    await expect(Promise.all([
      finalizeExpiredMatches('uid-1'),
      finalizeExpiredMatches('uid-1'),
      finalizeExpiredMatches('uid-1'),
    ])).resolves.toBeDefined()
  })
})
