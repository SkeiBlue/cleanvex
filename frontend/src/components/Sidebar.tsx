import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Car, Home, Wallet, Package,
  CalendarDays, Folder, Users, BarChart2, HardDrive, Settings,
  ChevronLeft, ChevronRight, ShieldCheck, LifeBuoy,
  type LucideIcon,
} from 'lucide-react'
import type { ModuleItem, User } from '../types'

const MODULE_ICONS: Record<string, LucideIcon> = {
  dashboard:    LayoutDashboard,
  vehicles:     Car,
  'real-estate':Home,
  finances:     Wallet,
  stock:        Package,
  agenda:       CalendarDays,
  documents:    Folder,
  contacts:     Users,
}

const MODULE_ROUTES: Record<string, string> = {
  vehicles:     '/app/vehicles',
  'real-estate':'/app/real-estate',
  finances:     '/app/finances',
  stock:        '/app/stock',
  agenda:       '/app/agenda',
  documents:    '/app/documents',
  contacts:     '/app/contacts',
}

type Props = {
  user: User
  modules: ModuleItem[]
  moduleBadges?: Record<string, number>
  sidebarOpen?: boolean
  collapsed?: boolean
  onClose?: () => void
  onToggleCollapse?: () => void
}

export function Sidebar({
  user, modules,
  moduleBadges = {},
  sidebarOpen = false,
  collapsed = false,
  onClose,
  onToggleCollapse,
}: Props) {
  const initial = (user.username ?? user.email).charAt(0).toUpperCase()

  return (
    <aside
      className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`}
      aria-label="Navigation principale"
      data-tour="sidebar"
    >
      <div className="sidebar-top">
        <div className="logo-row">
          <div className="logo-gem" />
          <div className="logo-stack">
            <div className="logo-text">Clean<span>Vex</span></div>
          </div>
          {/* Bouton réduire/déplier — desktop uniquement (caché via CSS sur mobile) */}
          <button
            className="sidebar-toggle"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Déplier la sidebar' : 'Réduire la sidebar'}
            title={collapsed ? 'Déplier' : 'Réduire'}
          >
            {collapsed
              ? <ChevronRight size={14} />
              : <ChevronLeft size={14} />
            }
          </button>
        </div>
      </div>

      <nav className="nav-section" aria-label="Menu principal">
        <div className="nav-label">Principal</div>
        <NavLink
          to="/app"
          end
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          onClick={onClose}
          data-label="Dashboard"
          aria-label="Dashboard"
        >
          <div className="nav-ico"><LayoutDashboard size={15} /></div>
          <span className="nav-txt">Dashboard</span>
        </NavLink>

        <div className="nav-label" data-tour="sidebar-modules">Modules</div>
        {/* Le backend liste "dashboard" comme module mais il a déjà son entrée
            "Principal" plus haut — on évite le doublon en le filtrant ici. */}
        {modules
          .filter(m => m.key !== 'dashboard')
          // Sprint 3 — masquage côté utilisateur. Un module désactivé
          // globalement (isEnabled=false) reste affiché avec un badge "Off"
          // pour rappeler à l'admin qu'il est OFF ; un module masqué par
          // l'utilisateur (isVisible=false) disparaît complètement.
          .filter(m => m.isVisible !== false)
          .map((module) => {
          const Icon = MODULE_ICONS[module.key] ?? Settings
          const count = moduleBadges[module.key] ?? 0
          return (
            <NavLink
              to={MODULE_ROUTES[module.key] ?? '/app'}
              key={module.key}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={onClose}
              data-label={module.title}
              aria-label={count > 0 ? `${module.title} — ${count} à traiter` : module.title}
            >
              <div className="nav-ico"><Icon size={15} /></div>
              <span className="nav-txt">{module.title}</span>
              {!module.isEnabled ? (
                <span className="nav-badge badge-purple">Off</span>
              ) : count > 0 && (
                <span className="nav-badge nav-badge-count" aria-hidden="true">{count > 99 ? '99+' : count}</span>
              )}
            </NavLink>
          )
        })}

        <div className="nav-label">Système</div>
        <NavLink
          to="/app/reports"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          onClick={onClose}
          data-label="Rapports"
          aria-label="Rapports"
        >
          <div className="nav-ico"><BarChart2 size={15} /></div>
          <span className="nav-txt">Rapports</span>
        </NavLink>
        <NavLink
          to="/app/backups"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          onClick={onClose}
          data-label="Sauvegarde"
          aria-label="Sauvegarde"
        >
          <div className="nav-ico"><HardDrive size={15} /></div>
          <span className="nav-txt">Sauvegarde</span>
        </NavLink>
        <NavLink
          to="/app/support"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          onClick={onClose}
          data-label="Support"
          aria-label="Support"
        >
          <div className="nav-ico"><LifeBuoy size={15} /></div>
          <span className="nav-txt">Support</span>
        </NavLink>
        <NavLink
          to="/app/settings"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          onClick={onClose}
          data-label="Paramètres"
          aria-label="Paramètres"
          data-tour="settings-link"
        >
          <div className="nav-ico"><Settings size={15} /></div>
          <span className="nav-txt">Paramètres</span>
        </NavLink>
        {user.role === 'admin' && (
          <NavLink
            to="/app/admin"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={onClose}
            data-label="Administration"
            aria-label="Administration"
          >
            <div className="nav-ico"><ShieldCheck size={15} /></div>
            <span className="nav-txt">Administration</span>
          </NavLink>
        )}
      </nav>

      <div className="sidebar-footer">
        <div
          className="user-card"
          title={collapsed ? `${user.username ?? user.email} · ${user.role}` : undefined}
          data-tour="user-card"
        >
          <div className="user-avatar">{initial}</div>
          <div>
            <div className="user-name">{user.username ?? user.email}</div>
            <div className="user-role">{user.role.toUpperCase()} · v{__APP_VERSION__}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
