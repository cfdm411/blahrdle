import { useEffect, useRef } from 'react'

const LORDLE = 'lordle'

function entry({ screen, isGuest, inMatchGame }) {
  return { [LORDLE]: true, screen, isGuest: !!isGuest, inMatchGame: !!inMatchGame }
}

function isForward(prev, next) {
  if (!prev.isGuest && next.isGuest) return true
  if (prev.isGuest || next.isGuest) return false
  if (prev.screen === 'home' && next.screen === 'match') return true
  if (prev.screen === 'home' && next.screen === 'game') return true
  if (prev.screen === 'match' && next.screen === 'game') return true
  return false
}

function isBackward(prev, next) {
  if (prev.isGuest && !next.isGuest) return true
  if (prev.isGuest || next.isGuest) return false
  if (prev.screen === 'game' && next.screen === 'match') return true
  if (prev.screen === 'game' && next.screen === 'home') return true
  if (prev.screen === 'match' && next.screen === 'home') return true
  return false
}

export function useBrowserHistory({
  enabled,
  screen,
  isGuest,
  currentMatch,
  setScreen,
  setCurrentMatch,
  setIsGuest,
}) {
  const navRef = useRef({ screen, isGuest, hasMatch: !!currentMatch })
  const prevRef = useRef({ screen, isGuest, hasMatch: !!currentMatch })
  const isPopStateRef = useRef(false)
  const syncingHistoryRef = useRef(false)
  const trackingRef = useRef(false)

  navRef.current = { screen, isGuest, hasMatch: !!currentMatch }

  useEffect(() => {
    if (!enabled) {
      trackingRef.current = false
      return
    }

    const onPopState = (e) => {
      if (syncingHistoryRef.current) {
        syncingHistoryRef.current = false
        isPopStateRef.current = true
        return
      }

      isPopStateRef.current = true
      const { screen: curScreen, isGuest: curGuest, hasMatch } = navRef.current

      if (!e.state?.[LORDLE]) {
        if (curGuest) {
          setIsGuest(false)
          return
        }
        window.history.pushState(
          entry({ screen: curScreen, isGuest: false, inMatchGame: hasMatch && curScreen === 'game' }),
          '',
        )
        if (curScreen === 'home') return
      }

      if (curGuest) {
        setIsGuest(false)
        return
      }

      if (curScreen === 'game') {
        if (hasMatch) {
          setCurrentMatch(null)
          setScreen('match')
        } else {
          setCurrentMatch(null)
          setScreen('home')
        }
      } else if (curScreen === 'match') {
        setScreen('home')
      } else {
        window.history.pushState(entry({ screen: 'home', isGuest: false, inMatchGame: false }), '')
      }
    }

    if (!trackingRef.current) {
      trackingRef.current = true
      const seed = isGuest
        ? { screen: 'game', isGuest: true, hasMatch: false }
        : { screen: 'home', isGuest: false, hasMatch: false }
      prevRef.current = seed
      if (isGuest) {
        window.history.pushState(entry({ screen: 'game', isGuest: true, inMatchGame: false }), '')
      } else {
        window.history.replaceState(entry({ screen: 'home', isGuest: false, inMatchGame: false }), '')
      }
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [enabled, isGuest, setScreen, setCurrentMatch, setIsGuest])

  useEffect(() => {
    if (!enabled || !trackingRef.current) return

    const prev = prevRef.current
    const next = { screen, isGuest, hasMatch: !!currentMatch }

    if (isPopStateRef.current) {
      isPopStateRef.current = false
      prevRef.current = next
      return
    }

    if (isForward(prev, next)) {
      prevRef.current = next
      window.history.pushState(
        entry({ screen: isGuest ? 'game' : screen, isGuest, inMatchGame: !!currentMatch }),
        '',
      )
      return
    }

    if (isBackward(prev, next)) {
      prevRef.current = next
      syncingHistoryRef.current = true
      window.history.back()
      return
    }

    prevRef.current = next
  }, [enabled, screen, isGuest, currentMatch])
}
