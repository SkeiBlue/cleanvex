import { useState } from 'react'
import {
  ArrowRight, CalendarCheck, Car, Eye, EyeOff, FolderOpen,
  KeyRound, Lock, LogIn, Mail, Package, Plus, ShieldCheck, Sparkles,
  User, UserPlus, Wallet, Wrench, X,
} from 'lucide-react'
import { API_URL } from '../contexts/AuthContext'
import { parseApiError } from '../hooks/useApiError'

type FormEv = { preventDefault(): void }

type Props = {
  email: string
  password: string
  signupEmail: string
  signupPassword: string
  signupUsername: string
  signupInviteCode: string
  verificationToken: string
  message: string
  onEmailChange: (v: string) => void
  onPasswordChange: (v: string) => void
  onSignupEmailChange: (v: string) => void
  onSignupPasswordChange: (v: string) => void
  onSignupUsernameChange: (v: string) => void
  onSignupInviteCodeChange: (v: string) => void
  onVerificationTokenChange: (v: string) => void
  onLogin: (event: FormEv) => void
  onRegister: (event: FormEv) => void
  onVerifyEmail: (event: FormEv) => void
}

/* ───────────── Styles partagés ───────────── */
const INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '11px 14px 11px 38px',
  color: 'var(--text)',
  fontFamily: 'var(--font)',
  fontSize: 13.5,
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.15s, background 0.15s',
}
const LABEL: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6,
  fontSize: 10.5, color: 'var(--text3)',
  fontFamily: 'var(--mono)', letterSpacing: 1, textTransform: 'uppercase',
}
const ICON_WRAP: React.CSSProperties = {
  position: 'relative', display: 'flex', alignItems: 'center',
}
const ICON_IN_INPUT: React.CSSProperties = {
  position: 'absolute', left: 12, color: 'var(--text3)', pointerEvents: 'none',
}

function Field({
  label, icon, type = 'text', value, onChange, placeholder, required, autoComplete, name,
}: {
  label: string
  icon: React.ReactNode
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  autoComplete?: string
  name?: string
}) {
  return (
    <label style={LABEL}>
      {label}
      <div style={ICON_WRAP}>
        <span style={ICON_IN_INPUT}>{icon}</span>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          name={name}
          style={INPUT}
          onFocus={e => (e.currentTarget.style.borderColor = 'rgba(124,58,237,0.55)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
      </div>
    </label>
  )
}

/* Champ password avec œil afficher/cacher */
function PasswordField({
  label, value, onChange, placeholder, autoComplete = 'current-password',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
}) {
  const [shown, setShown] = useState(false)
  return (
    <label style={LABEL}>
      {label}
      <div style={ICON_WRAP}>
        <span style={ICON_IN_INPUT}><Lock size={14} /></span>
        <input
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          style={{ ...INPUT, paddingRight: 40 }}
          onFocus={e => (e.currentTarget.style.borderColor = 'rgba(124,58,237,0.55)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
        <button
          type="button"
          onClick={() => setShown(s => !s)}
          aria-label={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          style={{
            position: 'absolute', right: 8, background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text3)', padding: 6, display: 'flex',
          }}
        >
          {shown ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </label>
  )
}

/* ───────────── Mot de passe oublié inline ───────────── */
function ForgotInline({ onClose }: { onClose: () => void }) {
  const [forgotEmail, setForgotEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [isOk, setIsOk] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handle(e: FormEv) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setMsg('')
    try {
      const r = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })
      if (r.ok) { setIsOk(true); setMsg('Si ce compte existe, un email a été envoyé.') }
      else setMsg(await parseApiError(r, 'Erreur lors de la demande.'))
    } catch { setMsg('Impossible de contacter le serveur.') }
    finally { setBusy(false) }
  }

  return (
    <div style={{
      marginTop: 12, padding: 14, borderRadius: 10,
      background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.18)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 13 }}>Réinitialiser le mot de passe</strong>
        <button type="button" onClick={onClose} aria-label="Fermer"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, display: 'flex' }}>
          <X size={14} />
        </button>
      </div>
      <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field label="Email" icon={<Mail size={14} />} type="email"
          value={forgotEmail} onChange={setForgotEmail}
          placeholder="votre@email.com" required autoComplete="email" />
        {!isOk && (
          <button className="primary-action wide" type="submit" disabled={busy}>
            <KeyRound size={14} />
            {busy ? 'Envoi…' : 'Envoyer le lien'}
          </button>
        )}
        {msg && (
          <p style={{
            fontSize: 11, fontFamily: 'var(--mono)', margin: 0,
            padding: '8px 10px', borderRadius: 6,
            color: isOk ? '#4ade80' : '#f87171',
            background: isOk ? 'rgba(74,222,128,0.08)' : 'rgba(244,63,94,0.08)',
            border: `1px solid ${isOk ? 'rgba(74,222,128,0.25)' : 'rgba(244,63,94,0.25)'}`,
          }}>
            {msg}
          </p>
        )}
      </form>
    </div>
  )
}

/* ───────────── Vérif email inline ───────────── */
function VerifyInline({
  value, onChange, onSubmit, onClose,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: (e: FormEv) => void
  onClose: () => void
}) {
  return (
    <div style={{
      marginTop: 12, padding: 14, borderRadius: 10,
      background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.18)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 13 }}>Vérifier mon email</strong>
        <button type="button" onClick={onClose} aria-label="Fermer"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, display: 'flex' }}>
          <X size={14} />
        </button>
      </div>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field label="Token" icon={<KeyRound size={14} />}
          value={value} onChange={onChange}
          placeholder="Collez le token reçu par email" required />
        <button className="primary-action wide" type="submit">
          <ShieldCheck size={14} />Vérifier
        </button>
      </form>
    </div>
  )
}

/* ───────────── Highlight modules (colonne hero) ───────────── */
const FEATURES = [
  { icon: Car,            title: 'Véhicules',    desc: 'Suivi entretien, dépenses, documents.' },
  { icon: Wallet,         title: 'Finances',     desc: 'Comptes, transactions, catégories.' },
  { icon: FolderOpen,     title: 'Documents',    desc: 'Centralisation chiffrée, recherche.' },
  { icon: CalendarCheck,  title: 'Agenda',       desc: 'Tâches, rappels, notifications.' },
  { icon: Package,        title: 'Stock',        desc: 'Inventaire, alertes de rupture.' },
]

/* ───────────── Composant principal ───────────── */
export function LoginScreen({
  email, password, signupEmail, signupPassword, signupUsername, signupInviteCode,
  verificationToken, message,
  onEmailChange, onPasswordChange, onSignupEmailChange, onSignupPasswordChange,
  onSignupUsernameChange, onSignupInviteCodeChange, onVerificationTokenChange,
  onLogin, onRegister, onVerifyEmail,
}: Props) {
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [showForgot, setShowForgot] = useState(false)
  const [showVerify, setShowVerify] = useState(false)

  return (
    <main className="login-screen" style={{
      display: 'flex', alignItems: 'stretch', justifyContent: 'center',
      padding: '24px', gap: 0,
    }}>
      {/* Décor d'ambiance */}
      <div aria-hidden style={{
        position: 'fixed', top: '-200px', left: '-150px',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.18), transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div aria-hidden style={{
        position: 'fixed', bottom: '-200px', right: '-100px',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(6,182,212,0.12), transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)',
        gap: 40, maxWidth: 1100, width: '100%', margin: 'auto',
        position: 'relative', zIndex: 1,
      }} className="login-grid">

        {/* ── Hero (gauche en desktop, caché en mobile via CSS) ── */}
        <section className="login-hero" style={{
          display: 'flex', flexDirection: 'column', gap: 24, padding: '20px 0',
          justifyContent: 'center',
        }}>
          <div className="brand login-brand" style={{ alignSelf: 'flex-start' }}>
            <div className="brand-mark" style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', boxShadow: '0 8px 24px rgba(124,58,237,0.35)',
            }}>
              <Wrench size={22} />
            </div>
            <div>
              <strong style={{ fontSize: 18, letterSpacing: '-0.3px' }}>MonEspace</strong>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                Plateforme personnelle
              </span>
            </div>
          </div>

          <h1 style={{
            fontSize: 38, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.05,
            margin: 0,
          }}>
            Ton{' '}
            <span style={{
              background: 'linear-gradient(135deg, #a78bfa, #06b6d4)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              espace privé
            </span>
            <br />tout-en-un.
          </h1>

          <p style={{ fontSize: 14, color: 'var(--text2)', maxWidth: 460, lineHeight: 1.55, margin: 0 }}>
            Véhicules, finances, immobilier, documents, agenda, stock, contacts — un seul outil,
            chiffré, sans pub, et 100 % à toi.
          </p>

          <ul style={{
            listStyle: 'none', padding: 0, margin: 0,
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10,
          }}>
            {FEATURES.map(({ icon: Ic, title, desc }) => (
              <li key={title} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: 10, borderRadius: 10,
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid var(--border)',
              }}>
                <Ic size={16} style={{ color: '#a78bfa', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4 }}>{desc}</div>
                </div>
              </li>
            ))}
          </ul>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)',
          }}>
            <ShieldCheck size={12} /> JWT 15 min · refresh httpOnly · audit log
          </div>
        </section>

        {/* ── Carte formulaire (droite en desktop, plein écran mobile) ── */}
        <section style={{
          background: 'var(--card)',
          border: '1px solid var(--border)', borderRadius: 18,
          padding: '28px 28px 24px', backdropFilter: 'blur(16px)',
          display: 'flex', flexDirection: 'column', gap: 18,
          alignSelf: 'center', width: '100%', maxWidth: 460, justifySelf: 'center',
          boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
        }}>
          {/* Tabs Connexion / Inscription */}
          <div role="tablist" aria-label="Mode d'accès" style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
            borderRadius: 999, padding: 4,
          }}>
            {(['login', 'signup'] as const).map(t => (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={tab === t}
                onClick={() => { setTab(t); setShowForgot(false); setShowVerify(false) }}
                style={{
                  border: 'none', borderRadius: 999, padding: '8px 14px',
                  background: tab === t ? 'linear-gradient(135deg, #7c3aed, #2563eb)' : 'transparent',
                  color: tab === t ? 'white' : 'var(--text2)',
                  fontFamily: 'var(--font)', fontSize: 12.5, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {t === 'login' ? 'Se connecter' : 'Créer un compte'}
              </button>
            ))}
          </div>

          {/* ── Connexion ── */}
          {tab === 'login' && (
            <form className="login-form" onSubmit={onLogin}
              style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 0, background: 'none', border: 'none' }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.4px' }}>
                  Bon retour 👋
                </h1>
                <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '4px 0 0' }}>
                  Connecte-toi pour accéder à ton espace.
                </p>
              </div>

              <Field label="Email" icon={<Mail size={14} />} type="email"
                value={email} onChange={onEmailChange}
                placeholder="vous@email.com" required autoComplete="email" name="email" />
              <PasswordField label="Mot de passe" value={password} onChange={onPasswordChange}
                placeholder="••••••••" autoComplete="current-password" />

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowForgot(s => !s)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#a78bfa', fontSize: 11.5, fontFamily: 'var(--font)',
                    padding: 0, textDecoration: 'underline', textUnderlineOffset: 3,
                  }}>
                  Mot de passe oublié ?
                </button>
              </div>

              <button className="primary-action wide" type="submit" style={{ marginTop: 4 }}>
                <LogIn size={16} />
                Se connecter
                <ArrowRight size={14} style={{ marginLeft: 4 }} />
              </button>

              {message && (
                <p className="form-message" style={{ margin: 0 }}>{message}</p>
              )}

              {showForgot && <ForgotInline onClose={() => setShowForgot(false)} />}

              <div style={{
                textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 6,
              }}>
                Déjà reçu un email de vérification ?{' '}
                <button type="button" onClick={() => setShowVerify(s => !s)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#06b6d4', fontSize: 11, fontFamily: 'var(--font)',
                    textDecoration: 'underline', textUnderlineOffset: 3, padding: 0,
                  }}>
                  Saisir le token
                </button>
              </div>
              {showVerify && (
                <VerifyInline
                  value={verificationToken}
                  onChange={onVerificationTokenChange}
                  onSubmit={onVerifyEmail}
                  onClose={() => setShowVerify(false)}
                />
              )}
            </form>
          )}

          {/* ── Inscription ── */}
          {tab === 'signup' && (
            <form className="login-form" onSubmit={onRegister}
              style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 0, background: 'none', border: 'none' }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.4px' }}>
                  Créer un compte
                </h1>
                <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '4px 0 0' }}>
                  Demande un code d'invitation à l'admin pour rejoindre l'espace.
                </p>
              </div>

              <Field label="Email" icon={<Mail size={14} />} type="email"
                value={signupEmail} onChange={onSignupEmailChange}
                placeholder="vous@email.com" required autoComplete="email" />
              <Field label="Nom d'utilisateur" icon={<User size={14} />}
                value={signupUsername} onChange={onSignupUsernameChange}
                placeholder="ex: clement" autoComplete="username" />
              <PasswordField label="Mot de passe" value={signupPassword} onChange={onSignupPasswordChange}
                placeholder="8 caractères minimum" autoComplete="new-password" />
              <Field label="Code d'invitation" icon={<Sparkles size={14} />}
                value={signupInviteCode} onChange={onSignupInviteCodeChange}
                placeholder="xxx-xxx-xxx" required />

              <button className="primary-action wide" type="submit" style={{ marginTop: 4 }}>
                <UserPlus size={16} />
                Créer mon compte
                <ArrowRight size={14} style={{ marginLeft: 4 }} />
              </button>

              {message && <p className="form-message" style={{ margin: 0 }}>{message}</p>}

              <p style={{ fontSize: 11, color: 'var(--text3)', margin: '4px 0 0', textAlign: 'center' }}>
                En créant un compte, tu acceptes que tes données soient stockées de façon chiffrée.
              </p>
            </form>
          )}
        </section>
      </div>
    </main>
  )
}
