import { useState, useEffect, useCallback } from 'react'
import {
  searchProfiles, listMatches, createMatch, respondToMatch, finalizeExpiredMatches,
} from '../lib/matches'

function timeLeftLabel(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'expirado'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function MatchScreen({ auth, theme, onBack, onPlayMatch }) {
  const isDark = theme === 'dark'
  const userId = auth.user.id

  const [matches, setMatches] = useState([])
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState(null)
  const [info, setInfo]       = useState(null)

  // Theme tokens
  const bg         = isDark ? '#12121e' : '#f7f7f2'
  const cardBg     = isDark ? '#1a1a2e' : '#ffffff'
  const cardBorder = isDark ? '#2e2e42' : '#e5e7eb'
  const textColor  = isDark ? '#e8e8f0' : '#1a1a2e'
  const dimColor   = isDark ? '#5a5a78' : '#9ca3af'
  const subtle     = isDark ? '#888888' : '#6b7280'

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      await finalizeExpiredMatches(userId)
      const list = await listMatches(userId)
      setMatches(list)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  // Debounced search
  useEffect(() => {
    if (!query || query.trim().length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      try { setResults(await searchProfiles(query, userId)) }
      catch { setResults([]) }
    }, 250)
    return () => clearTimeout(t)
  }, [query, userId])

  const flash = (msg, isErr = false) => {
    if (isErr) { setError(msg); setInfo(null) } else { setInfo(msg); setError(null) }
    setTimeout(() => { setError(null); setInfo(null) }, 2800)
  }

  const challenge = async (opponent) => {
    if (busy) return
    setBusy(true)
    try {
      await createMatch(userId, opponent.id)
      flash(`Reto enviado a ${opponent.username}`)
      setQuery(''); setResults([])
      await refresh()
    } catch (e) {
      flash(e.message || String(e), true)
    } finally {
      setBusy(false)
    }
  }

  const respond = async (match, accept) => {
    if (busy) return
    setBusy(true)
    try {
      await respondToMatch(match.id, accept, userId)
      await refresh()
    } catch (e) {
      flash(e.message || String(e), true)
    } finally {
      setBusy(false)
    }
  }

  // Bucket matches
  const received     = []
  const sent         = []
  const playable     = []
  const waitingMine  = [] // I played, opponent hasn't
  const completed    = []

  for (const m of matches) {
    const iAmChallenger = m.challenger_id === userId
    const myScore       = iAmChallenger ? m.challenger_score : m.opponent_score
    const oppScore      = iAmChallenger ? m.opponent_score   : m.challenger_score
    const myPlayed      = myScore !== null && myScore !== undefined
    const oppPlayed     = oppScore !== null && oppScore !== undefined

    if (m.status === 'pending') {
      if (iAmChallenger) sent.push(m)
      else received.push(m)
    } else if (m.status === 'accepted') {
      if (!myPlayed) playable.push(m)
      else if (!oppPlayed) waitingMine.push(m)
    } else if (m.status === 'completed' || m.status === 'expired' || m.status === 'rejected') {
      completed.push(m)
    }
  }

  const Section = ({ title, count, children }) => (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: dimColor,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {title}
        {count !== undefined && (
          <span style={{
            background: isDark ? '#2a2a3c' : '#e5e7eb', color: subtle,
            padding: '1px 7px', borderRadius: 999, fontSize: 10,
          }}>{count}</span>
        )}
      </div>
      {children}
    </div>
  )

  const Card = ({ children, ...rest }) => (
    <div style={{
      background: cardBg,
      border: `1px solid ${cardBorder}`,
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      ...rest.style,
    }}>{children}</div>
  )

  const SmallButton = ({ label, onClick, primary = false, danger = false, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '7px 12px',
        background: danger ? 'transparent' : (primary ? '#4ade80' : 'transparent'),
        color: primary ? '#12121e' : (danger ? '#f87171' : textColor),
        border: primary ? 'none' : `1px solid ${danger ? '#f87171' : cardBorder}`,
        borderRadius: 6, fontSize: 11, fontWeight: 700,
        fontFamily: "'Outfit', sans-serif",
        letterSpacing: '0.06em', textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >{label}</button>
  )

  const otherOf = (m) => m.challenger_id === userId ? m.opponent : m.challenger
  const oppNameOf = (m) => otherOf(m)?.username || '…'

  return (
    <div style={{
      minHeight: '100vh', background: bg, color: textColor,
      fontFamily: "'Outfit', sans-serif",
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '20px 16px 40px',
    }}>
      {/* Header */}
      <div style={{
        width: '100%', maxWidth: 460,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 18,
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: dimColor, fontSize: 12, fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            fontFamily: "'Outfit', sans-serif",
          }}
        >← Volver</button>
        <div style={{
          fontSize: 16, fontWeight: 800, letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}>Match</div>
        <div style={{ width: 60 }} />
      </div>

      {/* Toast */}
      {(error || info) && (
        <div style={{
          width: '100%', maxWidth: 460, marginBottom: 12,
          padding: '10px 14px',
          background: error ? (isDark ? '#3b1c1c' : '#fee2e2') : (isDark ? '#1a2e1a' : '#dcfce7'),
          color: error ? '#f87171' : '#16a34a',
          border: `1px solid ${error ? '#7f1d1d' : '#166534'}`,
          borderRadius: 8, fontSize: 12, letterSpacing: '0.04em',
        }}>{error || info}</div>
      )}

      {/* Search */}
      <div style={{ width: '100%', maxWidth: 460, marginBottom: 24 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar jugador por nombre…"
          style={{
            width: '100%', padding: '12px 14px',
            background: cardBg, color: textColor,
            border: `1px solid ${cardBorder}`,
            borderRadius: 8, fontSize: 13,
            fontFamily: "'Outfit', sans-serif",
            outline: 'none',
          }}
        />
        {results.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {results.map(p => (
              <Card key={p.id}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{p.username}</span>
                <SmallButton label="Retar" primary onClick={() => challenge(p)} disabled={busy} />
              </Card>
            ))}
          </div>
        )}
      </div>

      <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {loading && <div style={{ color: dimColor, fontSize: 12, textAlign: 'center' }}>Cargando…</div>}

        {!loading && received.length > 0 && (
          <Section title="Recibidos" count={received.length}>
            {received.map(m => (
              <Card key={m.id}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{oppNameOf(m)}</span>
                  <span style={{ fontSize: 10, color: subtle, letterSpacing: '0.04em' }}>
                    Expira en {timeLeftLabel(m.expires_at)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <SmallButton label="Aceptar" primary onClick={() => respond(m, true)}  disabled={busy} />
                  <SmallButton label="Rechazar" danger onClick={() => respond(m, false)} disabled={busy} />
                </div>
              </Card>
            ))}
          </Section>
        )}

        {!loading && playable.length > 0 && (
          <Section title="Listos para jugar" count={playable.length}>
            {playable.map(m => (
              <Card key={m.id} style={{ cursor: 'pointer' }}>
                <div onClick={() => onPlayMatch(m)} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, cursor: 'pointer' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>vs {oppNameOf(m)}</span>
                  <span style={{ fontSize: 10, color: subtle, letterSpacing: '0.04em' }}>
                    Expira en {timeLeftLabel(m.expires_at)}
                  </span>
                </div>
                <SmallButton label="Jugar" primary onClick={() => onPlayMatch(m)} />
              </Card>
            ))}
          </Section>
        )}

        {!loading && (sent.length > 0 || waitingMine.length > 0) && (
          <Section title="Esperando">
            {sent.map(m => (
              <Card key={m.id}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{oppNameOf(m)}</span>
                  <span style={{ fontSize: 10, color: subtle, letterSpacing: '0.04em' }}>
                    Pendiente de aceptar · {timeLeftLabel(m.expires_at)}
                  </span>
                </div>
                <span style={{ fontSize: 10, color: subtle, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Enviado</span>
              </Card>
            ))}
            {waitingMine.map(m => (
              <Card key={m.id}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>vs {oppNameOf(m)}</span>
                  <span style={{ fontSize: 10, color: subtle, letterSpacing: '0.04em' }}>
                    Esperando rival · {timeLeftLabel(m.expires_at)}
                  </span>
                </div>
                <span style={{ fontSize: 10, color: subtle, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Tu turno hecho</span>
              </Card>
            ))}
          </Section>
        )}

        {!loading && completed.length > 0 && (
          <Section title="Resultados">
            {completed.map(m => {
              const iAmChallenger = m.challenger_id === userId
              const myScore  = iAmChallenger ? m.challenger_score : m.opponent_score
              const oppScore = iAmChallenger ? m.opponent_score   : m.challenger_score
              const youWon   = m.winner_id === userId
              const isDraw   = m.status === 'completed' && !m.winner_id
              const verdict  = m.status === 'rejected' ? 'Rechazado'
                            : m.status === 'expired'  ? 'Expirado'
                            : youWon                  ? 'Victoria'
                            : isDraw                  ? 'Empate'
                            :                           'Derrota'
              const verdictColor = m.status === 'rejected' || m.status === 'expired'
                ? subtle
                : youWon ? '#4ade80' : isDraw ? subtle : '#f87171'
              return (
                <Card key={m.id}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>vs {oppNameOf(m)}</span>
                    <span style={{ fontSize: 10, color: subtle, letterSpacing: '0.04em' }}>
                      Palabra: {m.word}
                      {(myScore !== null || oppScore !== null) && ` · ${myScore ?? '—'} vs ${oppScore ?? '—'}`}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: verdictColor,
                  }}>{verdict}</span>
                </Card>
              )
            })}
          </Section>
        )}

        {!loading && matches.length === 0 && (
          <div style={{ color: dimColor, fontSize: 12, textAlign: 'center', marginTop: 12 }}>
            Aún no tienes retos. Busca a un jugador para empezar.
          </div>
        )}
      </div>
    </div>
  )
}
