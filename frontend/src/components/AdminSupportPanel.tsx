import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2, LifeBuoy, Mail, RefreshCw, ShieldCheck, ShieldOff, X, XCircle,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { relativeDate } from '../utils/date'
import {
  Badge, CATEGORIES, PRIORITIES, TicketDetail, priorityColor,
} from '../pages/SupportPage'
import type { SupportAuthor, SupportTicket } from '../types'

// "active" = tous les tickets non clôturés (vue par défaut). Les tickets
// clôturés ne sont visibles que via le filtre dédié.
const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: 'active', label: 'Actifs' },
  { key: 'open', label: 'Ouverts' },
  { key: 'pending', label: 'En attente' },
  { key: 'resolved', label: 'Résolus' },
  { key: 'closed', label: 'Clôturés' },
]

export function AdminSupportPanel() {
  const { authedFetch } = useAuth()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('active')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [userInfo, setUserInfo] = useState<SupportAuthor | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    // "active" récupère tout puis exclut les clôturés côté client ; les autres
    // filtres ciblent un statut précis côté serveur.
    const qs = status && status !== 'active' ? `?status=${status}` : ''
    const r = await authedFetch(`/support/all${qs}`)
    if (r.ok) {
      const data: SupportTicket[] = await r.json()
      setTickets(status === 'active' ? data.filter(t => t.status !== 'closed') : data)
    }
    setLoading(false)
  }, [authedFetch, status])

  useEffect(() => { load() }, [load])

  if (selectedId) {
    return (
      <>
        <TicketDetail
          id={selectedId}
          isAdmin
          onBack={() => { setSelectedId(null); load() }}
          onUserClick={(owner) => owner && setUserInfo(owner)}
        />
        {userInfo && <UserInfoModal user={userInfo} onClose={() => setUserInfo(null)} />}
      </>
    )
  }

  return (
    <>
      <section className="panel" style={{ padding: 0 }}>
        <div className="panel-header">
          <div><span className="panel-kicker">Assistance</span><h2>Tickets de support</h2></div>
          <button className="btn btn-ghost" onClick={load} disabled={loading}>
            <RefreshCw size={14} style={{ marginRight: 4, animation: loading ? 'spin 0.8s linear infinite' : undefined }} />
            Actualiser
          </button>
        </div>

        {/* Filtres par statut */}
        <div style={{ display: 'flex', gap: 6, padding: '12px 20px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                fontFamily: 'var(--font)',
                background: status === f.key ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${status === f.key ? 'rgba(167,139,250,0.4)' : 'var(--border)'}`,
                color: status === f.key ? '#c4b5fd' : 'var(--text2)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading && tickets.length === 0 ? (
          <p style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Chargement…</p>
        ) : tickets.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <LifeBuoy size={28} style={{ color: 'var(--text3)', marginBottom: 10 }} />
            <p style={{ color: 'var(--text3)', fontSize: 13, margin: 0 }}>Aucun ticket{status ? ' dans ce statut' : ''}.</p>
          </div>
        ) : (
          <div style={{ maxHeight: 560, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', letterSpacing: 1, textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px' }}>SUJET</th>
                  <th style={{ padding: '10px 14px' }}>DEMANDEUR</th>
                  <th style={{ padding: '10px 14px' }}>STATUT</th>
                  <th style={{ padding: '10px 14px' }}>PRIORITÉ</th>
                  <th style={{ padding: '10px 14px' }}>MAJ</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <button
                        onClick={() => setSelectedId(t.id)}
                        style={{
                          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                          color: 'var(--text)', fontSize: 13, fontWeight: 500, textAlign: 'left',
                          fontFamily: 'var(--font)',
                        }}
                      >
                        {t.subject}
                      </button>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {CATEGORIES[t.category] ?? t.category} · {t._count?.messages ?? 0} msg
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {t.user ? (
                        <button
                          onClick={() => setUserInfo(t.user!)}
                          title="Voir la fiche de l'utilisateur"
                          style={{
                            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                            color: '#a78bfa', fontSize: 12.5, fontFamily: 'var(--font)',
                            textDecoration: 'underline', textUnderlineOffset: 2, textAlign: 'left',
                          }}
                        >
                          {t.user.username ?? t.user.email}
                        </button>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}><Badge status={t.status} /></td>
                    <td style={{ padding: '10px 14px', color: priorityColor(t.priority) }}>
                      {PRIORITIES[t.priority] ?? t.priority}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 11.5, whiteSpace: 'nowrap' }}>
                      {relativeDate(t.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {userInfo && <UserInfoModal user={userInfo} onClose={() => setUserInfo(null)} />}
    </>
  )
}

/* ── Popup d'informations utilisateur ──────────────────────────────── */
function fmt(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text3)' }}>{label}</span>
      <span style={{ fontSize: 12.5, color: 'var(--text)', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function UserInfoModal({ user, onClose }: { user: SupportAuthor; onClose: () => void }) {
  const c = user._count
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="panel"
        style={{ width: 'min(440px, 100%)', padding: 0, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="panel-header">
          <div><span className="panel-kicker">Utilisateur</span><h2>Fiche du demandeur</h2></div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '14px 20px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(124,58,237,0.35), rgba(37,99,235,0.35))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, color: '#fff',
            }}>
              {(user.username ?? user.email).charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                {user.username ?? '—'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Mail size={12} /> {user.email}
              </div>
            </div>
          </div>

          <Row label="Identifiant" value={<code style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{user.id.slice(0, 8)}…</code>} />
          <Row label="Rôle" value={
            <span style={{
              padding: '2px 8px', borderRadius: 6, fontSize: 10.5, fontFamily: 'var(--mono)', letterSpacing: 1,
              background: user.role === 'admin' ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
              color: user.role === 'admin' ? '#c4b5fd' : 'var(--text2)',
            }}>{user.role.toUpperCase()}</span>
          } />
          <Row label="Statut du compte" value={
            user.isActive
              ? <span style={{ color: '#4ade80', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} /> Actif</span>
              : <span style={{ color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: 4 }}><XCircle size={13} /> Désactivé</span>
          } />
          <Row label="Email vérifié" value={user.emailVerified
            ? <span style={{ color: '#4ade80' }}>Oui</span>
            : <span style={{ color: '#f59e0b' }}>Non</span>} />
          <Row label="2FA" value={user.totpEnabled
            ? <span style={{ color: '#4ade80', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ShieldCheck size={13} /> Activée</span>
            : <span style={{ color: 'var(--text3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ShieldOff size={13} /> Inactive</span>} />
          <Row label="Dernière connexion" value={fmt(user.lastLoginAt)} />
          <Row label="Inscrit le" value={fmt(user.createdAt)} />

          {c && (
            <>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', letterSpacing: 1, margin: '16px 0 6px' }}>
                CONTENU
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {[
                  { label: 'Documents', value: c.documents },
                  { label: 'Véhicules', value: c.vehicles },
                  { label: 'Biens', value: c.properties },
                  { label: 'Contacts', value: c.contacts },
                  { label: 'Tickets', value: c.supportTickets },
                ].map(s => (
                  <div key={s.label} style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '10px 12px',
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
