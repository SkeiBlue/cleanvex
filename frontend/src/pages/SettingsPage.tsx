import { useEffect, useState } from 'react'
import { Bell, LogOut, Settings, Shield, ShieldCheck, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { ActivityLog, AuditLog, ErrorLog, ModuleItem, ProfileInfo, UserSetting } from '../types'

type FormEv = { preventDefault(): void; currentTarget: HTMLFormElement }
type Tab = 'profil' | 'securite' | 'modules' | 'logs'

const MODULE_ICONS: Record<string, string> = {
  vehicles: '🚗', 'real-estate': '🏠', finances: '💸',
  stock: '📦', agenda: '📅', documents: '📁', contacts: '👥',
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 18px', fontSize: '13px', fontWeight: 600,
        fontFamily: 'var(--font)', cursor: 'pointer', border: 'none',
        borderBottom: active ? '2px solid var(--p1)' : '2px solid transparent',
        background: 'none', color: active ? '#c4b5fd' : 'var(--text2)',
        transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

export function SettingsPage() {
  const { authedFetch, refreshModules, logout } = useAuth()
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null)
  const [settings, setSettings] = useState<UserSetting[]>([])
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([])
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok' | 'err'>('ok')
  const [activeTab, setActiveTab] = useState<Tab>('profil')
  const [logFilter, setLogFilter] = useState('')

  function setOk(msg: string) { setMessage(msg); setMessageType('ok') }
  function setErr(msg: string) { setMessage(msg); setMessageType('err') }

  async function load() {
    const [p, s, m, act, aud, err] = await Promise.all([
      authedFetch('/profile'), authedFetch('/settings'), authedFetch('/modules'),
      authedFetch('/activity'), authedFetch('/audit'), authedFetch('/errors'),
    ])
    if (p.ok) setProfileInfo(await p.json())
    if (s.ok) setSettings(await s.json())
    if (m.ok) setModules(await m.json())
    if (act.ok) setActivityLogs(await act.json())
    if (aud.ok) setAuditLogs(await aud.json())
    if (err.ok) setErrorLogs(await err.json())
  }

  useEffect(() => { load() }, [authedFetch])

  async function handleUpdateProfile(event: FormEv) {
    event.preventDefault()
    const form = event.currentTarget; const data = new FormData(form)
    const r = await authedFetch('/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: data.get('username') || undefined }),
    })
    if (!r.ok) { setErr('Mise à jour refusée.'); return }
    setOk('Nom d\'utilisateur mis à jour.')
    const pr = await authedFetch('/profile'); if (pr.ok) setProfileInfo(await pr.json())
  }

  async function handleChangePassword(event: FormEv) {
    event.preventDefault()
    const form = event.currentTarget; const data = new FormData(form)
    const newPassword = data.get('newPassword')?.toString() ?? ''
    const confirmPassword = data.get('confirmPassword')?.toString() ?? ''
    if (newPassword !== confirmPassword) { setErr('Les mots de passe ne correspondent pas.'); return }
    if (newPassword.length < 8) { setErr('Le nouveau mot de passe doit contenir au moins 8 caractères.'); return }
    const r = await authedFetch('/auth/password', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: data.get('currentPassword'), newPassword }),
    })
    if (!r.ok) {
      const body = await r.json().catch(() => ({}))
      setErr(body.message ?? 'Changement de mot de passe refusé.')
      return
    }
    form.reset(); setOk('Mot de passe changé avec succès.')
  }

  async function handleRevokeSession(sessionId: string) {
    if (!window.confirm('Révoquer cette session ?')) return
    const r = await authedFetch(`/auth/sessions/${sessionId}`, { method: 'DELETE' })
    if (!r.ok) { setErr('Révocation refusée.'); return }
    setOk('Session révoquée.')
    const pr = await authedFetch('/profile'); if (pr.ok) setProfileInfo(await pr.json())
  }

  async function handleLogoutAll() {
    if (!window.confirm('Déconnecter tous les appareils ? Tu seras déconnecté aussi.')) return
    await authedFetch('/auth/logout-all', { method: 'POST' })
    await logout()
  }

  async function handleSaveSetting(event: FormEv) {
    event.preventDefault()
    const form = event.currentTarget; const data = new FormData(form)
    const key = data.get('key')?.toString(); if (!key) return
    const r = await authedFetch(`/settings/${encodeURIComponent(key)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: data.get('value')?.toString() }),
    })
    if (!r.ok) { setErr('Paramètre refusé.'); return }
    form.reset(); setOk('Paramètre enregistré.')
    const sr = await authedFetch('/settings'); if (sr.ok) setSettings(await sr.json())
  }

  async function toggleModule(module: ModuleItem) {
    const r = await authedFetch(`/modules/${module.key}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: !module.isEnabled }),
    })
    if (r.ok) {
      await refreshModules()
      const mr = await authedFetch('/modules'); if (mr.ok) setModules(await mr.json())
    }
  }

  const activeSessions = profileInfo?.sessions.filter(s => !s.revokedAt) ?? []
  const filteredActivity = logFilter
    ? activityLogs.filter(l => l.action.includes(logFilter) || (l.moduleKey ?? '').includes(logFilter))
    : activityLogs
  const filteredAudit = logFilter
    ? auditLogs.filter(l => l.action.includes(logFilter))
    : auditLogs

  const INPUT_STYLE: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '9px 12px', color: 'var(--text)',
    fontFamily: 'var(--font)', fontSize: '13px', outline: 'none', width: '100%',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* ─── TABS ─── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--card)', borderRadius: '16px 16px 0 0', padding: '0 8px' }}>
        <TabBtn label="Profil" active={activeTab === 'profil'} onClick={() => setActiveTab('profil')} />
        <TabBtn label="Sécurité" active={activeTab === 'securite'} onClick={() => setActiveTab('securite')} />
        <TabBtn label="Modules" active={activeTab === 'modules'} onClick={() => setActiveTab('modules')} />
        <TabBtn label="Logs" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
      </div>

      {message && (
        <p style={{
          fontSize: '12px', fontFamily: 'var(--mono)',
          padding: '8px 14px', borderRadius: '0',
          background: messageType === 'ok' ? 'rgba(74,222,128,0.08)' : 'rgba(244,63,94,0.08)',
          border: `1px solid ${messageType === 'ok' ? 'rgba(74,222,128,0.2)' : 'rgba(244,63,94,0.2)'}`,
          color: messageType === 'ok' ? '#4ade80' : '#f87171',
        }}>
          {message}
        </p>
      )}

      {/* ══ ONGLET PROFIL ══ */}
      {activeTab === 'profil' && (
        <section className="stability-layout" style={{ marginTop: '16px' }}>
          {/* Infos compte */}
          <article className="panel">
            <div className="panel-header">
              <div><span className="panel-kicker">Compte</span><h2>Informations</h2></div>
              <ShieldCheck size={20} />
            </div>
            <div className="detail-grid">
              <span>Email<strong>{profileInfo?.user.email ?? '—'}</strong></span>
              <span>Rôle<strong style={{ textTransform: 'capitalize' }}>{profileInfo?.user.role ?? '—'}</strong></span>
              <span>Email vérifié<strong style={{ color: profileInfo?.user.emailVerified ? '#4ade80' : '#f87171' }}>
                {profileInfo?.user.emailVerified ? '✓ Oui' : '✗ Non'}
              </strong></span>
              <span>Membre depuis<strong>{profileInfo?.user.createdAt ? new Date(profileInfo.user.createdAt).toLocaleDateString('fr-FR') : '—'}</strong></span>
            </div>

            <div style={{ padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '-4px' }}>NOM D'UTILISATEUR</div>
              <form onSubmit={handleUpdateProfile} style={{ display: 'flex', gap: '8px' }}>
                <input
                  name="username"
                  defaultValue={profileInfo?.user.username ?? ''}
                  placeholder="Nom d'utilisateur"
                  style={{ ...INPUT_STYLE, width: 'auto', flex: 1 }}
                />
                <button className="primary-action" type="submit">Mettre à jour</button>
              </form>
            </div>
          </article>

          {/* Paramètres */}
          <article className="panel">
            <div className="panel-header">
              <div><span className="panel-kicker">Préférences</span><h2>Paramètres</h2></div>
              <Settings size={20} />
            </div>
            <form className="finance-form" onSubmit={handleSaveSetting}>
              <input name="key" placeholder="Clé" required />
              <input name="value" placeholder="Valeur" required />
              <button className="primary-action" type="submit">Enregistrer</button>
            </form>
            <div className="document-list">
              {settings.length === 0 ? (
                <p className="muted">Aucun paramètre personnel.</p>
              ) : (
                settings.map((s) => (
                  <div className="document-row" key={s.id}>
                    <Settings size={16} />
                    <span style={{ flex: 1 }}>{s.key}</span>
                    <small>{JSON.stringify(s.valueJson)}</small>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      )}

      {/* ══ ONGLET SÉCURITÉ ══ */}
      {activeTab === 'securite' && (
        <section className="stability-layout" style={{ marginTop: '16px' }}>
          {/* Changer mot de passe */}
          <article className="panel">
            <div className="panel-header">
              <div><span className="panel-kicker">Sécurité</span><h2>Mot de passe</h2></div>
              <Shield size={20} />
            </div>
            <form onSubmit={handleChangePassword} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '6px' }}>MOT DE PASSE ACTUEL</div>
                <input name="currentPassword" type="password" placeholder="••••••••" style={INPUT_STYLE} required />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '6px' }}>NOUVEAU MOT DE PASSE (min. 8 caractères)</div>
                <input name="newPassword" type="password" placeholder="••••••••" style={INPUT_STYLE} required minLength={8} />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '6px' }}>CONFIRMER LE NOUVEAU MOT DE PASSE</div>
                <input name="confirmPassword" type="password" placeholder="••••••••" style={INPUT_STYLE} required />
              </div>
              <button className="primary-action" type="submit" style={{ width: '100%' }}>
                <Shield size={16} />Changer le mot de passe
              </button>
            </form>
          </article>

          {/* Sessions */}
          <article className="panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Sessions</span>
                <h2>Appareils connectés</h2>
              </div>
              <span className="badge">{activeSessions.length} active{activeSessions.length > 1 ? 's' : ''}</span>
            </div>

            <div className="document-list">
              {(profileInfo?.sessions ?? []).map((s) => {
                const isActive = !s.revokedAt && new Date(s.expiresAt) > new Date()
                const ua = s.userAgent ?? 'Appareil inconnu'
                const browser = ua.includes('Chrome') ? '🌐 Chrome'
                  : ua.includes('Firefox') ? '🦊 Firefox'
                  : ua.includes('Safari') ? '🧭 Safari'
                  : '💻 Navigateur'
                return (
                  <div
                    className="document-row"
                    key={s.id}
                    style={{ borderLeft: isActive ? '3px solid #4ade80' : '3px solid var(--border)', opacity: isActive ? 1 : 0.5 }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>
                        {browser}
                        {isActive && <span style={{ marginLeft: '6px', fontSize: '9px', color: '#4ade80', fontFamily: 'var(--mono)', fontWeight: 700 }}>ACTIVE</span>}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px', display: 'flex', gap: '10px' }}>
                        {s.ipAddress && <span>{s.ipAddress}</span>}
                        <span>Créée le {new Date(s.createdAt).toLocaleDateString('fr-FR')}</span>
                        {s.lastUsedAt && <span>Utilisée le {new Date(s.lastUsedAt).toLocaleDateString('fr-FR')}</span>}
                      </div>
                    </div>
                    {isActive && (
                      <button
                        className="btn-ghost"
                        style={{ fontSize: '10px', padding: '3px 8px', color: '#f87171' }}
                        onClick={() => handleRevokeSession(s.id)}
                        title="Révoquer cette session"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ padding: '8px 20px 16px' }}>
              <button
                className="primary-action wide"
                style={{ background: 'rgba(244,63,94,0.15)', color: '#f87171', boxShadow: 'none', border: '1px solid rgba(244,63,94,0.3)' }}
                onClick={handleLogoutAll}
              >
                <LogOut size={16} />Déconnecter tous les appareils
              </button>
              <p style={{ fontSize: '10px', color: 'var(--text3)', textAlign: 'center', marginTop: '8px', fontFamily: 'var(--mono)' }}>
                Tu seras déconnecté de tous les appareils, y compris celui-ci.
              </p>
            </div>
          </article>
        </section>
      )}

      {/* ══ ONGLET MODULES ══ */}
      {activeTab === 'modules' && (
        <article className="panel" style={{ marginTop: '16px' }}>
          <div className="panel-header">
            <div><span className="panel-kicker">Configuration</span><h2>Modules actifs</h2></div>
            <span className="badge">{modules.filter(m => m.isEnabled).length}/{modules.length}</span>
          </div>
          <p style={{ padding: '8px 20px 4px', fontSize: '12px', color: 'var(--text3)' }}>
            Activer/désactiver un module masque ses routes et bloque l'accès à l'API. Les données sont conservées.
          </p>
          <div style={{ padding: '12px 20px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {modules.map((m) => (
              <button
                key={m.key}
                onClick={() => toggleModule(m)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 14px', borderRadius: '10px',
                  background: m.isEnabled ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${m.isEnabled ? 'rgba(124,58,237,0.25)' : 'var(--border)'}`,
                  cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font)',
                }}
              >
                <span style={{ fontSize: '20px' }}>{MODULE_ICONS[m.key] ?? '⚙️'}</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: m.isEnabled ? 'var(--text)' : 'var(--text2)' }}>{m.title}</div>
                  <div style={{ fontSize: '10px', fontFamily: 'var(--mono)', color: m.isEnabled ? '#a78bfa' : 'var(--text3)' }}>
                    {m.isEnabled ? 'Actif' : 'Désactivé'} · v{m.version}
                  </div>
                </div>
                <div style={{
                  width: '32px', height: '18px', borderRadius: '20px',
                  background: m.isEnabled ? 'var(--p1)' : 'rgba(255,255,255,0.1)',
                  position: 'relative', transition: 'all 0.2s',
                }}>
                  <div style={{
                    position: 'absolute', top: '3px',
                    left: m.isEnabled ? '16px' : '3px',
                    width: '12px', height: '12px',
                    borderRadius: '50%', background: 'white',
                    transition: 'all 0.2s',
                  }} />
                </div>
              </button>
            ))}
          </div>
        </article>
      )}

      {/* ══ ONGLET LOGS ══ */}
      {activeTab === 'logs' && (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={logFilter}
              onChange={e => setLogFilter(e.target.value)}
              placeholder="Filtrer les logs (action, module...)"
              style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '12px', fontFamily: 'var(--font)', outline: 'none' }}
            />
            {logFilter && <button className="btn-ghost" onClick={() => setLogFilter('')}>Effacer</button>}
          </div>

          <section className="stability-layout">
            {/* Activité */}
            <article className="panel">
              <div className="panel-header">
                <div><span className="panel-kicker">Activité</span><h2>Actions produit</h2></div>
                <Bell size={18} />
              </div>
              <div className="document-list">
                {filteredActivity.length === 0 ? (
                  <p className="muted">Aucune activité.</p>
                ) : (
                  filteredActivity.slice(0, 20).map((l) => (
                    <div className="document-row" key={l.id}>
                      <span style={{
                        fontSize: '10px', fontFamily: 'var(--mono)', padding: '2px 6px',
                        borderRadius: '4px', background: 'rgba(124,58,237,0.1)', color: '#a78bfa',
                        flexShrink: 0,
                      }}>
                        {l.moduleKey ?? 'core'}
                      </span>
                      <span style={{ flex: 1, fontSize: '12px' }}>{l.action}</span>
                      <small style={{ fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                        {new Date(l.createdAt).toLocaleDateString('fr-FR')}
                      </small>
                    </div>
                  ))
                )}
              </div>
            </article>

            {/* Audit */}
            <article className="panel">
              <div className="panel-header">
                <div><span className="panel-kicker">Audit</span><h2>Actions sensibles</h2></div>
                <ShieldCheck size={18} />
              </div>
              <div className="document-list">
                {filteredAudit.length === 0 ? (
                  <p className="muted">Aucun audit.</p>
                ) : (
                  filteredAudit.slice(0, 20).map((l) => (
                    <div className="document-row" key={l.id}>
                      <ShieldCheck size={14} style={{ color: '#a78bfa', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: '12px' }}>{l.action}</span>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {l.ipAddress && <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{l.ipAddress}</div>}
                        <small style={{ fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                          {new Date(l.createdAt).toLocaleDateString('fr-FR')}
                        </small>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>

            {/* Erreurs */}
            <article className="panel">
              <div className="panel-header">
                <div><span className="panel-kicker">Erreurs</span><h2>Serveur</h2></div>
              </div>
              <div className="document-list">
                {errorLogs.length === 0 ? (
                  <p className="muted" style={{ color: '#4ade80' }}>✓ Aucune erreur serveur.</p>
                ) : (
                  errorLogs.slice(0, 15).map((l) => (
                    <div className="document-row" key={l.id} style={{ borderLeft: `3px solid ${l.level === 'error' ? '#f87171' : '#fbbf24'}` }}>
                      <span style={{
                        fontSize: '9px', fontFamily: 'var(--mono)', fontWeight: 700,
                        padding: '2px 5px', borderRadius: '4px', flexShrink: 0,
                        background: l.level === 'error' ? 'rgba(244,63,94,0.1)' : 'rgba(251,191,36,0.1)',
                        color: l.level === 'error' ? '#f87171' : '#fbbf24',
                      }}>
                        {l.level.toUpperCase()}
                      </span>
                      <span style={{ flex: 1, fontSize: '12px' }}>{l.message}</span>
                      <small style={{ fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                        {new Date(l.createdAt).toLocaleDateString('fr-FR')}
                      </small>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        </div>
      )}
    </div>
  )
}
