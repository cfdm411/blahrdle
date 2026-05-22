import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Supabase mock ────────────────────────────────────────────────────────────
// Each test can call supabase.from.mockReturnValueOnce(chain(...)) to inject
// per-call behaviour; the default builder resolves with { data: null, count: 0 }.

function chain(defaults = {}) {
  const res = { data: null, count: 0, error: null, ...defaults }
  const b = {
    select:     vi.fn(() => b),
    eq:         vi.fn(() => b),
    neq:        vi.fn(() => b),
    in:         vi.fn(() => b),
    or:         vi.fn(() => b),
    is:         vi.fn(() => b),
    lt:         vi.fn(() => b),
    limit:      vi.fn(() => b),
    order:      vi.fn(() => b),
    ilike:      vi.fn(() => b),
    update:     vi.fn(() => b),
    insert:     vi.fn(() => b),
    single:     vi.fn(() => Promise.resolve(res)),
    maybeSingle: vi.fn(() => Promise.resolve(res)),
    // Thenable so `await chain.select().eq().in()` resolves (no terminal call)
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
import {
  searchProfiles,
  createMatch,
  respondToMatch,
  saveMatchResult,
  finalizeExpiredMatches,
  MAX_ACTIVE_RECEIVED,
} from '../lib/matches'

beforeEach(() => {
  vi.clearAllMocks()
  supabase.from.mockReturnValue(chain())
  supabase.rpc.mockResolvedValue({ data: null, error: null })
})

// ─── searchProfiles ───────────────────────────────────────────────────────────
describe('searchProfiles', () => {
  it('returns [] without hitting the DB when query is shorter than 2 chars', async () => {
    expect(await searchProfiles('', 'uid-1')).toEqual([])
    expect(await searchProfiles('a', 'uid-1')).toEqual([])
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('passes the trimmed query as an ilike pattern', async () => {
    const b = chain({ data: [{ id: 'uid-2', username: 'alice' }], error: null })
    supabase.from.mockReturnValueOnce(b)

    const results = await searchProfiles('  al  ', 'uid-1')

    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(b.ilike).toHaveBeenCalledWith('username', '%al%')
    expect(b.neq).toHaveBeenCalledWith('id', 'uid-1')
    expect(results).toEqual([{ id: 'uid-2', username: 'alice' }])
  })
})

// ─── createMatch ─────────────────────────────────────────────────────────────
describe('createMatch', () => {
  it('throws without any DB call when challenger === opponent', async () => {
    await expect(createMatch('uid-1', 'uid-1')).rejects.toThrow('ti mismo')
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('throws when the opponent already has MAX_ACTIVE_RECEIVED active matches', async () => {
    supabase.from.mockReturnValueOnce(chain({ count: MAX_ACTIVE_RECEIVED, error: null }))

    await expect(createMatch('uid-c', 'uid-o')).rejects.toThrow('muchos retos')
  })

  it('throws when an active match already exists between the pair', async () => {
    // 1st from() — count for opponent: under limit
    supabase.from.mockReturnValueOnce(chain({ count: 0, error: null }))
    // 2nd from() — duplicate-pair check: returns an existing row
    supabase.from.mockReturnValueOnce(chain({ data: [{ id: 'existing' }], error: null }))

    await expect(createMatch('uid-c', 'uid-o')).rejects.toThrow('reto activo')
  })

  it('inserts a match with the correct fields on success', async () => {
    const mockMatch = {
      id: 'match-1', challenger_id: 'uid-c', opponent_id: 'uid-o',
      word: 'HELLO', status: 'pending',
    }
    const insertChain = chain({ data: mockMatch, error: null })

    supabase.from
      .mockReturnValueOnce(chain({ count: 0, error: null }))      // active count
      .mockReturnValueOnce(chain({ data: [],  error: null }))      // duplicate check
      .mockReturnValueOnce(insertChain)                            // insert

    const result = await createMatch('uid-c', 'uid-o')

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        challenger_id: 'uid-c',
        opponent_id:   'uid-o',
        status:        'pending',
      })
    )
    expect(result).toEqual(mockMatch)
  })
})

// ─── respondToMatch ───────────────────────────────────────────────────────────
describe('respondToMatch', () => {
  it('updates status to accepted when accept=true', async () => {
    const b = chain({ data: [{ id: 'match-1' }], error: null })
    supabase.from.mockReturnValueOnce(b)

    await respondToMatch('match-1', true, 'uid-opponent')

    expect(b.update).toHaveBeenCalledWith({ status: 'accepted' })
    expect(b.eq).toHaveBeenCalledWith('id', 'match-1')
    expect(b.eq).toHaveBeenCalledWith('opponent_id', 'uid-opponent')
  })

  it('updates status to rejected when accept=false', async () => {
    const b = chain({ data: [{ id: 'match-1' }], error: null })
    supabase.from.mockReturnValueOnce(b)

    await respondToMatch('match-1', false, 'uid-opponent')

    expect(b.update).toHaveBeenCalledWith({ status: 'rejected' })
  })

  it('throws when no row was updated (wrong opponent or match not pending)', async () => {
    supabase.from.mockReturnValueOnce(chain({ data: [], error: null }))

    await expect(respondToMatch('match-1', true, 'uid-wrong')).rejects.toThrow()
  })
})

// ─── saveMatchResult ──────────────────────────────────────────────────────────
describe('saveMatchResult', () => {
  it('calls the save_match_result RPC with the correct parameters', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: { id: 'match-1' }, error: null })

    const match = { id: 'match-1', challenger_id: 'uid-c', opponent_id: 'uid-o' }
    const result = await saveMatchResult(match, 'uid-c', 120, true)

    expect(supabase.rpc).toHaveBeenCalledWith('save_match_result', {
      p_match_id: 'match-1',
      p_score:    120,
      p_solved:   true,
    })
    expect(result).toEqual({ id: 'match-1' })
  })

  it('returns null when the RPC signals a no-op (already saved)', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: null })

    const match = { id: 'match-1', challenger_id: 'uid-c', opponent_id: 'uid-o' }
    const result = await saveMatchResult(match, 'uid-c', 80, false)

    expect(result).toBeNull()
  })

  it('throws when the RPC returns an error', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'not accepted' } })

    const match = { id: 'match-1', challenger_id: 'uid-c', opponent_id: 'uid-o' }
    await expect(saveMatchResult(match, 'uid-c', 80, false)).rejects.toThrow('not accepted')
  })
})

// ─── finalizeExpiredMatches ───────────────────────────────────────────────────
describe('finalizeExpiredMatches', () => {
  it('calls the process_expired_matches RPC with the user id', async () => {
    await finalizeExpiredMatches('uid-1')

    expect(supabase.rpc).toHaveBeenCalledWith('process_expired_matches', {
      p_user_id: 'uid-1',
    })
  })

  it('does not throw when the RPC returns an error (non-fatal)', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'server error' } })

    await expect(finalizeExpiredMatches('uid-1')).resolves.not.toThrow()
  })
})
