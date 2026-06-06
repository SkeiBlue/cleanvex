import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { ModuleItem, User } from '../types'
import { identifyUser, initAnalytics, resetAnalytics, trackEvent } from '../analytics'
import { parseApiError } from '../hooks/useApiError'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

type AuthCtx = {
  user: User | null
  accessToken: string | null
  modules: ModuleItem[]
  unreadNotifications: number
  isLoading: boolean
  authedFetch: (path: string, init?: RequestInit) => Promise<Response>
  login: (email: string, password: string) => Promise<string>
  register: (email: string, password: string, username?: string, inviteCode?: string) => Promise<string>
  verifyEmail: (token: string) => Promise<string>
  logout: () => Promise<void>
  refreshModules: () => Promise<void>
  setUnreadNotifications: (n: number) => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const authedFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    let res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' })
    if (res.status === 401) {
      const r = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      if (r.ok) {
        const d = await r.json()
        setAccessToken(d.accessToken)
        setUser(d.user)
        headers.set('Authorization', `Bearer ${d.accessToken}`)
        res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' })
      }
    }
    return res
  }, [accessToken])

  const refreshModules = useCallback(async () => {
    const r = await authedFetch('/modules')
    if (r.ok) setModules(await r.json())
  }, [authedFetch])

  useEffect(() => {
    initAnalytics()
    async function restore() {
      try {
        const tokenFromUrl = new URLSearchParams(window.location.search).get('verifyToken')
        if (tokenFromUrl) window.history.replaceState({}, '', window.location.pathname)
        const r = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
        if (r.ok) {
          const d = await r.json()
          setAccessToken(d.accessToken)
          setUser(d.user)
          identifyUser(d.user.id)
          trackEvent('session_restored')
        }
      } finally {
        setIsLoading(false)
      }
    }
    restore()
  }, [])

  useEffect(() => {
    if (!accessToken) return
    authedFetch('/modules').then(async r => { if (r.ok) setModules(await r.json()) })
    authedFetch('/agenda/dashboard').then(async r => {
      if (r.ok) { const d = await r.json(); setUnreadNotifications(d.unreadNotifications ?? 0) }
    })
  }, [accessToken, authedFetch])

  async function login(email: string, password: string): Promise<string> {
    const r = await fetch(`${API_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ email, password }),
    })
    if (!r.ok) return parseApiError(r, 'Connexion refusée.')
    const d = await r.json()
    setAccessToken(d.accessToken)
    setUser(d.user)
    identifyUser(d.user.id)
    trackEvent('login_success')
    return ''
  }

  async function register(email: string, password: string, username?: string, inviteCode?: string): Promise<string> {
    const r = await fetch(`${API_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ email, password, username, inviteCode }),
    })
    if (!r.ok) return parseApiError(r, 'Inscription refusée.')
    trackEvent('signup_created')
    return 'Compte cree. Verifie email avant connexion.'
  }

  async function verifyEmail(token: string): Promise<string> {
    const r = await fetch(`${API_URL}/auth/verify-email`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ token }),
    })
    if (!r.ok) return parseApiError(r, 'Vérification email refusée.')
    trackEvent('email_verified')
    return 'Email verifie. Connexion disponible.'
  }

  async function logout() {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' })
    trackEvent('logout')
    resetAnalytics()
    setAccessToken(null)
    setUser(null)
    setModules([])
    setUnreadNotifications(0)
  }

  return (
    <Ctx.Provider value={{
      user, accessToken, modules, unreadNotifications, isLoading,
      authedFetch, login, register, verifyEmail, logout, refreshModules, setUnreadNotifications,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
