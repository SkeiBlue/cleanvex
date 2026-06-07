import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { Sidebar } from './components/Sidebar'
import { TopHeader } from './components/TopHeader'
import { LoginScreen } from './components/LoginScreen'
import { CommandPalette } from './components/CommandPalette'
import { ModuleGuard } from './components/ModuleGuard'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PageLoader } from './components/PageLoader'
import type { SearchResult } from './types'

/* ── Lazy loading des pages (code splitting par route) ── */
const DashboardPage  = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const VehiclesPage   = lazy(() => import('./pages/VehiclesPage').then(m => ({ default: m.VehiclesPage })))
const FinancesPage   = lazy(() => import('./pages/FinancesPage').then(m => ({ default: m.FinancesPage })))
const StockPage      = lazy(() => import('./pages/StockPage').then(m => ({ default: m.StockPage })))
const AgendaPage     = lazy(() => import('./pages/AgendaPage').then(m => ({ default: m.AgendaPage })))
const RealEstatePage = lazy(() => import('./pages/RealEstatePage').then(m => ({ default: m.RealEstatePage })))
const DocumentsPage  = lazy(() => import('./pages/DocumentsPage').then(m => ({ default: m.DocumentsPage })))
const ContactsPage   = lazy(() => import('./pages/ContactsPage').then(m => ({ default: m.ContactsPage })))
const SettingsPage   = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const ReportsPage    = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })))
const BackupsPage    = lazy(() => import('./pages/BackupsPage').then(m => ({ default: m.BackupsPage })))
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })))

type FormEv = { preventDefault(): void }

const RESULT_ROUTES: Record<string, string> = {
  vehicle: '/vehicles',
  contact: '/contacts',
  document: '/documents',
  property: '/real-estate',
  task: '/agenda',
  'stock_item': '/stock',
  transaction: '/finances',
}

function AppLayout() {
  const { user, modules, unreadNotifications, logout, authedFetch } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    localStorage.getItem('sidebar-collapsed') === 'true'
  )
  const [cmdOpen, setCmdOpen] = useState(false)

  function toggleCollapse() {
    setSidebarCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }
  const searchRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  /* Cmd+K / Ctrl+K listener */
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  async function handleSearch(event: FormEv) {
    event.preventDefault()
    const q = searchQuery.trim()
    if (!q) { setSearchResults([]); setSearchOpen(false); return }
    const r = await authedFetch(`/search?q=${encodeURIComponent(q)}`)
    if (r.ok) {
      const data = await r.json()
      setSearchResults(data.results ?? [])
      setSearchOpen(true)
    }
  }

  function handleResultClick(result: SearchResult) {
    setSearchOpen(false)
    setSearchQuery('')
    setSearchResults([])
    const route = RESULT_ROUTES[result.type] ?? '/'
    navigate(route)
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <a href="#main-content" className="skip-link">Aller au contenu</a>
      {/* Overlay mobile pour fermer la sidebar */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 199 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        user={user}
        modules={modules}
        sidebarOpen={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={toggleCollapse}
      />

      <main className="main">
        <TopHeader
          username={user.username}
          dateLabel={dateLabel}
          unreadNotifications={unreadNotifications}
          searchQuery={searchQuery}
          onSearchChange={(q) => { setSearchQuery(q); if (!q) { setSearchOpen(false); setSearchResults([]) } }}
          onSearch={handleSearch}
          onLogout={logout}
          onMenuToggle={() => setSidebarOpen(o => !o)}
          searchResults={searchResults}
          searchOpen={searchOpen}
          onSearchResultClick={handleResultClick}
          onSearchClose={() => setSearchOpen(false)}
          searchRef={searchRef}
          onCmdOpen={() => setCmdOpen(true)}
        />
        <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
        <div className="content" id="main-content">
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}

function AuthPage() {
  const { user, isLoading, login, register, verifyEmail } = useAuth()
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('ChangeMe123!')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupUsername, setSignupUsername] = useState('')
  const [signupInviteCode, setSignupInviteCode] = useState('')
  const [verificationToken, setVerificationToken] = useState('')
  const [message, setMessage] = useState('')

  if (isLoading) return <div className="loading-screen">Chargement...</div>
  if (user) return <Navigate to="/" replace />

  async function handleLogin(event: FormEv) {
    event.preventDefault(); setMessage('')
    const err = await login(email, password)
    if (err) setMessage(err)
  }

  async function handleRegister(event: FormEv) {
    event.preventDefault(); setMessage('')
    const msg = await register(signupEmail, signupPassword, signupUsername || undefined, signupInviteCode || undefined)
    setMessage(msg)
  }

  async function handleVerifyEmail(event: FormEv) {
    event.preventDefault(); setMessage('')
    const msg = await verifyEmail(verificationToken)
    setMessage(msg)
  }

  return (
    <LoginScreen
      email={email} password={password}
      signupEmail={signupEmail} signupPassword={signupPassword}
      signupUsername={signupUsername} signupInviteCode={signupInviteCode}
      verificationToken={verificationToken} message={message}
      onEmailChange={setEmail} onPasswordChange={setPassword}
      onSignupEmailChange={setSignupEmail} onSignupPasswordChange={setSignupPassword}
      onSignupUsernameChange={setSignupUsername} onSignupInviteCodeChange={setSignupInviteCode}
      onVerificationTokenChange={setVerificationToken}
      onLogin={handleLogin} onRegister={handleRegister} onVerifyEmail={handleVerifyEmail}
    />
  )
}

function ProtectedRoute() {
  const { user, isLoading } = useAuth()
  if (isLoading) return (
    <div className="loading-screen">
      <div className="loading-screen-spinner" />
      <div className="loading-screen-logo">Mon<span>Espace</span></div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <ToastProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="vehicles" element={<ModuleGuard moduleKey="vehicles"><VehiclesPage /></ModuleGuard>} />
              <Route path="finances" element={<ModuleGuard moduleKey="finances"><FinancesPage /></ModuleGuard>} />
              <Route path="stock" element={<ModuleGuard moduleKey="stock"><StockPage /></ModuleGuard>} />
              <Route path="agenda" element={<ModuleGuard moduleKey="agenda"><AgendaPage /></ModuleGuard>} />
              <Route path="real-estate" element={<ModuleGuard moduleKey="real-estate"><RealEstatePage /></ModuleGuard>} />
              <Route path="documents" element={<ModuleGuard moduleKey="documents"><DocumentsPage /></ModuleGuard>} />
              <Route path="contacts" element={<ModuleGuard moduleKey="contacts"><ContactsPage /></ModuleGuard>} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="backups" element={<BackupsPage />} />
              <Route path="admin" element={<AdminOnlyRoute><AdminDashboardPage /></AdminOnlyRoute>} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ToastProvider>
  )
}
