import { Eye, EyeOff, LayoutGrid } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { ModuleItem } from '../types'

/**
 * Sprint 3 — onglet "Modules" des Paramètres utilisateur.
 *
 * Distinction importante (cf. CDC §9) :
 * - Activation globale = Admin (page Administration). Si OFF, le module est
 *   bloqué côté API pour tous.
 * - Préférence utilisateur = ici. Masque uniquement la sidebar/dashboard
 *   pour ce compte ; n'affecte pas les autres utilisateurs.
 */
export function SettingsModulesTab() {
  const { authedFetch, refreshModules } = useAuth()
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [saving, setSaving] = useState<string | null>(null)

  async function load() {
    const r = await authedFetch('/modules/me')
    if (r.ok) setModules(await r.json())
  }
  useEffect(() => { load() }, [authedFetch]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(key: string, next: boolean) {
    setSaving(key)
    const r = await authedFetch(`/modules/me/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isVisible: next }),
    })
    if (r.ok) {
      setModules(prev => prev.map(m => m.key === key ? { ...m, isVisible: next } : m))
      await refreshModules()
    }
    setSaving(null)
  }

  const visibleModules = modules.filter(m => m.key !== 'dashboard')

  return (
    <section className="stability-layout" style={{ marginTop: 16 }}>
      <article className="panel">
        <div className="panel-header">
          <div>
            <span className="panel-kicker">Affichage</span>
            <h2>Modules visibles</h2>
          </div>
          <LayoutGrid size={20} />
        </div>
        <div style={{ padding: '12px 20px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
            Affiche ou masque les modules dans <strong>ta</strong> sidebar et ton dashboard.
            Cela n'impacte ni les autres utilisateurs ni les données — masquer un module
            ne fait que cacher son entrée pour toi.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {visibleModules.map((m) => {
              const visible = m.isVisible !== false
              const globallyDisabled = !m.isEnabled
              return (
                <div
                  key={m.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      {m.title}
                      {globallyDisabled && (
                        <span style={{
                          marginLeft: 8, fontSize: 10, fontFamily: 'var(--mono)',
                          padding: '2px 6px', borderRadius: 4,
                          background: 'rgba(244,63,94,0.1)', color: '#f87171',
                        }}>
                          Désactivé par admin
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {visible ? 'Visible dans ta sidebar' : 'Masqué pour ton compte'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(m.key, !visible)}
                    disabled={saving === m.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', fontSize: 12, fontFamily: 'var(--font)',
                      background: visible ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${visible ? 'rgba(74,222,128,0.3)' : 'var(--border)'}`,
                      borderRadius: 8, cursor: 'pointer',
                      color: visible ? '#4ade80' : 'var(--text2)',
                    }}
                  >
                    {visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    {visible ? 'Afficher' : 'Masqué'}
                  </button>
                </div>
              )
            })}
            {visibleModules.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text3)' }}>Aucun module disponible.</p>
            )}
          </div>
        </div>
      </article>
    </section>
  )
}
