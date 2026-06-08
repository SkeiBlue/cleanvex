import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Car, Home, Wallet, Package,
  CalendarDays, Folder, Users, BarChart2, HardDrive, Settings,
  ChevronLeft, ChevronRight, ShieldCheck,
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
  vehicles:     '/vehicles',
  'real-estate':'/real-estate',
  finances:     '/finances',
  stock:        '/stock',
  agenda:       '/agenda',
  documents:    '/documents',
  contacts:     '/contacts',
}

type Props = {
  user: User
  modules: ModuleItem[]
  sidebarOpen?: boolean
  collapsed?: boolean
  onClose?: () => void
  onToggleCollapse?: () => void
}

export function Sidebar({
  user, modules,
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
      {/* Bouton rétractable — desktop uniquement (caché via CSS sur mobile) */}
      <button
        className="sidebar-toggle"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Déplier la sidebar' : 'Réduire la sidebar'}
        title={collapsed ? 'Déplier' : 'Réduire'}
      >
        {collapsed
          ? <ChevronRight size={13} />
          : <ChevronLeft size={13} />
        }
      </button>

      <div className="sidebar-top">
        <div className="logo-row">
          <div className="logo-gem" />
          <div>
            <div className="logo-text">Mon<span>Espace</span></div>
            <div className="logo-badge">v{__APP_VERSION__} · COSMIC UI</div>
          </div>
        </div>
      </div>

      <nav className="nav-section" aria-label="Menu principal">
        <div className="nav-label">Principal</div>
        <NavLink
          to="/"
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
        {modules.map((module) => {
          const Icon = MODULE_ICONS[module.key] ?? Settings
          return (
            <NavLink
              to={MODULE_ROUTES[module.key] ?? '/'}
              key={module.key}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={onClose}
              data-label={module.title}
              aria-label={module.title}
            >
              <div className="nav-ico"><Icon size={15} /></div>
              <span className="nav-txt">{module.title}</span>
              {!module.isEnabled && (
                <span className="nav-badge badge-purple">Off</span>
              )}
            </NavLink>
          )
        })}

        <div className="nav-label">Système</div>
        <NavLink
          to="/reports"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          onClick={onClose}
          data-label="Rapports"
          aria-label="Rapports"
        >
          <div className="nav-ico"><BarChart2 size={15} /></div>
          <span className="nav-txt">Rapports</span>
        </NavLink>
        <NavLink
          to="/backups"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          onClick={onClose}
          data-label="Sauvegarde"
          aria-label="Sauvegarde"
        >
          <div className="nav-ico"><HardDrive size={15} /></div>
          <span className="nav-txt">Sauvegarde</span>
        </NavLink>
        <NavLink
          to="/settings"
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
            to="/admin"
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
          <div className="user-dot" />
        </div>
      </div>
    </aside>
  )
}
