import { useEffect, useState } from 'react'
import {
  BarChart3, Bell, CalendarDays, Car, CreditCard, FileText, Home,
  Package, RefreshCw, ShieldCheck, TrendingDown, TrendingUp, Users, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { relativeDate } from '../utils/date'
import { SkeletonTabPage } from '../components/Skeleton'
import type { ActivityLog, AuditLog, ReportSummary } from '../types'

export function ReportsPage() {
  const { authedFetch } = useAuth()
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  // true au démarrage pour afficher le skeleton avant le 1er fetch (cohérence avec Dashboard, Finances…).
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [sr, ar, lr] = await Promise.all([
      authedFetch('/reports/summary'),
      authedFetch('/activity'),
      authedFetch('/audit'),
    ])
    if (sr.ok) setSummary(await sr.json())
    if (ar.ok) setActivityLogs(await ar.json())
    if (lr.ok) setAuditLogs(await lr.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [authedFetch])

  if (loading && !summary) return <SkeletonTabPage />

  const net = summary?.finance.net ?? 0

  return (
    <>
      <div className="panel-header" style={{ marginBottom: '20px' }}>
        <div>
          <span className="panel-kicker">Synthèse</span>
          <h2>Rapports</h2>
        </div>
        <button className="btn-ghost" onClick={load} disabled={loading}>
          <RefreshCw size={14} style={{ marginRight: 4 }} />
          {loading ? 'Chargement…' : 'Actualiser'}
        </button>
      </div>

      {summary && (
        <p style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '16px', fontFamily: 'var(--mono)' }}>
          Généré le {new Date(summary.generatedAt).toLocaleString('fr-FR')}
        </p>
      )}

      {/* Compteurs modules */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        {([
          { Icon: Car,          label: 'VEHICULES',   value: summary?.counts.vehicles ?? 0 },
          { Icon: Users,        label: 'CONTACTS',    value: summary?.counts.contacts ?? 0 },
          { Icon: Home,         label: 'IMMOBILIER',  value: summary?.counts.properties ?? 0 },
          { Icon: FileText,     label: 'DOCUMENTS',   value: summary?.counts.documents ?? 0 },
          { Icon: Package,      label: 'STOCK',       value: summary?.counts.stockItems ?? 0 },
          { Icon: CalendarDays, label: 'TACHES OPEN', value: summary?.counts.openTasks ?? 0 },
          { Icon: Bell,         label: 'NOTIFS',      value: summary?.counts.unreadNotifications ?? 0 },
          { Icon: CreditCard,   label: 'OPERATIONS',  value: summary?.counts.transactions ?? 0 },
        ] as { Icon: LucideIcon; label: string; value: number }[]).map(({ Icon, label, value }) => (
          <div className="stat-card" key={label}>
            <div className="stat-header">
              <span className="stat-label">{label}</span>
              <span className="stat-ico"><Icon size={16} /></span>
            </div>
            <div className="stat-value">{value}</div>
          </div>
        ))}
      </div>

      {/* Finances */}
      <section className="stability-layout" style={{ marginBottom: '24px' }}>
        <article className="panel">
          <div className="panel-header">
            <div><span className="panel-kicker">Bilan</span><h2>Finances</h2></div>
            <BarChart3 size={20} />
          </div>
          <div className="detail-grid">
            <span>Revenus<strong style={{ color: '#4ade80' }}>
              {(summary?.finance.income ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </strong></span>
            <span>Dépenses<strong style={{ color: '#f87171' }}>
              {(summary?.finance.expense ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </strong></span>
            <span>Solde net<strong style={{ color: net >= 0 ? '#4ade80' : '#f87171' }}>
              {net >= 0 ? <TrendingUp size={12} style={{ display: 'inline', marginRight: 4 }} /> : <TrendingDown size={12} style={{ display: 'inline', marginRight: 4 }} />}
              {net.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </strong></span>
            <span>Budgets véhicules<strong style={{ color: '#a78bfa' }}>
              {(summary?.finance.vehicleBudget ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </strong></span>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div><span className="panel-kicker">Sécurité</span><h2>Audit</h2></div>
            <ShieldCheck size={20} />
          </div>
          <div className="document-list">
            {auditLogs.length === 0 ? (
              <p className="muted">Aucun log d'audit.</p>
            ) : (
              auditLogs.slice(0, 8).map((log) => (
                <div className="document-row" key={log.id}>
                  <ShieldCheck size={14} />
                  <span style={{ flex: 1 }}>
                    {log.action}
                    {log.targetType && (
                      <em style={{ display: 'block', fontSize: '10px', color: 'var(--text3)', fontStyle: 'normal' }}>
                        {log.targetType}{log.targetId ? ` · ${log.targetId.slice(0, 8)}` : ''}
                      </em>
                    )}
                  </span>
                  <small title={new Date(log.createdAt).toLocaleDateString('fr-FR')}>{relativeDate(log.createdAt)}</small>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      {/* Activité */}
      <article className="panel">
        <div className="panel-header">
          <div><span className="panel-kicker">Historique</span><h2>Activité récente</h2></div>
          <span className="badge">{activityLogs.length} entrées</span>
        </div>
        <div className="document-list">
          {activityLogs.length === 0 ? (
            <p className="muted" style={{ padding: '0 20px' }}>Aucune activité enregistrée.</p>
          ) : (
            activityLogs.slice(0, 20).map((log) => (
              <div className="document-row" key={log.id}>
                <span style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', minWidth: 60 }}>
                  {log.moduleKey ?? 'core'}
                </span>
                <span style={{ flex: 1 }}>{log.action}</span>
                <small>{new Date(log.createdAt).toLocaleDateString('fr-FR')}</small>
              </div>
            ))
          )}
        </div>
      </article>
    </>
  )
}
