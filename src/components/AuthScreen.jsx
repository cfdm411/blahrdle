import { useState } from 'react'

export function AuthScreen({ theme, onSignIn, onSignUp, onGuest }) {
  const isDark = theme === 'dark'
  const [mode, setMode]       = useState('login')
  const [identity, setIdent]  = useState('')  // login: email-or-username; register: email
  const [username, setUser]   = useState('')  // register only
  const [password, setPass]   = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError]     = useState(null)
  const [busy, setBusy]       = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    if (mode === 'register') {
      if (username.includes('@')) {
        setError('Username cannot contain @')
        return
      }
      if (password !== confirm) {
        setError('Passwords do not match')
        return
      }
    }
    setError(null); setBusy(true)
    const { error } = mode === 'login'
      ? await onSignIn(identity.trim(), password)
      : await onSignUp(identity.trim(), username.trim(), password)
    setBusy(false)
    if (error) setError(error.message || String(error))
  }

  const switchMode = () => {
    setMode(m => m === 'login' ? 'register' : 'login')
    setError(null)
    setIdent(''); setUser(''); setPass(''); setConfirm('')
  }

  const inputStyle = {
    padding: '12px 14px',
    background: isDark ? '#1e1e2e' : '#ffffff',
    color: isDark ? '#e8e8f0' : '#1a1a2e',
    border: `1px solid ${isDark ? '#2e2e42' : '#d1d5db'}`,
    borderRadius: 8,
    fontFamily: "'Outfit', sans-serif",
    fontSize: 14,
    outline: 'none',
    width: '100%',
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isDark ? '#12121e' : '#f7f7f2',
      color: isDark ? '#e8e8f0' : '#1a1a2e',
      padding: 24,
    }}>
      <form onSubmit={submit} style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          fontSize: 32, fontWeight: 900, letterSpacing: '0.24em',
          textAlign: 'center', marginBottom: 16, textTransform: 'uppercase',
        }}>
          LORDLE
        </div>

        {mode === 'register' && (
          <input
            value={identity}
            onChange={e => setIdent(e.target.value)}
            placeholder="Email"
            aria-label="Email"
            type="email"
            autoComplete="email"
            required
            style={inputStyle}
          />
        )}
        <input
          value={mode === 'login' ? identity : username}
          onChange={e => mode === 'login' ? setIdent(e.target.value) : setUser(e.target.value)}
          placeholder={mode === 'login' ? 'Email or username' : 'Username'}
          aria-label={mode === 'login' ? 'Email or username' : 'Username'}
          autoComplete="username"
          required minLength={mode === 'login' ? 1 : 3} maxLength={mode === 'login' ? 254 : 20}
          style={inputStyle}
        />
        {mode === 'login' && (
          <div style={{ fontSize: 11, color: isDark ? '#7a7a98' : '#6b7280', marginTop: -6 }}>
            You can log in with your email or your username
          </div>
        )}
        <input
          value={password}
          onChange={e => setPass(e.target.value)}
          type="password"
          placeholder="Password"
          aria-label="Password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          required minLength={6}
          style={inputStyle}
        />
        {mode === 'register' && (
          <input
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            type="password"
            placeholder="Confirm password"
            aria-label="Confirm password"
            autoComplete="new-password"
            required minLength={6}
            style={inputStyle}
          />
        )}

        {error && (
          <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            padding: '12px',
            background: '#4ade80',
            color: '#12121e',
            border: 'none', borderRadius: 8,
            fontFamily: "'Outfit', sans-serif",
            fontSize: 13, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.7 : 1,
            marginTop: 4,
          }}
        >
          {busy ? '…' : (mode === 'login' ? 'Log in' : 'Register')}
        </button>

        <button
          type="button"
          onClick={switchMode}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: isDark ? '#8a8aa6' : '#6b7280', fontSize: 12,
            fontFamily: "'Outfit', sans-serif", marginTop: 4,
          }}
        >
          {mode === 'login'
            ? "Don't have an account? Register"
            : 'Already have an account? Log in'}
        </button>

        <div style={{
          height: 1, background: isDark ? '#1e1e2e' : '#e5e7eb', margin: '8px 0',
        }} />

        <button
          type="button"
          onClick={onGuest}
          style={{
            background: 'transparent', cursor: 'pointer',
            color: isDark ? '#7a7a98' : '#6b7280', fontSize: 12,
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '0.06em',
            border: `1px solid ${isDark ? '#444444' : '#cccccc'}`,
            borderRadius: 8,
            padding: '10px 0',
          }}
        >
          Jugar como invitado
        </button>
      </form>
    </div>
  )
}
