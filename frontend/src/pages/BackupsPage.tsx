import { useState } from 'react'
import { Download, HardDrive, ShieldCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export function BackupsPage() {
  const { authedFetch } = useAuth()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleExport() {
    setLoading(true)
    setMessage('')
    try {
      const r = await authedFetch('/backups/export.zip')
      if (!r.ok) { setMessage('Erreur lors de la génération du backup.'); return }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const filename = `personal-platform-export-${new Date().toISOString().slice(0, 10)}.zip`
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      setMessage(`Backup téléchargé : ${filename}`)
    } catch {
      setMessage('Erreur réseau.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="panel-header" style={{ marginBottom: '20px' }}>
        <div>
          <span className="panel-kicker">Export</span>
          <h2>Sauvegarde</h2>
        </div>
        <HardDrive size={20} />
      </div>

      <section className="stability-layout">
        <article className="panel">
          <div className="panel-header">
            <div><span className="panel-kicker">Export complet</span><h2>Archive ZIP</h2></div>
            <ShieldCheck size={18} />
          </div>

          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }}>
              Génère une archive ZIP contenant l'intégralité de tes données : contacts, véhicules,
              finances, stock, immobilier, agenda, documents et fichiers attachés.
            </p>

            <div className="detail-grid">
              <span>Format<strong>ZIP (JSON + fichiers)</strong></span>
              <span>Contenu<strong>Toutes les données</strong></span>
              <span>Fichiers<strong>Inclus dans l'archive</strong></span>
              <span>Fréquence<strong>À la demande</strong></span>
            </div>

            {message && (
              <p style={{
                fontSize: '12px', fontFamily: 'var(--mono)',
                color: message.startsWith('Erreur') ? '#f87171' : '#4ade80',
                padding: '8px 12px',
                background: message.startsWith('Erreur') ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)',
                border: `1px solid ${message.startsWith('Erreur') ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)'}`,
                borderRadius: '8px',
              }}>
                {message}
              </p>
            )}

            <button
              className="primary-action"
              onClick={handleExport}
              disabled={loading}
              style={{ maxWidth: '260px' }}
            >
              <Download size={18} />
              {loading ? 'Génération en cours…' : 'Télécharger la sauvegarde'}
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div><span className="panel-kicker">Informations</span><h2>À savoir</h2></div>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { icon: '🔒', text: 'L\'archive est générée à la volée côté serveur, rien n\'est stocké.' },
              { icon: '📁', text: 'Les fichiers attachés à tes documents sont inclus dans le dossier files/.' },
              { icon: '📋', text: 'Un fichier manifest.json liste toutes les données au format JSON.' },
              { icon: '⚠️', text: 'Conserve tes backups dans un endroit sécurisé et chiffré.' },
              { icon: '🔄', text: 'Lance un backup régulièrement pour ne rien perdre.' },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '14px', lineHeight: 1.5 }}>{icon}</span>
                <p style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>{text}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  )
}
