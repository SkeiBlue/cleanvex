import { useState } from 'react'
import { KeyRound, Plus, ShieldCheck, Wrench } from 'lucide-react'
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

function ForgotPasswordForm() {
  const [forgotEmail, setForgotEmail] = useState('')
  const [msg, setMsg]   = useState('')
  const [isOk, setIsOk] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleForgot(e: FormEv) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setMsg('')
    try {
      const r = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })
      if (r.ok) {
        setIsOk(true)
        setMsg('Si ce compte existe, un email de réinitialisation a été envoyé.')
      } else {
        setMsg(await parseApiError(r, 'Erreur lors de la demande.'))
      }
    } catch {
      setMsg('Impossible de contacter le serveur.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="login-form" onSubmit={handleForgot}>
      <h2>Mot de passe oublié</h2>
      <label>
        Email
        <input
          type="email"
          value={forgotEmail}
          onChange={e => setForgotEmail(e.target.value)}
          disabled={isOk}
          placeholder="votre@email.com"
          required
        />
      </label>
      {!isOk && (
        <button className="primary-action wide" type="submit" disabled={busy}>
          <KeyRound size={16} />
          {busy ? 'Envoi…' : 'Envoyer le lien'}
        </button>
      )}
      {msg && (
        <p className="form-message" style={{ color: isOk ? '#4ade80' : '#f87171' }}>{msg}</p>
      )}
    </form>
  )
}

export function LoginScreen({
  email, password, signupEmail, signupPassword, signupUsername, signupInviteCode,
  verificationToken, message,
  onEmailChange, onPasswordChange, onSignupEmailChange, onSignupPasswordChange,
  onSignupUsernameChange, onSignupInviteCodeChange, onVerificationTokenChange,
  onLogin, onRegister, onVerifyEmail,
}: Props) {
  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand login-brand">
          <div className="brand-mark"><Wrench size={20} /></div>
          <div><strong>Atelier Core</strong><span>Accès privé V0.2</span></div>
        </div>

        <form className="login-form" onSubmit={onLogin}>
          <h1>Connexion</h1>
          <label>Email<input type="email" value={email} onChange={(e) => onEmailChange(e.target.value)} /></label>
          <label>Mot de passe<input type="password" value={password} onChange={(e) => onPasswordChange(e.target.value)} /></label>
          <button className="primary-action wide" type="submit"><ShieldCheck size={18} />Entrer</button>
          {message && <p className="form-message">{message}</p>}
        </form>

        <ForgotPasswordForm />

        <form className="login-form" onSubmit={onRegister}>
          <h2>Création de compte</h2>
          <label>Email<input type="email" value={signupEmail} onChange={(e) => onSignupEmailChange(e.target.value)} /></label>
          <label>Nom<input value={signupUsername} onChange={(e) => onSignupUsernameChange(e.target.value)} /></label>
          <label>Mot de passe<input type="password" value={signupPassword} onChange={(e) => onSignupPasswordChange(e.target.value)} /></label>
          <label>Code invitation<input value={signupInviteCode} onChange={(e) => onSignupInviteCodeChange(e.target.value)} /></label>
          <button className="primary-action wide" type="submit"><Plus size={18} />Créer</button>
        </form>

        <form className="login-form" onSubmit={onVerifyEmail}>
          <h2>Vérification email</h2>
          <label>Token<input value={verificationToken} onChange={(e) => onVerificationTokenChange(e.target.value)} /></label>
          <button className="primary-action wide" type="submit"><ShieldCheck size={18} />Vérifier</button>
        </form>
      </section>
    </main>
  )
}
