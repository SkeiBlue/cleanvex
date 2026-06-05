import { NavLink } from 'react-router-dom'
import type { ModuleItem, User } from '../types'

const MODULE_ICONS: Record<string, string> = {
  dashboard:    '🌌',
  vehicles:     '🚗',
  'real-estate':'🏠',
  finances:     '💸',
  stock:        '📦',
  agenda:       '📅',
  documents:    '📁',
  contacts:     '👥',
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
  onClose?: () => void
}

export function Sidebar({ user, modules, sidebarOpen = false, onClose }: Props) {
  const initial = (user.username ?? user.email).charAt(0).toUpperCase()

  return (
    <aside
      className="sidebar"
      style={{ transform: sidebarOpen ? 'translateX(0)' : undefined }}
    >
      <div className="sidebar-top">
        <div className="logo-row">
          <div className="logo-gem" />
          <div>
            <div className="logo-text">Mon<span>Espace</span></div>
            <div className="logo-badge">V0.1 · COSMIC UI</div>
          </div>
        </div>
      </div>

      <nav className="nav-section">
        <div className="nav-label">Principal</div>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          onClick={onClose}
        >
          <div className="nav-ico">🌌</div>
          <span className="nav-txt">Dashboard</span>
        </NavLink>

        <div className="nav-label">Modules</div>
        {modules.map((module) => (
          <NavLink
            to={MODULE_ROUTES[module.key] ?? '/'}
            key={module.key}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={onClose}
          >
            <div className="nav-ico">{MODULE_ICONS[module.key] ?? '⚙️'}</div>
            <span className="nav-txt">{module.title}</span>
            {!module.isEnabled && (
              <span className="nav-badge badge-purple">Off</span>
            )}
          </NavLink>
        ))}

        <div className="nav-label">Système</div>
        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          onClick={onClose}
        >
          <div className="nav-ico">⚙️</div>
          <span className="nav-txt">Paramètres</span>
        </NavLink>
        <NavLink
          to="/documents"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          onClick={onClose}
        >
          <div className="nav-ico">💾</div>
          <span className="nav-txt">Documents</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">{initial}</div>
          <div>
            <div className="user-name">{user.username ?? 'Clément'}</div>
            <div className="user-role">{user.role.toUpperCase()} · V0.1</div>
          </div>
          <div className="user-dot" />
        </div>
      </div>
    </aside>
  )
}
