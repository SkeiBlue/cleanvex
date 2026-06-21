import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Car,
  Package,
  Wrench,
  NotebookPen,
  FolderOpen,
  Wallet,
  Search,
  CalendarClock,
  Receipt,
  Bike,
  Trophy,
  Hammer,
  Users,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useScrollReveal } from './useScrollReveal'
import { LandingFooter } from './LandingFooter'
import './landing.css'

const PILLARS = [
  {
    Icon: Car,
    title: 'Vos projets véhicules',
    desc: 'Suivez chaque restauration ou réparation, gardez l\'historique de vos travaux et sachez toujours où vous en êtes.',
  },
  {
    Icon: Package,
    title: 'Votre stock de pièces',
    desc: 'Retrouvez vos références, quantités, emplacements et évitez les achats en double.',
  },
  {
    Icon: Wrench,
    title: 'Votre atelier & outillage',
    desc: 'Gardez une vue claire de vos outils, de leur état et de leur organisation.',
  },
  {
    Icon: NotebookPen,
    title: 'Journal de travaux',
    desc: 'Conservez chaque intervention, chaque découverte et chaque étape de vos projets.',
  },
  {
    Icon: FolderOpen,
    title: 'Documentation centralisée',
    desc: 'Regroupez factures, photos, manuels, schémas techniques et documents importants.',
  },
  {
    Icon: Wallet,
    title: 'Coût réel de vos projets',
    desc: 'Suivez ce que chaque véhicule vous a réellement coûté au fil du temps.',
  },
]

const PROBLEMS = [
  {
    Icon: Search,
    title: 'Une pièce introuvable',
    desc: 'Vous avez acheté une pièce il y a 6 mois mais impossible de savoir où elle est rangée ?',
  },
  {
    Icon: CalendarClock,
    title: 'Un projet en pause',
    desc: 'Vous reprenez un projet après plusieurs semaines et vous ne savez plus où vous en étiez ?',
  },
  {
    Icon: Receipt,
    title: 'Des factures éparpillées',
    desc: 'Vos factures sont réparties entre votre téléphone, vos mails et plusieurs classeurs ?',
  },
]

const AUDIENCE = [
  { Icon: Car,     label: 'Passionnés automobiles', desc: 'Daily, youngtimers, sportives.' },
  { Icon: Hammer,  label: 'Restaurateurs',          desc: 'Projets longs, voitures de caractère.' },
  { Icon: Bike,    label: 'Motards & mobylettistes', desc: 'Deux-roues anciens ou modernes.' },
  { Icon: Trophy,  label: 'Collectionneurs',        desc: 'Plusieurs véhicules à suivre.' },
  { Icon: Users,   label: 'Bricoleurs équipés',     desc: 'Atelier perso, outillage sérieux.' },
]

export function LandingPage() {
  const { user } = useAuth()
  useScrollReveal()
  const [menuOpen, setMenuOpen] = useState(false)

  const primaryLabel = user ? 'Ouvrir l\'app' : 'Commencer gratuitement'
  const primaryHref  = user ? '/app' : '/app/login'

  return (
    <div className="landing">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="landing-header">
        <div className="landing-wrap landing-nav">
          <Link to="/" className="landing-logo">
            <span className="landing-logo-gem" />
            CleanVex
          </Link>
          <nav
            className={`landing-nav-links${menuOpen ? ' open' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            <a href="#probleme">Le problème</a>
            <a href="#solution">La solution</a>
            <a href="#exemple">Exemple</a>
            <a href="#pour-qui">Pour qui ?</a>
            <Link to="/contact">Contact</Link>
            {!user && <Link to="/app/login" className="landing-nav-mobile-auth">Se connecter</Link>}
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
            <button
              type="button"
              className="landing-burger"
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(o => !o)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="landing-hero landing-wrap">
        <span className="landing-eyebrow">
          <span className="landing-eyebrow-dot" />
          Le cerveau numérique de votre atelier
        </span>
        <h1 className="landing-h1">
          Ne perdez plus jamais le fil <br className="landing-h1-br" />
          de vos <span className="grad">projets mécaniques</span>.
        </h1>
        <p className="landing-sub">
          Centralisez vos véhicules, pièces, outils, documents et travaux dans une seule
          application pensée par et pour les passionnés de mécanique.
        </p>
        <div className="landing-hero-actions">
          <Link to={primaryHref} className="landing-btn primary">
            {primaryLabel} <ArrowRight size={14} />
          </Link>
          <a href="#solution" className="landing-btn ghost">Découvrir CleanVex</a>
        </div>

        {/* Mockup atelier */}
        <div className="landing-hero-mockup reveal">
          <div className="landing-mockup-frame">
            <div className="landing-mockup-bar">
              <span /><span /><span />
              <div className="landing-mockup-url">cleanvex · atelier</div>
            </div>
            <div className="landing-mockup-body">
              <aside className="landing-mockup-side">
                <div className="landing-mockup-side-logo">
                  <span className="landing-logo-gem" />
                  <strong>CleanVex</strong>
                </div>
                <ul>
                  <li className="active">Véhicules</li>
                  <li>Stock pièces</li>
                  <li>Outillage</li>
                  <li>Journal</li>
                  <li>Documents</li>
                  <li>Budget</li>
                </ul>
              </aside>
              <main className="landing-mockup-main">
                <div className="landing-mockup-title">
                  <h4>Mes projets</h4>
                  <span className="landing-mockup-badge">3 en cours</span>
                </div>
                <div className="landing-mockup-grid">
                  <div className="landing-mockup-card accent">
                    <div className="landing-mockup-card-head">
                      <span className="landing-mockup-emoji">🏎️</span>
                      <span className="landing-mockup-tag warn">En restauration</span>
                    </div>
                    <strong>Golf 3 GTI</strong>
                    <small>Train arrière · 3 250 €</small>
                  </div>
                  <div className="landing-mockup-card">
                    <div className="landing-mockup-card-head">
                      <span className="landing-mockup-emoji">🏍️</span>
                      <span className="landing-mockup-tag ok">Roulante</span>
                    </div>
                    <strong>CB 750 Four</strong>
                    <small>Vidange à -200 km</small>
                  </div>
                  <div className="landing-mockup-card">
                    <div className="landing-mockup-card-head">
                      <span className="landing-mockup-emoji">🛵</span>
                      <span className="landing-mockup-tag info">En pause</span>
                    </div>
                    <strong>Peugeot 103</strong>
                    <small>Stock : 12 pièces</small>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </section>

      {/* ── Le problème ────────────────────────────────────────────── */}
      <section id="probleme" className="landing-section landing-wrap">
        <span className="landing-section-kicker reveal">Le problème</span>
        <h2 className="reveal">Votre atelier déborde. Votre mémoire, aussi.</h2>
        <p className="landing-section-lead reveal">
          Carnets papier, notes sur le téléphone, photos perdues, classeurs, Excel, Drive…
          La mémoire de votre atelier est éclatée partout — sauf au bon endroit.
        </p>
        <div className="landing-problems">
          {PROBLEMS.map(({ Icon, title, desc }) => (
            <div key={title} className="landing-problem reveal">
              <div className="landing-problem-ico"><Icon size={22} /></div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── La solution / 6 piliers ────────────────────────────────── */}
      <section id="solution" className="landing-section landing-wrap">
        <span className="landing-section-kicker reveal">La solution</span>
        <h2 className="reveal">Toute la mémoire de votre atelier, au même endroit.</h2>
        <p className="landing-section-lead reveal">
          Six piliers pour reprendre le contrôle de vos projets, du premier démontage à la
          dernière intervention.
        </p>
        <div className="landing-pillars">
          {PILLARS.map(({ Icon, title, desc }) => (
            <div key={title} className="landing-pillar reveal">
              <div className="landing-pillar-ico">
                <Icon size={26} className="landing-pillar-lucide" />
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Exemple concret (réplique fidèle de la fiche véhicule) ──── */}
      <section id="exemple" className="landing-section landing-wrap">
        <span className="landing-section-kicker reveal">Un exemple concret</span>
        <h2 className="reveal">Voici la vraie fiche véhicule de CleanVex.</h2>
        <p className="landing-section-lead reveal">
          Exactement ce que vous retrouvez dans l'application : avancement, interventions,
          pièces et coût réel — pour savoir où vous en êtes en un coup d'œil.
        </p>

        <div className="landing-example reveal">
          {/* En-tête véhicule */}
          <div className="landing-example-head">
            <div>
              <span className="landing-example-emoji">🏎️</span>
              <div>
                <h3>Golf 3 GTI</h3>
                <small>Volkswagen · 1992 · GH-208-VR</small>
              </div>
            </div>
            <span className="lx-status restoration">En restauration</span>
          </div>

          {/* Onglets de la fiche */}
          <div className="lx-tabs">
            <span className="active">Résumé</span>
            <span>Interventions</span>
            <span>Pièces</span>
            <span>Alertes</span>
            <span>Budget</span>
            <span>Documents</span>
          </div>

          {/* Caractéristiques */}
          <div className="lx-specs">
            <span>Kilométrage<strong>187 400 km</strong></span>
            <span>Année<strong>1992</strong></span>
            <span>Carburant<strong>Essence</strong></span>
            <span>Puissance<strong>110 CV</strong></span>
          </div>

          {/* Avancement global */}
          <div className="lx-progress">
            <div className="lx-mono">AVANCEMENT GLOBAL</div>
            <div className="lx-bar-head">
              <span>6/10 éléments terminés</span>
              <strong>60 %</strong>
            </div>
            <div className="lx-bar"><div className="lx-bar-fill" style={{ width: '60%' }} /></div>
            <div className="lx-mini-stats">
              <div><strong style={{ color: '#4ade80' }}>6/9</strong><span>Interventions faites</span></div>
              <div><strong style={{ color: 'var(--text3)' }}>0</strong><span>Bloqués</span></div>
              <div><strong style={{ color: '#fbbf24' }}>1</strong><span>Alerte ouverte</span></div>
            </div>
          </div>

          {/* Travaux + pièces (statuts réels du produit) */}
          <div className="lx-lists">
            <div className="lx-list">
              <div className="lx-mono">Interventions</div>
              <div className="lx-row">
                <span>Remplacement du train arrière</span>
                <span className="lx-badge done">Terminé</span>
              </div>
              <div className="lx-row">
                <span>Réfection des silent-blocs</span>
                <span className="lx-badge todo">À faire</span>
              </div>
            </div>
            <div className="lx-list">
              <div className="lx-mono">Pièces</div>
              <div className="lx-row">
                <span>4× Vis de fixation train AR</span>
                <span className="lx-badge recu">Reçu</span>
              </div>
              <div className="lx-row">
                <span>2× Silent-blocs renforcés</span>
                <span className="lx-badge acheter">À acheter</span>
              </div>
            </div>
          </div>

          {/* Coût réel */}
          <div className="lx-costs">
            <span>Coût total<strong style={{ color: '#f87171' }}>3 250 €</strong></span>
            <span>Déjà réalisé<strong style={{ color: '#4ade80' }}>2 480 €</strong></span>
            <span>Reste à faire<strong style={{ color: '#fbbf24' }}>770 €</strong></span>
          </div>
        </div>
      </section>

      {/* ── Pour qui ───────────────────────────────────────────────── */}
      <section id="pour-qui" className="landing-section landing-wrap">
        <span className="landing-section-kicker reveal">Pour qui ?</span>
        <h2 className="reveal">Fait pour celles et ceux qui aiment vraiment la mécanique.</h2>
        <p className="landing-section-lead reveal">
          CleanVex n'est pas un outil pour l'automobiliste moyen. C'est l'outil de celles et
          ceux qui vivent dans leur atelier.
        </p>
        <div className="landing-audience">
          {AUDIENCE.map(({ Icon, label, desc }) => (
            <div key={label} className="landing-audience-card reveal">
              <div className="landing-audience-ico"><Icon size={20} /></div>
              <strong>{label}</strong>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA final ──────────────────────────────────────────────── */}
      <section className="landing-section landing-wrap">
        <div className="landing-cta reveal">
          <h2>Votre atelier a une mémoire.<br />Donnez-lui un cerveau.</h2>
          <p>Créez votre compte gratuitement et commencez à structurer vos projets dès aujourd'hui.</p>
          <Link to={primaryHref} className="landing-btn primary">
            {primaryLabel} <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <LandingFooter />
    </div>
  )
}
