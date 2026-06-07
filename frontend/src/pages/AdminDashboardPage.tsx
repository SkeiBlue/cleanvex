import { useCallback, useEffect, useState } from 'react'
import {
  Activity, CheckCircle2, Copy, FileText, KeyRound, RefreshCw, Search,
  ShieldCheck, UserCog, Users, XCircle,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { SystemPanel } from '../components/SystemPanel'

type AdminStats = {
  users: { total: number; active: number; admins: number; emailsVerified: number }
  content: { documents: number; properties: number; vehicles: number; contacts: number }
}

type AdminUser = {
  id: string
  email: string
  username: string | null
  role: 'admin' | 'user' | string
  isActive: boolean
  emailVerified: boolean
  totpEnabled: boolean
  lastLoginAt: string | null
  createdAt: string
}

type AuditEntry = {
  id: string
  userId: string | null
  action: string
  targetType: string | null
  targetId: string | null
  ipAddress: string | null
  createdAt: string
  user: { id: string; email: string; username: string | null } | null
}

/* ── helpers ─────────────────────────────────────────────────── */
function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function StatCard({ icon, label, value, hint, color }: {
  icon: React.ReactNode
  label: string
  value: number | string
  hint?: string
  color: string
}) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 14, padding: 16, display: 'flex', gap: 14, alignItems: 'center',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: `${color}22`, color, display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: 1, marginTop: 4 }}>
          {label.toUpperCase()}
        </div>
        {hint && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{hint}</div>}
      </div>
    </div>
  )
}

/* ── Page ────────────────────────────────────────────────────── */
export function AdminDashboardPage() {
  const { authedFetch, user: currentUser } = useAuth()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [inviteCode, setInviteCode] = useState<string>('')
  const [inviteCopied, setInviteCopied] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [s, u, a, i] = await Promise.all([
        authedFetch('/admin/stats').then(r => r.ok ? r.json() : null),
        authedFetch('/admin/users?limit=100').then(r => r.ok ? r.json() : { data: [] }),
        authedFetch('/admin/audit-logs?limit=25').then(r => r.ok ? r.json() : { data: [] }),
        authedFetch('/admin/invite-code').then(r => r.ok ? r.json() : { code: '' }),
      ])
      setStats(s)
      setUsers(u.data ?? [])
      setAudit(a.data ?? [])
      setInviteCode(i.code ?? '')
    } finally {
      setLoading(false)
    }
  }, [authedFetch])

  useEffect(() => { reload() }, [reload])

  const filteredUsers = users.filter(u => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (u.email + ' ' + (u.username ?? '')).toLowerCase().includes(q)
  })

  async function setRole(u: AdminUser, role: 'admin' | 'user') {
    if (u.id === currentUser?.id && role !== 'admin') return
    setBusyId(u.id)
    try {
      const r = await authedFetch(`/admin/users/${u.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (r.ok) setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role } : x))
    } finally { setBusyId(null) }
  }

  async function setActive(u: AdminUser, isActive: boolean) {
    if (u.id === currentUser?.id && !isActive) return
    setBusyId(u.id)
    try {
      const r = await authedFetch(`/admin/users/${u.id}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      if (r.ok) setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive } : x))
    } finally { setBusyId(null) }
  }

  function copyInvite() {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode).then(() => {
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 2000)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{
            fontSize: 10, color: '#a78bfa', fontFamily: 'var(--mono)',
            letterSpacing: 2, marginBottom: 6,
          }}>ADMINISTRATION</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>
            Tableau de bord admin
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text3)', fontSize: 13 }}>
            Pilote tes utilisateurs, suis l'activité, et gère la maintenance système.
          </p>
        </div>
        <button onClick={reload} disabled={loading}
          style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '8px 14px', fontSize: 12, color: 'var(--text2)',
            cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--font)',
          }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 0.8s linear infinite' : undefined }} />
          Actualiser
        </button>
      </div>

      {/* Stats */}
      <section style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12,
      }}>
        <StatCard icon={<Users size={20} />} label="Utilisateurs"
          value={stats?.users.total ?? '—'}
          hint={stats ? `${stats.users.active} actifs · ${stats.users.admins} admin${stats.users.admins > 1 ? 's' : ''}` : undefined}
          color="#a78bfa" />
        <StatCard icon={<ShieldCheck size={20} />} label="Emails vérifiés"
          value={stats?.users.emailsVerified ?? '—'}
          hint={stats ? `${Math.round((stats.users.emailsVerified / Math.max(1, stats.users.total)) * 100)}% des comptes` : undefined}
          color="#4ade80" />
        <StatCard icon={<FileText size={20} />} label="Documents"
          value={stats?.content.documents ?? '—'} color="#06b6d4" />
        <StatCard icon={<Activity size={20} />} label="Contenu total"
          value={stats ? stats.content.vehicles + stats.content.properties + stats.content.contacts : '—'}
          hint={stats ? `${stats.content.vehicles} véh. · ${stats.content.properties} biens · ${stats.content.contacts} contacts` : undefined}
          color="#f59e0b" />
      </section>

      {/* Grille 2 colonnes : Utilisateurs + Invite */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
        gap: 16,
      }} className="admin-grid">
        {/* Utilisateurs */}
        <section className="panel" style={{ padding: 0 }}>
          <div className="panel-header">
            <div><span className="panel-kicker">Utilisateurs</span><h2>Gestion des comptes</h2></div>
            <UserCog size={20} />
          </div>
          <div style={{ padding: '14px 20px', display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
            <Search size={14} style={{ color: 'var(--text3)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrer par email ou nom…"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
              {filteredUsers.length}/{users.length}
            </span>
          </div>
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {filteredUsers.length === 0 ? (
              <p style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                Aucun utilisateur.
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{
                    fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)',
                    letterSpacing: 1, textAlign: 'left',
                  }}>
                    <th style={{ padding: '10px 14px' }}>UTILISATEUR</th>
                    <th style={{ padding: '10px 14px' }}>RÔLE</th>
                    <th style={{ padding: '10px 14px' }}>STATUT</th>
                    <th style={{ padding: '10px 14px' }}>DERNIÈRE CO</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => {
                    const isMe = u.id === currentUser?.id
                    const busy = busyId === u.id
                    return (
                      <tr key={u.id} style={{
                        borderTop: '1px solid var(--border)',
                        opacity: busy ? 0.5 : 1,
                      }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                            {u.username ?? '—'}
                            {isMe && <span style={{ fontSize: 10, color: '#a78bfa', marginLeft: 6 }}>(vous)</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{u.email}</div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            display: 'inline-block', padding: '3px 8px', borderRadius: 6,
                            fontSize: 10.5, fontFamily: 'var(--mono)', letterSpacing: 1,
                            background: u.role === 'admin' ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
                            color: u.role === 'admin' ? '#c4b5fd' : 'var(--text2)',
                            border: `1px solid ${u.role === 'admin' ? 'rgba(167,139,250,0.4)' : 'var(--border)'}`,
                          }}>{u.role.toUpperCase()}</span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {u.isActive
                            ? <span style={{ color: '#4ade80', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}><CheckCircle2 size={12} /> Actif</span>
                            : <span style={{ color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}><XCircle size={12} /> Désactivé</span>}
                          {u.emailVerified ? null : <span style={{ marginLeft: 6, fontSize: 10, color: '#f59e0b' }}>(email !vérif)</span>}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text2)', fontSize: 11.5 }}>
                          {fmt(u.lastLoginAt)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            {u.role === 'admin'
                              ? <button disabled={isMe || busy} onClick={() => setRole(u, 'user')}
                                  title={isMe ? 'Tu ne peux pas te retirer tes droits' : 'Rétrograder en user'}
                                  style={{
                                    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                                    borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--text2)',
                                    cursor: (isMe || busy) ? 'not-allowed' : 'pointer', opacity: isMe ? 0.4 : 1,
                                  }}>Rétrograder</button>
                              : <button disabled={busy} onClick={() => setRole(u, 'admin')}
                                  style={{
                                    background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(37,99,235,0.2))',
                                    border: '1px solid rgba(167,139,250,0.4)', borderRadius: 6,
                                    padding: '4px 8px', fontSize: 11, color: '#c4b5fd',
                                    cursor: busy ? 'not-allowed' : 'pointer',
                                  }}>Promouvoir</button>}
                            <button disabled={(isMe && u.isActive) || busy}
                              onClick={() => setActive(u, !u.isActive)}
                              title={isMe && u.isActive ? 'Tu ne peux pas désactiver ton propre compte' : ''}
                              style={{
                                background: u.isActive ? 'rgba(244,63,94,0.08)' : 'rgba(74,222,128,0.08)',
                                border: `1px solid ${u.isActive ? 'rgba(244,63,94,0.25)' : 'rgba(74,222,128,0.25)'}`,
                                borderRadius: 6, padding: '4px 8px', fontSize: 11,
                                color: u.isActive ? '#f87171' : '#4ade80',
                                cursor: ((isMe && u.isActive) || busy) ? 'not-allowed' : 'pointer',
                                opacity: (isMe && u.isActive) ? 0.4 : 1,
                              }}>
                              {u.isActive ? 'Désactiver' : 'Réactiver'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Invite code + System updates */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* Code d'invitation */}
          <section className="panel" style={{ padding: 0 }}>
            <div className="panel-header">
              <div><span className="panel-kicker">Inscription</span><h2>Code d'invitation</h2></div>
              <KeyRound size={20} />
            </div>
            <div style={{ padding: '14px 20px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
                Partage ce code aux personnes que tu veux laisser créer un compte.
                Pour le changer, modifie <code style={{ color: 'var(--text)', background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: 4 }}>SIGNUP_INVITE_CODE</code> dans <code style={{ color: 'var(--text)', background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: 4 }}>backend/.env</code> puis redémarre.
              </p>
              {inviteCode ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(167,139,250,0.3)',
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  <code style={{ fontSize: 13, fontFamily: 'var(--mono)', color: '#c4b5fd', flex: 1, wordBreak: 'break-all' }}>
                    {inviteCode}
                  </code>
                  <button onClick={copyInvite} title="Copier"
                    style={{
                      background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
                      color: inviteCopied ? '#4ade80' : 'var(--text2)', display: 'flex',
                    }}>
                    {inviteCopied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: '#f59e0b', margin: 0 }}>
                  ⚠ Aucun code n'est défini. Tout le monde peut s'inscrire librement !
                </p>
              )}
            </div>
          </section>

          {/* System (réutilise le panel existant) */}
          <section className="panel" style={{ padding: 0 }}>
            <div className="panel-header">
              <div><span className="panel-kicker">Maintenance</span><h2>Système</h2></div>
              <RefreshCw size={20} />
            </div>
            <div style={{ padding: 16 }}>
              <SystemPanel />
            </div>
          </section>
        </div>
      </div>

      {/* Audit logs */}
      <section className="panel" style={{ padding: 0 }}>
        <div className="panel-header">
          <div><span className="panel-kicker">Activité</span><h2>Derniers événements (audit)</h2></div>
          <Activity size={20} />
        </div>
        {audit.length === 0 ? (
          <p style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            Aucun événement enregistré.
          </p>
        ) : (
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', letterSpacing: 1, textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px' }}>DATE</th>
                  <th style={{ padding: '10px 14px' }}>UTILISATEUR</th>
                  <th style={{ padding: '10px 14px' }}>ACTION</th>
                  <th style={{ padding: '10px 14px' }}>CIBLE</th>
                  <th style={{ padding: '10px 14px' }}>IP</th>
                </tr>
              </thead>
              <tbody>
                {audit.map(a => (
                  <tr key={a.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 14px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{fmt(a.createdAt)}</td>
                    <td style={{ padding: '8px 14px', color: 'var(--text)' }}>{a.user?.email ?? '—'}</td>
                    <td style={{ padding: '8px 14px', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 11.5 }}>{a.action}</td>
                    <td style={{ padding: '8px 14px', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                      {a.targetType ? `${a.targetType}${a.targetId ? `:${a.targetId.slice(0, 8)}` : ''}` : '—'}
                    </td>
                    <td style={{ padding: '8px 14px', color: 'var(--text3)', fontSize: 11 }}>{a.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
