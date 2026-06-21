import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Mail, Send } from 'lucide-react'
import { API_URL, useAuth } from '../contexts/AuthContext'
import { LandingFooter } from './LandingFooter'
import './landing.css'
import './contact.css'

type Status =
  | { state: 'idle' }
  | { state: 'sending' }
  | { state: 'success' }
  | { state: 'error', message: string }

export function ContactPage() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>({ state: 'idle' })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status.state === 'sending') return // anti double-submit
    setStatus({ state: 'sending' })

    try {
      const r = await fetch(`${API_URL}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
        }),
      })
      if (r.status === 429) {
        setStatus({ state: 'error', message: 'Trop de messages envoyés récemment. Réessaie dans quelques minutes.' })
        return
      }
      if (!r.ok) {
        const body = await r.json().catch(() => ({} as { message?: string }))
        setStatus({ state: 'error', message: body.message ?? 'Envoi refusé. Vérifie tes informations.' })
        return
      }
      setStatus({ state: 'success' })
      // Reset doux après succès
      setSubject(''); setMessage('')
    } catch {
      setStatus({ state: 'error', message: 'Erreur réseau. Réessaie dans un instant.' })
    }
  }

  return (
    <div className="landing">
      {/* Header simplifié (réutilise le style landing) */}
      <header className="landing-header">
        <div className="landing-wrap landing-nav">
          <Link to="/" className="landing-logo">
            <span className="landing-logo-gem" />
            CleanVex
          </Link>
          <nav className="landing-nav-links">
            <Link to="/#solution">La solution</Link>
            <Link to="/#pour-qui">Pour qui&nbsp;?</Link>
            <Link to="/contact" style={{ color: 'var(--text)' }}>Contact</Link>
          </nav>
          <div className="landing-nav-right">
            {user ? (
              <Link to="/app" className="landing-btn primary">
                Ouvrir l'app <ArrowRight size={14} />
              </Link>
            ) : (
              <Link to="/app/login" className="landing-btn ghost">Se connecter</Link>
            )}
          </div>
        </div>
      </header>

      <section className="contact-wrap">
        <div className="contact-intro">
          <span className="landing-eyebrow">
            <span className="landing-eyebrow-dot" />
            Une question ? Un retour ? Un partenariat ?
          </span>
          <h1 className="landing-h1" style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}>
            Parlons de <span className="grad">ton projet</span>.
          </h1>
          <p className="landing-sub" style={{ margin: '12px 0 0' }}>
            On répond généralement sous 48&nbsp;heures ouvrées. Pour les questions techniques sur ton instance
            auto-hébergée, contacte d'abord l'administrateur qui l'a déployée chez toi.
          </p>

          <div className="contact-meta">
            <div className="contact-meta-card">
              <Mail size={18} />
              <div>
                <strong>Réponse rapide</strong>
                <span>par email, depuis ta boîte habituelle</span>
              </div>
            </div>
            <div className="contact-meta-card">
              <CheckCircle2 size={18} />
              <div>
                <strong>Pas de spam</strong>
                <span>ton email n'est utilisé que pour te répondre</span>
              </div>
            </div>
          </div>
        </div>

        {/* Formulaire */}
        <form className="contact-card" onSubmit={handleSubmit} noValidate={false}>
          {status.state === 'success' ? (
            <div className="contact-success">
              <div className="contact-success-ico"><CheckCircle2 size={28} /></div>
              <h2>Message envoyé</h2>
              <p>
                Merci {name || 'pour ton message'} ! On t'écrit à <strong>{email}</strong> sous 48h.
              </p>
              <button
                type="button"
                className="landing-btn ghost"
                onClick={() => { setStatus({ state: 'idle' }); setName(''); setEmail('') }}
                style={{ marginTop: 18 }}
              >
                Envoyer un autre message
              </button>
            </div>
          ) : (
            <>
              <div className="contact-row">
                <label className="contact-field">
                  <span>Ton nom</span>
                  <input
                    type="text" required minLength={2} maxLength={80}
                    value={name} onChange={e => setName(e.target.value)}
                    placeholder="Ex : Alex Dupont"
                    autoComplete="name"
                    disabled={status.state === 'sending'}
                  />
                </label>
                <label className="contact-field">
                  <span>Ton email</span>
                  <input
                    type="email" required maxLength={254}
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="alex@exemple.fr"
                    autoComplete="email"
                    disabled={status.state === 'sending'}
                  />
                </label>
              </div>

              <label className="contact-field">
                <span>Sujet</span>
                <input
                  type="text" required minLength={3} maxLength={140}
                  value={subject} onChange={e => setSubject(e.target.value)}
                  placeholder="Découverte du projet, démo, contribution…"
                  disabled={status.state === 'sending'}
                />
              </label>

              <label className="contact-field">
                <span>Message</span>
                <textarea
                  required minLength={10} maxLength={4000} rows={7}
                  value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Dis-nous ce qui t'amène. Plus tu donnes de contexte, mieux on peut t'aider."
                  disabled={status.state === 'sending'}
                />
                <small className="contact-counter">{message.length}/4000</small>
              </label>

              {status.state === 'error' && (
                <div className="contact-error" role="alert">
                  {status.message}
                </div>
              )}

              <button
                type="submit"
                className="landing-btn primary contact-submit"
                disabled={status.state === 'sending'}
              >
                {status.state === 'sending' ? 'Envoi…' : <>Envoyer le message <Send size={14} /></>}
              </button>

              <p className="contact-legal">
                En envoyant ce formulaire, tu acceptes qu'on te recontacte à l'adresse fournie.
                Aucune donnée n'est partagée à des tiers.
              </p>
            </>
          )}
        </form>
      </section>

      {/* Footer réutilisé */}
      <LandingFooter />
    </div>
  )
}
