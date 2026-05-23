import { supabase } from './supabase'
import { getRandomWord } from './gameLogic'
import { throwIfSupabaseError } from './supabaseHelpers'

const ACTIVE_STATES = ['pending', 'accepted']
const MATCH_DURATION_MS = 24 * 60 * 60 * 1000

export const MAX_ACTIVE_RECEIVED = 3

const SELECT_FULL = `
  *,
  challenger:profiles!matches_challenger_id_fkey(id, username),
  opponent:profiles!matches_opponent_id_fkey(id, username)
`

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
  const activeCountResult = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('opponent_id', opponentId)
    .in('status', ACTIVE_STATES)
  throwIfSupabaseError(activeCountResult)
  if ((activeCountResult.count || 0) >= MAX_ACTIVE_RECEIVED) {
    throw new Error('El oponente tiene muchos retos activos')
  }

  // Already an active match between these two players (in either direction)?
  const orFilter = `and(challenger_id.eq.${challengerId},opponent_id.eq.${opponentId}),and(challenger_id.eq.${opponentId},opponent_id.eq.${challengerId})`
  const existingResult = await supabase
    .from('matches')
    .select('id')
    .or(orFilter)
    .in('status', ACTIVE_STATES)
    .limit(1)
  throwIfSupabaseError(existingResult)
  if (existingResult.data && existingResult.data.length > 0) {
    throw new Error('Ya tienes un reto activo con este jugador.')
  }

  const expiresAt = new Date(Date.now() + MATCH_DURATION_MS).toISOString()
  const { data, error } = await supabase
    .from('matches')
    .insert({
      challenger_id: challengerId,
      opponent_id: opponentId,
      word: getRandomWord(),
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

// Save the calling player's score and (if both have played) finalise the match.
// Winner logic and match_wins crediting all happen atomically server-side.
export async function saveMatchResult(match, _userId, score, solved) {
  const { data, error } = await supabase.rpc('save_match_result', {
    p_match_id: match.id,
    p_score:    score,
    p_solved:   solved,
  })
  if (error) throw error
  return data   // null means no-op (already saved or match not accepted)
}

// Lazy expiration: called when the Match screen mounts.
// Expired pending/accepted matches are tidied up server-side.
export async function finalizeExpiredMatches(userId) {
  // errors are non-fatal — swallow silently so the rest of the screen loads
  await supabase.rpc('process_expired_matches', { p_user_id: userId })
}
