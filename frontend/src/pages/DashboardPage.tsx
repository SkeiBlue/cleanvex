import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, ShieldCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { AlertBanner } from '../components/AlertBanner'
import { StatCard } from '../components/StatCard'
import type { ActivityLog, AgendaDashboard, FinancialSummary, ReportSummary, VehicleItem } from '../types'

export function DashboardPage() {
  const { authedFetch, setUnreadNotifications } = useAuth()
  const [agendaDashboard, setAgendaDashboard] = useState<AgendaDashboard | null>(null)
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [financeSummary, setFinanceSummary] = useState<FinancialSummary | null>(null)
  const [vehicles, setVehicles] = useState<VehicleItem[]>([])
  const [stockCount, setStockCount] = useState(0)
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null)

  useEffect(() => {
    async function load() {
      const [agenda, activity, finance, veh, stock, report] = await Promise.all([
        authedFetch('/agenda/dashboard'),
        authedFetch('/activity'),
        authedFetch('/finances/summary'),
        authedFetch('/vehicles'),
        authedFetch('/stock/items'),
        authedFetch('/reports/summary'),
      ])
      if (agenda.ok) {
        const d = await agenda.json()
        setAgendaDashboard(d)
        setUnreadNotifications(d.unreadNotifications ?? 0)
      }
      if (activity.ok) setActivityLogs(await activity.json())
      if (finance.ok) setFinanceSummary(await finance.json())
      if (veh.ok) setVehicles(await veh.json())
      if (stock.ok) { const d = await stock.json(); setStockCount(d.length) }
      if (report.ok) setReportSummary(await report.json())
    }
    load()
  }, [authedFetch, setUnreadNotifications])

  const stats = useMemo(() => [
    {
      colorClass: 'c1' as const, label: 'VEHICULES', icon: '🚗',
      value: vehicles.length, sub: `${vehicles.length} total`,
      trend: '→ Stable', trendClass: 'trend-flat' as const,
    },
    {
      colorClass: 'c2' as const, label: 'SOLDE', icon: '💰',
      value: financeSummary ? `${financeSummary.balance.toFixed(0)}€` : '-',
      sub: 'revenus - depenses',
      trend: (financeSummary?.balance ?? 0) >= 0 ? '↑ positif' : '↓ deficit',
      trendClass: ((financeSummary?.balance ?? 0) >= 0 ? 'trend-up' : 'trend-down') as 'trend-up' | 'trend-down',
    },
    {
      colorClass: 'c3' as const, label: 'STOCK', icon: '📦',
      value: stockCount, sub: 'articles en stock',
      trend: '→ Stable', trendClass: 'trend-flat' as const,
    },
    {
      colorClass: 'c4' as const, label: 'TACHES', icon: '✅',
      value: agendaDashboard?.openTasks ?? 0,
      sub: `${agendaDashboard?.overdueTasks ?? 0} en retard`,
      trend: `↑ ${agendaDashboard?.unreadNotifications ?? 0} notifs`,
      trendClass: 'trend-down' as const,
    },
  ], [agendaDashboard, financeSummary, stockCount, vehicles.length])

  return (
    <>
      <AlertBanner
        unreadNotifications={agendaDashboard?.unreadNotifications ?? 0}
        overdueTasks={agendaDashboard?.overdueTasks ?? 0}
        openTasks={reportSummary?.counts.openTasks ?? 0}
        documentCount={reportSummary?.counts.documents ?? 0}
      />

      <div className="stats-grid">
        {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>

      <section className="stability-layout">
        <article className="panel">
          <div className="panel-header">
            <div><span className="panel-kicker">Resume</span><h2>Finances</h2></div>
            <Link to="/finances" className="btn-ghost">Voir →</Link>
          </div>
          <div className="detail-grid">
            <span>Comptes<strong>{financeSummary?.accountCount ?? 0}</strong></span>
            <span>Operations<strong>{financeSummary?.transactionCount ?? 0}</strong></span>
            <span>Revenus<strong>{(financeSummary?.income ?? 0).toFixed(2)} €</strong></span>
            <span>Depenses<strong>{(financeSummary?.expense ?? 0).toFixed(2)} €</strong></span>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div><span className="panel-kicker">Activite</span><h2>Dernieres actions</h2></div>
            <Bell size={20} />
          </div>
          <div className="document-list">
            {activityLogs.length === 0 ? (
              <p className="muted">Aucune activite recente.</p>
            ) : (
              activityLogs.slice(0, 6).map((log) => (
                <div className="document-row" key={log.id}>
                  <Bell size={18} />
                  <span>{log.action}</span>
                  <small>{log.moduleKey ?? 'core'}</small>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="stability-layout">
        <article className="panel">
          <div className="panel-header">
            <div><span className="panel-kicker">Agenda</span><h2>Etat des taches</h2></div>
            <Link to="/agenda" className="btn-ghost">Voir →</Link>
          </div>
          <div className="detail-grid">
            <span>Ouvertes<strong>{agendaDashboard?.openTasks ?? 0}</strong></span>
            <span>En retard<strong>{agendaDashboard?.overdueTasks ?? 0}</strong></span>
            <span>Notifications<strong>{agendaDashboard?.unreadNotifications ?? 0}</strong></span>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div><span className="panel-kicker">Rapport</span><h2>Synthese</h2></div>
            <ShieldCheck size={20} />
          </div>
          <div className="detail-grid">
            <span>Documents<strong>{reportSummary?.counts.documents ?? 0}</strong></span>
            <span>Contacts<strong>{reportSummary?.counts.contacts ?? 0}</strong></span>
            <span>Biens<strong>{reportSummary?.counts.properties ?? 0}</strong></span>
            <span>Solde net<strong>{(reportSummary?.finance.net ?? 0).toFixed(2)} €</strong></span>
          </div>
        </article>
      </section>

      <div className="stats-grid">
        {[
          { to: '/vehicles',    icon: '🚗', label: 'Vehicules',  sub: `${vehicles.length} enregistres` },
          { to: '/finances',    icon: '💸', label: 'Finances',   sub: `${financeSummary?.transactionCount ?? 0} operations` },
          { to: '/stock',       icon: '📦', label: 'Stock',      sub: `${stockCount} articles` },
          { to: '/agenda',      icon: '📅', label: 'Agenda',     sub: `${agendaDashboard?.openTasks ?? 0} taches` },
          { to: '/real-estate', icon: '🏠', label: 'Immobilier', sub: `${reportSummary?.counts.properties ?? 0} biens` },
          { to: '/documents',   icon: '📁', label: 'Documents',  sub: `${reportSummary?.counts.documents ?? 0} fichiers` },
          { to: '/contacts',    icon: '👥', label: 'Contacts',   sub: `${reportSummary?.counts.contacts ?? 0} contacts` },
          { to: '/settings',    icon: '⚙️', label: 'Parametres', sub: 'profil & modules' },
        ].map((item) => (
          <Link key={item.to} to={item.to} className="stat-card" style={{ textDecoration: 'none' }}>
            <div className="stat-header">
              <span className="stat-label">{item.label.toUpperCase()}</span>
              <span className="stat-ico">{item.icon}</span>
            </div>
            <div className="stat-sub">{item.sub}</div>
          </Link>
        ))}
      </div>
    </>
  )
}
