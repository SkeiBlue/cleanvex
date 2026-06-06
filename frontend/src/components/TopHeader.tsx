import { type RefObject, useEffect, useRef, useState } from 'react'
import { Bell, LogOut, Menu, Search, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { SearchResult } from '../types'

const RESULT_ICONS: Record<string, string> = {
  vehicle: '🚗', contact: '👥', document: '📁',
  property: '🏠', task: '📅', stock_item: '📦', transaction: '💸',
}

interface Notification {
  id: string
  title: string
  body?: string
  isRead: boolean
  createdAt: string
}

type Props = {
  username: string | null
  dateLabel: string
  unreadNotifications: number
  onLogout: () => void
  onMenuToggle: () => void
  onCmdOpen: () => void
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
  onLogout, onMenuToggle, onCmdOpen,
  searchQuery, onSearchChange, onSearch,
  searchResults, searchOpen, onSearchResultClick, onSearchClose,
  searchRef,
}: Props) {
  const { authedFetch, setUnreadNotifications } = useAuth()
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  /* Load notifications when dropdown opens */
  useEffect(() => {
    if (!notifOpen) return
    setNotifLoading(true)
    authedFetch('/agenda/notifications').then(r => {
      if (r.ok) r.json().then((d: Notification[]) => setNotifications(d))
      setNotifLoading(false)
    })
  }, [notifOpen, authedFetch])

  /* Click-outside to close notif dropdown */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    if (notifOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notifOpen])

  async function markRead(id: string) {
    await authedFetch(`/agenda/notifications/${id}/read`, { method: 'PATCH' })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setUnreadNotifications(Math.max(0, unreadNotifications - 1))
  }

  async function markAllRead() {
    await authedFetch('/agenda/notifications/read-all', { method: 'PATCH' })
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadNotifications(0)
  }

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'à l\'instant'
    if (m < 60) return `il y a ${m}min`
    const h = Math.floor(m / 60)
    if (h < 24) return `il y a ${h}h`
    return `il y a ${Math.floor(h / 24)}j`
  }

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

        {/* ⌘K button */}
        <button
          onClick={onCmdOpen}
          title="Recherche globale (⌘K)"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: 'var(--text3)',
            fontSize: '12px', fontFamily: 'var(--mono)', transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.4)'; (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.06)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
        >
          <Search size={12} />
          <span className="desktop-only">Rechercher</span>
          <kbd style={{ fontSize: '9px', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>⌘K</kbd>
        </button>

        {/* Recherche header (still works for quick search) */}
        <div ref={searchRef} style={{ position: 'relative' }} className="desktop-only">
          <form onSubmit={onSearch} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="search-box" style={{ width: 180 }}>
              <span className="search-box-icon"><Search size={12} /></span>
              <input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
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

        {/* 🔔 Notifications dropdown */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            className="hdr-btn"
            onClick={() => setNotifOpen(o => !o)}
            title="Notifications"
            style={{ position: 'relative' }}
          >
            <Bell size={16} />
            {unreadNotifications > 0 && (
              <div className="notif-dot" style={{ position: 'absolute', top: '4px', right: '4px', width: '8px', height: '8px', background: '#f87171', borderRadius: '50%', border: '1.5px solid var(--p2)' }} />
            )}
          </button>

          {notifOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 320,
              background: 'rgba(12,16,41,0.98)', border: '1px solid var(--border)',
              borderRadius: '14px', boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
              zIndex: 200, overflow: 'hidden', backdropFilter: 'blur(20px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)', letterSpacing: '0.05em' }}>NOTIFICATIONS</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {unreadNotifications > 0 && (
                    <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', color: 'var(--p1)', fontFamily: 'var(--font)', padding: 0 }}>
                      Tout lire
                    </button>
                  )}
                  <button onClick={() => setNotifOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', padding: 0 }}>
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                {notifLoading && (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: '12px' }}>Chargement…</div>
                )}
                {!notifLoading && notifications.length === 0 && (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: '12px' }}>
                    <Bell size={24} style={{ opacity: 0.3, marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
                    Aucune notification
                  </div>
                )}
                {!notifLoading && notifications.map(n => (
                  <div
                    key={n.id}
                    style={{
                      padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)',
                      background: n.isRead ? 'none' : 'rgba(124,58,237,0.05)',
                      display: 'flex', gap: '10px', alignItems: 'flex-start',
                      cursor: n.isRead ? 'default' : 'pointer', transition: 'background 0.15s',
                    }}
                    onClick={() => { if (!n.isRead) markRead(n.id) }}
                    onMouseEnter={e => { if (!n.isRead) (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.1)' }}
                    onMouseLeave={e => { if (!n.isRead) (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.05)' }}
                  >
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: n.isRead ? 'transparent' : '#a78bfa', marginTop: '5px', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: n.isRead ? 'var(--text2)' : 'var(--text)', fontWeight: n.isRead ? 400 : 600, lineHeight: 1.3 }}>{n.title}</div>
                      {n.body && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px', lineHeight: 1.4 }}>{n.body}</div>}
                      <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '4px', fontFamily: 'var(--mono)' }}>{timeAgo(n.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="hdr-btn" style={{ cursor: 'pointer' }} onClick={onLogout} title="Déconnexion">
          <LogOut size={16} />
        </div>
      </div>
    </header>
  )
}
