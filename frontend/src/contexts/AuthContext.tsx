import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ModuleItem, User } from '../types'
import { identifyUser, initAnalytics, resetAnalytics, trackEvent } from '../analytics'
import { parseApiError } from '../hooks/useApiError'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

type AuthCtx = {
  user: User | null
  accessToken: string | null
  modules: ModuleItem[]
  moduleBadges: Record<string, number>
  unreadNotifications: number
  isLoading: boolean
  verifyMessage: string | null
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
  const [user, setUser]               = useState<User | null>(null)
  const [modules, setModules]         = useState<ModuleItem[]>([])
  const [moduleBadges, setModuleBadges] = useState<Record<string, number>>({})
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [isLoading, setIsLoading]     = useState(true)
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null)

  // Le refresh token est à usage unique (tourné à chaque appel côté backend).
  // Si plusieurs requêtes échouent en 401 en même temps, il ne faut déclencher
  // qu'UN SEUL `/auth/refresh` : la première rotation invaliderait le cookie
  // pour les suivantes, ce qui provoquerait une déconnexion intempestive.
  const refreshInFlight = useRef<Promise<string | null> | null>(null)

  const refreshAccessToken = useCallback((): Promise<string | null> => {
    if (!refreshInFlight.current) {
      refreshInFlight.current = (async () => {
        try {
          const r = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
          if (!r.ok) return null
          const d = await r.json()
          setAccessToken(d.accessToken)
          setUser(d.user)
          return d.accessToken as string
        } catch {
          return null
        } finally {
          refreshInFlight.current = null
        }
      })()
    }
    return refreshInFlight.current
  }, [])

  const authedFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    let res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' })
    if (res.status === 401) {
      const newToken = await refreshAccessToken()
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`)
        res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' })
      }
    }
    return res
  }, [accessToken, refreshAccessToken])

  const refreshModules = useCallback(async () => {
    const [r, b] = await Promise.all([
      authedFetch('/modules/me'),
      authedFetch('/modules/badges'),
    ])
    if (r.ok) setModules(await r.json())
    if (b.ok) setModuleBadges(await b.json())
  }, [authedFetch])

  useEffect(() => {
    initAnalytics()
    async function restore() {
      try {
        const tokenFromUrl = new URLSearchParams(window.location.search).get('verifyToken')
        if (tokenFromUrl) {
          // Nettoie l'URL d'abord (évite de re-vérifier au refresh / de laisser le token traîner)
          window.history.replaceState({}, '', window.location.pathname)
          // Le lien email pointe ici : on vérifie réellement le token au lieu de l'ignorer.
          setVerifyMessage(await verifyEmail(tokenFromUrl))
        }
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
    authedFetch('/modules/me').then(async r => { if (r.ok) setModules(await r.json()) })
    authedFetch('/modules/badges').then(async r => { if (r.ok) setModuleBadges(await r.json()) })
    authedFetch('/agenda/dashboard').then(async r => {
      if (r.ok) { const d = await r.json(); setUnreadNotifications(d.unreadNotifications ?? 0) }
    })
  }, [accessToken, authedFetch])

  async function login(email: string, password: string): Promise<string> {
    let r: Response
    try {
      r = await fetch(`${API_URL}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ email, password }),
      })
    } catch {
      return 'Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.'
    }
    if (!r.ok) return parseApiError(r, 'Connexion refusée.')
    const d = await r.json()
    setAccessToken(d.accessToken)
    setUser(d.user)
    identifyUser(d.user.id)
    trackEvent('login_success')
    return ''
  }

  async function register(email: string, password: string, username?: string, inviteCode?: string): Promise<string> {
    let r: Response
    try {
      r = await fetch(`${API_URL}/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ email, password, username, inviteCode }),
      })
    } catch {
      return 'Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.'
    }
    if (!r.ok) return parseApiError(r, 'Inscription refusée.')
    trackEvent('signup_created')
    return 'Compte créé. Vérifiez votre email avant de vous connecter.'
  }

  async function verifyEmail(token: string): Promise<string> {
    let r: Response
    try {
      r = await fetch(`${API_URL}/auth/verify-email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ token }),
      })
    } catch {
      return 'Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.'
    }
    if (!r.ok) return parseApiError(r, 'Vérification email refusée.')
    trackEvent('email_verified')
    return 'Email vérifié. Connexion disponible.'
  }

  async function logout() {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' })
    trackEvent('logout')
    resetAnalytics()
    setAccessToken(null)
    setUser(null)
    setModules([])
    setModuleBadges({})
    setUnreadNotifications(0)
  }

  return (
    <Ctx.Provider value={{
      user, accessToken, modules, moduleBadges, unreadNotifications, isLoading, verifyMessage,
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
