import { Plus, Ruler, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { UnitItem } from '../types'

/**
 * Sprint 3 — onglet "Unités" des Paramètres utilisateur.
 *
 * - Les unités par défaut globales (userId=null) sont en lecture seule.
 * - L'utilisateur peut créer/modifier/désactiver ses propres unités.
 * - Une unité utilisée par un article de stock ne peut pas être supprimée
 *   (le backend renvoie 409) ; on la désactive à la place.
 */
export function SettingsUnitsTab() {
  const { authedFetch } = useAuth()
  const [units, setUnits] = useState<UnitItem[]>([])
  const [label, setLabel] = useState('')
  const [symbol, setSymbol] = useState('')
  const [type, setType] = useState('quantity')
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  async function load() {
    const r = await authedFetch('/units')
    if (r.ok) setUnits(await r.json())
  }
  useEffect(() => { load() }, [authedFetch]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: { preventDefault(): void }) {
    e.preventDefault()
    setMsg(null)
    if (!label.trim() || !symbol.trim()) {
      setMsg({ text: 'Libellé et symbole requis.', ok: false })
      return
    }
    const r = await authedFetch('/units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label.trim(), symbol: symbol.trim(), type }),
    })
    if (!r.ok) {
      const body = await r.json().catch(() => ({}))
      setMsg({ text: body.message ?? 'Création refusée.', ok: false })
      return
    }
    setLabel(''); setSymbol(''); setType('quantity')
    setMsg({ text: 'Unité créée.', ok: true })
    await load()
  }

  async function toggleActive(u: UnitItem) {
    const r = await authedFetch(`/units/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !u.isActive }),
    })
    if (r.ok) await load()
  }

  async function remove(u: UnitItem) {
    if (!confirm(`Supprimer l'unité "${u.label}" ?`)) return
    const r = await authedFetch(`/units/${u.id}`, { method: 'DELETE' })
    if (!r.ok) {
      const body = await r.json().catch(() => ({}))
      setMsg({ text: body.message ?? 'Suppression refusée.', ok: false })
      return
    }
    setMsg({ text: 'Unité supprimée.', ok: true })
    await load()
  }

  return (
    <section className="stability-layout" style={{ marginTop: 16 }}>
      <article className="panel">
        <div className="panel-header">
          <div>
            <span className="panel-kicker">Stock</span>
            <h2>Unités</h2>
          </div>
          <Ruler size={20} />
        </div>
        <div style={{ padding: '12px 20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
            Les unités servent à mesurer les articles du Stock (litres, pièces, mètres, etc.).
            Les unités par défaut sont disponibles pour tous ; tu peux en ajouter d'autres.
          </p>

          {msg && (
            <div style={{
              fontSize: 12, padding: '8px 12px', borderRadius: 6,
              background: msg.ok ? 'rgba(74,222,128,0.08)' : 'rgba(244,63,94,0.08)',
              border: `1px solid ${msg.ok ? 'rgba(74,222,128,0.2)' : 'rgba(244,63,94,0.2)'}`,
              color: msg.ok ? '#4ade80' : '#f87171',
            }}>
              {msg.text}
            </div>
          )}

          <form
            onSubmit={handleCreate}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8 }}
          >
            <input
              value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="Libellé (ex: litre)"
              style={inputStyle}
            />
            <input
              value={symbol} onChange={(e) => setSymbol(e.target.value)}
              placeholder="Symbole (ex: L)"
              style={inputStyle}
            />
            <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
              <option value="quantity">Quantité</option>
              <option value="volume">Volume</option>
              <option value="weight">Poids</option>
              <option value="length">Longueur</option>
              <option value="other">Autre</option>
            </select>
            <button type="submit" className="primary-action" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Ajouter
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {units.map(u => (
              <div
                key={u.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  opacity: u.isActive ? 1 : 0.5,
                }}
              >
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{u.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8, fontFamily: 'var(--mono)' }}>
                    {u.symbol} · {u.type}
                  </span>
                  {u.isDefault && (
                    <span style={{
                      marginLeft: 8, fontSize: 10, fontFamily: 'var(--mono)',
                      padding: '2px 6px', borderRadius: 4,
                      background: 'rgba(167,139,250,0.1)', color: '#a78bfa',
                    }}>
                      Par défaut
                    </span>
                  )}
                </div>
                {!u.isDefault && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleActive(u)}
                      style={{
                        fontSize: 11, padding: '4px 10px',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                        borderRadius: 6, cursor: 'pointer', color: 'var(--text2)',
                      }}
                    >
                      {u.isActive ? 'Désactiver' : 'Activer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(u)}
                      style={{
                        padding: 4,
                        background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)',
                        borderRadius: 6, cursor: 'pointer', color: '#f87171',
                      }}
                      title="Supprimer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            ))}
            {units.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text3)' }}>Aucune unité.</p>
            )}
          </div>
        </div>
      </article>
    </section>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--text)',
  fontFamily: 'var(--font)', fontSize: 13, outline: 'none', width: '100%',
}
