import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { LandingFooter } from './LandingFooter'
import './landing.css'

/* ─────────────────────────────────────────────────────────────────────────
   Pages légales publiques (mentions légales, CGU, confidentialité, cookies).
   Le contenu est volontairement générique et prêt à être complété au moment
   de l'ouverture commerciale du SaaS (raison sociale, SIREN, hébergeur, etc.).
   Les emplacements à renseigner sont marqués « [À COMPLÉTER] ».
   ───────────────────────────────────────────────────────────────────────── */

type Section = { title: string; body: React.ReactNode }

function LegalLayout({
  kicker,
  title,
  updatedAt,
  intro,
  sections,
}: {
  kicker: string
  title: string
  updatedAt: string
  intro: React.ReactNode
  sections: Section[]
}) {
  const { user } = useAuth()

  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-wrap landing-nav">
          <Link to="/" className="landing-logo">
            <span className="landing-logo-gem" />
            CleanVex
          </Link>
          <nav className="landing-nav-links">
            <Link to="/#solution">La solution</Link>
            <Link to="/#pour-qui">Pour qui&nbsp;?</Link>
            <Link to="/contact">Contact</Link>
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

      <section className="legal-wrap landing-wrap">
        <Link to="/" className="legal-back">
          <ArrowLeft size={15} /> Retour à l'accueil
        </Link>
        <span className="landing-section-kicker" style={{ textAlign: 'left' }}>{kicker}</span>
        <h1 className="legal-title">{title}</h1>
        <p className="legal-updated">Dernière mise à jour : {updatedAt}</p>

        <div className="legal-doc">
          <p className="legal-intro">{intro}</p>
          {sections.map((s, i) => (
            <div key={s.title} className="legal-section">
              <h2>{i + 1}. {s.title}</h2>
              {s.body}
            </div>
          ))}

          <p className="legal-note">
            Ce document est susceptible d'évoluer, notamment lors du passage de
            CleanVex en offre commerciale (SaaS). Les utilisateurs seront informés
            de toute modification substantielle.
          </p>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}

const UPDATED = '21 juin 2026'

/* ── Mentions légales ─────────────────────────────────────────────────── */
export function MentionsLegalesPage() {
  return (
    <LegalLayout
      kicker="Informations légales"
      title="Mentions légales"
      updatedAt={UPDATED}
      intro="Conformément à la loi pour la confiance dans l'économie numérique (LCEN), voici les informations relatives à l'éditeur et à l'hébergement du service CleanVex."
      sections={[
        {
          title: 'Éditeur du service',
          body: (
            <p>
              Le service CleanVex est édité par <strong>[À COMPLÉTER — raison sociale]</strong>,
              {' '}[forme juridique] au capital de [montant], immatriculée au RCS de [ville] sous le
              numéro <strong>[SIREN/SIRET]</strong>, dont le siège social est situé [adresse].
              <br />Directeur de la publication : [nom du responsable].
              <br />Contact : <Link to="/contact">via le formulaire de contact</Link>.
            </p>
          ),
        },
        {
          title: 'Hébergement',
          body: (
            <p>
              Dans sa version actuelle, CleanVex peut être <strong>auto-hébergé</strong> par
              l'utilisateur sur sa propre infrastructure. Pour la future offre SaaS,
              l'hébergement sera assuré par <strong>[À COMPLÉTER — hébergeur, adresse]</strong>.
            </p>
          ),
        },
        {
          title: 'Propriété intellectuelle',
          body: (
            <p>
              L'ensemble des éléments du service (code, design, marque, logo, contenus) est
              protégé par le droit de la propriété intellectuelle. Toute reproduction non
              autorisée est interdite. Les données saisies par l'utilisateur restent sa
              propriété exclusive.
            </p>
          ),
        },
      ]}
    />
  )
}

/* ── Conditions d'utilisation (CGU / futures CGV) ─────────────────────── */
export function ConditionsPage() {
  return (
    <LegalLayout
      kicker="Cadre contractuel"
      title="Conditions générales d'utilisation"
      updatedAt={UPDATED}
      intro="Les présentes conditions encadrent l'accès et l'utilisation de CleanVex. En utilisant le service, vous acceptez ces conditions."
      sections={[
        {
          title: 'Objet du service',
          body: (
            <p>
              CleanVex est une application de gestion d'atelier mécanique permettant de
              centraliser projets véhicules, stock de pièces, outillage, journal de travaux,
              documents et suivi des coûts.
            </p>
          ),
        },
        {
          title: 'Accès et compte',
          body: (
            <p>
              L'accès nécessite la création d'un compte. Vous êtes responsable de la
              confidentialité de vos identifiants et de toute activité réalisée depuis votre
              compte. Un système de double authentification (2FA) est disponible.
            </p>
          ),
        },
        {
          title: 'Offre commerciale (à venir)',
          body: (
            <p>
              CleanVex évolue vers une offre <strong>SaaS</strong>. Des formules payantes,
              décrites dans des conditions générales de vente dédiées, seront proposées. Les
              tarifs, modalités de paiement, de résiliation et de remboursement seront
              communiqués <strong>[À COMPLÉTER]</strong> avant toute souscription.
            </p>
          ),
        },
        {
          title: 'Responsabilité',
          body: (
            <p>
              Le service est fourni « en l'état ». Nous mettons tout en œuvre pour assurer sa
              disponibilité et la sécurité des données, sans garantie d'absence totale
              d'interruption. L'utilisateur est invité à conserver ses propres sauvegardes.
            </p>
          ),
        },
      ]}
    />
  )
}

/* ── Politique de confidentialité (RGPD) ──────────────────────────────── */
export function ConfidentialitePage() {
  return (
    <LegalLayout
      kicker="Protection des données"
      title="Politique de confidentialité"
      updatedAt={UPDATED}
      intro="Cette politique décrit comment vos données personnelles sont collectées, utilisées et protégées, conformément au Règlement général sur la protection des données (RGPD)."
      sections={[
        {
          title: 'Données collectées',
          body: (
            <p>
              Nous collectons les données nécessaires au fonctionnement du service : adresse
              email et identifiants de compte, ainsi que les contenus que vous saisissez
              (véhicules, pièces, documents, travaux). Aucune revente de données à des tiers.
            </p>
          ),
        },
        {
          title: 'Finalités',
          body: (
            <p>
              Vos données servent exclusivement à fournir le service, sécuriser votre compte,
              vous contacter en cas de besoin et, à terme, gérer votre abonnement SaaS.
            </p>
          ),
        },
        {
          title: 'Conservation',
          body: (
            <p>
              Les données sont conservées tant que votre compte est actif. Vous pouvez demander
              leur suppression à tout moment ; elles sont alors effacées dans un délai
              raisonnable, sauf obligation légale de conservation.
            </p>
          ),
        },
        {
          title: 'Vos droits',
          body: (
            <p>
              Vous disposez d'un droit d'accès, de rectification, d'effacement, de portabilité
              et d'opposition. Pour les exercer, contactez-nous
              {' '}<Link to="/contact">via le formulaire de contact</Link>. Vous pouvez
              également saisir la CNIL.
            </p>
          ),
        },
      ]}
    />
  )
}

/* ── Politique cookies ────────────────────────────────────────────────── */
export function CookiesPage() {
  return (
    <LegalLayout
      kicker="Traceurs"
      title="Politique de gestion des cookies"
      updatedAt={UPDATED}
      intro="CleanVex limite l'usage des cookies au strict nécessaire au fonctionnement du service."
      sections={[
        {
          title: 'Cookies essentiels',
          body: (
            <p>
              Ils sont indispensables au fonctionnement : maintien de la session, sécurité,
              préférences d'affichage (thème clair/sombre). Ils ne nécessitent pas de
              consentement préalable.
            </p>
          ),
        },
        {
          title: "Mesure d'audience",
          body: (
            <p>
              Des outils de mesure d'audience peuvent être utilisés pour améliorer le service.
              Le cas échéant, ils seront configurés de manière respectueuse de la vie privée et
              soumis à votre consentement <strong>[À COMPLÉTER selon la solution retenue]</strong>.
            </p>
          ),
        },
        {
          title: 'Gestion de vos préférences',
          body: (
            <p>
              Vous pouvez à tout moment paramétrer ou supprimer les cookies depuis votre
              navigateur. Le blocage des cookies essentiels peut dégrader le fonctionnement du
              service.
            </p>
          ),
        },
      ]}
    />
  )
}

/* ── Tarifs (placeholder « bientôt ») ─────────────────────────────────── */
export function TarifsPage() {
  const { user } = useAuth()
  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-wrap landing-nav">
          <Link to="/" className="landing-logo">
            <span className="landing-logo-gem" />
            CleanVex
          </Link>
          <nav className="landing-nav-links">
            <Link to="/#solution">La solution</Link>
            <Link to="/#pour-qui">Pour qui&nbsp;?</Link>
            <Link to="/contact">Contact</Link>
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

      <section className="legal-wrap landing-wrap" style={{ textAlign: 'center' }}>
        <span className="landing-eyebrow" style={{ margin: '0 auto 22px' }}>
          <span className="landing-eyebrow-dot" />
          Offre commerciale en préparation
        </span>
        <h1 className="legal-title" style={{ fontSize: 'clamp(30px, 5vw, 48px)' }}>
          Des tarifs <span className="grad">bientôt disponibles</span>.
        </h1>
        <p className="landing-sub" style={{ margin: '0 auto 30px' }}>
          CleanVex passe progressivement en SaaS. Les formules et tarifs seront annoncés
          prochainement. Laissez-nous votre email pour être prévenu en avant-première.
        </p>
        <div className="landing-hero-actions" style={{ justifyContent: 'center' }}>
          <Link to="/contact" className="landing-btn primary">
            Être prévenu·e <ArrowRight size={14} />
          </Link>
          <Link to="/" className="landing-btn ghost">Retour à l'accueil</Link>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}
