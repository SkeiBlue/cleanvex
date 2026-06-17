import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bell, LayoutGrid, LogOut, Maximize2, Moon, Settings, Shield, ShieldCheck, Sparkles, Sun, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { startOnboardingTour } from '../components/OnboardingTour'
import { useDensity } from '../hooks/useDensity'
import { useTheme } from '../hooks/useTheme'
import type { ActivityLog, AuditLog, ErrorLog, ProfileInfo, UserSetting } from '../types'
import { SettingsModulesTab } from './SettingsModulesTab'
import { SettingsUnitsTab } from './SettingsUnitsTab'

type FormEv = { preventDefault(): void; currentTarget: HTMLFormElement }
// Sprint 3 — onglets "modules" et "unites" ajoutés : préférences utilisateur
// (≠ activation globale qui reste dans /admin).
type Tab = 'profil' | 'securite' | 'modules' | 'unites' | 'logs'

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
  const { authedFetch, logout } = useAuth()
  const [density, setDensity] = useDensity()
  const [theme, setTheme] = useTheme()
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null)
  const [settings, setSettings] = useState<UserSetting[]>([])
  const [totpQr, setTotpQr] = useState<string | null>(null)
  const [totpSecret, setTotpSecret] = useState<string | null>(null)
  const [totpEnabled, setTotpEnabled] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [disablePassword, setDisablePassword] = useState('')
  const [totpMsg, setTotpMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([])
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok' | 'err'>('ok')
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = ((): Tab => {
    const t = searchParams.get('tab') as Tab | null
    const allowed: Tab[] = ['profil', 'securite', 'modules', 'unites', 'logs']
    return t && allowed.includes(t) ? t : 'profil'
  })()
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  // Nettoie le param ?tab=... une fois lu (URL plus propre)
  useEffect(() => {
    if (searchParams.get('tab')) {
      const next = new URLSearchParams(searchParams)
      next.delete('tab')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [logFilter, setLogFilter] = useState('')

  function setOk(msg: string) { setMessage(msg); setMessageType('ok') }
  function setErr(msg: string) { setMessage(msg); setMessageType('err') }

  async function handle2faSetup() {
    const r = await authedFetch('/auth/2fa/setup', { method: 'POST' })
    if (!r.ok) { setTotpMsg({ text: 'Erreur lors de la génération.', ok: false }); return }
    const d = await r.json()
    setTotpQr(d.qrDataUrl); setTotpSecret(d.secret); setTotpCode(''); setTotpMsg(null)
  }

  async function handle2faEnable() {
    const r = await authedFetch('/auth/2fa/enable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: totpCode }) })
    if (!r.ok) { setTotpMsg({ text: 'Code invalide, réessaye.', ok: false }); return }
    setTotpEnabled(true); setTotpQr(null); setTotpSecret(null); setTotpMsg({ text: '2FA activé avec succès !', ok: true })
  }

  async function handle2faDisable() {
    const r = await authedFetch('/auth/2fa/disable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: disablePassword, code: totpCode }) })
    if (!r.ok) { setTotpMsg({ text: 'Mot de passe ou code incorrect.', ok: false }); return }
    setTotpEnabled(false); setTotpCode(''); setDisablePassword(''); setTotpMsg({ text: '2FA désactivé.', ok: true })
  }

  async function load() {
    const [p, s, act, aud, err] = await Promise.all([
      authedFetch('/profile'), authedFetch('/settings'),
      authedFetch('/activity'), authedFetch('/audit'), authedFetch('/errors'),
    ])
    if (p.ok) setProfileInfo(await p.json())
    if (s.ok) setSettings(await s.json())
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
    // Doit rester aligné sur la politique backend (IsStrongPassword).
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/.test(newPassword)) {
      setErr('Le mot de passe doit contenir au moins 8 caractères, une minuscule, une majuscule, un chiffre et un caractère spécial.')
      return
    }
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
      <div className="tabs-bar">
        <TabBtn label="Profil" active={activeTab === 'profil'} onClick={() => setActiveTab('profil')} />
        <TabBtn label="Sécurité" active={activeTab === 'securite'} onClick={() => setActiveTab('securite')} />
        <TabBtn label="Modules" active={activeTab === 'modules'} onClick={() => setActiveTab('modules')} />
        <TabBtn label="Unités" active={activeTab === 'unites'} onClick={() => setActiveTab('unites')} />
        <TabBtn label="Logs" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
      </div>

      {activeTab === 'modules' && <SettingsModulesTab />}
      {activeTab === 'unites' && <SettingsUnitsTab />}

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

          {/* Thème */}
          <article className="panel">
            <div className="panel-header">
              <div><span className="panel-kicker">Apparence</span><h2>Thème</h2></div>
              {theme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
            </div>
            <div style={{ padding: '14px 20px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
                Bascule entre sombre et clair. Appliqué immédiatement et conservé sur cet appareil.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  aria-pressed={theme === 'dark'}
                  style={{
                    flex: 1, minWidth: 180, padding: '12px 14px',
                    background: theme === 'dark' ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${theme === 'dark' ? 'rgba(167,139,250,0.5)' : 'var(--border)'}`,
                    borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <Moon size={16} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Sombre</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Confort visuel le soir, look par défaut.</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  aria-pressed={theme === 'light'}
                  style={{
                    flex: 1, minWidth: 180, padding: '12px 14px',
                    background: theme === 'light' ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${theme === 'light' ? 'rgba(167,139,250,0.5)' : 'var(--border)'}`,
                    borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <Sun size={16} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Clair</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Idéal en plein jour, contraste élevé.</div>
                  </div>
                </button>
              </div>
            </div>
          </article>

          {/* Apparence */}
          <article className="panel">
            <div className="panel-header">
              <div><span className="panel-kicker">Apparence</span><h2>Densité d'affichage</h2></div>
              <LayoutGrid size={20} />
            </div>
            <div style={{ padding: '14px 20px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
                Choisis la densité d'interface. Le réglage s'applique immédiatement et est conservé sur cet appareil.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setDensity('comfortable')}
                  aria-pressed={density === 'comfortable'}
                  style={{
                    flex: 1, minWidth: 180, padding: '12px 14px',
                    background: density === 'comfortable' ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${density === 'comfortable' ? 'rgba(167,139,250,0.5)' : 'var(--border)'}`,
                    borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <Maximize2 size={16} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Confortable</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Marges aérées, lisibilité maximale.</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDensity('compact')}
                  aria-pressed={density === 'compact'}
                  style={{
                    flex: 1, minWidth: 180, padding: '12px 14px',
                    background: density === 'compact' ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${density === 'compact' ? 'rgba(167,139,250,0.5)' : 'var(--border)'}`,
                    borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <LayoutGrid size={16} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Compact</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Plus d'infos à l'écran, marges réduites.</div>
                  </div>
                </button>
              </div>
            </div>
          </article>

          {/* Aide / Onboarding */}
          <article className="panel">
            <div className="panel-header">
              <div><span className="panel-kicker">Aide</span><h2>Visite guidée</h2></div>
              <Sparkles size={20} />
            </div>
            <div style={{ padding: '14px 20px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
                Tu peux relancer la visite guidée à tout moment pour redécouvrir l'interface.
              </p>
              <button
                type="button"
                className="primary-action"
                onClick={() => startOnboardingTour()}
                style={{ alignSelf: 'flex-start' }}
              >
                <Sparkles size={14} /> Refaire la visite guidée
              </button>
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
                <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '6px' }}>NOUVEAU MOT DE PASSE</div>
                <input name="newPassword" type="password" placeholder="8+ car., maj., min., chiffre, spécial" style={INPUT_STYLE} required minLength={8} maxLength={72} />
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

          {/* 2FA */}
          <article className="panel">
            <div className="panel-header">
              <div><span className="panel-kicker">Sécurité</span><h2>Authentification à deux facteurs</h2></div>
              <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: totpEnabled ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: totpEnabled ? '#4ade80' : '#f87171', border: `1px solid ${totpEnabled ? '#4ade80' : '#f87171'}40`, fontFamily: 'var(--mono)', fontWeight: 700 }}>
                {totpEnabled ? '✓ ACTIVÉ' : '✗ DÉSACTIVÉ'}
              </span>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {totpMsg && (
                <div style={{ fontSize: '12px', padding: '8px 12px', borderRadius: '8px', background: totpMsg.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', color: totpMsg.ok ? '#4ade80' : '#f87171', border: `1px solid ${totpMsg.ok ? '#4ade8040' : '#f8717140'}` }}>
                  {totpMsg.text}
                </div>
              )}
              {!totpEnabled && !totpQr && (
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px' }}>
                    Protège ton compte avec une application TOTP (Authy, Google Authenticator, etc.).
                    Le code change toutes les 30 secondes.
                  </p>
                  <button className="primary-action" onClick={handle2faSetup} style={{ width: 'auto' }}>
                    <ShieldCheck size={15} /> Configurer le 2FA
                  </button>
                </div>
              )}
              {!totpEnabled && totpQr && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text2)' }}>
                    1. Scanne ce QR code avec ton application TOTP<br />
                    2. Entre le code à 6 chiffres pour confirmer
                  </p>
                  <img src={totpQr} alt="QR Code 2FA" style={{ width: '200px', height: '200px', borderRadius: '12px', alignSelf: 'center' }} />
                  {totpSecret && (
                    <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', textAlign: 'center', wordBreak: 'break-all' }}>
                      Secret: {totpSecret}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Code à 6 chiffres" maxLength={6}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px', fontFamily: 'var(--mono)', textAlign: 'center', outline: 'none', letterSpacing: '0.2em' }}
                    />
                    <button className="primary-action" onClick={handle2faEnable} style={{ width: 'auto' }} disabled={totpCode.length !== 6}>
                      Activer
                    </button>
                  </div>
                </div>
              )}
              {totpEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text3)' }}>
                    Pour désactiver le 2FA, entre ton mot de passe et ton code actuel.
                  </p>
                  <input
                    type="password"
                    value={disablePassword} onChange={e => setDisablePassword(e.target.value)}
                    placeholder="Mot de passe actuel" autoComplete="current-password"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px', fontFamily: 'var(--font)', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Code à 6 chiffres" maxLength={6}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '14px', fontFamily: 'var(--mono)', textAlign: 'center', outline: 'none', letterSpacing: '0.2em' }}
                    />
                    <button
                      onClick={handle2faDisable}
                      style={{ padding: '8px 16px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', color: '#f87171', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font)' }}
                      disabled={totpCode.length !== 6 || disablePassword.length < 8}
                    >
                      Désactiver
                    </button>
                  </div>
                </div>
              )}
            </div>
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
