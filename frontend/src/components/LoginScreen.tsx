import { Plus, ShieldCheck, Wrench } from 'lucide-react'

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
          <div><strong>Atelier Core</strong><span>Acces prive V0.2</span></div>
        </div>

        <form className="login-form" onSubmit={onLogin}>
          <h1>Connexion</h1>
          <label>Email<input value={email} onChange={(e) => onEmailChange(e.target.value)} /></label>
          <label>Mot de passe<input type="password" value={password} onChange={(e) => onPasswordChange(e.target.value)} /></label>
          <button className="primary-action wide" type="submit"><ShieldCheck size={18} />Entrer</button>
          {message && <p className="form-message">{message}</p>}
        </form>

        <form className="login-form" onSubmit={onRegister}>
          <h2>Creation de compte</h2>
          <label>Email<input value={signupEmail} onChange={(e) => onSignupEmailChange(e.target.value)} /></label>
          <label>Nom<input value={signupUsername} onChange={(e) => onSignupUsernameChange(e.target.value)} /></label>
          <label>Mot de passe<input type="password" value={signupPassword} onChange={(e) => onSignupPasswordChange(e.target.value)} /></label>
          <label>Code invitation<input value={signupInviteCode} onChange={(e) => onSignupInviteCodeChange(e.target.value)} /></label>
          <button className="primary-action wide" type="submit"><Plus size={18} />Creer</button>
        </form>

        <form className="login-form" onSubmit={onVerifyEmail}>
          <h2>Verification email</h2>
          <label>Token<input value={verificationToken} onChange={(e) => onVerificationTokenChange(e.target.value)} /></label>
          <button className="primary-action wide" type="submit"><ShieldCheck size={18} />Verifier</button>
        </form>
      </section>
    </main>
  )
}
