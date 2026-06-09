import { useEffect, useRef, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { API_URL, useAuth } from '../contexts/AuthContext'

type MaintenanceState = { active: boolean; since: string | null } | null

const POLL_INTERVAL_MS = 10_000     // poll réseau quand l'app est tranquille
const POLL_BUSY_INTERVAL_MS = 4_000 // accéléré quand on sait qu'une MAJ tourne

/**
 * Overlay plein écran affiché aux utilisateurs NON admin pendant qu'une
 * mise à jour est en cours côté serveur. Empêche les actions qui seraient
 * corrompues par le restart du backend pendant la transaction.
 *
 * - Polling 10s (4s en mode "MAJ en cours") sur GET /system/maintenance,
 *   endpoint public sans auth pour fonctionner même si l'access token
 *   expire pendant la fenêtre de maintenance.
 * - Les admins ne voient PAS cet overlay : ils ont déjà UpdateOverlay qui
 *   leur montre les détails du job.
 * - Quand maintenance.active repasse à false après être passé true →
 *   window.location.reload() pour récupérer le nouveau bundle frontend.
 */
export function MaintenanceOverlay() {
  const { user } = useAuth()
  const [state, setState] = useState<MaintenanceState>(null)
  const wasActiveRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    let timer: number | null = null

    const tick = async () => {
      try {
        const r = await fetch(`${API_URL}/system/maintenance`, { cache: 'no-store' })
        if (!r.ok) {
          // Backend down pendant la MAJ : on considère qu'on est en maintenance.
          if (!cancelled) setState({ active: true, since: null })
        } else {
          const data = (await r.json()) as { active: boolean; since: string | null }
          if (cancelled) return
          setState(data)

          // Détection du passage actif → inactif : la MAJ vient de se terminer,
          // on recharge la page pour basculer sur le nouveau code/bundle.
          if (wasActiveRef.current && !data.active) {
            window.location.reload()
            return
          }
          wasActiveRef.current = data.active
        }
      } catch {
        if (!cancelled) setState({ active: true, since: null })
      }
      // Reprogramme le prochain tick selon le mode actif/inactif
      if (cancelled) return
      const delay = state?.active ? POLL_BUSY_INTERVAL_MS : POLL_INTERVAL_MS
      timer = window.setTimeout(tick, delay)
    }

    tick()
    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
    }
    // state?.active intentionnellement omis : on lit la valeur fraîche
    // dans le tick via la closure du setTimeout, pas besoin de relancer
    // tout l'effet à chaque changement (sinon polling double).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Les admins voient déjà l'UpdateOverlay détaillé, on ne les enquiquine pas.
  if (!state?.active) return null
  if (user?.role === 'admin') return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="maintenance-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(6, 8, 24, 0.92)',
        backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, textAlign: 'center',
      }}
    >
      {/* Décor radial pour rester cohérent avec le reste de l'app */}
      <div aria-hidden style={{
        position: 'fixed', top: '-200px', left: '-150px',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.18), transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div aria-hidden style={{
        position: 'fixed', bottom: '-200px', right: '-100px',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(6,182,212,0.12), transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative', maxWidth: 460,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(37,99,235,0.25))',
          border: '1px solid rgba(167,139,250,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#c4b5fd',
          boxShadow: '0 12px 40px rgba(124,58,237,0.35)',
        }}>
          <Loader2 size={32} style={{ animation: 'spin 1.4s linear infinite' }} />
        </div>

        <div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: '#a78bfa',
            letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6,
          }}>
            Maintenance
          </div>
          <h1 id="maintenance-title" style={{
            margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.4px',
            color: 'var(--text)',
          }}>
            Mise à jour en cours
          </h1>
        </div>

        <p style={{
          margin: 0, color: 'var(--text2)', fontSize: 14, lineHeight: 1.6,
          maxWidth: 380,
        }}>
          Nous appliquons une mise à jour de CleanVex. L'application sera de retour
          dans quelques instants.
        </p>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 999,
          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
          fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)',
        }}>
          <Sparkles size={12} style={{ color: '#a78bfa' }} />
          Rechargement automatique dès qu'on revient
        </div>
      </div>
    </div>
  )
}
