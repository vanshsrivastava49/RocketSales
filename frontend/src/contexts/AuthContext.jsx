import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI } from '../api'

const AuthContext = createContext(null)

const TOKEN_KEY = 'priceiq_token'  // must match api.js

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // Bootstrap: validate stored token once on mount only.
  // token is intentionally NOT in React state — api.js reads from localStorage
  // directly, so mirroring it here would cause redundant /auth/me calls.
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    const token  = stored && stored !== 'null' && stored !== 'undefined' ? stored : null

    if (!token) {
      setLoading(false)
      return
    }

    authAPI.me()
      .then((u) => setUser(u))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false))
  }, [])  // empty array — runs once on mount

  const login = useCallback(async (email, password) => {
    const res = await authAPI.login(email, password)
    localStorage.setItem(TOKEN_KEY, res.access_token)
    setUser(res.user)
    return res.user
  }, [])

  const signup = useCallback(async (data) => {
    const res = await authAPI.signup(data)
    localStorage.setItem(TOKEN_KEY, res.access_token)
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  const updateProfile = useCallback(async (data) => {
    const updated = await authAPI.updateProfile(data)
    setUser(updated)
    return updated
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}