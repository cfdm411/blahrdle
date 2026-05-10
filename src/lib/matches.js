import { supabase } from './supabase'
import { ANSWERS } from '../data/words'

const ANSWER_POOL = [...new Set(ANSWERS)]
const ACTIVE_STATES = ['pending', 'accepted']
const MATCH_DURATION_MS = 24 * 60 * 60 * 1000

export const MAX_ACTIVE_RECEIVED = 3

const SELECT_FULL = `
  *,
  challenger:profiles!matches_challenger_id_fkey(id, username),
  opponent:profiles!matches_opponent_id_fkey(id, username)
`

function pickWord() {
  return ANSWER_POOL[Math.floor(Math.random() * ANSWER_POOL.length)]
}

export async function searchProfiles(query, currentUserId) {
  const q = (query || '').trim()
  if (q.length < 2) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', `%${q}%`)
    .neq('id', currentUserId)
    .order('username')
    .limit(10)
  if (error) throw error
  return data || []
}

export async function listMatches(userId) {
  const { data, error } = await supabase
    .from('matches')
    .select(SELECT_FULL)
    .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function countPendingReceived(userId) {
  const { count, error } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('opponent_id', userId)
    .eq('status', 'pending')
  if (error) return 0
  return count || 0
}

export async function createMatch(challengerId, opponentId) {
  if (!opponentId || challengerId === opponentId) {
    throw new Error('No puedes retarte a ti mismo.')
  }

  // Recipient already has too many active matches?
  const { count: activeCount } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('opponent_id', opponentId)
    .in('status', ACTIVE_STATES)
  if ((activeCount || 0) >= MAX_ACTIVE_RECEIVED) {
    throw new Error('El oponente tiene muchos retos activos')
  }

  // Already an active match between these two players (in either direction)?
  const orFilter = `and(challenger_id.eq.${challengerId},opponent_id.eq.${opponentId}),and(challenger_id.eq.${opponentId},opponent_id.eq.${challengerId})`
  const { data: existing } = await supabase
    .from('matches')
    .select('id')
    .or(orFilter)
    .in('status', ACTIVE_STATES)
    .limit(1)
  if (existing && existing.length > 0) {
    throw new Error('Ya tienes un reto activo con este jugador.')
  }

  const expiresAt = new Date(Date.now() + MATCH_DURATION_MS).toISOString()
  const { data, error } = await supabase
    .from('matches')
    .insert({
      challenger_id: challengerId,
      opponent_id: opponentId,
      word: pickWord(),
      status: 'pending',
      expires_at: expiresAt,
    })
    .select(SELECT_FULL)
    .single()
  if (error) throw error
  return data
}

export async function respondToMatch(matchId, accept, userId) {
  const status = accept ? 'accepted' : 'rejected'
  const { data, error } = await supabase
    .from('matches')
    .update({ status })
    .eq('id', matchId)
    .eq('status', 'pending')
    .eq('opponent_id', userId)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No se pudo responder a este reto.')
  }
}

function pickWinner(m) {
  const cPlayed = m.challenger_score !== null && m.challenger_score !== undefined
  const oPlayed = m.opponent_score   !== null && m.opponent_score   !== undefined
  if (!cPlayed && !oPlayed) return null
  if (cPlayed && !oPlayed) return m.challenger_id
  if (oPlayed && !cPlayed) return m.opponent_id

  // Both played
  const cSolved = !!m.challenger_solved
  const oSolved = !!m.opponent_solved
  if (cSolved && !oSolved) return m.challenger_id
  if (oSolved && !cSolved) return m.opponent_id
  if (m.challenger_score > m.opponent_score) return m.challenger_id
  if (m.opponent_score   > m.challenger_score) return m.opponent_id
  return null // draw
}

async function finalizeMatch(match) {
  const winnerId = pickWinner(match)
  const { data, error } = await supabase
    .from('matches')
    .update({ status: 'completed', winner_id: winnerId })
    .eq('id', match.id)
    .neq('status', 'completed')
    .select('id')
  if (error) throw error
  // Only credit the winner if this call actually performed the transition
  // (guards against double-finalize when both players save concurrently).
  if (data && data.length > 0 && winnerId) {
    await supabase.rpc('award_match_win', { winner: winnerId })
  }
}

export async function saveMatchResult(match, userId, score, solved) {
  const isChallenger = match.challenger_id === userId
  const scoreCol = isChallenger ? 'challenger_score'  : 'opponent_score'
  const fields   = isChallenger
    ? { challenger_score: score, challenger_solved: solved }
    : { opponent_score: score, opponent_solved: solved }

  const { data: updated, error } = await supabase
    .from('matches')
    .update(fields)
    .eq('id', match.id)
    .eq('status', 'accepted')
    .is(scoreCol, null)
    .select(SELECT_FULL)
    .maybeSingle()
  if (error) throw error
  if (!updated) {
    // Either the match isn't accepted anymore or this player already saved.
    // Treat as a no-op rather than corrupting state or double-finalizing.
    return null
  }

  const bothPlayed =
    updated.challenger_score !== null && updated.challenger_score !== undefined &&
    updated.opponent_score   !== null && updated.opponent_score   !== undefined

  if (bothPlayed) await finalizeMatch(updated)
  return updated
}

// Lazy expiration: when the user opens the Match screen we tidy up any of
// their own active matches that have run past expires_at.
export async function finalizeExpiredMatches(userId) {
  const nowIso = new Date().toISOString()
  const { data: expired } = await supabase
    .from('matches')
    .select(SELECT_FULL)
    .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
    .in('status', ACTIVE_STATES)
    .lt('expires_at', nowIso)

  for (const m of (expired || [])) {
    if (m.status === 'pending') {
      // Never accepted — no winner.
      await supabase.from('matches')
        .update({ status: 'expired' })
        .eq('id', m.id)
    } else {
      await finalizeMatch(m)
    }
  }
}
