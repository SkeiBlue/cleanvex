import { useCallback, useEffect, useState } from 'react'
import {
  Activity, CheckCircle2, Copy, FileText, KeyRound, MailCheck, Pencil, RefreshCw, Search,
  ShieldCheck, ShieldOff, Trash2, UserCog, UserPlus, Users, X, XCircle,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { SystemPanel } from '../components/SystemPanel'
import { SkeletonTabPage } from '../components/Skeleton'
import type { ModuleItem } from '../types'

const ADMIN_MODULE_ICONS: Record<string, string> = {
  vehicles: '🚗', 'real-estate': '🏠', finances: '💸',
  stock: '📦', agenda: '📅', documents: '📁', contacts: '👥',
}

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

/* ── Modal édition utilisateur ────────────────────────────────── */
type EditUserModalProps = {
  user: AdminUser
  onClose: () => void
  onUpdated: (u: Partial<AdminUser> & { id: string }) => void
  authedFetch: (input: string, init?: RequestInit) => Promise<Response>
}
function EditUserModal({ user, onClose, onUpdated, authedFetch }: EditUserModalProps) {
  const [email, setEmail] = useState(user.email)
  const [username, setUsername] = useState(user.username ?? '')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function saveProfile() {
    setBusy('profile'); setMsg(null)
    try {
      const body: Record<string, string> = {}
      if (email !== user.email) body.email = email
      if ((username || null) !== (user.username || null)) body.username = username
      if (Object.keys(body).length === 0) { setMsg({ text: 'Aucun changement.', ok: false }); return }
      const r = await authedFetch(`/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (r.ok) {
        const d = await r.json()
        onUpdated({ id: user.id, email: d.email, username: d.username })
        setMsg({ text: 'Profil mis à jour.', ok: true })
      } else {
        const e = await r.json().catch(() => ({}))
        setMsg({ text: e.message ?? 'Erreur lors de la mise à jour.', ok: false })
      }
    } finally { setBusy(null) }
  }

  async function verifyEmail() {
    setBusy('verify'); setMsg(null)
    try {
      const r = await authedFetch(`/admin/users/${user.id}/verify-email`, { method: 'POST' })
      if (r.ok) {
        onUpdated({ id: user.id, emailVerified: true })
        setMsg({ text: 'Email vérifié manuellement.', ok: true })
      } else setMsg({ text: 'Erreur.', ok: false })
    } finally { setBusy(null) }
  }

  async function disable2fa() {
    if (!confirm('Désactiver le 2FA de cet utilisateur ?')) return
    setBusy('2fa'); setMsg(null)
    try {
      const r = await authedFetch(`/admin/users/${user.id}/disable-2fa`, { method: 'POST' })
      if (r.ok) {
        onUpdated({ id: user.id, totpEnabled: false })
        setMsg({ text: '2FA désactivé.', ok: true })
      } else setMsg({ text: 'Erreur.', ok: false })
    } finally { setBusy(null) }
  }

  async function resetPassword() {
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/.test(newPwd)) {
      setMsg({ text: 'Mot de passe : 8+ caractères, minuscule, majuscule, chiffre et caractère spécial.', ok: false }); return
    }
    if (newPwd !== confirmPwd) { setMsg({ text: 'Les mots de passe ne correspondent pas.', ok: false }); return }
    if (!confirm('Réinitialiser le mot de passe ? Toutes les sessions de l\'utilisateur seront révoquées.')) return
    setBusy('pwd'); setMsg(null)
    try {
      const r = await authedFetch(`/admin/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: newPwd }),
      })
      if (r.ok) {
        setNewPwd(''); setConfirmPwd('')
        setMsg({ text: 'Mot de passe réinitialisé. Sessions révoquées.', ok: true })
      } else {
        const e = await r.json().catch(() => ({}))
        setMsg({ text: e.message ?? 'Erreur.', ok: false })
      }
    } finally { setBusy(null) }
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)',
    fontFamily: 'var(--font)', outline: 'none', width: '100%',
  }
  const labelStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 5,
    fontSize: 10.5, color: 'var(--text3)',
    fontFamily: 'var(--mono)', letterSpacing: 1, textTransform: 'uppercase',
  }

  return (
    <div role="dialog" aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(6,8,24,0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16,
        width: '100%', maxWidth: 540, maxHeight: '90vh', overflow: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700,
          }}>{(user.username ?? user.email).charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
              Modifier le profil
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
              ID : {user.id.slice(0, 8)}…
            </p>
          </div>
          <button onClick={onClose} aria-label="Fermer"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Message */}
        {msg && (
          <div style={{
            margin: '12px 20px 0', padding: '8px 12px', borderRadius: 8, fontSize: 12,
            color: msg.ok ? '#4ade80' : '#f87171',
            background: msg.ok ? 'rgba(74,222,128,0.08)' : 'rgba(244,63,94,0.08)',
            border: `1px solid ${msg.ok ? 'rgba(74,222,128,0.25)' : 'rgba(244,63,94,0.25)'}`,
          }}>{msg.text}</div>
        )}

        {/* Section 1: infos */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h4 style={{ margin: 0, fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)', letterSpacing: 1, textTransform: 'uppercase' }}>
            Informations
          </h4>
          <label style={labelStyle}>
            Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Nom d'utilisateur
            <input value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} placeholder="(facultatif)" />
          </label>
          <button onClick={saveProfile} disabled={busy === 'profile'}
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #2563eb)', border: 'none', borderRadius: 10,
              padding: '9px 16px', fontSize: 13, fontWeight: 600, color: 'white',
              cursor: busy ? 'wait' : 'pointer', alignSelf: 'flex-start',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
            <Pencil size={13} />{busy === 'profile' ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--border)' }} />

        {/* Section 2: vérif email + 2FA */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h4 style={{ margin: 0, fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)', letterSpacing: 1, textTransform: 'uppercase' }}>
            Sécurité
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text2)' }}>
            <MailCheck size={14} style={{ color: user.emailVerified ? '#4ade80' : '#f59e0b' }} />
            <span style={{ flex: 1 }}>
              Email : {user.emailVerified ? <span style={{ color: '#4ade80' }}>vérifié ✓</span> : <span style={{ color: '#f59e0b' }}>non vérifié</span>}
            </span>
            {!user.emailVerified && (
              <button onClick={verifyEmail} disabled={busy === 'verify'}
                style={{
                  background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)',
                  borderRadius: 6, padding: '5px 10px', fontSize: 11.5, color: '#4ade80',
                  cursor: busy ? 'wait' : 'pointer',
                }}>
                {busy === 'verify' ? '…' : 'Marquer vérifié'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text2)' }}>
            <ShieldCheck size={14} style={{ color: user.totpEnabled ? '#4ade80' : 'var(--text3)' }} />
            <span style={{ flex: 1 }}>
              2FA : {user.totpEnabled ? <span style={{ color: '#4ade80' }}>actif</span> : <span>désactivé</span>}
            </span>
            {user.totpEnabled && (
              <button onClick={disable2fa} disabled={busy === '2fa'}
                style={{
                  background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)',
                  borderRadius: 6, padding: '5px 10px', fontSize: 11.5, color: '#f87171',
                  cursor: busy ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                }}>
                <ShieldOff size={12} />{busy === '2fa' ? '…' : 'Désactiver'}
              </button>
            )}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)' }} />

        {/* Section 3: reset password */}
        <div style={{ padding: '16px 20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h4 style={{ margin: 0, fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)', letterSpacing: 1, textTransform: 'uppercase' }}>
            Réinitialiser le mot de passe
          </h4>
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text3)' }}>
            Définit un nouveau mot de passe. Toutes les sessions actives seront révoquées.
          </p>
          <label style={labelStyle}>
            Nouveau mot de passe
            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
              placeholder="8 caractères minimum" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Confirmer
            <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
              placeholder="Retape le nouveau mot de passe" style={inputStyle} />
          </label>
          <button onClick={resetPassword} disabled={busy === 'pwd'}
            style={{
              background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)',
              borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, color: '#f87171',
              cursor: busy ? 'wait' : 'pointer', alignSelf: 'flex-start',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
            <KeyRound size={13} />{busy === 'pwd' ? 'Reset en cours…' : 'Réinitialiser'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Page ────────────────────────────────────────────────────── */
export function AdminDashboardPage() {
  const { authedFetch, refreshModules, user: currentUser } = useAuth()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [inviteCode, setInviteCode] = useState<string>('')
  const [inviteCopied, setInviteCopied] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [s, u, a, i, m] = await Promise.all([
        authedFetch('/admin/stats').then(r => r.ok ? r.json() : null),
        authedFetch('/admin/users?limit=100').then(r => r.ok ? r.json() : { data: [] }),
        authedFetch('/admin/audit-logs?limit=25').then(r => r.ok ? r.json() : { data: [] }),
        authedFetch('/admin/invite-code').then(r => r.ok ? r.json() : { code: '' }),
        authedFetch('/modules').then(r => r.ok ? r.json() : []),
      ])
      setStats(s)
      setUsers(u.data ?? [])
      setAudit(a.data ?? [])
      setInviteCode(i.code ?? '')
      setModules(Array.isArray(m) ? m : [])
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

  async function removeUser(u: AdminUser) {
    if (u.id === currentUser?.id) return
    if (!confirm(`Supprimer définitivement « ${u.username ?? u.email} » ?\n\nToutes ses données (documents, véhicules, biens, finances…) seront effacées. Cette action est irréversible.`)) return
    setBusyId(u.id)
    try {
      const r = await authedFetch(`/admin/users/${u.id}`, { method: 'DELETE' })
      if (r.ok) {
        setUsers(prev => prev.filter(x => x.id !== u.id))
      } else {
        const e = await r.json().catch(() => ({}))
        alert(e.message ?? 'Suppression impossible.')
      }
    } finally { setBusyId(null) }
  }

  function copyInvite() {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode).then(() => {
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 2000)
    })
  }

  async function toggleModule(module: ModuleItem) {
    const r = await authedFetch(`/modules/${module.key}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: !module.isEnabled }),
    })
    if (r.ok) {
      // Met à jour la liste locale + la sidebar globale
      setModules(prev => prev.map(m => m.key === module.key ? { ...m, isEnabled: !m.isEnabled } : m))
      await refreshModules()
    }
  }

  // Skeleton initial pour rester cohérent avec les autres pages (Dashboard, Finances…)
  // au lieu d'un écran blanc pendant le 1er chargement.
  if (loading && !stats) return <SkeletonTabPage />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header — flex-wrap pour laisser le bouton "Actualiser" passer sous le titre sur mobile */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
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

      {/* Stats — minmax(180px) au lieu de 220px : tient à 2 col sur 430px de viewport */}
      <section style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12,
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
          <div style={{ maxHeight: 480, overflowY: 'auto', overflowX: 'auto' }}>
            {filteredUsers.length === 0 ? (
              <p style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                Aucun utilisateur.
              </p>
            ) : (
              <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 12.5 }}>
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
                            <button onClick={() => setEditingUser(u)} title="Éditer le profil"
                              style={{
                                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                                borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--text2)',
                                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                              }}>
                              <Pencil size={11} /> Éditer
                            </button>
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
                            <button disabled={isMe || busy}
                              onClick={() => removeUser(u)}
                              title={isMe ? 'Tu ne peux pas supprimer ton propre compte' : 'Supprimer définitivement'}
                              style={{
                                background: 'rgba(244,63,94,0.08)',
                                border: '1px solid rgba(244,63,94,0.25)',
                                borderRadius: 6, padding: '4px 8px', fontSize: 11,
                                color: '#f87171',
                                cursor: (isMe || busy) ? 'not-allowed' : 'pointer',
                                opacity: isMe ? 0.4 : 1,
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                              }}>
                              <Trash2 size={11} /> Supprimer
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

          {/* Modules globaux (activer/désactiver pour toute l'instance) */}
          <section className="panel" style={{ padding: 0 }}>
            <div className="panel-header">
              <div><span className="panel-kicker">Configuration</span><h2>Modules globaux</h2></div>
              <span className="badge">{modules.filter(m => m.isEnabled).length}/{modules.length}</span>
            </div>
            <p style={{ padding: '8px 20px 4px', fontSize: '12px', color: 'var(--text3)' }}>
              Activer/désactiver un module masque ses routes et bloque l'accès à l'API pour tous les utilisateurs. Les données sont conservées.
            </p>
            <div style={{ padding: '12px 20px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {modules.map((m) => (
                <button
                  key={m.key}
                  onClick={() => toggleModule(m)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px', borderRadius: 10,
                    background: m.isEnabled ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${m.isEnabled ? 'rgba(124,58,237,0.25)' : 'var(--border)'}`,
                    cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font)',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{ADMIN_MODULE_ICONS[m.key] ?? '⚙️'}</span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: m.isEnabled ? 'var(--text)' : 'var(--text2)' }}>{m.title}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: m.isEnabled ? '#a78bfa' : 'var(--text3)' }}>
                      {m.isEnabled ? 'Actif' : 'Désactivé'} · v{m.version}
                    </div>
                  </div>
                  <div style={{
                    width: 32, height: 18, borderRadius: 20,
                    background: m.isEnabled ? 'var(--p1)' : 'rgba(255,255,255,0.1)',
                    position: 'relative', transition: 'all 0.2s', flexShrink: 0,
                  }}>
                    <div style={{
                      position: 'absolute', top: 3,
                      left: m.isEnabled ? 16 : 3,
                      width: 12, height: 12,
                      borderRadius: '50%', background: 'white', transition: 'all 0.2s',
                    }} />
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Sprint 3 — Inscription publique (toggle global) */}
          <SignupEnabledPanel />

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

      {/* Modal d'édition utilisateur */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          authedFetch={authedFetch}
          onUpdated={patch => {
            setUsers(prev => prev.map(x => x.id === patch.id ? { ...x, ...patch } : x))
            setEditingUser(curr => curr ? { ...curr, ...patch } : curr)
          }}
        />
      )}

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

/* ── Sprint 3 — Inscription publique (réglage global admin) ──────── */
function SignupEnabledPanel() {
  const { authedFetch } = useAuth()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    authedFetch('/admin/app-settings/signup-enabled').then(async r => {
      if (r.ok) { const d = await r.json(); setEnabled(!!d.enabled) }
    })
  }, [authedFetch])

  async function toggle() {
    if (enabled === null) return
    setSaving(true)
    const next = !enabled
    const r = await authedFetch('/admin/app-settings/signup-enabled', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: next }),
    })
    if (r.ok) setEnabled(next)
    setSaving(false)
  }

  return (
    <section className="panel" style={{ padding: 0 }}>
      <div className="panel-header">
        <div><span className="panel-kicker">Accès</span><h2>Inscription publique</h2></div>
        <UserPlus size={20} />
      </div>
      <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--text)' }}>
            Autoriser n'importe quel visiteur à créer un compte depuis la page de connexion.
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
            Désactivée par défaut. Lorsqu'elle est OFF, seuls les détenteurs d'un code
            d'invitation peuvent s'inscrire (variable d'env SIGNUP_INVITE_CODE).
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={saving || enabled === null}
          style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600,
            background: enabled ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${enabled ? 'rgba(74,222,128,0.3)' : 'var(--border)'}`,
            borderRadius: 8, cursor: saving ? 'wait' : 'pointer',
            color: enabled ? '#4ade80' : 'var(--text2)',
            minWidth: 110,
          }}
        >
          {enabled === null ? '…' : enabled ? 'Activée' : 'Désactivée'}
        </button>
      </div>
    </section>
  )
}

