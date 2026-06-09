import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, Package, Pencil, Plus, RotateCcw } from 'lucide-react'
import { ConfirmButton } from '../components/ConfirmButton'
import { FieldTip } from '../components/FieldTip'
import { Modal } from '../components/Modal'
import { useAuth } from '../contexts/AuthContext'
import { SkeletonGridPage } from '../components/Skeleton'
import { useToast } from '../contexts/ToastContext'
import { parseApiError } from '../hooks/useApiError'
import type { FinancialAccount, StockItem, StockMovement, ToolLoan, VehicleItem } from '../types'

type FormEv = { preventDefault(): void; currentTarget: HTMLFormElement }
type View = 'list' | 'detail'
type DetailTab = 'infos' | 'mouvements' | 'prets'

const CAT_ICONS: Record<string, string> = {
  piece: '⚙️', consommable: '🧴', outil: '🔧', equipement: '📋', autre: '📦',
}
const CAT_COLORS: Record<string, string> = {
  piece: '#67e8f9', consommable: '#4ade80', outil: '#fbbf24', equipement: '#a78bfa', autre: '#7b82a8',
}


export function StockPage() {
  const { authedFetch } = useAuth()
  const toast = useToast()

  const [stockItems, setStockItems]   = useState<StockItem[]>([])
  const [movements, setMovements]     = useState<StockMovement[]>([])
  const [toolLoans, setToolLoans]     = useState<ToolLoan[]>([])
  const [vehicles, setVehicles]       = useState<VehicleItem[]>([])
  const [accounts, setAccounts]       = useState<FinancialAccount[]>([])
  const [isLoading, setIsLoading]     = useState(true)

  const [view, setView]               = useState<View>('list')
  const [selected, setSelected]       = useState<StockItem | null>(null)
  const [detailTab, setDetailTab]     = useState<DetailTab>('infos')
  const [editMode, setEditMode]       = useState(false)

  const [searchQ, setSearchQ]         = useState('')
  const [catFilter, setCatFilter]     = useState('all')
  const [showCreate, setShowCreate]   = useState(false)
  const [showPurchase, setShowPurchase] = useState(false)
  const [showConsume, setShowConsume]   = useState(false)
  const [showCreateLoan, setShowCreateLoan] = useState(false)

  /* ── Data ── */
  const reload = useCallback(async () => {
    const [si, sm, sl] = await Promise.all([
      authedFetch('/stock/items'),
      authedFetch('/stock/movements'),
      authedFetch('/stock/loans'),
    ])
    if (si.ok) setStockItems(await si.json())
    if (sm.ok) { const d = await sm.json(); setMovements(d.data ?? d) }
    if (sl.ok) setToolLoans(await sl.json())
  }, [authedFetch])

  useEffect(() => {
    async function load() {
      const [v, a] = await Promise.all([authedFetch('/vehicles'), authedFetch('/finances/accounts')])
      if (v.ok) setVehicles(await v.json())
      if (a.ok) setAccounts(await a.json())
      await reload()
      setIsLoading(false)
    }
    load()
  }, [authedFetch, reload])

  /* sync selected après reload */
  useEffect(() => {
    if (selected) setSelected(prev => stockItems.find(i => i.id === prev?.id) ?? prev)
  }, [stockItems]) // eslint-disable-line

  /* ── Handlers ── */
  async function handleCreate(e: FormEv) {
    e.preventDefault()
    const form = e.currentTarget  // capture avant les await (sinon currentTarget=null)
    const d = new FormData(form)
    const body = {
      name: String(d.get('name') ?? '').trim(),
      category: String(d.get('category') ?? '').trim(),
      unit: String(d.get('unit') ?? '').trim(),
      quantity: d.get('quantity') ? Number(d.get('quantity')) : 0,
      location: d.get('location') || undefined,
      valueAmount: d.get('valueAmount') ? Number(d.get('valueAmount')) : undefined,
      reference: d.get('reference') || undefined,
      supplier: d.get('supplier') || undefined,
      notes: d.get('notes') || undefined,
      thresholdEnabled: d.get('thresholdEnabled') === 'on',
      threshold: d.get('threshold') ? Number(d.get('threshold')) : undefined,
    }
    if (!body.name || !body.category || !body.unit) {
      toast.err('Nom, catégorie et unité sont obligatoires.'); return
    }
    try {
      const r = await authedFetch('/stock/items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        // Affiche le message d'erreur réel du backend (utile pour debug)
        let msg = `Création refusée (HTTP ${r.status}).`
        try {
          const err = await r.json()
          if (err?.message) msg = Array.isArray(err.message) ? err.message.join(' · ') : err.message
        } catch { /* pas de body JSON */ }
        toast.err(msg)
        return
      }
      const created = await r.json()
      form.reset(); setShowCreate(false); toast.ok('Article créé.')
      await reload()
      setSelected(created); setView('detail'); setDetailTab('infos')
    } catch (err) {
      toast.err(`Erreur réseau : ${err instanceof Error ? err.message : 'inconnue'}`)
    }
  }

  async function handleUpdate(e: FormEv) {
    e.preventDefault(); if (!selected) return
    const d = new FormData(e.currentTarget)
    const r = await authedFetch(`/stock/items/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: d.get('name') || undefined, category: d.get('category') || undefined,
        unit: d.get('unit') || undefined, location: d.get('location') || undefined,
        valueAmount: d.get('valueAmount') ? Number(d.get('valueAmount')) : undefined,
        reference: d.get('reference') || undefined, supplier: d.get('supplier') || undefined,
        notes: d.get('notes') || undefined,
        thresholdEnabled: d.get('thresholdEnabled') === 'on',
        threshold: d.get('threshold') ? Number(d.get('threshold')) : undefined,
      }),
    })
    if (!r.ok) { toast.err(await parseApiError(r, 'Mise à jour refusée.')); return }
    setEditMode(false); toast.ok('Article mis à jour.'); await reload()
  }

  async function handleDelete() {
    if (!selected) return
    const r = await authedFetch(`/stock/items/${selected.id}`, { method: 'DELETE' })
    if (!r.ok) { toast.err(await parseApiError(r, 'Suppression refusée.')); return }
    toast.ok('Article supprimé.'); setSelected(null); setView('list'); await reload()
  }

  async function handlePurchase(e: FormEv) {
    e.preventDefault(); if (!selected) return
    const d = new FormData(e.currentTarget)
    const r = await authedFetch(`/stock/items/${selected.id}/purchase`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: Number(d.get('quantity')),
        valueAmount: d.get('valueAmount') ? Number(d.get('valueAmount')) : undefined,
        accountId: d.get('accountId') || undefined,
        operationDate: d.get('operationDate') || undefined,
      }),
    })
    if (!r.ok) { toast.err(await parseApiError(r, 'Achat refusé.')); return }
    e.currentTarget.reset(); setShowPurchase(false); toast.ok('Achat enregistré.')
    await reload()
    // Bascule sur l'onglet "Mouvements" pour que le nouveau mouvement
    // apparaisse immédiatement à l'écran (la quantité change aussi mais
    // ce n'est pas toujours évident à voir).
    setDetailTab('mouvements')
  }

  async function handleConsume(e: FormEv) {
    e.preventDefault(); if (!selected) return
    const d = new FormData(e.currentTarget)
    const r = await authedFetch(`/stock/items/${selected.id}/consume`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: Number(d.get('quantity')),
        valueAmount: d.get('valueAmount') ? Number(d.get('valueAmount')) : undefined,
        vehicleId: d.get('vehicleId') || undefined,
        note: d.get('note') || undefined,
      }),
    })
    if (!r.ok) { toast.err(await parseApiError(r, 'Sortie refusée.')); return }
    e.currentTarget.reset(); setShowConsume(false); toast.ok('Sortie enregistrée.')
    await reload()
    setDetailTab('mouvements')
  }

  async function handleCreateLoan(e: FormEv) {
    e.preventDefault(); if (!selected) return
    const d = new FormData(e.currentTarget)
    const r = await authedFetch('/stock/loans', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stockItemId: selected.id,
        borrowerName: d.get('borrowerName'),
        loanDate: d.get('loanDate') || undefined,
        expectedReturnDate: d.get('expectedReturnDate') || undefined,
        notes: d.get('notes') || undefined,
      }),
    })
    if (!r.ok) { toast.err(await parseApiError(r, 'Prêt refusé.')); return }
    e.currentTarget.reset(); setShowCreateLoan(false); toast.ok('Prêt enregistré.'); await reload()
  }

  async function handleReturn(loanId: string) {
    await authedFetch(`/stock/loans/${loanId}/return`, { method: 'PATCH' })
    toast.ok('Retour enregistré.'); await reload()
  }

  /* ── Dérivés ── */
  const belowThreshold = stockItems.filter(i => i.thresholdEnabled && Number(i.quantity) <= Number(i.threshold ?? 0))
  const totalValue     = stockItems.reduce((s, i) => s + Number(i.quantity) * Number(i.valueAmount ?? 0), 0)

  const filtered = stockItems.filter(i => {
    const matchQ   = !searchQ || i.name.toLowerCase().includes(searchQ.toLowerCase()) || (i.reference ?? '').toLowerCase().includes(searchQ.toLowerCase()) || (i.supplier ?? '').toLowerCase().includes(searchQ.toLowerCase())
    const matchCat = catFilter === 'all' || i.category === catFilter
    return matchQ && matchCat
  })

  const itemMovements = selected ? movements.filter(m => m.stockItem.id === selected.id) : []
  const itemLoans     = selected ? toolLoans.filter(l => l.stockItem.id === selected.id) : []

  if (isLoading) return <SkeletonGridPage count={4} />

  /* ══════════════════════════════════════════════════
     VUE LISTE
  ══════════════════════════════════════════════════ */
  if (view === 'list') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Inventaire</span>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: '2px 0 0' }}>Stock & Outillage</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
            {stockItems.length} articles · <strong style={{ color: '#4ade80' }}>{totalValue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong>
          </span>
          <label style={{ cursor: 'pointer' }}>
            <span className="btn-ghost" style={{ fontSize: '12px' }}>⬆ Import CSV</span>
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={async e => {
              const f = e.target.files?.[0]; if (!f) return
              const fd = new FormData(); fd.append('file', f)
              const r = await authedFetch('/stock/items/import.csv', { method: 'POST', body: fd })
              if (!r.ok) { toast.err(await parseApiError(r, 'Import échoué.')); return }
              const j = await r.json() as { created: number; errors: string[]; total: number }
              toast.ok(`Import : ${j.created}/${j.total} articles créés${j.errors.length ? ` (${j.errors.length} erreur${j.errors.length > 1 ? 's' : ''})` : ''}.`)
              e.target.value = ''; await reload()
            }} />
          </label>
          <button className="btn-ghost" style={{ fontSize: '12px' }} onClick={async () => { const r = await authedFetch('/stock/items/export.csv'); if (!r.ok) return; const blob = await r.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `stock_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url) }}>⬇ Export CSV</button>
          <button className="primary-action" onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={15} /> Nouvel article
          </button>
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvel article" subtitle="Ajoutez un article à votre inventaire" icon={<Package size={20} />} maxWidth={600}>
        <form onSubmit={handleCreate}>
          <div className="modal-grid">
            <FieldTip label="Nom de l'article" hint="Le nom complet de l'article tel qu'il apparaîtra dans votre inventaire. Soyez précis pour faciliter les recherches." required style={{ gridColumn: '1/-1' }}>
              <input name="name" required className="modal-input" placeholder="Ex : Huile moteur 5W30, Plaquettes AV…" style={{ width: '100%', boxSizing: 'border-box' }} />
            </FieldTip>
            <FieldTip label="Catégorie" hint="La famille de l'article. Pièce = composant à monter. Consommable = produit qui se vide. Outil = équipement réutilisable.">
              <select name="category" defaultValue="piece" className="modal-select">
                <option value="piece">⚙️ Pièce</option>
                <option value="consommable">🧴 Consommable</option>
                <option value="outil">🔧 Outil</option>
                <option value="equipement">📋 Équipement</option>
                <option value="autre">📦 Autre</option>
              </select>
            </FieldTip>
            <FieldTip label="Unité" hint="L'unité de mesure : 'unit', 'L' (litres), 'kg', 'paire', 'rouleau'… Sera affiché à côté de chaque quantité." required>
              <input name="unit" defaultValue="unit" required className="modal-input" placeholder="Ex : unit, L, kg, paire" />
            </FieldTip>
            <FieldTip label="Quantité initiale" hint="Le stock actuel au moment où vous créez l'article. Vous pourrez ensuite enregistrer des achats et des sorties.">
              <input name="quantity" type="number" step="0.01" className="modal-input" placeholder="Ex : 10" />
            </FieldTip>
            <FieldTip label="Valeur unitaire (€)" hint="Le coût à l'unité de cet article. Multipliée par la quantité, elle donne la valeur totale de votre stock.">
              <input name="valueAmount" type="number" step="0.01" className="modal-input" placeholder="Ex : 12.50" />
            </FieldTip>
            <FieldTip label="Localisation" hint="L'endroit où est rangé cet article : 'Caisse rouge', 'Étagère A2', 'Coffre camion'… Facilite la recherche physique.">
              <input name="location" className="modal-input" placeholder="Ex : Caisse rouge, Étagère A2" />
            </FieldTip>
            <FieldTip label="Référence / SKU" hint="Le code fabricant ou votre référence interne. Utile pour passer commande rapidement ou faire le lien avec un catalogue.">
              <input name="reference" className="modal-input" placeholder="Ex : NGK-B8ES, REF-001" />
            </FieldTip>
            <FieldTip label="Fournisseur" hint="Le nom du fournisseur habituel. Pratique pour savoir où recommander rapidement.">
              <input name="supplier" className="modal-input" placeholder="Ex : Oscaro, Amazon, Norauto" />
            </FieldTip>
            <FieldTip label="Seuil d'alerte" hint="Activez cette option pour recevoir une alerte visuelle quand le stock passe sous la quantité minimale définie.">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text2)' }}>
                  <input name="thresholdEnabled" type="checkbox" /> Activer le seuil
                </label>
                <input name="threshold" type="number" step="0.01" className="modal-input" placeholder="Qté min." style={{ width: '100px' }} />
              </div>
            </FieldTip>
            <FieldTip label="Notes" hint="Toute information complémentaire : spécifications, compatibilités, fournisseurs alternatifs, précautions de stockage…" style={{ gridColumn: '1/-1' }}>
              <textarea name="notes" className="modal-input" rows={3} placeholder="Notes, spécifications, compatibilités…" style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
            </FieldTip>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Annuler</button>
            <button type="submit" className="primary-action"><Package size={14} /> Créer l'article</button>
          </div>
        </form>
      </Modal>

      {/* Alerte stock bas */}
      {belowThreshold.length > 0 && (
        <div style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '12px', padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <AlertTriangle size={16} style={{ color: '#f87171', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', color: '#f87171' }}>
            <strong>{belowThreshold.length} article{belowThreshold.length > 1 ? 's' : ''}</strong> sous le seuil minimal :
            <span style={{ color: 'var(--text2)', marginLeft: '6px' }}>{belowThreshold.map(i => i.name).join(', ')}</span>
          </span>
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Rechercher nom, référence, fournisseur…"
          style={{ flex: 1, minWidth: 'min(200px, 100%)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text)', fontSize: '13px', fontFamily: 'var(--font)', outline: 'none' }} />
        {(['all', 'piece', 'consommable', 'outil', 'equipement', 'autre'] as const).map(c => (
          <button key={c} onClick={() => setCatFilter(c)} style={{
            padding: '7px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--mono)', fontWeight: 600,
            border: `1px solid ${catFilter === c ? (CAT_COLORS[c] ?? 'var(--p1)') : 'var(--border)'}`,
            background: catFilter === c ? `${CAT_COLORS[c] ?? 'var(--p1)'}18` : 'none',
            color: catFilter === c ? (CAT_COLORS[c] ?? 'var(--p1)') : 'var(--text3)',
          }}>
            {c === 'all' ? 'Tous' : `${CAT_ICONS[c]} ${c}`}
          </button>
        ))}
      </div>

      {/* Grille articles */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
          <Package size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <p style={{ fontSize: '14px' }}>{searchQ ? 'Aucun résultat.' : 'Aucun article — crée-en un !'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
          {filtered.map(item => {
            const qty       = Number(item.quantity)
            const isLow     = item.thresholdEnabled && qty <= Number(item.threshold ?? 0)
            const color     = CAT_COLORS[item.category] ?? '#7b82a8'
            const totalVal  = item.valueAmount ? qty * Number(item.valueAmount) : null
            return (
              <div key={item.id} onClick={() => { setSelected(item); setView('detail'); setDetailTab('infos'); setEditMode(false) }}
                style={{ background: 'var(--card)', border: `1px solid ${isLow ? 'rgba(248,113,113,0.4)' : 'var(--border)'}`, borderTop: `3px solid ${color}`, borderRadius: '14px', padding: '18px', cursor: 'pointer', transition: 'transform 0.12s, border-color 0.12s', display: 'flex', flexDirection: 'column', gap: '10px' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {CAT_ICONS[item.category]} {item.category}
                    </span>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: isLow ? '#f87171' : 'var(--text)', marginTop: '2px', lineHeight: 1.2 }}>{item.name}</div>
                  </div>
                  {isLow && <AlertTriangle size={16} style={{ color: '#f87171', flexShrink: 0, marginTop: '2px' }} />}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '28px', fontWeight: 800, color: isLow ? '#f87171' : color, lineHeight: 1 }}>{qty.toLocaleString('fr-FR')}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{item.unit}</span>
                  {item.thresholdEnabled && <span style={{ fontSize: '10px', color: isLow ? '#f87171' : 'var(--text3)', marginLeft: 'auto', fontFamily: 'var(--mono)' }}>seuil {Number(item.threshold).toLocaleString('fr-FR')}</span>}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '10px', color: 'var(--text3)' }}>
                  {item.location && <span>📍 {item.location}</span>}
                  {item.reference && <span style={{ fontFamily: 'var(--mono)' }}>#{item.reference}</span>}
                  {item.supplier && <span>🏭 {item.supplier}</span>}
                  {totalVal !== null && <span style={{ marginLeft: 'auto', color: '#4ade80', fontWeight: 600 }}>≈ {totalVal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  /* ══════════════════════════════════════════════════
     VUE DÉTAIL
  ══════════════════════════════════════════════════ */
  const sv = selected ?? stockItems[0]
  if (!sv) return null

  const qty       = Number(sv.quantity)
  const isLow     = sv.thresholdEnabled && qty <= Number(sv.threshold ?? 0)
  const color     = CAT_COLORS[sv.category] ?? '#7b82a8'
  const totalVal  = sv.valueAmount ? qty * Number(sv.valueAmount) : null
  const activeLoans = itemLoans.filter(l => !l.returnedAt)

  const NAV: { tab: DetailTab; label: string; badge?: number }[] = [
    { tab: 'infos',      label: '📋 Infos' },
    { tab: 'mouvements', label: '📈 Mouvements', badge: itemMovements.length },
    { tab: 'prets',      label: '🤝 Prêts', badge: activeLoans.length },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '100%' }}>

      {/* ── Header détail ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 0 20px', flexWrap: 'wrap' }}>
        <button onClick={() => { setView('list'); setEditMode(false) }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 14px', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer' }}>
          <ArrowLeft size={14} /> Stock
        </button>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {CAT_ICONS[sv.category]} {sv.category}
          </span>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '2px 0 0' }}>{sv.name}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '22px', fontWeight: 800, color: isLow ? '#f87171' : color }}>{qty.toLocaleString('fr-FR')} <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text3)' }}>{sv.unit}</span></span>
          {isLow && <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '20px', background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', fontFamily: 'var(--mono)', fontWeight: 700 }}>⚠ STOCK BAS</span>}
          <button className="hdr-btn" onClick={() => setEditMode(m => !m)} title="Modifier"><Pencil size={13} /></button>
          <ConfirmButton onConfirm={handleDelete} confirmLabel="Supprimer ?" />
        </div>
      </div>

      {/* ── Corps master-detail ── */}
      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>

        {/* Navigation verticale */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '160px', flexShrink: 0 }}>
          {NAV.map(({ tab, label, badge }) => {
            const active = detailTab === tab
            return (
              <button key={tab} onClick={() => setDetailTab(tab)} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px',
                border: 'none', cursor: 'pointer', background: active ? 'rgba(124,58,237,0.18)' : 'none',
                color: active ? '#c4b5fd' : 'var(--text2)', fontSize: '13px', fontWeight: active ? 600 : 400,
                textAlign: 'left', transition: 'all 0.12s',
              }}>
                <span style={{ flex: 1 }}>{label}</span>
                {badge != null && badge > 0 && (
                  <span style={{ fontSize: '9px', background: 'rgba(124,58,237,0.4)', color: '#c4b5fd', borderRadius: '20px', padding: '1px 5px', fontWeight: 700 }}>{badge}</span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Contenu */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px' }}>

          {/* ══ INFOS ══ */}
          {detailTab === 'infos' && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <Modal open={editMode} onClose={() => setEditMode(false)} title="Modifier l'article" subtitle={sv.name} icon={<Pencil size={20} />} maxWidth={580}>
                <form onSubmit={handleUpdate}>
                  <div className="modal-grid">
                    <FieldTip label="Nom" hint="Le nom complet de l'article tel qu'il apparaît dans l'inventaire." required>
                      <input name="name" defaultValue={sv.name} required className="modal-input" placeholder="Nom de l'article" />
                    </FieldTip>
                    <FieldTip label="Catégorie" hint="La famille de l'article. Pièce, consommable, outil, équipement ou autre.">
                      <select name="category" defaultValue={sv.category} className="modal-select">
                        <option value="piece">⚙️ Pièce</option>
                        <option value="consommable">🧴 Consommable</option>
                        <option value="outil">🔧 Outil</option>
                        <option value="equipement">📋 Équipement</option>
                        <option value="autre">📦 Autre</option>
                      </select>
                    </FieldTip>
                    <FieldTip label="Unité" hint="L'unité de mesure : 'unit', 'L', 'kg', 'paire'… Affiché à côté des quantités." required>
                      <input name="unit" defaultValue={sv.unit} required className="modal-input" placeholder="Ex : unit, L, kg" />
                    </FieldTip>
                    <FieldTip label="Valeur unitaire (€)" hint="Le coût à l'unité. Multipliée par la quantité, elle donne la valeur totale du stock.">
                      <input name="valueAmount" type="number" step="0.01" defaultValue={sv.valueAmount ?? ''} className="modal-input" placeholder="Ex : 12.50" />
                    </FieldTip>
                    <FieldTip label="Localisation" hint="L'endroit où est rangé l'article : 'Caisse rouge', 'Étagère A2'…">
                      <input name="location" defaultValue={sv.location ?? ''} className="modal-input" placeholder="Ex : Caisse rouge, Étagère A2" />
                    </FieldTip>
                    <FieldTip label="Référence / SKU" hint="Le code fabricant ou référence interne. Utile pour passer commande rapidement.">
                      <input name="reference" defaultValue={sv.reference ?? ''} className="modal-input" placeholder="Ex : NGK-B8ES" />
                    </FieldTip>
                    <FieldTip label="Fournisseur" hint="Le nom du fournisseur habituel. Pratique pour savoir où recommander.">
                      <input name="supplier" defaultValue={sv.supplier ?? ''} className="modal-input" placeholder="Ex : Oscaro, Amazon" />
                    </FieldTip>
                    <FieldTip label="Seuil d'alerte" hint="Définissez une quantité minimale en dessous de laquelle une alerte visuelle sera affichée.">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text2)' }}>
                          <input name="thresholdEnabled" type="checkbox" defaultChecked={sv.thresholdEnabled} /> Activer
                        </label>
                        <input name="threshold" type="number" step="0.01" defaultValue={sv.threshold ?? ''} className="modal-input" placeholder="Qté min." style={{ width: '100px' }} />
                      </div>
                    </FieldTip>
                    <FieldTip label="Notes" hint="Toute information complémentaire : spécifications, compatibilités, précautions de stockage…" style={{ gridColumn: '1/-1' }}>
                      <textarea name="notes" defaultValue={sv.notes ?? ''} rows={3} className="modal-input" placeholder="Notes, spécifications, compatibilités…" style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
                    </FieldTip>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn-ghost" onClick={() => setEditMode(false)}>Annuler</button>
                    <button type="submit" className="primary-action">Sauvegarder</button>
                  </div>
                </form>
              </Modal>

              <div className="detail-grid">
                <span>Quantité<strong style={{ color, fontSize: '18px' }}>{qty.toLocaleString('fr-FR')} {sv.unit}</strong></span>
                <span>Catégorie<strong>{CAT_ICONS[sv.category]} {sv.category}</strong></span>
                <span>Valeur unit.<strong>{sv.valueAmount ? `${Number(sv.valueAmount).toFixed(2)} €` : '—'}</strong></span>
                <span>Valeur totale<strong style={{ color: '#4ade80' }}>{totalVal !== null ? `≈ ${totalVal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €` : '—'}</strong></span>
                <span>Localisation<strong>{sv.location ?? '—'}</strong></span>
                <span>Référence<strong style={{ fontFamily: 'var(--mono)' }}>{sv.reference ?? '—'}</strong></span>
                <span>Fournisseur<strong>{sv.supplier ?? '—'}</strong></span>
                {sv.thresholdEnabled && <span>Seuil alerte<strong style={{ color: isLow ? '#f87171' : 'var(--text)' }}>{Number(sv.threshold).toLocaleString('fr-FR')} {sv.unit}</strong></span>}
              </div>

              {sv.notes && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', color: 'var(--text2)', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                  {sv.notes}
                </div>
              )}

              {/* Achat + Sortie */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={() => setShowPurchase(true)} style={{ flex: 1, minWidth: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.07)', color: '#4ade80', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  ↑ Enregistrer un achat
                </button>
                <button onClick={() => setShowConsume(true)} style={{ flex: 1, minWidth: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.07)', color: '#f87171', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  ↓ Enregistrer une sortie
                </button>
              </div>

              <Modal open={showPurchase} onClose={() => setShowPurchase(false)} title="Enregistrer un achat" subtitle={sv.name} icon={<Package size={20} />} maxWidth={460}>
                <form onSubmit={handlePurchase}>
                  <div className="modal-grid">
                    <FieldTip label="Quantité" hint="Le nombre d'unités achetées. La valeur sera ajoutée à votre stock actuel." required style={{ gridColumn: '1/-1' }}>
                      <input name="quantity" type="number" step="0.01" required className="modal-input" placeholder={`Quantité en ${sv.unit}`} style={{ width: '100%', boxSizing: 'border-box' }} />
                    </FieldTip>
                    <FieldTip label="Coût total (€)" hint="Le montant total payé pour cet achat (pas le prix unitaire). Sera imputé au compte financier sélectionné si vous en renseignez un.">
                      <input name="valueAmount" type="number" step="0.01" className="modal-input" placeholder="Ex : 45.00" />
                    </FieldTip>
                    <FieldTip label="Date d'achat" hint="La date à laquelle vous avez effectué cet achat. Apparaîtra dans l'historique des mouvements.">
                      <input name="operationDate" type="date" defaultValue={new Date().toISOString().slice(0,10)} className="modal-input" />
                    </FieldTip>
                    <FieldTip label="Compte financier" hint="Optionnel. Si renseigné, la dépense sera automatiquement enregistrée dans vos finances et débitée du compte choisi." style={{ gridColumn: '1/-1' }}>
                      <select name="accountId" defaultValue="" className="modal-select" style={{ width: '100%' }}>
                        <option value="">Sans compte (sans imputation financière)</option>
                        {accounts.map(a => <option value={a.id} key={a.id}>{a.name}</option>)}
                      </select>
                    </FieldTip>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn-ghost" onClick={() => setShowPurchase(false)}>Annuler</button>
                    <button type="submit" className="primary-action" style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', borderColor: 'rgba(74,222,128,0.3)' }}>↑ Valider l'achat</button>
                  </div>
                </form>
              </Modal>

              <Modal open={showConsume} onClose={() => setShowConsume(false)} title="Enregistrer une sortie" subtitle={sv.name} icon={<Package size={20} />} maxWidth={460}>
                <form onSubmit={handleConsume}>
                  <div className="modal-grid">
                    <FieldTip label="Quantité sortie" hint="Le nombre d'unités consommées ou utilisées. La valeur sera déduite de votre stock actuel." required style={{ gridColumn: '1/-1' }}>
                      <input name="quantity" type="number" step="0.01" required className="modal-input" placeholder={`Quantité en ${sv.unit}`} style={{ width: '100%', boxSizing: 'border-box' }} />
                    </FieldTip>
                    <FieldTip label="Coût (€)" hint="La valeur de la quantité sortie. Optionnel, utilisé pour les statistiques de coût.">
                      <input name="valueAmount" type="number" step="0.01" className="modal-input" placeholder="Ex : 12.00" />
                    </FieldTip>
                    <FieldTip label="Véhicule concerné" hint="Optionnel. Si cette sortie est liée à un véhicule spécifique, associez-la ici pour le suivi des coûts par véhicule.">
                      <select name="vehicleId" defaultValue="" className="modal-select">
                        <option value="">Sans véhicule</option>
                        {vehicles.map(v => <option value={v.id} key={v.id}>{v.name}</option>)}
                      </select>
                    </FieldTip>
                    <FieldTip label="Note" hint="Une description courte de l'utilisation : 'Vidange moteur', 'Montage plaquettes'… Apparaîtra dans l'historique.">
                      <input name="note" className="modal-input" placeholder="Ex : Vidange moteur, Montage plaquettes…" />
                    </FieldTip>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn-ghost" onClick={() => setShowConsume(false)}>Annuler</button>
                    <button type="submit" className="primary-action" style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}>↓ Valider la sortie</button>
                  </div>
                </form>
              </Modal>
            </div>
          )}

          {/* ══ MOUVEMENTS ══ */}
          {detailTab === 'mouvements' && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {itemMovements.length === 0 ? (
                <p className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>Aucun mouvement enregistré.</p>
              ) : (
                <>
                  {/* mini KPIs */}
                  <div className="detail-grid">
                    <span>Total achats<strong style={{ color: '#4ade80' }}>{itemMovements.filter(m => m.type === 'purchase').reduce((s, m) => s + Number(m.quantity), 0).toLocaleString('fr-FR')} {sv.unit}</strong></span>
                    <span>Total sorties<strong style={{ color: '#f87171' }}>{itemMovements.filter(m => m.type === 'consume').reduce((s, m) => s + Number(m.quantity), 0).toLocaleString('fr-FR')} {sv.unit}</strong></span>
                    <span>Coût total<strong style={{ color: '#fbbf24' }}>{itemMovements.reduce((s, m) => s + Number(m.valueAmount ?? 0), 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong></span>
                  </div>
                  <div className="document-list">
                    {itemMovements.map(m => (
                      <div className="document-row" key={m.id}>
                        <span style={{ fontSize: '18px' }}>{m.type === 'purchase' ? '↑' : '↓'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: m.type === 'purchase' ? '#4ade80' : '#f87171' }}>
                            {m.type === 'purchase' ? 'Achat' : 'Sortie'} · {Number(m.quantity).toLocaleString('fr-FR')} {sv.unit}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>
                            {new Date(m.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {m.note && ` · ${m.note}`}
                          </div>
                        </div>
                        {m.valueAmount && <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>{Number(m.valueAmount).toFixed(2)} €</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══ PRÊTS ══ */}
          {detailTab === 'prets' && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>Prêts de cet outil</span>
                <button className="primary-action" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }} onClick={() => setShowCreateLoan(true)}>
                  <Plus size={13} /> Enregistrer un prêt
                </button>
              </div>
              <Modal open={showCreateLoan} onClose={() => setShowCreateLoan(false)} title="Enregistrer un prêt" subtitle={sv.name} icon={<RotateCcw size={20} />} maxWidth={460}>
                <form onSubmit={handleCreateLoan}>
                  <div className="modal-grid">
                    <FieldTip label="Prêté à" hint="Le nom de la personne ou de l'entreprise à qui vous prêtez cet outil. Sera affiché dans la liste des prêts actifs." required style={{ gridColumn: '1/-1' }}>
                      <input name="borrowerName" required className="modal-input" placeholder="Ex : Jean Dupont, Garage Martin…" style={{ width: '100%', boxSizing: 'border-box' }} />
                    </FieldTip>
                    <FieldTip label="Date du prêt" hint="La date à laquelle vous remettez l'outil. Par défaut : aujourd'hui.">
                      <input name="loanDate" type="date" defaultValue={new Date().toISOString().slice(0,10)} className="modal-input" />
                    </FieldTip>
                    <FieldTip label="Retour prévu" hint="La date à laquelle vous attendez le retour. Une alerte sera affichée si la date est dépassée sans retour enregistré.">
                      <input name="expectedReturnDate" type="date" className="modal-input" />
                    </FieldTip>
                    <FieldTip label="Notes" hint="Toute information utile : état de l'outil au départ, conditions du prêt, contact de l'emprunteur…" style={{ gridColumn: '1/-1' }}>
                      <textarea name="notes" className="modal-input" rows={2} placeholder="État, conditions, contact…" style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
                    </FieldTip>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn-ghost" onClick={() => setShowCreateLoan(false)}>Annuler</button>
                    <button type="submit" className="primary-action"><RotateCcw size={13} /> Enregistrer le prêt</button>
                  </div>
                </form>
              </Modal>

              {itemLoans.length === 0 ? (
                <p className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>Aucun prêt pour cet article.</p>
              ) : (
                <div className="document-list">
                  {itemLoans.map(l => {
                    const isOverdue = !l.returnedAt && l.expectedReturnDate && new Date(l.expectedReturnDate) < new Date()
                    return (
                      <div key={l.id} className="document-row"
                        style={{ borderLeft: `3px solid ${l.returnedAt ? '#4ade80' : isOverdue ? '#f87171' : 'var(--p1)'}`, opacity: l.returnedAt ? 0.6 : 1 }}>
                        <RotateCcw size={14} style={{ color: l.returnedAt ? '#4ade80' : isOverdue ? '#f87171' : '#c4b5fd', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: '13px' }}>{l.borrowerName}</strong>
                          <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>
                            {new Date(l.loanDate).toLocaleDateString('fr-FR')}
                            {l.expectedReturnDate && ` → ${new Date(l.expectedReturnDate).toLocaleDateString('fr-FR')}`}
                          </div>
                          {l.notes && <div style={{ fontSize: '10px', color: 'var(--text3)', fontStyle: 'italic' }}>{l.notes}</div>}
                        </div>
                        {l.returnedAt
                          ? <span style={{ fontSize: '10px', color: '#4ade80', fontFamily: 'var(--mono)' }}>Retourné {new Date(l.returnedAt).toLocaleDateString('fr-FR')}</span>
                          : <button className="btn-ghost" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleReturn(l.id)}>
                              <RotateCcw size={11} /> Retour
                            </button>
                        }
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
