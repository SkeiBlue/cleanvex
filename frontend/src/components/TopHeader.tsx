import type { RefObject } from 'react'
import { Menu, Search } from 'lucide-react'
import type { SearchResult } from '../types'

const RESULT_ICONS: Record<string, string> = {
  vehicle: '🚗', contact: '👥', document: '📁',
  property: '🏠', task: '📅', stock_item: '📦', transaction: '💸',
}

type Props = {
  username: string | null
  dateLabel: string
  unreadNotifications: number
  onLogout: () => void
  onMenuToggle: () => void
  searchQuery: string
  onSearchChange: (q: string) => void
  onSearch: (e: { preventDefault(): void }) => void
  searchResults: SearchResult[]
  searchOpen: boolean
  onSearchResultClick: (r: SearchResult) => void
  onSearchClose: () => void
  searchRef: RefObject<HTMLDivElement | null>
}

export function TopHeader({
  username, dateLabel, unreadNotifications,
  onLogout, onMenuToggle,
  searchQuery, onSearchChange, onSearch,
  searchResults, searchOpen, onSearchResultClick, onSearchClose,
  searchRef,
}: Props) {
  return (
    <header className="header">
      <div className="header-left">
        <button
          className="hdr-btn mobile-only"
          onClick={onMenuToggle}
          style={{ marginRight: '8px' }}
        >
          <Menu size={18} />
        </button>
        <div>
          <div className="header-greeting">
            Bonjour, <span>{username ?? 'Clément'}</span> ✦
          </div>
          <div className="header-date">{dateLabel.toUpperCase()}</div>
        </div>
      </div>

      <div className="header-right">
        {/* Recherche avec dropdown */}
        <div ref={searchRef} style={{ position: 'relative' }}>
          <form onSubmit={onSearch} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="search-box" style={{ width: 220 }}>
              <span className="search-box-icon"><Search size={12} /></span>
              <input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={() => searchResults.length > 0 && onSearchResultClick}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { onSearchChange(''); onSearchClose() }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '0 2px', display: 'flex' }}
                >
                  ✕
                </button>
              )}
            </div>
          </form>

          {/* Dropdown résultats */}
          {searchOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 300,
              background: 'rgba(12,16,41,0.98)', border: '1px solid var(--border)',
              borderRadius: '12px', boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
              zIndex: 100, overflow: 'hidden', backdropFilter: 'blur(20px)',
            }}>
              {searchResults.length === 0 ? (
                <div style={{ padding: '16px', fontSize: '12px', color: 'var(--text3)', textAlign: 'center' }}>
                  Aucun résultat pour « {searchQuery} »
                </div>
              ) : (
                <>
                  <div style={{ padding: '8px 12px 4px', fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: '1px' }}>
                    {searchResults.length} RÉSULTAT{searchResults.length > 1 ? 'S' : ''}
                  </div>
                  {searchResults.slice(0, 8).map((r) => (
                    <button
                      key={`${r.type}-${r.id}`}
                      onClick={() => onSearchResultClick(r)}
                      style={{
                        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 14px', textAlign: 'left', transition: 'background 0.15s',
                        fontFamily: 'var(--font)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.1)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      <span style={{ fontSize: '18px', flexShrink: 0 }}>{RESULT_ICONS[r.type] ?? '🔍'}</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{r.title}</div>
                        {r.subtitle && <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{r.subtitle}</div>}
                      </div>
                      <span style={{
                        marginLeft: 'auto', fontSize: '9px', fontFamily: 'var(--mono)',
                        color: 'var(--text3)', background: 'rgba(255,255,255,0.05)',
                        padding: '2px 6px', borderRadius: '4px', flexShrink: 0,
                      }}>
                        {r.type}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <div className="hdr-btn" style={{ position: 'relative' }}>
          🔔
          {unreadNotifications > 0 && <div className="notif-dot" />}
        </div>
        <div className="hdr-btn" style={{ cursor: 'pointer' }} onClick={onLogout} title="Déconnexion">⚡</div>
      </div>
    </header>
  )
}
