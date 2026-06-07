import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, CheckCircle2, Circle, Loader2, RotateCw, Sparkles, Terminal,
} from 'lucide-react'
import { API_URL } from '../contexts/AuthContext'

export type UpdateJob = {
  id: string
  status: 'pending' | 'running' | 'success' | 'error'
  startedAt: string
  finishedAt: string | null
  exitCode: number | null
  logs: string[]
  startedBy: string
}

type Props = {
  job: UpdateJob
  /** Récupère le job à jour. Doit renvoyer null si backend down. */
  fetchJob: () => Promise<UpdateJob | null>
  onClose: () => void
}

/* Étapes attendues du script update.sh — détectées via marqueurs dans les logs */
const STEPS: { id: string; label: string; match: RegExp }[] = [
  { id: 'backup',    label: 'Sauvegarde base de données', match: /Backup DB/i },
  { id: 'git',       label: 'Récupération du code (GitHub)', match: /Git fetch/i },
  { id: 'be-deps',   label: 'Backend : dépendances',       match: /Backend\s*:\s*install/i },
  { id: 'be-prisma', label: 'Backend : Prisma',            match: /prisma generate/i },
  { id: 'be-migr',   label: 'Backend : migrations',        match: /prisma migrate/i },
  { id: 'be-build',  label: 'Backend : compilation',       match: /Backend\s*:\s*build/i },
  { id: 'fe-deps',   label: 'Frontend : dépendances',      match: /Frontend\s*:\s*install/i },
  { id: 'fe-build',  label: 'Frontend : compilation',      match: /Frontend\s*:\s*build/i },
  { id: 'restart',   label: 'Redémarrage de l\'application', match: /Restart application/i },
]

function detectStepIndex(logs: string[]): number {
  let idx = -1
  for (let i = STEPS.length - 1; i >= 0; i--) {
    if (logs.some(l => STEPS[i].match.test(l))) { idx = i; break }
  }
  return idx
}

export function UpdateOverlay({ job: initialJob, fetchJob, onClose }: Props) {
  const [job, setJob] = useState<UpdateJob>(initialJob)
  const [backendDown, setBackendDown] = useState(false)
  const [reloadIn, setReloadIn] = useState<number | null>(null)
  const logRef = useRef<HTMLPreElement>(null)
  const pollRef = useRef<number | null>(null)

  /* Polling robuste : si backend down (restart en cours), on continue à essayer */
  useEffect(() => {
    if (job.status === 'success' || job.status === 'error') return

    let cancelled = false

    const tick = async () => {
      try {
        const updated = await fetchJob()
        if (cancelled) return
        if (updated) {
          setJob(updated)
          setBackendDown(false)
        } else {
          setBackendDown(true)
        }
      } catch {
        if (!cancelled) setBackendDown(true)
      }
    }

    tick()
    pollRef.current = window.setInterval(tick, 1500)
    return () => {
      cancelled = true
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [job.status, fetchJob])

  /* Quand le job est fini ET le backend répond à nouveau → countdown auto-reload */
  useEffect(() => {
    if (job.status !== 'success') return
    if (reloadIn !== null) return

    // Attendre que le backend réponde sur /api/health, puis lancer un compte à rebours
    let cancelled = false
    const waitBackend = async () => {
      for (let i = 0; i < 90; i++) { // jusqu'à 90s max
        try {
          const r = await fetch(`${API_URL}/health`, { cache: 'no-store' })
          if (r.ok) break
        } catch { /* backend encore down */ }
        await new Promise(res => setTimeout(res, 1000))
        if (cancelled) return
      }
      if (cancelled) return
      setBackendDown(false)
      setReloadIn(5)
    }
    waitBackend()
    return () => { cancelled = true }
  }, [job.status, reloadIn])

  /* Décrémentation du compte à rebours */
  useEffect(() => {
    if (reloadIn === null) return
    if (reloadIn <= 0) { window.location.reload(); return }
    const id = window.setTimeout(() => setReloadIn(reloadIn - 1), 1000)
    return () => window.clearTimeout(id)
  }, [reloadIn])

  /* Auto-scroll des logs */
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [job.logs])

  const currentStep = useMemo(() => detectStepIndex(job.logs), [job.logs])
  const isFinished = job.status === 'success' || job.status === 'error'
  const isError = job.status === 'error'
  const isSuccess = job.status === 'success'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-overlay-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(6,8,24,0.85)', backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)', borderRadius: 18,
        width: '100%', maxWidth: 780, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isError ? 'rgba(244,63,94,0.15)'
              : isSuccess ? 'rgba(74,222,128,0.15)'
              : 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(37,99,235,0.25))',
            color: isError ? '#f87171' : isSuccess ? '#4ade80' : '#c4b5fd',
          }}>
            {isError ? <AlertCircle size={22} />
              : isSuccess ? <Sparkles size={22} />
              : <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />}
          </div>
          <div style={{ flex: 1 }}>
            <h2 id="update-overlay-title" style={{
              margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px',
            }}>
              {isError ? 'Échec de la mise à jour'
                : isSuccess ? 'Mise à jour réussie'
                : 'Mise à jour en cours…'}
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text3)' }}>
              {isError ? `Code de sortie : ${job.exitCode}. Consulte les logs ci-dessous.`
                : isSuccess
                  ? (reloadIn !== null
                      ? `La page va se recharger dans ${reloadIn}s pour appliquer la nouvelle version.`
                      : 'Vérification du backend…')
                  : backendDown
                    ? 'Backend en cours de redémarrage… polling automatique.'
                    : 'Ne ferme pas cette page tant que ce n\'est pas terminé.'}
            </p>
          </div>
          {isFinished && (
            <button onClick={isSuccess ? () => window.location.reload() : onClose}
              style={{
                background: isSuccess
                  ? 'linear-gradient(135deg, #7c3aed, #2563eb)'
                  : 'rgba(255,255,255,0.05)',
                color: isSuccess ? 'white' : 'var(--text2)',
                border: `1px solid ${isSuccess ? 'transparent' : 'var(--border)'}`,
                borderRadius: 10, padding: '8px 14px',
                fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}>
              {isSuccess ? <><RotateCw size={13} /> Recharger maintenant</> : 'Fermer'}
            </button>
          )}
        </div>

        {/* Steps */}
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {STEPS.map((s, i) => {
            const isCurrent = i === currentStep && !isFinished
            const isDone = i < currentStep || (i === currentStep && isSuccess)
            const failed = isError && i === currentStep
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
                color: isCurrent ? 'var(--text)' : isDone ? '#4ade80'
                  : failed ? '#f87171' : 'var(--text3)',
                fontWeight: isCurrent ? 600 : 400,
              }}>
                {isDone ? <CheckCircle2 size={14} />
                  : failed ? <AlertCircle size={14} />
                  : isCurrent ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: '#a78bfa' }} />
                  : <Circle size={14} />}
                {s.label}
              </div>
            )
          })}
        </div>

        {/* Logs */}
        <div style={{ flex: 1, minHeight: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            padding: '10px 24px', fontSize: 10.5, fontFamily: 'var(--mono)',
            color: 'var(--text3)', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6,
            borderBottom: '1px solid var(--border)',
          }}>
            <Terminal size={11} /> LOGS LIVE
          </div>
          <pre ref={logRef} style={{
            margin: 0, padding: '12px 24px',
            background: '#060818', color: 'var(--text2)',
            fontSize: 11, fontFamily: 'var(--mono)', lineHeight: 1.55,
            flex: 1, overflowY: 'auto',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {job.logs.length === 0
              ? 'En attente du démarrage du script…\n'
              : job.logs.join('\n')}
            {backendDown && !isFinished && (
              <span style={{ color: '#f59e0b' }}>
                {'\n⏳ Connexion au backend perdue (restart en cours), je continue à essayer…\n'}
              </span>
            )}
          </pre>
        </div>
      </div>
    </div>
  )
}
