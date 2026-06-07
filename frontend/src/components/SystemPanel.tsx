import { useCallback, useEffect, useState } from 'react'
import { GitCommit, RefreshCw, ShieldAlert, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { UpdateOverlay, type UpdateJob } from './UpdateOverlay'

type VersionStatus = {
  installed: string | null
  remote: string | null
  upToDate: boolean
  behindBy: number
  commits: { sha: string; message: string; date: string }[]
  warning?: string
}

export function SystemPanel() {
  const { authedFetch } = useAuth()
  const [version, setVersion] = useState<VersionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [job, setJob] = useState<UpdateJob | null>(null)
  const [confirmUpdate, setConfirmUpdate] = useState(false)

  const loadVersion = useCallback(async () => {
    const r = await authedFetch('/admin/system/version')
    if (r.ok) setVersion(await r.json())
    setLoading(false)
  }, [authedFetch])

  const loadCurrentJob = useCallback(async () => {
    const r = await authedFetch('/admin/system/update/current')
    if (r.ok) {
      const data = await r.json()
      if (data) setJob(data)
    }
  }, [authedFetch])

  useEffect(() => {
    loadVersion()
    loadCurrentJob()
  }, [loadVersion, loadCurrentJob])

  const isActive = job?.status === 'pending' || job?.status === 'running'

  // Polling déplacé dans UpdateOverlay (gère aussi backend-down pendant le restart).
  // On garde un fetch helper qu'on lui passe.
  const fetchJobNow = useCallback(async (): Promise<UpdateJob | null> => {
    if (!job) return null
    try {
      const r = await authedFetch(`/admin/system/update/${job.id}`)
      if (!r.ok) return null
      return (await r.json()) as UpdateJob
    } catch {
      return null
    }
  }, [authedFetch, job])

  // Synchronise le job du panneau avec celui en cours (utile à la fermeture overlay)
  useEffect(() => {
    if (!isActive) return
    // ping unique au mount, l'overlay prend le relais ensuite
    const id = setTimeout(async () => {
      const updated = await fetchJobNow()
      if (updated) setJob(updated)
    }, 500)
    return () => clearTimeout(id)
  }, [isActive, fetchJobNow])

  useEffect(() => {
    if (job && (job.status === 'success' || job.status === 'error')) {
      loadVersion()
    }
  }, [job, loadVersion])

  async function handleCheck() {
    setChecking(true)
    try {
      const r = await authedFetch('/admin/system/check', { method: 'POST' })
      if (r.ok) setVersion(await r.json())
    } finally {
      setChecking(false)
    }
  }

  async function handleUpdate() {
    const r = await authedFetch('/admin/system/update', { method: 'POST' })
    if (r.ok) {
      const data = await r.json()
      setJob({ ...data, logs: [], exitCode: null, finishedAt: null, startedBy: '' })
    }
    setConfirmUpdate(false)
  }

  if (loading) return <div style={{ padding: 16, color: 'var(--text3)' }}>Chargement…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Overlay plein écran pendant la MAJ */}
      {isActive && job && (
        <UpdateOverlay
          job={job}
          fetchJob={fetchJobNow}
          onClose={async () => {
            const updated = await fetchJobNow()
            if (updated) setJob(updated)
            await loadVersion()
          }}
        />
      )}

      {/* État version */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {version?.upToDate ? <CheckCircle2 size={18} style={{ color: '#4ade80' }} /> : <ShieldAlert size={18} style={{ color: '#f59e0b' }} />}
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {version?.upToDate ? "À jour" : `${version?.behindBy} commit${(version?.behindBy ?? 0) > 1 ? 's' : ''} en retard`}
          </span>
          <button
            onClick={handleCheck}
            disabled={checking || isActive}
            style={{
              marginLeft: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '6px 12px', fontSize: 12, fontFamily: 'var(--font)',
              color: 'var(--text2)', cursor: checking ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <RefreshCw size={12} style={{ animation: checking ? 'spin 0.6s linear infinite' : undefined }} />
            Vérifier
          </button>
        </div>

        <div style={{ display: 'flex', gap: 24, fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
          <div>Installé : <span style={{ color: 'var(--text)' }}>{version?.installed ?? '—'}</span></div>
          <div>Distant : <span style={{ color: 'var(--text)' }}>{version?.remote ?? '—'}</span></div>
        </div>

        {version?.warning && (
          <p style={{ fontSize: 12, color: '#f59e0b', margin: 0 }}>⚠ {version.warning}</p>
        )}

        {!version?.upToDate && version?.commits && version.commits.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: '0.08em', marginBottom: 4 }}>COMMITS EN ATTENTE</div>
            {version.commits.slice(0, 10).map(c => (
              <div key={c.sha} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
                <GitCommit size={12} style={{ color: 'var(--text3)', marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--text3)', flexShrink: 0 }}>{c.sha}</span>
                <span style={{ color: 'var(--text2)', flex: 1 }}>{c.message}</span>
              </div>
            ))}
          </div>
        )}

        {!version?.upToDate && !isActive && (
          <button
            onClick={() => setConfirmUpdate(true)}
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #2563eb)', border: 'none',
              borderRadius: 10, padding: '10px 18px', color: 'white', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
            }}
          >
            Mettre à jour maintenant
          </button>
        )}

        {confirmUpdate && (
          <div style={{ background: 'rgba(244,63,94,0.05)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 10, padding: 12, fontSize: 12 }}>
            <p style={{ margin: '0 0 10px', color: 'var(--text)' }}>
              ⚠ La mise à jour va arrêter le serveur quelques secondes. Continuer ?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleUpdate} style={{ background: '#f43f5e', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Confirmer
              </button>
              <button onClick={() => setConfirmUpdate(false)} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Job en cours / dernier job */}
      {job && (
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {job.status === 'success' && <CheckCircle2 size={16} style={{ color: '#4ade80' }} />}
            {job.status === 'error' && <AlertCircle size={16} style={{ color: '#f87171' }} />}
            {(job.status === 'pending' || job.status === 'running') && <Loader2 size={16} style={{ color: '#a78bfa', animation: 'spin 0.8s linear infinite' }} />}
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{job.status}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
              {new Date(job.startedAt).toLocaleString()}
            </span>
          </div>

          <pre style={{
            margin: 0, background: '#060818', border: '1px solid var(--border)', borderRadius: 8,
            padding: 12, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text2)',
            maxHeight: 260, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {job.logs.length === 0 ? 'En attente de logs…' : job.logs.join('\n')}
          </pre>
        </div>
      )}
    </div>
  )
}
