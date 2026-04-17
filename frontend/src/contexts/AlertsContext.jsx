import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { fetchAlerts } from '../api'

const AlertsContext = createContext(null)

export function AlertsProvider({ children }) {
  const { user } = useAuth()
  const [alerts, setAlerts] = useState([])

  const loadAlerts = useCallback(async () => {
    // ✅ FIX: guard against unauthenticated calls — user is guaranteed to exist
    // here because AlertsProvider is only mounted inside AppRouter when user
    // is truthy, but defensive check prevents future regressions.
    if (!user) {
      setAlerts([])
      return
    }
    try {
      const res = await fetchAlerts(20)
      // ✅ FIX: backend returns { alerts: [...], total, limit, skip }
      // safely fall back to empty array if shape is unexpected
      setAlerts(Array.isArray(res?.alerts) ? res.alerts : [])
    } catch (err) {
      // ✅ FIX: don't re-throw — polling failures are non-fatal.
      // Swallow silently so a temporary backend hiccup doesn't crash the tree.
      console.warn('[AlertsContext] fetch failed:', err?.response?.status ?? err?.message)
    }
  }, [user])

  useEffect(() => {
    // Load immediately on mount (user is guaranteed truthy here)
    loadAlerts()

    // Poll every 30 s for new alerts
    const interval = setInterval(loadAlerts, 30_000)
    return () => clearInterval(interval)
  }, [loadAlerts])

  return (
    <AlertsContext.Provider value={{ alerts, refresh: loadAlerts }}>
      {children}
    </AlertsContext.Provider>
  )
}

export const useAlerts = () => {
  const ctx = useContext(AlertsContext)
  if (!ctx) throw new Error('useAlerts must be used inside AlertsProvider')
  return ctx
}