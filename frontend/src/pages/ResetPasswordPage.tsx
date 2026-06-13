import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound, Lock } from 'lucide-react'
import { API_URL } from '../contexts/AuthContext'
import { parseApiError } from '../hooks/useApiError'

/**
 * Page de finalisation du « mot de passe oublié ». Le lien envoyé par email
 * pointe vers /app/reset-password?token=… : on lit le token, on demande le
 * nouveau mot de passe et on appelle POST /auth/reset-password.
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [isOk, setIsOk] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handle(e: { preventDefault(): void }) {
    e.preventDefault()
    if (busy) return
    setMsg('')
    if (!token) { setMsg('Lien invalide ou expiré. Refais une demande de réinitialisation.'); return }
    if (password.length < 8) { setMsg('Le mot de passe doit faire au moins 8 caractères.'); return }
    if (password !== confirm) { setMsg('Les deux mots de passe ne correspondent pas.'); return }

    setBusy(true)
    try {
      const r = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })
      if (r.ok) {
        setIsOk(true)
        setMsg('Mot de passe réinitialisé. Tu peux te connecter.')
        setTimeout(() => navigate('/app/login', { replace: true }), 1500)
      } else {
        setMsg(await parseApiError(r, 'Réinitialisation refusée.'))
      }
    } catch {
      setMsg('Impossible de contacter le serveur.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20 }}>
      <div style={{
        width: '100%', maxWidth: 380, background: 'var(--card)',
        border: '1px solid var(--border)', borderRadius: 16, padding: 28,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <KeyRound size={20} style={{ color: 'var(--p1)' }} />
          <strong style={{ fontSize: 18 }}>Nouveau mot de passe</strong>
        </div>

        {!token && (
          <p style={{ fontSize: 13, color: '#f87171', margin: 0 }}>
            Lien invalide : aucun token fourni.
          </p>
        )}

        {!isOk && (
          <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
              Nouveau mot de passe
              <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={14} style={{ position: 'absolute', left: 10, color: 'var(--text3)' }} />
                <input
                  className="modal-input" type="password" autoComplete="new-password"
                  style={{ paddingLeft: 32 }} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Au moins 8 caractères" required minLength={8}
                />
              </span>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
              Confirmation
              <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={14} style={{ position: 'absolute', left: 10, color: 'var(--text3)' }} />
                <input
                  className="modal-input" type="password" autoComplete="new-password"
                  style={{ paddingLeft: 32 }} value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Retape le mot de passe" required minLength={8}
                />
              </span>
            </label>
            <button className="primary-action wide" type="submit" disabled={busy}>
              <KeyRound size={14} />
              {busy ? 'Enregistrement…' : 'Réinitialiser'}
            </button>
          </form>
        )}

        {msg && (
          <p style={{
            fontSize: 12, margin: 0, padding: '8px 10px', borderRadius: 6,
            color: isOk ? '#4ade80' : '#f87171',
            background: isOk ? 'rgba(74,222,128,0.08)' : 'rgba(244,63,94,0.08)',
            border: `1px solid ${isOk ? 'rgba(74,222,128,0.25)' : 'rgba(244,63,94,0.25)'}`,
          }}>
            {msg}
          </p>
        )}

        <Link to="/app/login" style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
          ← Retour à la connexion
        </Link>
      </div>
    </div>
  )
}
