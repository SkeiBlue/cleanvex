import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ModuleItem, User } from '../types'
import { identifyUser, initAnalytics, resetAnalytics, trackEvent } from '../analytics'
import { parseApiError } from '../hooks/useApiError'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

const USER_HINT_KEY = 'auth-user-hint'

function readUserHint(): User | null {
  try {
    const raw = sessionStorage.getItem(USER_HINT_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}
function saveUserHint(user: User) {
  try { sessionStorage.setItem(USER_HINT_KEY, JSON.stringify(user)) } catch { /* ignore */ }
}
function clearUserHint() {
  try { sessionStorage.removeItem(USER_HINT_KEY) } catch { /* ignore */ }
}

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
  // Optimistic auth: utilise le hint sessionStorage pour afficher l'app immédiatement
  const hint = readUserHint()
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [user, setUser]               = useState<User | null>(hint)
  const [modules, setModules]         = useState<ModuleItem[]>([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  // Si on a un hint, on n'affiche pas l'écran de chargement — l'app s'affiche direct
  const [isLoading, setIsLoading]     = useState(!hint)
  const refreshingRef = useRef(false)

  // accessToken ref pour authedFetch qui ne se re-crée pas à chaque changement de token
  const accessTokenRef = useRef<string | null>(null)
  accessTokenRef.current = accessToken

  const authedFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    const token = accessTokenRef.current
    if (token) headers.set('Authorization', `Bearer ${token}`)
    let res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' })
    if (res.status === 401) {
      // Token expiré — on tente un refresh silencieux
      const r = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      if (r.ok) {
        const d = await r.json()
        setAccessToken(d.accessToken)
        setUser(d.user)
        saveUserHint(d.user)
        accessTokenRef.current = d.accessToken
        headers.set('Authorization', `Bearer ${d.accessToken}`)
        res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' })
      } else {
        // Refresh échoué → session expirée
        clearUserHint()
        setUser(null)
        setAccessToken(null)
        setModules([])
      }
    }
    return res
  }, []) // stable — utilise accessTokenRef

  const refreshModules = useCallback(async () => {
    const r = await authedFetch('/modules')
    if (r.ok) setModules(await r.json())
  }, [authedFetch])

  useEffect(() => {
    initAnalytics()
    if (refreshingRef.current) return
    refreshingRef.current = true

    async function restore() {
      try {
        const tokenFromUrl = new URLSearchParams(window.location.search).get('verifyToken')
        if (tokenFromUrl) window.history.replaceState({}, '', window.location.pathname)

        const r = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
        if (r.ok) {
          const d = await r.json()
          setAccessToken(d.accessToken)
          setUser(d.user)
          saveUserHint(d.user)
          identifyUser(d.user.id)
          trackEvent('session_restored')
        } else {
          // Cookie de refresh invalide → déconnexion propre
          clearUserHint()
          setUser(null)
          setAccessToken(null)
        }
      } catch {
        // Serveur inaccessible — on garde le hint (offline graceful)
      } finally {
        setIsLoading(false)
      }
    }

    restore()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Chargement des modules + notifs dès qu'on a un token
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
    saveUserHint(d.user)
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
    return 'Compte créé. Vérifiez votre email avant de vous connecter.'
  }

  async function verifyEmail(token: string): Promise<string> {
    const r = await fetch(`${API_URL}/auth/verify-email`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ token }),
    })
    if (!r.ok) return parseApiError(r, 'Vérification email refusée.')
    trackEvent('email_verified')
    return 'Email vérifié. Connexion disponible.'
  }

  async function logout() {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' })
    trackEvent('logout')
    resetAnalytics()
    clearUserHint()
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
