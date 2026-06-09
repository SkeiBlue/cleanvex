import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, Bell, Car, FileText, Home,
  Package, ShieldCheck, TrendingUp, UserRound,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { SkeletonDashboard } from '../components/Skeleton'
import { MonthlyBarChart, CategoryPieChart, ChartPanel } from '../components/ChartsSection'
import type { AgendaDashboard, DocumentItem, FinancialSummary, FinancialTransaction, ReportSummary, VehicleItem } from '../types'

type VehicleWithAlerts = VehicleItem & { _count: { interventions: number; alerts: number } }

function StatTile({
  icon, label, value, sub, color = 'var(--p1)', to,
}: {
  icon: React.ReactNode; label: string; value: string | number
  sub?: string; color?: string; to: string
}) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px', transition: 'border-color 0.15s, transform 0.1s', cursor: 'pointer' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = color; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = 'none' }}
      >
        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '3px' }}>{label}</div>
          {sub && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '1px' }}>{sub}</div>}
        </div>
      </div>
    </Link>
  )
}

function UrgentBanner({ overdueTasks, openAlerts, expiringDocs }: { overdueTasks: number; openAlerts: number; expiringDocs: number }) {
  const total = overdueTasks + openAlerts + expiringDocs
  if (total === 0) return (
    <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <ShieldCheck size={18} style={{ color: '#4ade80' }} />
      <span style={{ fontSize: '13px', color: '#4ade80', fontWeight: 600 }}>Tout est en ordre — aucune urgence.</span>
    </div>
  )
  return (
    <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '12px', padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <AlertTriangle size={16} style={{ color: '#f87171' }} />
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#f87171', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>{total} point{total > 1 ? 's' : ''} nécessitant attention</span>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {overdueTasks > 0 && (
          <Link to="/app/agenda" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', cursor: 'pointer' }}>
              ⏰ {overdueTasks} tâche{overdueTasks > 1 ? 's' : ''} en retard
            </span>
          </Link>
        )}
        {openAlerts > 0 && (
          <Link to="/app/vehicles" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', cursor: 'pointer' }}>
              🔔 {openAlerts} alerte{openAlerts > 1 ? 's' : ''} véhicule
            </span>
          </Link>
        )}
        {expiringDocs > 0 && (
          <Link to="/app/documents" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', cursor: 'pointer' }}>
              📄 {expiringDocs} document{expiringDocs > 1 ? 's' : ''} expirent bientôt
            </span>
          </Link>
        )}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { authedFetch, setUnreadNotifications } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [agenda, setAgenda] = useState<AgendaDashboard | null>(null)
  const [finance, setFinance] = useState<FinancialSummary | null>(null)
  const [vehicles, setVehicles] = useState<VehicleWithAlerts[]>([])
  const [stockCount, setStockCount] = useState(0)
  const [report, setReport] = useState<ReportSummary | null>(null)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([])
  const [failedSections, setFailedSections] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      // allSettled : un endpoint en panne ne doit pas casser tout le dashboard.
      // Chaque section signale son échec pour qu'on l'affiche plutôt que de
      // laisser des "0" silencieux qu'on ne saurait pas distinguer de vrais 0.
      const endpoints = [
        { key: 'Agenda',       path: '/agenda/dashboard' },
        { key: 'Finances',     path: '/finances/summary' },
        { key: 'Véhicules',    path: '/vehicles' },
        { key: 'Stock',        path: '/stock/items' },
        { key: 'Rapports',     path: '/reports/summary' },
        { key: 'Documents',    path: '/documents' },
        { key: 'Transactions', path: '/finances/transactions' },
      ] as const

      const results = await Promise.allSettled(endpoints.map(e => authedFetch(e.path)))
      const failed: string[] = []

      async function take<T>(i: number, fn: (json: unknown) => T | Promise<T>): Promise<T | undefined> {
        const r = results[i]
        if (r.status === 'rejected' || !r.value.ok) { failed.push(endpoints[i].key); return undefined }
        try { return await fn(await r.value.json()) } catch { failed.push(endpoints[i].key); return undefined }
      }

      await take(0, (d: any) => { setAgenda(d); setUnreadNotifications(d?.unreadNotifications ?? 0) })
      await take(1, (d: any) => setFinance(d))
      await take(2, (d: any) => setVehicles(d))
      await take(3, (d: any) => setStockCount(Array.isArray(d) ? d.length : 0))
      await take(4, (d: any) => setReport(d))
      await take(5, (d: any) => setDocuments(d?.data ?? d ?? []))
      await take(6, (d: any) => setTransactions(d?.data ?? d ?? []))

      setFailedSections(failed)
      setIsLoading(false)
    }
    load()
  }, [authedFetch, setUnreadNotifications])

  if (isLoading) return <SkeletonDashboard />

  /* ── dérivés ── */
  const overdueTasks  = agenda?.overdueTasks ?? 0
  const openAlerts    = vehicles.reduce((s, v) => s + (v._count?.alerts ?? 0), 0)
  const vehiclesInRepair = vehicles.filter(v => v.status === 'repair')
  const soon30        = new Date(Date.now() + 30 * 86400000)
  const expiringDocs  = documents.filter(d => d.expiresAt && new Date(d.expiresAt) <= soon30 && new Date(d.expiresAt) > new Date()).length
  const upcomingTasks = agenda?.upcomingTasks ?? []
  const balance       = finance?.balance ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Titre */}
      <div data-tour="dashboard-title">
        <span style={{ fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Vue globale</span>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: '2px 0 0' }}>Tableau de bord</h1>
      </div>

      {/* Sections indisponibles : on évite les "0" qui pourraient être confondus avec de vraies valeurs nulles. */}
      {failedSections.length > 0 && (
        <div role="status" style={{
          padding: '10px 14px', borderRadius: 10, fontSize: 12.5,
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
          color: 'var(--text2)',
        }}>
          Données partiellement indisponibles : {failedSections.join(', ')}. Réessaie dans un instant.
        </div>
      )}

      {/* Bannière urgences */}
      <UrgentBanner overdueTasks={overdueTasks} openAlerts={openAlerts} expiringDocs={expiringDocs} />

      {/* Stats tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
        <StatTile icon={<Car size={20} />} label="Véhicules" value={vehicles.length} sub={vehiclesInRepair.length > 0 ? `${vehiclesInRepair.length} en réparation` : 'Aucun en réparation'} color="#67e8f9" to="/app/vehicles" />
        <StatTile icon={<TrendingUp size={20} />} label="Solde" value={`${balance >= 0 ? '+' : ''}${balance.toFixed(0)} €`} sub={`${(finance?.income ?? 0).toFixed(0)} € revenus`} color={balance >= 0 ? '#4ade80' : '#f87171'} to="/app/finances" />
        <StatTile icon={<Package size={20} />} label="Stock" value={stockCount} sub="articles référencés" color="#fbbf24" to="/app/stock" />
        <StatTile icon={<Bell size={20} />} label="Tâches" value={agenda?.openTasks ?? 0} sub={overdueTasks > 0 ? `⚠ ${overdueTasks} en retard` : 'Tout à jour'} color={overdueTasks > 0 ? '#f87171' : '#a78bfa'} to="/app/agenda" />
        <StatTile icon={<Home size={20} />} label="Biens" value={report?.counts.properties ?? 0} sub="biens immobiliers" color="#a78bfa" to="/app/real-estate" />
        <StatTile icon={<UserRound size={20} />} label="Contacts" value={report?.counts.contacts ?? 0} sub="dans le carnet" color="#f9a8d4" to="/app/contacts" />
        <StatTile icon={<FileText size={20} />} label="Documents" value={report?.counts.documents ?? 0} sub={expiringDocs > 0 ? `⚠ ${expiringDocs} expirent bientôt` : 'Tous valides'} color={expiringDocs > 0 ? '#fbbf24' : '#4ade80'} to="/app/documents" />
      </div>

      {/* Corps 2 colonnes */}
      <div className="grid-2">

        {/* Tâches à venir */}
        <article className="panel">
          <div className="panel-header">
            <div><span className="panel-kicker">Agenda</span><h2>Tâches à venir</h2></div>
            <Link to="/app/agenda" className="btn-ghost">Tout voir →</Link>
          </div>
          <div style={{ padding: '4px 0' }}>
            {upcomingTasks.length === 0 ? (
              <p className="muted" style={{ padding: '8px 20px' }}>Aucune tâche planifiée.</p>
            ) : upcomingTasks.map(t => {
              const due = t.dueDate ? new Date(t.dueDate) : null
              const isLate = due ? due < new Date() : false
              const days = due ? Math.ceil((due.getTime() - Date.now()) / 86400000) : null
              const priColors: Record<string, string> = { urgent: '#f87171', high: '#fbbf24', normal: '#a78bfa', low: '#7b82a8' }
              return (
                <div key={t.id} className="document-row" style={{ borderLeft: `3px solid ${priColors[t.priority] ?? 'var(--border)'}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{t.title}</div>
                    {due && <div style={{ fontSize: '11px', color: isLate ? '#f87171' : 'var(--text3)', marginTop: '2px', fontFamily: 'var(--mono)' }}>
                      {isLate ? `⏰ En retard (${Math.abs(days!)}j)` : days === 0 ? '📅 Aujourd\'hui' : `📅 J-${days}`}
                    </div>}
                  </div>
                  <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '20px', background: `${priColors[t.priority] ?? '#7b82a8'}20`, color: priColors[t.priority] ?? '#7b82a8', border: `1px solid ${priColors[t.priority] ?? '#7b82a8'}40`, fontFamily: 'var(--mono)', fontWeight: 700 }}>
                    {t.priority}
                  </span>
                </div>
              )
            })}
          </div>
        </article>

        {/* Véhicules avec alertes */}
        <article className="panel">
          <div className="panel-header">
            <div><span className="panel-kicker">Garage</span><h2>Véhicules actifs</h2></div>
            <Link to="/app/vehicles" className="btn-ghost">Tout voir →</Link>
          </div>
          <div style={{ padding: '4px 0' }}>
            {vehicles.length === 0 ? (
              <p className="muted" style={{ padding: '8px 20px' }}>Aucun véhicule.</p>
            ) : vehicles.filter(v => v.status !== 'sold').slice(0, 5).map(v => {
              const alerts = v._count?.alerts ?? 0
              const interv = v._count?.interventions ?? 0
              const statusColors: Record<string, string> = { active: '#4ade80', repair: '#fbbf24', parked: '#7b82a8' }
              return (
                <div key={v.id} className="document-row">
                  <span style={{ fontSize: '16px' }}>🚗</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{v.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{v.mileage.toLocaleString('fr-FR')} km</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {alerts > 0 && <span style={{ fontSize: '11px', background: '#fbbf2420', color: '#fbbf24', padding: '2px 6px', borderRadius: '20px', border: '1px solid #fbbf2440', fontFamily: 'var(--mono)', fontWeight: 700 }}>🔔 {alerts}</span>}
                    {interv > 0 && <span style={{ fontSize: '11px', background: '#a78bfa20', color: '#a78bfa', padding: '2px 6px', borderRadius: '20px', border: '1px solid #a78bfa40', fontFamily: 'var(--mono)', fontWeight: 700 }}>🔧 {interv}</span>}
                    <span style={{ fontSize: '11px', background: `${statusColors[v.status] ?? '#7b82a8'}20`, color: statusColors[v.status] ?? '#7b82a8', padding: '2px 6px', borderRadius: '20px', border: `1px solid ${statusColors[v.status] ?? '#7b82a8'}40`, fontFamily: 'var(--mono)', fontWeight: 700 }}>
                      {v.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </article>

        {/* Résumé finances */}
        <article className="panel">
          <div className="panel-header">
            <div><span className="panel-kicker">Finances</span><h2>Résumé</h2></div>
            <Link to="/app/finances" className="btn-ghost">Voir →</Link>
          </div>
          <div className="detail-grid">
            <span>Comptes<strong>{finance?.accountCount ?? 0}</strong></span>
            <span>Opérations<strong>{finance?.transactionCount ?? 0}</strong></span>
            <span>Revenus<strong style={{ color: '#4ade80' }}>{(finance?.income ?? 0).toLocaleString('fr-FR')} €</strong></span>
            <span>Dépenses<strong style={{ color: '#f87171' }}>{(finance?.expense ?? 0).toLocaleString('fr-FR')} €</strong></span>
            <span>Solde net<strong style={{ color: balance >= 0 ? '#4ade80' : '#f87171', fontSize: '16px' }}>{balance >= 0 ? '+' : ''}{balance.toFixed(2)} €</strong></span>
          </div>
        </article>

        {/* Docs qui expirent */}
        <article className="panel">
          <div className="panel-header">
            <div><span className="panel-kicker">Documents</span><h2>Expirent bientôt</h2></div>
            <Link to="/app/documents" className="btn-ghost">Voir →</Link>
          </div>
          <div style={{ padding: '4px 0' }}>
            {documents.filter(d => d.expiresAt && new Date(d.expiresAt) <= soon30).length === 0 ? (
              <p className="muted" style={{ padding: '8px 20px' }}>Aucun document n'expire dans les 30 prochains jours.</p>
            ) : documents.filter(d => d.expiresAt && new Date(d.expiresAt) <= soon30).sort((a, b) => new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime()).slice(0, 6).map(d => {
              const daysLeft = Math.ceil((new Date(d.expiresAt!).getTime() - Date.now()) / 86400000)
              const isExpired = daysLeft < 0
              const color = isExpired ? '#f87171' : daysLeft <= 7 ? '#f87171' : daysLeft <= 14 ? '#fbbf24' : '#a78bfa'
              return (
                <div key={d.id} className="document-row">
                  <FileText size={16} style={{ color, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{d.name}</span>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--mono)', fontWeight: 700, color }}>
                    {isExpired ? `Exp. il y a ${Math.abs(daysLeft)}j` : daysLeft === 0 ? 'Expire auj.' : `J-${daysLeft}`}
                  </span>
                </div>
              )
            })}
          </div>
        </article>

      </div>

      {/* ── Graphiques financiers ─────────────────────────────────────── */}
      {transactions.length > 0 && (
        <div className="charts-grid">
          <ChartPanel title="Revenus / Dépenses" kicker="Finances · 6 mois">
            <MonthlyBarChart transactions={transactions} months={6} />
          </ChartPanel>
          <ChartPanel title="Répartition dépenses" kicker="Finances · par catégorie">
            <CategoryPieChart transactions={transactions} />
          </ChartPanel>
        </div>
      )}

    </div>
  )
}
