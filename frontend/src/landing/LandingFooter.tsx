import { Link } from 'react-router-dom'

/**
 * Footer public réutilisé sur la landing, la page contact et les pages légales.
 * Structure pensée pour évoluer vers un SaaS : colonnes Produit / Compte / Légal,
 * mentions légales et liens RGPD prêts à être complétés à l'ouverture commerciale.
 */
export function LandingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="landing-footer">
      <div className="landing-wrap">
        <div className="landing-footer-grid">
          <div className="landing-footer-brand">
            <Link to="/" className="landing-logo">
              <span className="landing-logo-gem" />
              CleanVex
            </Link>
            <p>
              Le cerveau numérique de votre atelier. Centralisez véhicules, pièces,
              outils, documents et travaux au même endroit.
            </p>
            <span className="landing-footer-tag">Conçu par des passionnés, pour des passionnés.</span>
          </div>

          <nav className="landing-footer-col">
            <h4>Produit</h4>
            <Link to="/#solution">La solution</Link>
            <Link to="/#exemple">Exemple concret</Link>
            <Link to="/#pour-qui">Pour qui&nbsp;?</Link>
            <Link to="/tarifs">
              Tarifs <span className="landing-footer-soon">bientôt</span>
            </Link>
          </nav>

          <nav className="landing-footer-col">
            <h4>Compte</h4>
            <Link to="/app/login">Se connecter</Link>
            <Link to="/app/login">Créer un compte</Link>
            <Link to="/contact">Contact &amp; support</Link>
          </nav>

          <nav className="landing-footer-col">
            <h4>Légal</h4>
            <Link to="/mentions-legales">Mentions légales</Link>
            <Link to="/conditions">Conditions d'utilisation</Link>
            <Link to="/confidentialite">Confidentialité</Link>
            <Link to="/cookies">Cookies</Link>
          </nav>
        </div>

        <div className="landing-footer-bottom">
          <span>© {year} CleanVex — Tous droits réservés.</span>
          <span className="landing-footer-version">v{__APP_VERSION__}</span>
        </div>
      </div>
    </footer>
  )
}
