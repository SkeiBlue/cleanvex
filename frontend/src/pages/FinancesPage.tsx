import { useCallback, useEffect, useState } from 'react'
import { CircleDollarSign } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type {
  FinancialAccount, FinancialCategory, FinancialSummary,
  FinancialTransaction, PropertyItem, VehicleItem,
} from '../types'

type FormEv = { preventDefault(): void; currentTarget: HTMLFormElement }

export function FinancesPage() {
  const { authedFetch } = useAuth()
  const [financeSummary, setFinanceSummary] = useState<FinancialSummary | null>(null)
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([])
  const [financialCategories, setFinancialCategories] = useState<FinancialCategory[]>([])
  const [filterType, setFilterType] = useState<string>('all')
  const [filterAccountId, setFilterAccountId] = useState<string>('all')
  const [financialTransactions, setFinancialTransactions] = useState<FinancialTransaction[]>([])
  const [vehicles, setVehicles] = useState<VehicleItem[]>([])
  const [properties, setProperties] = useState<PropertyItem[]>([])
  const [message, setMessage] = useState('')

  const reload = useCallback(async () => {
    const [s, a, c, t] = await Promise.all([
      authedFetch('/finances/summary'), authedFetch('/finances/accounts'),
      authedFetch('/finances/categories'), authedFetch('/finances/transactions'),
    ])
    if (s.ok) setFinanceSummary(await s.json())
    if (a.ok) setFinancialAccounts(await a.json())
    if (c.ok) setFinancialCategories(await c.json())
    if (t.ok) setFinancialTransactions(await t.json())
  }, [authedFetch])

  useEffect(() => {
    async function load() {
      const [v, p] = await Promise.all([authedFetch('/vehicles'), authedFetch('/real-estate/properties')])
      if (v.ok) setVehicles(await v.json())
      if (p.ok) setProperties(await p.json())
      await reload()
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
    if (!r.ok) { setMessage('Creation compte refusee.'); return }
    form.reset(); setMessage('Compte cree.'); await reload()
  }

  async function handleCreateCategory(event: FormEv) {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    const data = new FormData(form)
    const r = await authedFetch('/finances/categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: data.get('name'), type: data.get('type'), color: data.get('color') || undefined }),
    })
    if (!r.ok) { setMessage('Creation categorie refusee.'); return }
    form.reset(); setMessage('Categorie creee.'); await reload()
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
    if (!r.ok) { setMessage('Creation operation refusee.'); return }
    form.reset(); setMessage('Operation creee.'); await reload()
  }

  return (
    <section className="finance-layout">
      <article className="panel">
        <div className="panel-header">
          <div><span className="panel-kicker">Finances</span><h2>Resume</h2></div>
          <CircleDollarSign size={20} />
        </div>
        <div className="detail-grid">
          <span>Comptes<strong>{financeSummary?.accountCount ?? 0}</strong></span>
          <span>Operations<strong>{financeSummary?.transactionCount ?? 0}</strong></span>
          <span>Revenus<strong>{(financeSummary?.income ?? 0).toFixed(2)} €</strong></span>
          <span>Depenses<strong>{(financeSummary?.expense ?? 0).toFixed(2)} €</strong></span>
        </div>
        {message && <p className="form-message">{message}</p>}
        <form className="compact-form" onSubmit={handleCreateAccount}>
          <input name="name" placeholder="Compte" required />
          <input name="type" placeholder="Type" defaultValue="checking" required />
          <input name="currency" placeholder="Devise" defaultValue="EUR" />
          <input name="initialBalance" type="number" step="0.01" placeholder="Solde initial" />
          <button className="primary-action" type="submit">Compte</button>
        </form>
        <form className="compact-form" onSubmit={handleCreateCategory}>
          <input name="name" placeholder="Categorie" required />
          <select name="type" defaultValue="expense">
            <option value="expense">Depense</option>
            <option value="income">Revenu</option>
          </select>
          <input name="color" placeholder="Couleur" defaultValue="#06b6d4" />
          <button className="primary-action" type="submit">Categorie</button>
        </form>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div><span className="panel-kicker">Operations</span><h2>Mouvements</h2></div>
          <span className="badge">{financialTransactions.length}</span>
        </div>
        <form className="finance-form" onSubmit={handleCreateTransaction}>
          <input name="label" placeholder="Libelle" required />
          <select name="type" defaultValue="expense">
            <option value="expense">Depense</option>
            <option value="income">Revenu</option>
          </select>
          <input name="amount" type="number" step="0.01" placeholder="Montant" required />
          <input name="operationDate" type="date" required />
          <select name="accountId" defaultValue="" required>
            <option value="" disabled>Compte</option>
            {financialAccounts.map((a) => <option value={a.id} key={a.id}>{a.name}</option>)}
          </select>
          <select name="categoryId" defaultValue="">
            <option value="">Categorie</option>
            {financialCategories.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}
          </select>
          <select name="vehicleId" defaultValue="">
            <option value="">Sans vehicule</option>
            {vehicles.map((v) => <option value={v.id} key={v.id}>{v.name}</option>)}
          </select>
          <select name="propertyId" defaultValue="">
            <option value="">Sans bien</option>
            {properties.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}
          </select>
          <input name="note" placeholder="Note" />
          <button className="primary-action" type="submit">Ajouter</button>
        </form>
        <div style={{ display: 'flex', gap: '8px', padding: '8px 20px' }}>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '6px 10px', fontSize: '12px', fontFamily: 'var(--font)' }}
          >
            <option value="all">Tous types</option>
            <option value="expense">Dépenses</option>
            <option value="income">Revenus</option>
          </select>
          <select
            value={filterAccountId}
            onChange={e => setFilterAccountId(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '6px 10px', fontSize: '12px', fontFamily: 'var(--font)' }}
          >
            <option value="all">Tous comptes</option>
            {financialAccounts.map((a) => <option value={a.id} key={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="document-list">
          {financialTransactions
            .filter(t => filterType === 'all' || t.type === filterType)
            .filter(t => filterAccountId === 'all' || t.account.id === filterAccountId)
            .slice(0, 20)
            .map((t) => (
              <div className="document-row" key={t.id}>
                <CircleDollarSign size={18} />
                <span>
                  {t.label}
                  {t.category && <em style={{ color: 'var(--text3)', fontSize: '10px', marginLeft: '6px' }}>{t.category.name}</em>}
                </span>
                <small style={{ color: t.type === 'expense' ? '#f87171' : '#4ade80' }}>
                  {t.type === 'expense' ? '-' : '+'}{Number(t.amount).toFixed(2)} €
                </small>
              </div>
            ))
          }
          {financialTransactions.filter(t => filterType === 'all' || t.type === filterType).filter(t => filterAccountId === 'all' || t.account.id === filterAccountId).length === 0 && (
            <p className="muted">Aucune operation pour ces filtres.</p>
          )}
        </div>
      </article>
    </section>
  )
}
