import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { SearchResult } from '../types'

const TYPE_ICONS: Record<string, string> = {
  vehicle: '🚗', contact: '👥', document: '📁',
  property: '🏠', task: '✅', stock_item: '📦', transaction: '💸',
}
const TYPE_LABELS: Record<string, string> = {
  vehicle: 'Véhicule', contact: 'Contact', document: 'Document',
  property: 'Bien', task: 'Tâche', stock_item: 'Stock', transaction: 'Transaction',
}
const TYPE_ROUTES: Record<string, string> = {
  vehicle: '/vehicles', contact: '/contacts', document: '/documents',
  property: '/real-estate', task: '/agenda', stock_item: '/stock', transaction: '/finances',
}

const QUICK_LINKS = [
  { label: 'Tableau de bord',  icon: '🏠', route: '/' },
  { label: 'Véhicules',        icon: '🚗', route: '/vehicles' },
  { label: 'Finances',         icon: '💰', route: '/finances' },
  { label: 'Agenda',           icon: '📅', route: '/agenda' },
  { label: 'Contacts',         icon: '👥', route: '/contacts' },
  { label: 'Immobilier',       icon: '🏢', route: '/real-estate' },
  { label: 'Stock',            icon: '📦', route: '/stock' },
  { label: 'Documents',        icon: '📁', route: '/documents' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: Props) {
  const { authedFetch } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState(0)

  /* Focus input when opened */
  useEffect(() => {
    if (open) {
      setQuery(''); setResults([]); setCursor(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  /* Live search with debounce */
  useEffect(() => {
    if (!query.trim()) { setResults([]); setLoading(false); return }
    setLoading(true)
    const timer = setTimeout(async () => {
      const r = await authedFetch(`/search?q=${encodeURIComponent(query.trim())}`)
      if (r.ok) { const d = await r.json(); setResults(d.results ?? []) }
      setLoading(false)
      setCursor(0)
    }, 220)
    return () => clearTimeout(timer)
  }, [query, authedFetch])

  const allItems = query.trim()
    ? results
    : QUICK_LINKS.map(l => ({ id: l.route, type: 'nav', title: l.label, subtitle: l.route, icon: l.icon } as SearchResult & { icon: string }))

  const go = useCallback((item: SearchResult) => {
    onClose()
    if ((item as { type: string }).type === 'nav') {
      navigate((item as { id: string }).id)
    } else {
      navigate(TYPE_ROUTES[item.type] ?? '/')
    }
  }, [navigate, onClose])

  /* Keyboard navigation */
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, allItems.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = allItems[cursor]
      if (item) go(item)
    }
  }

  /* Scroll cursor into view */
  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  if (!open) return null

  /* Group results by type */
  const grouped: Record<string, SearchResult[]> = {}
  results.forEach(r => { grouped[r.type] = [...(grouped[r.type] ?? []), r] })

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9000, backdropFilter: 'blur(4px)' }}
      />

      {/* Palette */}
      <div style={{
        position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)',
        width: 'min(580px, 92vw)', zIndex: 9001,
        background: 'rgba(14,18,46,0.98)', border: '1px solid rgba(124,58,237,0.3)',
        borderRadius: '16px', boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.1)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>

        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Search size={16} style={{ color: '#7b82a8', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher partout… (véhicule, contact, document…)"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: '15px', fontFamily: 'var(--font)' }}
          />
          {loading && <div style={{ width: '14px', height: '14px', border: '2px solid rgba(124,58,237,0.4)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 0.6s linear infinite', flexShrink: 0 }} />}
          {query && !loading && <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', padding: 0, flexShrink: 0 }}><X size={14} /></button>}
          <kbd style={{ fontSize: '10px', color: 'var(--text3)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', flexShrink: 0, fontFamily: 'var(--mono)' }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {!query.trim() && (
            <>
              <div style={{ padding: '8px 16px 4px', fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: '0.08em' }}>NAVIGATION RAPIDE</div>
              {QUICK_LINKS.map((l, i) => (
                <button key={l.route} onClick={() => { onClose(); navigate(l.route) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', background: cursor === i ? 'rgba(124,58,237,0.12)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'background 0.1s' }}
                  onMouseEnter={() => setCursor(i)}
                >
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>{l.icon}</span>
                  <span style={{ flex: 1, fontSize: '14px', color: 'var(--text)' }}>{l.label}</span>
                  <kbd style={{ fontSize: '10px', color: 'var(--text3)', background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: '4px', fontFamily: 'var(--mono)' }}>↵</kbd>
                </button>
              ))}
            </>
          )}

          {query.trim() && results.length === 0 && !loading && (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
              Aucun résultat pour « {query} »
            </div>
          )}

          {query.trim() && Object.entries(grouped).map(([type, items]) => {
            const sectionStart = Object.entries(grouped).slice(0, Object.keys(grouped).indexOf(type)).reduce((s, [, arr]) => s + arr.length, 0)
            return (
              <div key={type}>
                <div style={{ padding: '8px 16px 2px', fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {TYPE_ICONS[type]} {(TYPE_LABELS[type] ?? type).toUpperCase()}S
                </div>
                {items.map((r, i) => {
                  const idx = sectionStart + i
                  const active = cursor === idx
                  return (
                    <button key={r.id} onClick={() => go(r)} onMouseEnter={() => setCursor(idx)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', background: active ? 'rgba(124,58,237,0.12)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'background 0.1s', borderLeft: active ? '2px solid #a78bfa' : '2px solid transparent' }}
                    >
                      <span style={{ fontSize: '18px', flexShrink: 0 }}>{TYPE_ICONS[r.type] ?? '🔍'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', color: 'var(--text)', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                        {r.subtitle && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '1px' }}>{r.subtitle}</div>}
                      </div>
                      <span style={{ fontSize: '9px', color: 'var(--text3)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', flexShrink: 0, fontFamily: 'var(--mono)' }}>{TYPE_LABELS[r.type] ?? r.type}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Footer hint */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: '16px', fontSize: '10px', color: '#4a5280', fontFamily: 'var(--mono)' }}>
          <span>↑↓ naviguer</span>
          <span>↵ ouvrir</span>
          <span>ESC fermer</span>
          <span style={{ marginLeft: 'auto' }}>⌘K pour ouvrir</span>
        </div>
      </div>
    </>
  )
}
