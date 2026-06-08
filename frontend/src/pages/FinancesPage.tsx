import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownUp, CircleDollarSign, Pencil, Plus } from 'lucide-react'
import { ConfirmButton } from '../components/ConfirmButton'
import { FieldTip } from '../components/FieldTip'
import { Modal } from '../components/Modal'
import { useAuth } from '../contexts/AuthContext'
import { SkeletonTabPage } from '../components/Skeleton'
import { useToast } from '../contexts/ToastContext'
import { BalanceLineChart, CategoryPieChart, ChartPanel, MonthlyBarChart } from '../components/ChartsSection'
import { generateFinancePDF } from '../utils/pdf'
import type {
  FinancialAccount, FinancialCategory, FinancialSummary,
  FinancialTransaction, PropertyItem, VehicleItem,
} from '../types'

type FormEv = { preventDefault(): void; currentTarget: HTMLFormElement }
type Tab = 'resume' | 'operations' | 'comptes'

const SELECT_STYLE: React.CSSProperties = {
  background: 'rgba(12,16,41,0.95)', border: '1px solid var(--border)',
  borderRadius: '8px', color: 'var(--text)', padding: '8px 10px',
  fontSize: '12px', fontFamily: 'var(--font)',
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 18px', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font)',
      cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
      borderBottom: active ? '2px solid var(--p1)' : '2px solid transparent',
      background: 'none', color: active ? '#c4b5fd' : 'var(--text2)', transition: 'all 0.15s',
    }}>{label}</button>
  )
}

export function FinancesPage() {
  const { authedFetch } = useAuth()
  const [financeSummary, setFinanceSummary] = useState<FinancialSummary | null>(null)
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([])
  const [financialCategories, setFinancialCategories] = useState<FinancialCategory[]>([])
  const [filterType, setFilterType] = useState<string>('all')
  const [filterAccountId, setFilterAccountId] = useState<string>('all')
  const [filterSearch, setFilterSearch] = useState('')
  const [financialTransactions, setFinancialTransactions] = useState<FinancialTransaction[]>([])
  const [vehicles, setVehicles] = useState<VehicleItem[]>([])
  const [properties, setProperties] = useState<PropertyItem[]>([])
  const toast = useToast()
  const [editingTx, setEditingTx] = useState<FinancialTransaction | null>(null)
  const [showCreateTx, setShowCreateTx]         = useState(false)
  const [showCreateAccount, setShowCreateAccount] = useState(false)
  const [showCreateCategory, setShowCreateCategory] = useState(false)
  const [sortField, setSortField] = useState<'date' | 'amount' | 'label'>('date')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [visibleCount, setVisibleCount] = useState(20)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('resume')

  const reload = useCallback(async () => {
    const [s, a, c, t] = await Promise.all([
      authedFetch('/finances/summary'), authedFetch('/finances/accounts'),
      authedFetch('/finances/categories'), authedFetch('/finances/transactions'),
    ])
    if (s.ok) setFinanceSummary(await s.json())
    if (a.ok) setFinancialAccounts(await a.json())
    if (c.ok) setFinancialCategories(await c.json())
    if (t.ok) { const d = await t.json(); setFinancialTransactions(d.data ?? d) }
  }, [authedFetch])

  useEffect(() => {
    async function load() {
      const [v, p] = await Promise.all([authedFetch('/vehicles'), authedFetch('/real-estate/properties')])
      if (v.ok) setVehicles(await v.json())
      if (p.ok) setProperties(await p.json())
      await reload()
      setIsLoading(false)
    }
    load()
  }, [authedFetch, reload])

  async function handleCreateAccount(event: FormEv) {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    const data = new FormData(form)
    const r = await authedFetch('/finances/accounts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name'), type: data.get('type'),
        currency: data.get('currency') || 'EUR',
        initialBalance: data.get('initialBalance') ? Number(data.get('initialBalance')) : 0,
      }),
    })
    if (!r.ok) { toast.err('Création compte refusée.'); return }
    form.reset(); setShowCreateAccount(false); toast.ok('Compte créé.'); await reload()
  }

  async function handleCreateCategory(event: FormEv) {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    const data = new FormData(form)
    const r = await authedFetch('/finances/categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: data.get('name'), type: data.get('type'), color: data.get('color') || undefined }),
    })
    if (!r.ok) { toast.err('Création catégorie refusée.'); return }
    form.reset(); setShowCreateCategory(false); toast.ok('Catégorie créée.'); await reload()
  }

  async function handleCreateTransaction(event: FormEv) {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    const data = new FormData(form)
    const vehicleId = data.get('vehicleId')?.toString()
    const propertyId = data.get('propertyId')?.toString()
    const r = await authedFetch('/finances/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: data.get('type'), amount: Number(data.get('amount')),
        accountId: data.get('accountId'), categoryId: data.get('categoryId') || undefined,
        operationDate: data.get('operationDate'), label: data.get('label'), note: data.get('note') || undefined,
        sourceModule: propertyId ? 'real-estate' : vehicleId ? 'vehicles' : undefined,
        sourceType: propertyId ? 'property' : vehicleId ? 'vehicle' : undefined,
        sourceId: propertyId || vehicleId || undefined,
      }),
    })
    if (!r.ok) { toast.err('Création opération refusée.'); return }
    form.reset(); setShowCreateTx(false); toast.ok('Opération créée.'); await reload()
  }

  async function handleUpdateTransaction(event: FormEv) {
    event.preventDefault()
    if (!editingTx) return
    const form = event.currentTarget as HTMLFormElement
    const data = new FormData(form)
    const r = await authedFetch(`/finances/transactions/${editingTx.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: data.get('label') || undefined,
        accountId: data.get('accountId') || undefined,
        categoryId: data.get('categoryId') || undefined,
        operationDate: data.get('operationDate') || undefined,
        note: data.get('note') || undefined,
      }),
    })
    if (!r.ok) { toast.err('Mise à jour refusée.'); return }
    setEditingTx(null); toast.ok('Opération mise à jour.'); await reload()
  }

  async function handleDeleteTransaction(id: string, _label: string) {
    const r = await authedFetch(`/finances/transactions/${id}`, { method: 'DELETE' })
    if (!r.ok) { toast.err('Suppression refusée.'); return }
    toast.ok('Opération supprimée.'); await reload()
  }

  async function handleDeleteAccount(id: string, _name: string) {
    const r = await authedFetch(`/finances/accounts/${id}`, { method: 'DELETE' })
    if (!r.ok) { toast.err('Suppression refusée — des transactions sont peut-être liées.'); return }
    toast.ok('Compte supprimé.'); await reload()
  }

  async function handleDeleteCategory(id: string, _name: string) {
    const r = await authedFetch(`/finances/categories/${id}`, { method: 'DELETE' })
    if (!r.ok) { toast.err('Suppression refusée.'); return }
    toast.ok('Catégorie supprimée.'); await reload()
  }

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const filtered = useMemo(() => {
    const base = financialTransactions
      .filter(t => filterType === 'all' || t.type === filterType)
      .filter(t => filterAccountId === 'all' || t.account.id === filterAccountId)
      .filter(t => !filterSearch || t.label.toLowerCase().includes(filterSearch.toLowerCase()))
    return [...base].sort((a, b) => {
      let cmp = 0
      if (sortField === 'date') cmp = new Date(a.operationDate).getTime() - new Date(b.operationDate).getTime()
      else if (sortField === 'amount') cmp = Number(a.amount) - Number(b.amount)
      else if (sortField === 'label') cmp = a.label.localeCompare(b.label, 'fr')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [financialTransactions, filterType, filterAccountId, filterSearch, sortField, sortDir])

  const balance = (financeSummary?.income ?? 0) - (financeSummary?.expense ?? 0)

  if (isLoading) return <SkeletonTabPage rows={10} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ─── TABS ─── */}
      <div className="tabs-bar">
        <TabBtn label="Résumé" active={activeTab === 'resume'} onClick={() => setActiveTab('resume')} />
        <TabBtn label={`Opérations (${financialTransactions.length})`} active={activeTab === 'operations'} onClick={() => setActiveTab('operations')} />
        <TabBtn label="Comptes & Catégories" active={activeTab === 'comptes'} onClick={() => setActiveTab('comptes')} />
      </div>

      {/* ══ RÉSUMÉ ══ */}
      {activeTab === 'resume' && (
        <>
        <article className="panel" style={{ marginTop: '16px' }}>
          <div className="panel-header">
            <div><span className="panel-kicker">Finances</span><h2>Résumé</h2></div>
            <CircleDollarSign size={20} />
          </div>
          <div className="detail-grid">
            <span>Comptes<strong>{financeSummary?.accountCount ?? 0}</strong></span>
            <span>Opérations<strong>{financeSummary?.transactionCount ?? 0}</strong></span>
            <span>Revenus<strong style={{ color: '#4ade80' }}>{(financeSummary?.income ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</strong></span>
            <span>Dépenses<strong style={{ color: '#f87171' }}>{(financeSummary?.expense ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</strong></span>
            <span style={{ gridColumn: '1/-1' }}>
              Solde net
              <strong style={{ color: balance >= 0 ? '#4ade80' : '#f87171', fontSize: '15px' }}>
                {balance >= 0 ? '+' : ''}{balance.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </strong>
            </span>
          </div>
          <div style={{ padding: '12px 20px 20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn-ghost" onClick={() => setActiveTab('operations')} style={{ fontSize: '12px' }}>
              Voir les opérations →
            </button>
            <button className="btn-ghost" onClick={() => setActiveTab('comptes')} style={{ fontSize: '12px' }}>
              Gérer les comptes →
            </button>
            {/* Import CSV */}
            <label style={{ marginLeft: 'auto', cursor: 'pointer' }}>
              <input
                type="file" accept=".csv" style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return
                  const form = new FormData(); form.append('file', file)
                  const r = await authedFetch('/finances/transactions/import.csv', { method: 'POST', body: form })
                  if (r.ok) {
                    const d = await r.json() as { created: number; errors: string[]; total: number }
                    toast.ok(`✓ ${d.created} / ${d.total} opérations importées`)
                    if (d.errors.length) toast.err(d.errors.slice(0, 3).join(' · '))
                    await reload()
                  } else { toast.err('Import échoué') }
                  e.target.value = ''
                }}
              />
              <span className="btn-ghost" style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                ⬆ Importer CSV
              </span>
            </label>
          </div>
        </article>

        {/* ── Graphiques ────────────────────────────────────────────── */}
        {financialTransactions.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '16px' }}>
            <ChartPanel title="Revenus / Dépenses" kicker="6 derniers mois">
              <MonthlyBarChart transactions={financialTransactions} months={6} />
            </ChartPanel>
            <ChartPanel title="Dépenses par catégorie" kicker="Toutes périodes">
              <CategoryPieChart transactions={financialTransactions} />
            </ChartPanel>
          </div>
        )}
        {financialTransactions.length > 1 && (
          <div style={{ marginTop: '16px' }}>
            <ChartPanel title="Évolution du solde" kicker="12 derniers mois">
              <BalanceLineChart transactions={financialTransactions} />
            </ChartPanel>
          </div>
        )}
        </>
      )}

      {/* ══ OPÉRATIONS ══ */}
      {activeTab === 'operations' && (
        <article className="panel" style={{ marginTop: '16px' }}>
          <div className="panel-header">
            <div><span className="panel-kicker">Opérations</span><h2>Mouvements</h2></div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className="badge">{filtered.length} / {financialTransactions.length}</span>
              <button className="btn-ghost" style={{ fontSize: '12px' }} onClick={async () => { const r = await authedFetch('/finances/transactions/export.csv'); if (!r.ok) return; const blob = await r.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `transactions_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url); }}>⬇ CSV</button>
              <button className="btn-ghost" style={{ fontSize: '12px' }} onClick={() => { if (financeSummary) generateFinancePDF(financialTransactions, { income: financeSummary.income, expense: financeSummary.expense, balance: balance, accountCount: financeSummary.accountCount }) }}>📄 PDF</button>
            </div>
          </div>

          {/* Bouton + Modal nouvelle opération */}
          <div style={{ padding: '0 20px 12px' }}>
            <button className="primary-action" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowCreateTx(true)}>
              <Plus size={14} /> Nouvelle opération
            </button>
          </div>

          <Modal open={showCreateTx} onClose={() => setShowCreateTx(false)} title="Nouvelle opération" subtitle="Enregistre un revenu ou une dépense sur l'un de tes comptes." icon="💶">
            <form onSubmit={handleCreateTransaction}>
              <div className="modal-grid">
                <FieldTip label="Libellé" hint="Description de l'opération — sois précis pour retrouver facilement. Ex : 'Essence Total Clermont', 'Loyer décembre'." required style={{ gridColumn: '1/-1' }}>
                  <input name="label" className="modal-input" placeholder="Ex : Plein essence A75" required autoFocus />
                </FieldTip>
                <FieldTip label="Type" hint="Dépense = argent qui sort. Revenu = argent qui entre. Influence le solde du compte et les graphiques.">
                  <select name="type" className="modal-select" defaultValue="expense">
                    <option value="expense">↓ Dépense</option>
                    <option value="income">↑ Revenu</option>
                  </select>
                </FieldTip>
                <FieldTip label="Montant (€)" hint="Montant brut de l'opération, toujours positif. Le type (dépense/revenu) détermine le signe." required>
                  <input name="amount" type="number" step="0.01" min="0.01" className="modal-input" placeholder="0.00" required />
                </FieldTip>
                <FieldTip label="Date" hint="Date réelle de l'opération (pas la date de saisie). Utilisée pour les graphiques mensuels." required>
                  <input name="operationDate" type="date" className="modal-input" defaultValue={new Date().toISOString().slice(0,10)} required />
                </FieldTip>
                <FieldTip label="Compte" hint="Compte débité ou crédité. Si tu as plusieurs comptes, choisis le bon pour que les soldes restent justes." required>
                  <select name="accountId" className="modal-select" defaultValue="" required>
                    <option value="" disabled>Sélectionner un compte</option>
                    {financialAccounts.map(a => <option value={a.id} key={a.id}>{a.name}</option>)}
                  </select>
                </FieldTip>
                <FieldTip label="Catégorie" hint="Regroupe les dépenses par thème pour les graphiques. Ex : Carburant, Assurance, Alimentation.">
                  <select name="categoryId" className="modal-select" defaultValue="">
                    <option value="">Sans catégorie</option>
                    {financialCategories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}
                  </select>
                </FieldTip>
                <FieldTip label="Véhicule lié" hint="Lie cette dépense à un véhicule pour la retrouver dans l'onglet Budget du véhicule.">
                  <select name="vehicleId" className="modal-select" defaultValue="">
                    <option value="">Sans véhicule</option>
                    {vehicles.map(v => <option value={v.id} key={v.id}>{v.name}</option>)}
                  </select>
                </FieldTip>
                <FieldTip label="Bien immobilier lié" hint="Associe à un bien pour le suivi financier immobilier.">
                  <select name="propertyId" className="modal-select" defaultValue="">
                    <option value="">Sans bien</option>
                    {properties.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}
                  </select>
                </FieldTip>
                <FieldTip label="Note" hint="Détails supplémentaires : référence facture, motif, numéro de contrat, etc." style={{ gridColumn: '1/-1' }}>
                  <input name="note" className="modal-input" placeholder="Ex : Facture n°2024-045, pneus hiver" />
                </FieldTip>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setShowCreateTx(false)}>Annuler</button>
                <button type="submit" className="primary-action">Enregistrer</button>
              </div>
            </form>
          </Modal>

          {/* Modal édition opération */}
          <Modal open={!!editingTx} onClose={() => setEditingTx(null)} title={`Modifier : ${editingTx?.label ?? ''}`} subtitle="Corrige le libellé, la date, le compte ou la catégorie de cette opération." icon={<Pencil size={16} />}>
            {editingTx && (
              <form onSubmit={handleUpdateTransaction}>
                <div className="modal-grid">
                  <FieldTip label="Libellé" hint="Description visible dans la liste des opérations." style={{ gridColumn: '1/-1' }}>
                    <input name="label" className="modal-input" defaultValue={editingTx.label} autoFocus />
                  </FieldTip>
                  <FieldTip label="Date" hint="Date réelle de l'opération.">
                    <input name="operationDate" type="date" className="modal-input" defaultValue={new Date(editingTx.operationDate).toISOString().slice(0,10)} />
                  </FieldTip>
                  <FieldTip label="Compte" hint="Compte débité ou crédité.">
                    <select name="accountId" className="modal-select" defaultValue={editingTx.account.id}>
                      {financialAccounts.map(a => <option value={a.id} key={a.id}>{a.name}</option>)}
                    </select>
                  </FieldTip>
                  <FieldTip label="Catégorie" hint="Pour les graphiques de répartition.">
                    <select name="categoryId" className="modal-select" defaultValue={editingTx.category?.id ?? ''}>
                      <option value="">Sans catégorie</option>
                      {financialCategories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}
                    </select>
                  </FieldTip>
                  <FieldTip label="Note" hint="Commentaire libre sur l'opération." style={{ gridColumn: '1/-1' }}>
                    <input name="note" className="modal-input" defaultValue={editingTx.note ?? ''} placeholder="Optionnel" />
                  </FieldTip>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn-ghost" onClick={() => setEditingTx(null)}>Annuler</button>
                  <button type="submit" className="primary-action">Sauvegarder</button>
                </div>
              </form>
            )}
          </Modal>

          {/* Filtres */}
          <div style={{ display: 'flex', gap: '8px', padding: '8px 20px', flexWrap: 'wrap' }}>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...SELECT_STYLE, padding: '6px 10px' }}>
              <option value="all">Tous types</option>
              <option value="expense">Dépenses</option>
              <option value="income">Revenus</option>
            </select>
            <select value={filterAccountId} onChange={e => setFilterAccountId(e.target.value)} style={{ ...SELECT_STYLE, padding: '6px 10px' }}>
              <option value="all">Tous comptes</option>
              {financialAccounts.map((a) => <option value={a.id} key={a.id}>{a.name}</option>)}
            </select>
            <input
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              placeholder="Rechercher..."
              style={{ flex: 1, minWidth: '120px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px', color: 'var(--text)', fontSize: '12px', fontFamily: 'var(--font)', outline: 'none' }}
            />
          </div>

          {/* Tri */}
          <div style={{ display: 'flex', gap: '6px', padding: '0 20px 8px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>TRI :</span>
            {(['date', 'amount', 'label'] as const).map(f => (
              <button
                key={f}
                className="btn-ghost"
                style={{ fontSize: '11px', padding: '3px 8px', color: sortField === f ? '#a78bfa' : 'var(--text3)', borderColor: sortField === f ? 'rgba(167,139,250,0.3)' : undefined }}
                onClick={() => toggleSort(f)}
              >
                {f === 'date' ? 'Date' : f === 'amount' ? 'Montant' : 'Libellé'}
                {sortField === f && <ArrowDownUp size={10} style={{ marginLeft: 3 }} />}
              </button>
            ))}
          </div>

          {/* Liste */}
          <div className="document-list">
            {filtered.length === 0 && <p className="muted">Aucune opération pour ces filtres.</p>}
            {filtered.slice(0, visibleCount).map((t) => (
              <div className="document-row" key={t.id} style={{ gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', flexShrink: 0 }}>
                  <span style={{ fontSize: '14px' }}>{t.type === 'expense' ? '↓' : '↑'}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                    <em style={{ fontSize: '10px', color: 'var(--text3)', fontStyle: 'normal', fontFamily: 'var(--mono)' }}>
                      {new Date(t.operationDate).toLocaleDateString('fr-FR')}
                    </em>
                    <em style={{ fontSize: '10px', color: 'var(--text3)', fontStyle: 'normal' }}>{t.account.name}</em>
                    {t.category && (
                      <em style={{ fontSize: '10px', fontStyle: 'normal', padding: '0 5px', borderRadius: '10px', background: `${t.category.color ?? '#7b82a8'}20`, color: t.category.color ?? '#7b82a8' }}>
                        {t.category.name}
                      </em>
                    )}
                    {t.note && <em style={{ fontSize: '10px', color: 'var(--text3)', fontStyle: 'italic' }}>{t.note}</em>}
                  </div>
                </div>
                <strong style={{ color: t.type === 'expense' ? '#f87171' : '#4ade80', fontFamily: 'var(--mono)', fontSize: '13px', flexShrink: 0 }}>
                  {t.type === 'expense' ? '-' : '+'}{Number(t.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </strong>
                <button className="hdr-btn" title="Modifier" onClick={() => setEditingTx(t)} style={{ width: '26px', height: '26px', flexShrink: 0 }}>
                  <Pencil size={12} />
                </button>
                <ConfirmButton onConfirm={() => handleDeleteTransaction(t.id, t.label)} />
              </div>
            ))}
            {filtered.length > visibleCount && (
              <button
                className="btn-ghost"
                style={{ width: '100%', padding: '10px', fontSize: '12px', borderRadius: '0 0 8px 8px', borderTop: '1px solid var(--border)' }}
                onClick={() => setVisibleCount(c => c + 20)}
              >
                Afficher plus ({filtered.length - visibleCount} restantes)
              </button>
            )}
          </div>
        </article>
      )}

      {/* ══ COMPTES & CATÉGORIES ══ */}
      {activeTab === 'comptes' && (
        <article className="panel" style={{ marginTop: '16px' }}>
          <div className="panel-header">
            <div><span className="panel-kicker">Gestion</span><h2>Comptes & Catégories</h2></div>
            <CircleDollarSign size={20} />
          </div>

          <div style={{ padding: '8px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>COMPTES</span>
            <button className="btn-ghost" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => setShowCreateAccount(true)}>
              <Plus size={12} /> Nouveau compte
            </button>
          </div>
          <Modal open={showCreateAccount} onClose={() => setShowCreateAccount(false)} title="Nouveau compte" subtitle="Ajoute un compte bancaire, d'épargne, ou un portefeuille espèces." icon="🏦">
            <form onSubmit={handleCreateAccount}>
              <div className="modal-grid">
                <FieldTip label="Nom du compte" hint="Identifiant court. Ex : 'Compte courant LCL', 'Livret A', 'Wallet cash'. Apparaît dans tous les formulaires." required style={{ gridColumn: '1/-1' }}>
                  <input name="name" className="modal-input" placeholder="Ex : Compte courant LCL" required autoFocus />
                </FieldTip>
                <FieldTip label="Type" hint="Courant : compte du quotidien. Épargne : livret, PEL. Espèces : argent liquide. Investissement : CTO, PEA…">
                  <select name="type" className="modal-select" defaultValue="checking">
                    <option value="checking">💳 Courant</option>
                    <option value="savings">💰 Épargne</option>
                    <option value="cash">💵 Espèces</option>
                    <option value="investment">📈 Investissement</option>
                  </select>
                </FieldTip>
                <FieldTip label="Devise" hint="Monnaie du compte. EUR pour euro, USD pour dollar, etc.">
                  <input name="currency" className="modal-input" defaultValue="EUR" placeholder="EUR" />
                </FieldTip>
                <FieldTip label="Solde initial (€)" hint="Solde du compte au moment de la création dans l'app. Les transactions s'ajouteront à partir de là." style={{ gridColumn: '1/-1' }}>
                  <input name="initialBalance" type="number" step="0.01" className="modal-input" placeholder="0.00" />
                </FieldTip>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setShowCreateAccount(false)}>Annuler</button>
                <button type="submit" className="primary-action">Créer le compte</button>
              </div>
            </form>
          </Modal>

          {financialAccounts.length > 0 && (
            <div className="document-list">
              {financialAccounts.map(a => (
                <div className="document-row" key={a.id}>
                  <CircleDollarSign size={14} style={{ color: '#67e8f9' }} />
                  <span style={{ flex: 1 }}>{a.name}</span>
                  <small style={{ fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{a.type} · {a.currency}</small>
                  <ConfirmButton onConfirm={() => handleDeleteAccount(a.id, a.name)} />
                </div>
              ))}
            </div>
          )}

          <div style={{ padding: '8px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>CATÉGORIES</span>
            <button className="btn-ghost" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => setShowCreateCategory(true)}>
              <Plus size={12} /> Nouvelle catégorie
            </button>
          </div>
          <Modal open={showCreateCategory} onClose={() => setShowCreateCategory(false)} title="Nouvelle catégorie" subtitle="Crée une catégorie pour regrouper tes opérations dans les graphiques." icon="🏷️">
            <form onSubmit={handleCreateCategory}>
              <div className="modal-grid">
                <FieldTip label="Nom" hint="Libellé de la catégorie. Ex : 'Carburant', 'Assurances', 'Alimentation'. Court et reconnaissable." required style={{ gridColumn: '1/-1' }}>
                  <input name="name" className="modal-input" placeholder="Ex : Carburant" required autoFocus />
                </FieldTip>
                <FieldTip label="Type" hint="Dépense : catégorie associée aux sorties d'argent. Revenu : catégorie pour les entrées (salaire, loyer perçu…).">
                  <select name="type" className="modal-select" defaultValue="expense">
                    <option value="expense">↓ Dépense</option>
                    <option value="income">↑ Revenu</option>
                  </select>
                </FieldTip>
                <FieldTip label="Couleur" hint="Couleur affichée dans les graphiques camembert. Format hexadécimal. Ex : #06b6d4 pour cyan.">
                  <input name="color" type="color" className="modal-input" defaultValue="#06b6d4" style={{ height: '42px', cursor: 'pointer' }} />
                </FieldTip>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setShowCreateCategory(false)}>Annuler</button>
                <button type="submit" className="primary-action">Créer la catégorie</button>
              </div>
            </form>
          </Modal>

          {financialCategories.length > 0 && (
            <div className="document-list">
              {financialCategories.map(c => (
                <div className="document-row" key={c.id}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.color ?? '#7b82a8', flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{c.name}</span>
                  <small style={{ color: c.type === 'expense' ? '#f87171' : '#4ade80' }}>{c.type}</small>
                  <ConfirmButton onConfirm={() => handleDeleteCategory(c.id, c.name)} />
                </div>
              ))}
            </div>
          )}
        </article>
      )}
    </div>
  )
}
