import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Supabase auth requires email — synthesize one from the username.
const fakeEmail = (username) => `${username.toLowerCase()}@lordle.local`

export function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Hydrate session + subscribe to auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Fetch the profile row whenever the user changes
  useEffect(() => {
    if (!user) { setProfile(null); return }
    let cancelled = false
    supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setProfile(data) })
    return () => { cancelled = true }
  }, [user])

  const signIn = useCallback(async (usernameOrEmail, password) => {
    let authEmail
    if (usernameOrEmail.includes('@')) {
      const { data, error: lookupErr } = await supabase
        .from('profiles')
        .select('username')
        .eq('email', usernameOrEmail.trim().toLowerCase())
        .maybeSingle()
      if (lookupErr) return { error: lookupErr }
      if (!data) return { error: { message: 'No account found for that email.' } }
      authEmail = fakeEmail(data.username)
    } else {
      authEmail = fakeEmail(usernameOrEmail.trim())
    }
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password })
    return { error }
  }, [])

  const signUp = useCallback(async (email, username, password) => {
    const cleanUsername = username.trim()
    const cleanEmail = email.trim().toLowerCase()
    if (cleanUsername.includes('@')) {
      return { error: { message: 'Username cannot contain @' } }
    }
    const authEmail = fakeEmail(cleanUsername)
    const { data, error } = await supabase.auth.signUp({ email: authEmail, password })
    if (error) return { error }
    if (data.user) {
      const { error: pErr } = await supabase.from('profiles').insert({
        id: data.user.id, username: cleanUsername, email: cleanEmail,
      })
      if (pErr) {
        if (pErr.code === '23505' && /email/i.test(pErr.message || '')) {
          return { error: { message: 'An account with this email already exists' } }
        }
        return { error: pErr }
      }
    }
    return { error: null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return { user, profile, loading, signIn, signUp, signOut }
}
