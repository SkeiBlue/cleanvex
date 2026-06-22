import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, Package, Pencil, Plus, RotateCcw } from 'lucide-react'
import { ConfirmButton } from '../components/ConfirmButton'
import { FieldTip } from '../components/FieldTip'
import { Modal } from '../components/Modal'
import { useAuth } from '../contexts/AuthContext'
import { SkeletonGridPage } from '../components/Skeleton'
import { useToast } from '../contexts/ToastContext'
import { parseApiError } from '../hooks/useApiError'
import type { FinancialAccount, StockItem, StockMovement, ToolLoan, UnitItem, VehicleItem } from '../types'

type FormEv = { preventDefault(): void; currentTarget: HTMLFormElement }
type View = 'list' | 'detail'
type DetailTab = 'infos' | 'mouvements' | 'prets'

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
  // #F — on stocke l'id sélectionné et on DÉRIVE l'objet depuis stockItems :
  // plus besoin d'un effet de re-sync, et l'article affiché n'est jamais périmé.
  const [selectedId, setSelectedId]   = useState<string | null>(null)
  // #E — verrou anti double-soumission pendant une requête réseau.
  const [busy, setBusy]               = useState(false)
  const [detailTab, setDetailTab]     = useState<DetailTab>('infos')
  const [editMode, setEditMode]       = useState(false)

  const [searchQ, setSearchQ]         = useState('')
  const [catFilter, setCatFilter]     = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'in-stock' | 'to-buy'>('all')
  const [showCreate, setShowCreate]   = useState(false)
  const [showPurchase, setShowPurchase] = useState(false)
  const [showConsume, setShowConsume]   = useState(false)
  const [showCreateLoan, setShowCreateLoan] = useState(false)
  // Sprint 2 — Contacts (dégradable).
  const [contacts, setContacts] = useState<{ id: string; displayName: string; organization: string | null }[]>([])
  // Sprint 3 — liste d'unités personnalisables (defaults + user, actives).
  const [units, setUnits] = useState<UnitItem[]>([])

  /* ── Data ── */
  const reload = useCallback(async () => {
    const [si, sl] = await Promise.all([
      authedFetch('/stock/items'),
      authedFetch('/stock/loans'),
    ])
    if (si.ok) setStockItems(await si.json())
    if (sl.ok) setToolLoans(await sl.json())
  }, [authedFetch])

  // #A — charge TOUT l'historique de mouvements d'un article (filtre serveur),
  // au lieu des 20 derniers globaux qui tronquaient/faisaient disparaître
  // l'historique et faussaient les KPIs de la fiche.
  const loadItemMovements = useCallback(async (itemId: string) => {
    const r = await authedFetch(`/stock/movements?stockItemId=${itemId}&limit=1000`)
    if (r.ok) { const d = await r.json(); setMovements(d.data ?? d) }
  }, [authedFetch])

  useEffect(() => {
    async function load() {
      const [v, a, c, u] = await Promise.all([
        authedFetch('/vehicles'),
        authedFetch('/finances/accounts'),
        authedFetch('/contacts'),
        authedFetch('/units'),
      ])
      if (v.ok) setVehicles(await v.json())
      if (a.ok) setAccounts(await a.json())
      if (c.ok) setContacts(await c.json())
      if (u.ok) setUnits((await u.json() as UnitItem[]).filter(x => x.isActive))
      await reload()
      setIsLoading(false)
    }
    load()
  }, [authedFetch, reload])

  // #F — objet sélectionné dérivé de la liste : toujours à jour après reload.
  const selected = selectedId ? stockItems.find(i => i.id === selectedId) ?? null : null

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
      status: d.get('status') || undefined,
      location: d.get('location') || undefined,
      valueAmount: d.get('valueAmount') ? Number(d.get('valueAmount')) : undefined,
      reference: d.get('reference') || undefined,
      supplier: d.get('supplier') || undefined,
      supplierContactId: d.get('supplierContactId') || undefined,
      notes: d.get('notes') || undefined,
      thresholdEnabled: d.get('thresholdEnabled') === 'on',
      threshold: d.get('threshold') ? Number(d.get('threshold')) : undefined,
    }
    if (!body.name || !body.category || !body.unit) {
      toast.err('Nom, catégorie et unité sont obligatoires.'); return
    }
    if (busy) return
    setBusy(true)
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
      setSelectedId(created.id); setView('detail'); setDetailTab('infos')
    } catch (err) {
      toast.err(`Erreur réseau : ${err instanceof Error ? err.message : 'inconnue'}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdate(e: FormEv) {
    e.preventDefault(); if (!selected || busy) return
    setBusy(true)
    const d = new FormData(e.currentTarget)
    const r = await authedFetch(`/stock/items/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: d.get('name') || undefined, category: d.get('category') || undefined,
        unit: d.get('unit') || undefined, location: d.get('location') || undefined,
        status: d.get('status') || undefined,
        valueAmount: d.get('valueAmount') ? Number(d.get('valueAmount')) : undefined,
        reference: d.get('reference') || undefined, supplier: d.get('supplier') || undefined,
        supplierContactId: d.get('supplierContactId') !== null ? ((d.get('supplierContactId') as string) || '') : undefined,
        notes: d.get('notes') || undefined,
        thresholdEnabled: d.get('thresholdEnabled') === 'on',
        threshold: d.get('threshold') ? Number(d.get('threshold')) : undefined,
      }),
    })
    if (!r.ok) { toast.err(await parseApiError(r, 'Mise à jour refusée.')); setBusy(false); return }
    setEditMode(false); toast.ok('Article mis à jour.'); await reload(); setBusy(false)
  }

  async function handleDelete() {
    if (!selected || busy) return
    setBusy(true)
    const r = await authedFetch(`/stock/items/${selected.id}`, { method: 'DELETE' })
    if (!r.ok) { toast.err(await parseApiError(r, 'Suppression refusée.')); setBusy(false); return }
    toast.ok('Article supprimé.'); setSelectedId(null); setView('list'); await reload(); setBusy(false)
  }

  async function handlePurchase(e: FormEv) {
    e.preventDefault(); if (!selected || busy) return
    const itemId = selected.id; const form = e.currentTarget
    setBusy(true)
    const d = new FormData(form)
    const r = await authedFetch(`/stock/items/${itemId}/purchase`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: Number(d.get('quantity')),
        valueAmount: d.get('valueAmount') ? Number(d.get('valueAmount')) : undefined,
        accountId: d.get('accountId') || undefined,
        operationDate: d.get('operationDate') || undefined,
      }),
    })
    if (!r.ok) { toast.err(await parseApiError(r, 'Achat refusé.')); setBusy(false); return }
    // #G — rafraîchissement ciblé : maj locale de la quantité + historique de
    // l'article (1 requête) au lieu d'un reload complet (flicker/latence).
    const res = await r.json().catch(() => null)
    form.reset(); setShowPurchase(false); toast.ok('Achat enregistré.')
    if (res?.item) setStockItems(prev => prev.map(i => i.id === res.item.id ? { ...i, ...res.item } : i))
    await loadItemMovements(itemId)
    setDetailTab('mouvements'); setBusy(false)
  }

  async function handleConsume(e: FormEv) {
    e.preventDefault(); if (!selected || busy) return
    const itemId = selected.id; const form = e.currentTarget
    setBusy(true)
    const d = new FormData(form)
    const r = await authedFetch(`/stock/items/${itemId}/consume`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: Number(d.get('quantity')),
        valueAmount: d.get('valueAmount') ? Number(d.get('valueAmount')) : undefined,
        vehicleId: d.get('vehicleId') || undefined,
        note: d.get('note') || undefined,
      }),
    })
    if (!r.ok) { toast.err(await parseApiError(r, 'Sortie refusée.')); setBusy(false); return }
    const res = await r.json().catch(() => null)
    form.reset(); setShowConsume(false); toast.ok('Sortie enregistrée.')
    if (res?.item) setStockItems(prev => prev.map(i => i.id === res.item.id ? { ...i, ...res.item } : i))
    await loadItemMovements(itemId)
    setDetailTab('mouvements'); setBusy(false)
  }

  async function handleCreateLoan(e: FormEv) {
    e.preventDefault(); if (!selected || busy) return
    setBusy(true)
    const d = new FormData(e.currentTarget)
    const r = await authedFetch('/stock/loans', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stockItemId: selected.id,
        borrowerName: d.get('borrowerName') || undefined,
        borrowerContactId: d.get('borrowerContactId') || undefined,
        loanDate: d.get('loanDate') || undefined,
        expectedReturnDate: d.get('expectedReturnDate') || undefined,
        notes: d.get('notes') || undefined,
      }),
    })
    if (!r.ok) { toast.err(await parseApiError(r, 'Prêt refusé.')); setBusy(false); return }
    e.currentTarget.reset(); setShowCreateLoan(false); toast.ok('Prêt enregistré.'); await reload(); setBusy(false)
  }

  async function handleReturn(loanId: string) {
    if (busy) return
    setBusy(true)
    const r = await authedFetch(`/stock/loans/${loanId}/return`, { method: 'PATCH' })
    if (!r.ok) { toast.err(await parseApiError(r, 'Retour refusé.')); setBusy(false); return }
    toast.ok('Retour enregistré.'); await reload(); setBusy(false)
  }

  /* ── Dérivés ── */
  // #H — on n'alerte pas sur les articles « à acheter » (wishlist) : un item
  // à 0 avec seuil activé n'est pas un vrai stock bas.
  const belowThreshold = stockItems.filter(i => (i.status ?? 'in-stock') !== 'to-buy' && i.thresholdEnabled && Number(i.quantity) <= Number(i.threshold ?? 0))
  const totalValue     = stockItems.reduce((s, i) => s + Number(i.quantity) * Number(i.valueAmount ?? 0), 0)

  const filtered = stockItems.filter(i => {
    const matchQ      = !searchQ || i.name.toLowerCase().includes(searchQ.toLowerCase()) || (i.reference ?? '').toLowerCase().includes(searchQ.toLowerCase()) || (i.supplier ?? '').toLowerCase().includes(searchQ.toLowerCase())
    const matchCat    = catFilter === 'all' || i.category === catFilter
    const matchStatus = statusFilter === 'all' || (i.status ?? 'in-stock') === statusFilter
    return matchQ && matchCat && matchStatus
  })

  const toBuyCount = stockItems.filter(i => (i.status ?? 'in-stock') === 'to-buy').length

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
            <span className="btn-ghost" style={{ fontSize: '12px' }}>Importer CSV</span>
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
          <button className="btn-ghost" style={{ fontSize: '12px' }} onClick={async () => { const r = await authedFetch('/stock/items/export.csv'); if (!r.ok) return; const blob = await r.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `stock_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url) }}>Exporter CSV</button>
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
                <option value="piece">Pièce</option>
                <option value="consommable">Consommable</option>
                <option value="outil">Outil</option>
                <option value="equipement">Équipement</option>
                <option value="autre">Autre</option>
              </select>
            </FieldTip>
            <FieldTip label="Unité" hint="L'unité de mesure (litre, pièce, kg, mètre…). Gère la liste dans Paramètres → Unités." required>
              <select name="unit" defaultValue="pièce" required className="modal-input">
                {units.map(u => (
                  <option key={u.id} value={u.label}>{u.label} ({u.symbol})</option>
                ))}
              </select>
            </FieldTip>
            <FieldTip label="Quantité initiale" hint="Le stock actuel au moment où vous créez l'article. Mettez 0 si c'est un article que vous souhaitez acheter mais que vous n'avez pas encore.">
              <input name="quantity" type="number" min="0" step="0.01" className="modal-input" placeholder="Ex : 10" />
            </FieldTip>
            <FieldTip label="Statut" hint="« En stock » pour un article que vous possédez. « À acheter » pour un article que vous voulez acheter prochainement (wishlist d'achat).">
              <select name="status" defaultValue="in-stock" className="modal-select">
                <option value="in-stock">En stock</option>
                <option value="to-buy">À acheter</option>
              </select>
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
            <FieldTip label="Fournisseur (texte libre)" hint="Le nom du fournisseur habituel, écrit librement. Pour un fournisseur ponctuel sans fiche contact.">
              <input name="supplier" className="modal-input" placeholder="Ex : Oscaro, Amazon, Norauto" />
            </FieldTip>
            {contacts.length > 0 && (
              <FieldTip label="Fournisseur (contact)" hint="Ou bien lie ce stock à un contact existant. Si les deux sont remplis, le contact est prioritaire à l'affichage.">
                <select name="supplierContactId" defaultValue="" className="modal-select">
                  <option value="">— Aucun contact —</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.displayName}{c.organization ? ` — ${c.organization}` : ''}</option>
                  ))}
                </select>
              </FieldTip>
            )}
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
            <button type="submit" className="primary-action" disabled={busy}><Package size={14} /> Créer l'article</button>
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
            {c === 'all' ? 'Tous' : c}
          </button>
        ))}
      </div>

      {/* Filtre statut — en évidence si des articles "à acheter" existent */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {([
          { key: 'all',      label: 'Tous',           count: stockItems.length },
          { key: 'in-stock', label: 'En stock',    count: stockItems.length - toBuyCount },
          { key: 'to-buy',   label: `À acheter${toBuyCount > 0 ? ` (${toBuyCount})` : ''}`, count: toBuyCount },
        ] as const).map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key as 'all' | 'in-stock' | 'to-buy')} style={{
            padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
            fontSize: 12, fontFamily: 'var(--font)', fontWeight: 600,
            border: `1px solid ${statusFilter === f.key ? (f.key === 'to-buy' ? '#fbbf24' : 'var(--p1)') : 'var(--border)'}`,
            background: statusFilter === f.key
              ? (f.key === 'to-buy' ? 'rgba(251,191,36,0.12)' : 'rgba(124,58,237,0.12)')
              : 'rgba(255,255,255,0.02)',
            color: statusFilter === f.key
              ? (f.key === 'to-buy' ? '#fbbf24' : '#c4b5fd')
              : 'var(--text2)',
          }}>
            {f.label}
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
            const isToBuy   = (item.status ?? 'in-stock') === 'to-buy'
            const color     = CAT_COLORS[item.category] ?? '#7b82a8'
            const totalVal  = item.valueAmount ? qty * Number(item.valueAmount) : null
            const accentColor = isToBuy ? '#fbbf24' : color
            return (
              <div key={item.id} onClick={() => { setSelectedId(item.id); setView('detail'); setDetailTab('infos'); setEditMode(false); loadItemMovements(item.id) }}
                style={{ background: isToBuy ? 'rgba(251,191,36,0.04)' : 'var(--card)', border: `1px solid ${isLow ? 'rgba(248,113,113,0.4)' : isToBuy ? 'rgba(251,191,36,0.3)' : 'var(--border)'}`, borderTop: `3px solid ${accentColor}`, borderRadius: '14px', padding: '18px', cursor: 'pointer', transition: 'transform 0.12s, border-color 0.12s', display: 'flex', flexDirection: 'column', gap: '10px' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', color: accentColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {item.category}
                    </span>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: isLow ? '#f87171' : 'var(--text)', marginTop: '2px', lineHeight: 1.2 }}>{item.name}</div>
                  </div>
                  {isToBuy && (
                    <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)', flexShrink: 0, marginTop: 2 }}>À ACHETER</span>
                  )}
                  {!isToBuy && isLow && <AlertTriangle size={16} style={{ color: '#f87171', flexShrink: 0, marginTop: '2px' }} />}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '28px', fontWeight: 800, color: isLow ? '#f87171' : color, lineHeight: 1 }}>{qty.toLocaleString('fr-FR')}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{item.unit}</span>
                  {item.thresholdEnabled && <span style={{ fontSize: '10px', color: isLow ? '#f87171' : 'var(--text3)', marginLeft: 'auto', fontFamily: 'var(--mono)' }}>seuil {Number(item.threshold).toLocaleString('fr-FR')}</span>}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '10px', color: 'var(--text3)' }}>
                  {item.location && <span>{item.location}</span>}
                  {item.reference && <span style={{ fontFamily: 'var(--mono)' }}>#{item.reference}</span>}
                  {(item.supplierContact?.displayName || item.supplier) && (
                    <span title={item.supplierContact ? 'Contact lié' : 'Fournisseur libre'}>
                      {item.supplierContact?.displayName ?? item.supplier}
                    </span>
                  )}
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
    { tab: 'infos',      label: 'Infos' },
    { tab: 'mouvements', label: 'Mouvements', badge: itemMovements.length },
    { tab: 'prets',      label: 'Prêts', badge: activeLoans.length },
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
            {sv.category}
          </span>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '2px 0 0' }}>{sv.name}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '22px', fontWeight: 800, color: isLow ? '#f87171' : color }}>{qty.toLocaleString('fr-FR')} <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text3)' }}>{sv.unit}</span></span>
          {isLow && <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '20px', background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', fontFamily: 'var(--mono)', fontWeight: 700 }}>STOCK BAS</span>}
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
                        <option value="piece">Pièce</option>
                        <option value="consommable">Consommable</option>
                        <option value="outil">Outil</option>
                        <option value="equipement">Équipement</option>
                        <option value="autre">Autre</option>
                      </select>
                    </FieldTip>
                    <FieldTip label="Unité" hint="L'unité de mesure. Gère la liste dans Paramètres → Unités." required>
                      <select name="unit" defaultValue={sv.unit} required className="modal-input">
                        {/* Inclut l'unité courante même si désactivée, pour ne pas perdre la valeur. */}
                        {units.some(u => u.label === sv.unit) ? null : <option value={sv.unit}>{sv.unit}</option>}
                        {units.map(u => (
                          <option key={u.id} value={u.label}>{u.label} ({u.symbol})</option>
                        ))}
                      </select>
                    </FieldTip>
                    <FieldTip label="Statut" hint="Bascule entre « En stock » et « À acheter » (wishlist). Quand l'article arrive, repassez-le en « En stock ».">
                      <select name="status" defaultValue={sv.status ?? 'in-stock'} className="modal-select">
                        <option value="in-stock">En stock</option>
                        <option value="to-buy">À acheter</option>
                      </select>
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
                    <FieldTip label="Fournisseur (texte libre)" hint="Le nom du fournisseur habituel, écrit librement.">
                      <input name="supplier" defaultValue={sv.supplier ?? ''} className="modal-input" placeholder="Ex : Oscaro, Amazon" />
                    </FieldTip>
                    {contacts.length > 0 && (
                      <FieldTip label="Fournisseur (contact)" hint="Lie ce stock à un contact existant. Si vide, on garde uniquement le texte libre.">
                        <select name="supplierContactId" defaultValue={sv.supplierContactId ?? ''} className="modal-select">
                          <option value="">— Aucun contact —</option>
                          {contacts.map(c => (
                            <option key={c.id} value={c.id}>{c.displayName}{c.organization ? ` — ${c.organization}` : ''}</option>
                          ))}
                        </select>
                      </FieldTip>
                    )}
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
                    <button type="submit" className="primary-action" disabled={busy}>Sauvegarder</button>
                  </div>
                </form>
              </Modal>

              <div className="detail-grid">
                <span>Quantité<strong style={{ color, fontSize: '18px' }}>{qty.toLocaleString('fr-FR')} {sv.unit}</strong></span>
                <span>Catégorie<strong>{sv.category}</strong></span>
                <span>Valeur unit.<strong>{sv.valueAmount ? `${Number(sv.valueAmount).toFixed(2)} €` : '—'}</strong></span>
                <span>Valeur totale<strong style={{ color: '#4ade80' }}>{totalVal !== null ? `≈ ${totalVal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €` : '—'}</strong></span>
                <span>Localisation<strong>{sv.location ?? '—'}</strong></span>
                <span>Référence<strong style={{ fontFamily: 'var(--mono)' }}>{sv.reference ?? '—'}</strong></span>
                <span>Fournisseur<strong>{sv.supplierContact?.displayName ?? sv.supplier ?? '—'}</strong></span>
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
                    <button type="submit" className="primary-action" disabled={busy} style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', borderColor: 'rgba(74,222,128,0.3)' }}>↑ Valider l'achat</button>
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
                    <button type="submit" className="primary-action" disabled={busy} style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}>↓ Valider la sortie</button>
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
                    {contacts.length > 0 && (
                      <FieldTip label="Prêté à (contact)" hint="Optionnel. Sélectionne un contact existant. Sinon, écris juste le nom ci-dessous." style={{ gridColumn: '1/-1' }}>
                        <select name="borrowerContactId" defaultValue="" className="modal-select">
                          <option value="">— Aucun contact —</option>
                          {contacts.map(c => (
                            <option key={c.id} value={c.id}>{c.displayName}{c.organization ? ` — ${c.organization}` : ''}</option>
                          ))}
                        </select>
                      </FieldTip>
                    )}
                    <FieldTip label="Prêté à (texte libre)" hint="Tu peux choisir un contact ci-dessus OU écrire un nom manuellement ici. L'un des deux est requis." style={{ gridColumn: '1/-1' }}>
                      <input name="borrowerName" className="modal-input" placeholder="Ex : Jean Dupont, Garage Martin…" style={{ width: '100%', boxSizing: 'border-box' }} />
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
                    <button type="submit" className="primary-action" disabled={busy}><RotateCcw size={13} /> Enregistrer le prêt</button>
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
                          <strong style={{ fontSize: '13px' }}>{l.borrowerContact?.displayName ?? l.borrowerName ?? '—'}</strong>
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
