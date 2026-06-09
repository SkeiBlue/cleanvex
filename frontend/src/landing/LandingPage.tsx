import { Link } from 'react-router-dom'
import { ArrowRight, LayoutDashboard, LineChart, Lock, Sparkles } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useScrollReveal } from './useScrollReveal'
import './landing.css'

const MODULES = [
  { icon: '🚗', title: 'Véhicules',  desc: 'Suivi entretiens, alertes contrôle technique, pièces & ateliers.' },
  { icon: '💸', title: 'Finances',   desc: 'Comptes, opérations, catégories, graphiques mensuels.' },
  { icon: '📦', title: 'Stock',      desc: 'Outils, consommables, prêts et seuils d\'alerte.' },
  { icon: '📅', title: 'Agenda',     desc: 'Tâches, rappels, calendrier mensuel et notifications.' },
  { icon: '🏠', title: 'Immobilier', desc: 'Biens, surfaces, dépenses planifiées et historisées.' },
  { icon: '📁', title: 'Documents',  desc: 'Stockage privé, dates d\'expiration, partage contrôlé.' },
  { icon: '👥', title: 'Contacts',   desc: 'Carnet d\'adresses unifié avec historique d\'interactions.' },
  { icon: '📊', title: 'Rapports',   desc: 'Synthèse mensuelle, exports PDF/CSV pour ton comptable.' },
]

const FAQ = [
  {
    q: 'Qui peut utiliser CleanVex ?',
    a: 'CleanVex est conçu comme une plateforme personnelle modulaire : tu actives uniquement les modules dont tu as besoin (véhicules, finances, immobilier…). C\'est pensé pour un usage individuel ou pour une petite famille.',
  },
  {
    q: 'Mes données sont-elles en sécurité ?',
    a: 'Toutes les données sont stockées sur ton serveur (auto-hébergé). Auth JWT avec refresh tokens, 2FA TOTP optionnel, fichiers privés hors web root, sauvegardes Postgres planifiées.',
  },
  {
    q: 'Comment fonctionne le système modulaire ?',
    a: 'Chaque domaine (véhicules, finances, immo, etc.) est un module activable ou désactivable depuis l\'espace administration. Les modules désactivés disparaissent de la navigation et leurs routes API sont bloquées — sans perte de données.',
  },
  {
    q: 'L\'inscription est-elle ouverte ?',
    a: 'Selon la configuration de l\'instance, l\'inscription peut être ouverte ou protégée par un code d\'invitation. Demande à l\'administrateur de ton instance si tu n\'as pas reçu de lien.',
  },
  {
    q: 'L\'app est-elle utilisable sur téléphone ?',
    a: 'Oui : design responsive optimisé pour tablette et mobile, PWA installable depuis ton navigateur. La sidebar se replie automatiquement sur petits écrans.',
  },
]

const FEATURES = [
  { Icon: LayoutDashboard, title: 'Vue d\'ensemble unifiée', desc: 'Un dashboard qui synthétise tout : tâches en retard, finances du mois, véhicules en réparation, documents qui expirent.' },
  { Icon: Lock,            title: 'Privé par défaut',         desc: 'Fichiers stockés hors du web, authentification à deux facteurs, sessions révocables à la demande. Tes données restent chez toi.' },
  { Icon: Sparkles,        title: 'Modulaire',                desc: 'Active uniquement ce qui te sert. Pas besoin du module immobilier ? Désactive-le et il disparaît partout dans l\'app.' },
  { Icon: LineChart,       title: 'Insights intégrés',        desc: 'Graphiques mensuels, rapports exportables PDF/CSV, alertes intelligentes sur les échéances importantes.' },
]

export function LandingPage() {
  const { user } = useAuth()
  useScrollReveal()

  const primaryLabel = user ? 'Ouvrir l\'app' : 'Créer un compte'
  const primaryHref  = user ? '/app' : '/app/login'

  return (
    <div className="landing">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="landing-header">
        <div className="landing-wrap landing-nav">
          <Link to="/" className="landing-logo">
            <span className="landing-logo-gem" />
            CleanVex <span>(MonEspace)</span>
          </Link>
          <nav className="landing-nav-links">
            <a href="#features">Fonctionnalités</a>
            <a href="#modules">Modules</a>
            <a href="#why">Pourquoi</a>
            <a href="#faq">FAQ</a>
            <Link to="/contact">Contact</Link>
          </nav>
          <div className="landing-nav-right">
            {user ? (
              <Link to="/app" className="landing-btn primary">
                Ouvrir l'app <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link to="/app/login" className="landing-btn ghost">Se connecter</Link>
                <Link to="/app/login" className="landing-btn primary">
                  Commencer <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="landing-hero landing-wrap">
        <span className="landing-eyebrow">
          <span className="landing-eyebrow-dot" />
          Plateforme personnelle modulaire — v0.1
        </span>
        <h1 className="landing-h1">
          Ta vie personnelle, <span className="grad">organisée au même endroit</span>.
        </h1>
        <p className="landing-sub">
          CleanVex (MonEspace) regroupe véhicules, finances, immobilier, stock, agenda, documents et contacts
          dans un cockpit unique. Privé, auto-hébergé, modulaire — pensé pour celles et ceux qui veulent
          enfin arrêter de jongler entre dix outils.
        </p>
        <div className="landing-hero-actions">
          <Link to={primaryHref} className="landing-btn primary">
            {primaryLabel} <ArrowRight size={14} />
          </Link>
          <a href="#features" className="landing-btn ghost">Voir les fonctionnalités</a>
        </div>
        <div className="landing-hero-meta">
          <span>· 8 modules ·</span>
          <span>· Auto-hébergé ·</span>
          <span>· 2FA TOTP ·</span>
          <span>· PWA installable ·</span>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section id="features" className="landing-section landing-wrap">
        <span className="landing-section-kicker reveal">Pourquoi CleanVex</span>
        <h2 className="reveal">Une plateforme pensée pour durer.</h2>
        <p className="landing-section-lead reveal">
          Pas de SaaS opaque, pas de fonctionnalités payantes cachées : tu héberges, tu contrôles, tu adaptes.
        </p>
        <div className="landing-features">
          {FEATURES.map(({ Icon, title, desc }) => (
            <div key={title} className="landing-feature reveal">
              <div className="landing-feature-ico"><Icon size={20} /></div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Modules ────────────────────────────────────────────────── */}
      <section id="modules" className="landing-section landing-wrap">
        <span className="landing-section-kicker reveal">Tous les modules</span>
        <h2 className="reveal">Des briques qui s'activent à la demande.</h2>
        <p className="landing-section-lead reveal">
          Chaque module est indépendant : active ce qui te sert aujourd'hui, ajoute le reste plus tard.
        </p>
        <div className="landing-modules">
          {MODULES.map(m => (
            <div key={m.title} className="landing-module reveal">
              <span className="landing-module-emoji">{m.icon}</span>
              <h3>{m.title}</h3>
              <p>{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why (alternance image/texte) ───────────────────────────── */}
      <section id="why" className="landing-section landing-wrap">
        <span className="landing-section-kicker reveal">Conçu pour de vrai</span>
        <h2 className="reveal">L'antithèse du SaaS jetable.</h2>

        <div className="landing-why-row reveal" style={{ marginTop: 56 }}>
          <div>
            <h3>Tes données, ton serveur.</h3>
            <p>
              Auto-hébergé sur ta machine ou un VPS chez toi. Pas de tracking, pas de revente, pas de dépendance
              à un fournisseur tiers qui peut pivoter du jour au lendemain.
            </p>
            <ul>
              <li>Backend NestJS + PostgreSQL</li>
              <li>Fichiers privés hors web root</li>
              <li>Sauvegardes ZIP exportables</li>
            </ul>
          </div>
          <div className="landing-why-visual"><span className="landing-why-emoji">🔒</span></div>
        </div>

        <div className="landing-why-row reverse reveal">
          <div>
            <h3>Sécurité de niveau pro.</h3>
            <p>
              Auth JWT avec refresh tokens rotatifs, 2FA TOTP optionnel, sessions révocables, rate limiting
              sur les endpoints sensibles, validation stricte côté API.
            </p>
            <ul>
              <li>Argon2 sur les mots de passe</li>
              <li>Rate limit anti brute-force</li>
              <li>Audit log des actions sensibles</li>
            </ul>
          </div>
          <div className="landing-why-visual"><span className="landing-why-emoji">🛡️</span></div>
        </div>

        <div className="landing-why-row reveal">
          <div>
            <h3>Pensé pour le quotidien.</h3>
            <p>
              Dashboard synthétique au lancement, raccourcis clavier (⌘K pour la recherche globale), visite
              guidée à la première connexion, mode sombre/clair, PWA installable.
            </p>
            <ul>
              <li>Recherche globale unifiée</li>
              <li>Tour d'onboarding interactif</li>
              <li>Responsive mobile / tablette</li>
            </ul>
          </div>
          <div className="landing-why-visual"><span className="landing-why-emoji">✨</span></div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <section className="landing-section landing-wrap">
        <div className="landing-stats reveal">
          <div className="landing-stat"><strong>8</strong><span>Modules activables</span></div>
          <div className="landing-stat"><strong>0</strong><span>Tracking tiers</span></div>
          <div className="landing-stat"><strong>100%</strong><span>Auto-hébergé</span></div>
          <div className="landing-stat"><strong>∞</strong><span>Utilisateurs / instance</span></div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────── */}
      <section id="faq" className="landing-section landing-wrap">
        <span className="landing-section-kicker reveal">Foire aux questions</span>
        <h2 className="reveal">Tout ce que tu te demandes.</h2>
        <p className="landing-section-lead reveal">Et si la réponse n'est pas ici, écris-nous directement.</p>
        <div className="landing-faq">
          {FAQ.map((item, i) => (
            <details key={item.q} className="reveal" open={i === 0}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── CTA final ──────────────────────────────────────────────── */}
      <section className="landing-section landing-wrap">
        <div className="landing-cta reveal">
          <h2>Prêt à reprendre le contrôle ?</h2>
          <p>Crée ton compte en 30 secondes. Tu pourras activer les modules ensuite.</p>
          <Link to={primaryHref} className="landing-btn primary">
            {primaryLabel} <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-wrap landing-footer-inner">
          <div>© {new Date().getFullYear()} CleanVex — MonEspace v{__APP_VERSION__}</div>
          <div className="landing-footer-links">
            <a href="#features">Fonctionnalités</a>
            <a href="#modules">Modules</a>
            <a href="#faq">FAQ</a>
            <Link to="/contact">Contact</Link>
            <Link to="/app/login">Connexion</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
