import type { ReactNode } from 'react'

/**
 * Navigation verticale interne pour les sous-sections d'une page
 * (Finances → Résumé/Opérations/Comptes ; Agenda → Tâches/Calendrier/Notifs ;
 * Settings → Profil/Sécurité/…).
 *
 * Pattern aligné sur la sidebar principale : sur mobile, bascule en barre
 * horizontale scrollable pour rester lisible.
 */
export interface SubSidebarItem<K extends string = string> {
  key: K
  label: ReactNode
  icon?: ReactNode
  hidden?: boolean
}

export interface SubSidebarProps<K extends string = string> {
  items: ReadonlyArray<SubSidebarItem<K>>
  activeKey: K
  onSelect: (key: K) => void
  /** aria-label pour la <nav> interne (lecteurs d'écran). */
  ariaLabel?: string
  children: ReactNode
}

export function SubSidebar<K extends string = string>({
  items, activeKey, onSelect, ariaLabel = 'Sous-sections', children,
}: SubSidebarProps<K>) {
  const visibleItems = items.filter(i => !i.hidden)

  return (
    <div className="sub-shell">
      <nav className="sub-nav" aria-label={ariaLabel} role="tablist">
        {visibleItems.map(item => {
          const active = item.key === activeKey
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(item.key)}
              className={`sub-nav-item${active ? ' active' : ''}`}
            >
              {item.icon && <span className="sub-nav-ico">{item.icon}</span>}
              <span className="sub-nav-label">{item.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="sub-content" role="tabpanel">
        {children}
      </div>
    </div>
  )
}
