import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { countPendingReceived } from '../lib/matches'

async function fetchMatchRanking() {
  const { data, error } = await supabase
    .from('player_summary')
    .select('user_id, match_wins, profiles ( username )')
    .order('match_wins', { ascending: false })
    .limit(20)

  if (error) throw error

  return (data || []).map((row, index) => ({
    rank: index + 1,
    user_id: row.user_id,
    username: row.profiles?.username || '…',
    match_wins: row.match_wins ?? 0,
  }))
}

export function HomeScreen({ auth, theme, onPlay, onOpenMatches }) {
  const isDark = theme === 'dark'
  const [tab, setTab] = useState('stats')
  const [stats, setStats] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [ranking, setRanking] = useState([])
  const [rankingLoading, setRankingLoading] = useState(false)
  const [rankingError, setRankingError] = useState(null)

  useEffect(() => {
    if (!auth.user) return
    supabase
      .from('player_summary')
      .select('total_games, total_wins, best_score, current_streak, match_wins')
      .eq('user_id', auth.user.id)
      .maybeSingle()
      .then(({ data }) => setStats(data || {}))
    countPendingReceived(auth.user.id).then(setPendingCount)
  }, [auth.user])

  useEffect(() => {
    if (tab !== 'ranking' || !auth.user) return

    let cancelled = false
    setRankingLoading(true)
    setRankingError(null)

    fetchMatchRanking()
      .then((rows) => { if (!cancelled) setRanking(rows) })
      .catch((e) => {
        if (!cancelled) {
          setRanking([])
          setRankingError(e.message || String(e))
        }
      })
      .finally(() => { if (!cancelled) setRankingLoading(false) })

    return () => { cancelled = true }
  }, [tab, auth.user])

  const bg        = isDark ? '#12121e' : '#f7f7f2'
  const cardBg    = isDark ? '#1a1a2e' : '#ffffff'
  const cardBorder= isDark ? '#2e2e42' : '#e5e7eb'
  const textColor = isDark ? '#e8e8f0' : '#1a1a2e'
  const dimColor  = isDark ? '#7a7a98' : '#6b7280'

  const statCards = [
    { label: 'Partidas jugadas', value: stats?.total_games    ?? '—' },
    { label: 'Partidas ganadas', value: stats?.total_wins     ?? '—' },
    { label: 'Mejor puntuación', value: stats?.best_score     ?? '—' },
    { label: 'Racha actual',     value: stats?.current_streak ?? '—' },
    { label: 'Match ganados',    value: stats?.match_wins     ?? '—' },
  ]

  const tabBtnStyle = (active) => ({
    flex: 1,
    padding: '10px 0',
    background: active ? '#4ade80' : 'transparent',
    color: active ? '#12121e' : textColor,
    border: active ? 'none' : `1.5px solid ${cardBorder}`,
    borderRadius: 10,
    fontFamily: "'Outfit', sans-serif",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  })

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: bg, color: textColor,
      padding: '32px 24px', gap: 28,
      fontFamily: "'Outfit', sans-serif",
    }}>
      {/* Logo */}
      <div style={{
        fontSize: 40, fontWeight: 900, letterSpacing: '0.24em',
        textTransform: 'uppercase', lineHeight: 1,
      }}>
        LORDLE
      </div>

      {/* Welcome */}
      <div style={{ textAlign: 'center', lineHeight: 1.4 }}>
        <div style={{ fontSize: 12, color: dimColor, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
          Bienvenido
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.04em' }}>
          {auth.profile?.username || '…'}
        </div>
      </div>

      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 340 }}>
        <button type="button" onClick={() => setTab('stats')} style={tabBtnStyle(tab === 'stats')}>
          Mis Stats
        </button>
        <button type="button" onClick={() => setTab('ranking')} style={tabBtnStyle(tab === 'ranking')}>
          Ranking
        </button>
      </div>

      {tab === 'stats' && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
          width: '100%', maxWidth: 340,
        }}>
          {statCards.map(({ label, value }) => (
            <div key={label} style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: 10,
              padding: '16px 12px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums', color: textColor,
              }}>
                {value}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 500, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: dimColor,
                textAlign: 'center', lineHeight: 1.4,
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'ranking' && (
        <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rankingLoading && (
            <div style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: 10,
              padding: '24px 12px',
              textAlign: 'center',
              fontSize: 12,
              color: dimColor,
              letterSpacing: '0.06em',
            }}>
              Cargando…
            </div>
          )}

          {!rankingLoading && rankingError && (
            <div style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: 10,
              padding: '24px 12px',
              textAlign: 'center',
              fontSize: 12,
              color: '#f87171',
              letterSpacing: '0.04em',
            }}>
              {rankingError}
            </div>
          )}

          {!rankingLoading && !rankingError && ranking.length === 0 && (
            <div style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: 10,
              padding: '24px 12px',
              textAlign: 'center',
              fontSize: 12,
              color: dimColor,
              letterSpacing: '0.04em',
            }}>
              Aún no hay datos de ranking.
            </div>
          )}

          {!rankingLoading && !rankingError && ranking.map((row) => {
            const isMe = row.user_id === auth.user.id
            return (
              <div
                key={row.user_id}
                style={{
                  background: isMe ? (isDark ? '#1e2e24' : '#ecfdf5') : cardBg,
                  border: `1px solid ${isMe ? '#4ade80' : cardBorder}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span style={{
                  width: 28,
                  fontSize: 14,
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  color: isMe ? '#4ade80' : dimColor,
                  textAlign: 'center',
                  flexShrink: 0,
                }}>
                  {row.rank}
                </span>
                <span style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: isMe ? 700 : 600,
                  letterSpacing: '0.02em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {row.username}
                </span>
                <span style={{
                  fontSize: 18,
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  color: textColor,
                  flexShrink: 0,
                }}>
                  {row.match_wins}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Action buttons row */}
      <div style={{
        display: 'flex', gap: 10,
        width: '100%', maxWidth: 340,
      }}>
        <button
          onClick={onPlay}
          style={{
            flex: 1,
            padding: '14px 0',
            background: '#4ade80', color: '#12121e',
            border: 'none', borderRadius: 10,
            fontFamily: "'Outfit', sans-serif",
            fontSize: 14, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Nueva Partida
        </button>
        <button
          onClick={onOpenMatches}
          style={{
            flex: 1,
            padding: '14px 0',
            background: 'transparent',
            color: textColor,
            border: `1.5px solid ${cardBorder}`,
            borderRadius: 10,
            fontFamily: "'Outfit', sans-serif",
            fontSize: 14, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          Match
          {pendingCount > 0 && (
            <span style={{
              position: 'absolute', top: -6, right: -6,
              background: '#f87171', color: '#12121e',
              fontSize: 10, fontWeight: 800,
              minWidth: 20, height: 20,
              padding: '0 6px',
              borderRadius: 999,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              letterSpacing: 0,
            }}>{pendingCount}</span>
          )}
        </button>
      </div>

      {/* Sign out */}
      <button
        onClick={auth.signOut}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: dimColor, fontSize: 11, fontFamily: "'Outfit', sans-serif",
          letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: -12,
        }}
      >
        Cerrar sesión
      </button>
    </div>
  )
}
