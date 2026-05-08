import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { countPendingReceived } from '../lib/matches'

export function HomeScreen({ auth, theme, onPlay, onOpenMatches }) {
  const isDark = theme === 'dark'
  const [stats, setStats] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)

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

  const bg        = isDark ? '#12121e' : '#f7f7f2'
  const cardBg    = isDark ? '#1a1a2e' : '#ffffff'
  const cardBorder= isDark ? '#2e2e42' : '#e5e7eb'
  const textColor = isDark ? '#e8e8f0' : '#1a1a2e'
  const dimColor  = isDark ? '#5a5a78' : '#9ca3af'

  const statCards = [
    { label: 'Partidas jugadas', value: stats?.total_games    ?? '—' },
    { label: 'Partidas ganadas', value: stats?.total_wins     ?? '—' },
    { label: 'Mejor puntuación', value: stats?.best_score     ?? '—' },
    { label: 'Racha actual',     value: stats?.current_streak ?? '—' },
    { label: 'Match ganados',    value: stats?.match_wins     ?? '—' },
  ]

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

      {/* Stats grid */}
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
