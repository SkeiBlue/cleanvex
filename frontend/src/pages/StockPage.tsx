import { useCallback, useEffect, useState } from 'react'
import { Package, Pencil, Trash2, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { FinancialAccount, StockItem, StockMovement, VehicleItem } from '../types'

type FormEv = { preventDefault(): void; currentTarget: HTMLFormElement }

export function StockPage() {
  const { authedFetch } = useAuth()
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([])
  const [vehicles, setVehicles] = useState<VehicleItem[]>([])
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const [si, sm] = await Promise.all([authedFetch('/stock/items'), authedFetch('/stock/movements')])
    if (si.ok) setStockItems(await si.json())
    if (sm.ok) setStockMovements(await sm.json())
  }, [authedFetch])

  useEffect(() => {
    async function load() {
      const [v, a] = await Promise.all([authedFetch('/vehicles'), authedFetch('/finances/accounts')])
      if (v.ok) setVehicles(await v.json())
      if (a.ok) setFinancialAccounts(await a.json())
      await reload()
    }
    load()
  }, [authedFetch, reload])

  async function handleCreateStockItem(event: FormEv) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const r = await authedFetch('/stock/items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name'), category: data.get('category'), unit: data.get('unit'),
        quantity: data.get('quantity') ? Number(data.get('quantity')) : 0,
        location: data.get('location') || undefined,
        thresholdEnabled: data.get('thresholdEnabled') === 'on',
        threshold: data.get('threshold') ? Number(data.get('threshold')) : undefined,
        valueAmount: data.get('valueAmount') ? Number(data.get('valueAmount')) : undefined,
      }),
    })
    if (!r.ok) { setMessage('Creation article refusee.'); return }
    form.reset(); setMessage('Article cree.'); await reload()
  }

  async function handleUpdateItem(event: FormEv, itemId: string) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const r = await authedFetch(`/stock/items/${itemId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name') || undefined,
        category: data.get('category') || undefined,
        unit: data.get('unit') || undefined,
        location: data.get('location') || undefined,
        thresholdEnabled: data.get('thresholdEnabled') === 'on',
        threshold: data.get('threshold') ? Number(data.get('threshold')) : undefined,
        valueAmount: data.get('valueAmount') ? Number(data.get('valueAmount')) : undefined,
      }),
    })
    if (!r.ok) { setMessage('Mise a jour refusee.'); return }
    setEditingId(null); setMessage('Article mis a jour.'); await reload()
  }

  async function handleDeleteItem(itemId: string, name: string) {
    if (!window.confirm(`Supprimer "${name}" ? Tous les mouvements liés seront perdus.`)) return
    const r = await authedFetch(`/stock/items/${itemId}`, { method: 'DELETE' })
    if (!r.ok) { setMessage('Suppression refusee.'); return }
    setMessage('Article supprime.'); await reload()
  }

  async function handlePurchaseStock(event: FormEv) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const itemId = data.get('itemId'); if (!itemId) return
    const r = await authedFetch(`/stock/items/${itemId}/purchase`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: Number(data.get('quantity')),
        valueAmount: data.get('valueAmount') ? Number(data.get('valueAmount')) : undefined,
        accountId: data.get('accountId') || undefined,
        operationDate: data.get('operationDate') || undefined,
      }),
    })
    if (!r.ok) { setMessage('Achat refuse.'); return }
    form.reset(); setMessage('Achat enregistre — mouvement financier cree.'); await reload()
  }

  async function handleConsumeStock(event: FormEv) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const itemId = data.get('itemId'); if (!itemId) return
    const r = await authedFetch(`/stock/items/${itemId}/consume`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: Number(data.get('quantity')),
        valueAmount: data.get('valueAmount') ? Number(data.get('valueAmount')) : undefined,
        vehicleId: data.get('vehicleId') || undefined,
        note: data.get('note') || undefined,
      }),
    })
    if (!r.ok) { setMessage('Sortie refusee.'); return }
    form.reset(); setMessage('Sortie enregistree — cout affecte au vehicule.'); await reload()
  }

  const belowThreshold = stockItems.filter(i => i.thresholdEnabled && Number(i.quantity) <= Number(i.threshold ?? 0))

  return (
    <section className="stock-layout">
      {/* ─── ARTICLES ─── */}
      <article className="panel">
        <div className="panel-header">
          <div><span className="panel-kicker">Stock</span><h2>Articles</h2></div>
          <span className="badge">{stockItems.length} articles</span>
        </div>

        {belowThreshold.length > 0 && (
          <div style={{ margin: '0 20px 8px', padding: '8px 12px', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '8px', fontSize: '12px', color: '#fda4af' }}>
            ⚠ {belowThreshold.length} article{belowThreshold.length > 1 ? 's' : ''} sous le seuil : {belowThreshold.map(i => i.name).join(', ')}
          </div>
        )}

        {message && <p className="form-message">{message}</p>}

        <form className="compact-form" onSubmit={handleCreateStockItem}>
          <input name="name" placeholder="Nom *" required />
          <select name="category" defaultValue="piece" style={{ background: 'rgba(12,16,41,0.95)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '8px 10px', fontSize: '12px', fontFamily: 'var(--font)' }}>
            <option value="piece">Pièce</option>
            <option value="consommable">Consommable</option>
            <option value="outil">Outil</option>
            <option value="equipement">Équipement</option>
            <option value="autre">Autre</option>
          </select>
          <input name="unit" placeholder="Unité" defaultValue="unit" required />
          <input name="quantity" type="number" step="0.01" placeholder="Qté initiale" />
          <input name="location" placeholder="Localisation" />
          <input name="valueAmount" type="number" step="0.01" placeholder="Valeur unitaire €" />
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
            <input name="thresholdEnabled" type="checkbox" />
            Seuil alerte
          </label>
          <input name="threshold" type="number" step="0.01" placeholder="Qté seuil" />
          <button className="primary-action" type="submit"><Package size={18} />Ajouter</button>
        </form>

        <div className="stock-list">
          {stockItems.length === 0 ? (
            <p className="muted">Aucun article en stock.</p>
          ) : (
            stockItems.map((item) => {
              const qty = Number(item.quantity)
              const threshold = Number(item.threshold ?? 0)
              const isLow = item.thresholdEnabled && qty <= threshold
              const isEditing = editingId === item.id

              return (
                <div key={item.id}>
                  {isEditing ? (
                    <form
                      className="inline-form"
                      style={{ background: 'rgba(124,58,237,0.05)', borderRadius: '8px', border: '1px solid rgba(124,58,237,0.2)', margin: '4px 0' }}
                      onSubmit={(e) => { e.preventDefault(); handleUpdateItem(e as unknown as FormEv, item.id) }}
                    >
                      <input name="name" defaultValue={item.name} placeholder="Nom" style={{ minWidth: '100px' }} />
                      <input name="category" defaultValue={item.category} placeholder="Catégorie" style={{ minWidth: '80px' }} />
                      <input name="unit" defaultValue={item.unit} placeholder="Unité" style={{ minWidth: '60px' }} />
                      <input name="location" defaultValue={item.location ?? ''} placeholder="Lieu" style={{ minWidth: '80px' }} />
                      <input name="valueAmount" type="number" step="0.01" defaultValue={item.valueAmount ?? ''} placeholder="Val. unit. €" style={{ minWidth: '80px' }} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                        <input name="thresholdEnabled" type="checkbox" defaultChecked={item.thresholdEnabled} />
                        Seuil
                      </label>
                      <input name="threshold" type="number" step="0.01" defaultValue={item.threshold ?? ''} placeholder="Seuil" style={{ minWidth: '60px' }} />
                      <button className="primary-action" type="submit" style={{ padding: '6px 10px' }}>✓</button>
                      <button className="btn-ghost" type="button" onClick={() => setEditingId(null)} style={{ padding: '6px 8px' }}><X size={12} /></button>
                    </form>
                  ) : (
                    <div
                      className="stock-row"
                      style={{ borderColor: isLow ? 'rgba(244,63,94,0.3)' : undefined, background: isLow ? 'rgba(244,63,94,0.04)' : undefined }}
                    >
                      <div style={{ flex: 1 }}>
                        <strong style={{ color: isLow ? '#f87171' : undefined }}>{item.name}</strong>
                        <span style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <em style={{ color: 'var(--text3)', fontSize: '10px', fontFamily: 'var(--mono)', fontStyle: 'normal' }}>{item.category}</em>
                          {item.location && <em style={{ color: 'var(--text3)', fontSize: '10px', fontStyle: 'normal' }}>📍 {item.location}</em>}
                          {item.thresholdEnabled && <em style={{ color: isLow ? '#f87171' : 'var(--text3)', fontSize: '10px', fontStyle: 'normal' }}>seuil: {threshold}</em>}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: isLow ? '#f87171' : '#67e8f9' }}>{qty.toLocaleString('fr-FR')} {item.unit}</strong>
                        <button className="hdr-btn" style={{ width: '26px', height: '26px' }} onClick={() => setEditingId(item.id)} title="Modifier"><Pencil size={12} /></button>
                        <button className="hdr-btn" style={{ width: '26px', height: '26px', color: '#f87171' }} onClick={() => handleDeleteItem(item.id, item.name)} title="Supprimer"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </article>

      {/* ─── MOUVEMENTS ─── */}
      <article className="panel">
        <div className="panel-header">
          <div><span className="panel-kicker">Mouvements</span><h2>Achat & Sortie</h2></div>
          <span className="badge">{stockMovements.length}</span>
        </div>

        <div style={{ padding: '8px 20px 0', fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>ACHAT → génère une dépense financière</div>
        <form className="finance-form" onSubmit={handlePurchaseStock}>
          <select name="itemId" defaultValue="" required>
            <option value="" disabled>Article</option>
            {stockItems.map((i) => <option value={i.id} key={i.id}>{i.name} ({Number(i.quantity)} {i.unit})</option>)}
          </select>
          <input name="quantity" type="number" step="0.01" placeholder="Quantité *" required />
          <input name="valueAmount" type="number" step="0.01" placeholder="Coût total €" />
          <input name="operationDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          <select name="accountId" defaultValue="">
            <option value="">Sans compte (pas de dépense)</option>
            {financialAccounts.map((a) => <option value={a.id} key={a.id}>{a.name}</option>)}
          </select>
          <button className="primary-action" type="submit">Achat</button>
        </form>

        <div style={{ padding: '8px 20px 0', fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>SORTIE → affecte coût au véhicule</div>
        <form className="finance-form" onSubmit={handleConsumeStock}>
          <select name="itemId" defaultValue="" required>
            <option value="" disabled>Article</option>
            {stockItems.map((i) => <option value={i.id} key={i.id}>{i.name} ({Number(i.quantity)} {i.unit})</option>)}
          </select>
          <input name="quantity" type="number" step="0.01" placeholder="Quantité *" required />
          <input name="valueAmount" type="number" step="0.01" placeholder="Coût affecté €" />
          <select name="vehicleId" defaultValue="">
            <option value="">Sans véhicule</option>
            {vehicles.map((v) => <option value={v.id} key={v.id}>{v.name}</option>)}
          </select>
          <input name="note" placeholder="Note" />
          <button className="primary-action" type="submit">Sortie</button>
        </form>

        <div className="document-list">
          {stockMovements.length === 0 ? (
            <p className="muted">Aucun mouvement.</p>
          ) : (
            stockMovements.slice(0, 15).map((m) => (
              <div className="document-row" key={m.id}>
                <Package size={18} style={{ color: m.type === 'purchase' ? '#4ade80' : '#f87171' }} />
                <span>
                  {m.type === 'purchase' ? '↑ Achat' : '↓ Sortie'} · {m.stockItem.name}
                  {m.valueAmount && <em style={{ color: 'var(--text3)', fontSize: '10px', marginLeft: '4px' }}>{Number(m.valueAmount).toFixed(2)} €</em>}
                </span>
                <small>{Number(m.quantity).toLocaleString('fr-FR')} {m.stockItem.unit}</small>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  )
}
