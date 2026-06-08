import { useCallback, useEffect, useState } from 'react'
import { Download, FileLock2, Plus, Upload } from 'lucide-react'
import { ConfirmButton } from '../components/ConfirmButton'
import { FieldTip } from '../components/FieldTip'
import { Modal } from '../components/Modal'
import { useAuth } from '../contexts/AuthContext'
import { SkeletonTabPage } from '../components/Skeleton'
import { useToast } from '../contexts/ToastContext'
import { relativeDate } from '../utils/date'
import type { DocumentItem } from '../types'

type FormEv = { preventDefault(): void; currentTarget: HTMLFormElement }

const MIME_ICON: Record<string, string> = {
  'application/pdf': '📄',
  'image/jpeg': '🖼️',
  'image/png': '🖼️',
  'image/gif': '🖼️',
  'image/webp': '🖼️',
  'video/mp4': '🎬',
  'application/zip': '🗜️',
}

function mimeIcon(mime: string) {
  return MIME_ICON[mime] ?? (mime.startsWith('image/') ? '🖼️' : mime.startsWith('video/') ? '🎬' : '📎')
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 18px', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font)',
      cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
      borderBottom: active ? '2px solid var(--p1)' : '2px solid transparent',
      background: 'none', color: active ? '#c4b5fd' : 'var(--text2)', transition: 'all 0.15s',
    }}>{label}</button>
  )
}

export function DocumentsPage() {
  const { authedFetch } = useAuth()
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const toast = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'bibliotheque' | 'export'>('bibliotheque')
  const [showUpload, setShowUpload] = useState(false)

  const reload = useCallback(async () => {
    const r = await authedFetch('/documents')
    if (r.ok) { const d = await r.json(); setDocuments(d.data ?? d) }
    setIsLoading(false)
  }, [authedFetch])

  useEffect(() => { reload() }, [reload])

  async function handleUpload(event: FormEv) {
    event.preventDefault()
    const form = event.currentTarget
    const input = form.elements.namedItem('file') as HTMLInputElement
    const file = input.files?.[0]
    if (!file) { toast.err('Choisis un fichier.'); return }
    const body = new FormData(); body.append('file', file)
    const expiresAt = (form.elements.namedItem('expiresAt') as HTMLInputElement).value
    if (expiresAt) body.append('expiresAt', expiresAt)
    const r = await authedFetch('/documents', { method: 'POST', body })
    if (!r.ok) { toast.err('Upload refusé ou module désactivé.'); return }
    form.reset(); setShowUpload(false); toast.ok('Document ajouté.'); await reload()
  }

  async function downloadDoc(id: string, name: string) {
    const r = await authedFetch(`/documents/${id}/download`)
    if (!r.ok) return
    const blob = await r.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }

  async function deleteDoc(id: string, _name: string) {
    const r = await authedFetch(`/documents/${id}`, { method: 'DELETE' })
    if (!r.ok) { toast.err('Suppression refusée.'); return }
    toast.ok('Document supprimé.'); await reload()
  }

  async function handleExportZip() {
    const r = await authedFetch('/backups/export.zip')
    if (!r.ok) { toast.err('Export ZIP refusé.'); return }
    const blob = await r.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `export-${new Date().toISOString().slice(0, 10)}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = documents.filter(d =>
    !search || d.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalSize = documents.reduce((acc, d) => acc + d.size, 0)
  const expiredCount = documents.filter(d => d.expiresAt && new Date(d.expiresAt) < new Date()).length
  const expiringSoonCount = documents.filter(d => d.expiresAt && new Date(d.expiresAt) >= new Date() && new Date(d.expiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length

  if (isLoading) return <SkeletonTabPage rows={7} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ─── TABS ─── */}
      <div className="tabs-bar">
        <TabBtn label={`Bibliothèque (${documents.length})`} active={activeTab === 'bibliotheque'} onClick={() => setActiveTab('bibliotheque')} />
        <TabBtn label="Export & Sauvegarde" active={activeTab === 'export'} onClick={() => setActiveTab('export')} />
      </div>

      {/* ══ BIBLIOTHÈQUE ══ */}
      {activeTab === 'bibliotheque' && (
        <article className="panel" style={{ marginTop: '16px' }}>
          <div className="panel-header">
            <div><span className="panel-kicker">Documents</span><h2>Bibliothèque privée</h2></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge">{documents.length} · {fileSize(totalSize)}</span>
              <button className="primary-action" onClick={() => setShowUpload(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <Plus size={14} /> Uploader
              </button>
            </div>
          </div>

          <Modal open={showUpload} onClose={() => setShowUpload(false)} title="Uploader un document" subtitle="Ajoutez un fichier à votre bibliothèque privée" icon={<Upload size={20} />} maxWidth={480}>
            <form onSubmit={handleUpload}>
              <div className="modal-grid">
                <FieldTip label="Fichier" hint="Sélectionnez le fichier à uploader. Formats acceptés : PDF, images, ZIP, vidéos, etc. Le fichier est stocké de façon privée et sécurisée." required style={{ gridColumn: '1/-1' }}>
                  <input name="file" type="file" required className="modal-input" style={{ width: '100%', boxSizing: 'border-box', cursor: 'pointer' }} />
                </FieldTip>
                <FieldTip label="Date d'expiration" hint="Optionnel. Si renseignée, le document sera marqué comme expiré après cette date — pratique pour les documents administratifs à durée de vie limitée (assurance, CT, contrat…)." style={{ gridColumn: '1/-1' }}>
                  <input name="expiresAt" type="date" className="modal-input" style={{ width: '100%', boxSizing: 'border-box' }} />
                </FieldTip>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setShowUpload(false)}>Annuler</button>
                <button type="submit" className="primary-action"><Upload size={14} /> Uploader</button>
              </div>
            </form>
          </Modal>

          <div style={{ padding: '4px 20px 8px' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrer par nom..."
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 12px', color: 'var(--text)', fontSize: '12px', fontFamily: 'var(--font)', outline: 'none' }}
            />
          </div>

          {(expiredCount > 0 || expiringSoonCount > 0) && (
            <div style={{ margin: '0 20px 8px', padding: '8px 12px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', fontSize: '12px', color: '#fbbf24' }}>
              {expiredCount > 0 && <span>⚠ {expiredCount} document{expiredCount > 1 ? 's' : ''} expiré{expiredCount > 1 ? 's' : ''}</span>}
              {expiredCount > 0 && expiringSoonCount > 0 && <span> · </span>}
              {expiringSoonCount > 0 && <span>⏳ {expiringSoonCount} expire bientôt</span>}
            </div>
          )}

          <div className="document-list">
            {filtered.length === 0 ? (
              <p className="muted">{search ? 'Aucun document correspond.' : 'Aucun document privé.'}</p>
            ) : (
              filtered.map((doc) => {
                const isExpired = doc.expiresAt && new Date(doc.expiresAt) < new Date()
                const isExpiringSoon = doc.expiresAt && !isExpired && new Date(doc.expiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                return (
                  <div
                    key={doc.id}
                    className="document-row"
                    style={{ borderLeft: isExpired ? '3px solid #f87171' : isExpiringSoon ? '3px solid #fbbf24' : undefined }}
                  >
                    <span style={{ fontSize: '18px', flexShrink: 0 }}>{mimeIcon(doc.mimeType)}</span>
                    <button
                      style={{ flex: 1, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--font)', fontSize: '12px', fontWeight: 500, padding: 0 }}
                      onClick={() => downloadDoc(doc.id, doc.name)}
                    >
                      {doc.name}
                      <span style={{ display: 'block', fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: '2px' }}>
                        {fileSize(doc.size)} · {relativeDate(doc.createdAt)}
                        {doc.expiresAt && (
                          <span style={{ marginLeft: '8px', color: isExpired ? '#f87171' : isExpiringSoon ? '#fbbf24' : 'var(--text3)' }}>
                            exp. {new Date(doc.expiresAt).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '4px', display: 'flex', borderRadius: '6px' }}
                      onClick={() => downloadDoc(doc.id, doc.name)}
                      title="Télécharger"
                    >
                      <Download size={14} />
                    </button>
                    <ConfirmButton onConfirm={() => deleteDoc(doc.id, doc.name)} />
                  </div>
                )
              })
            )}
          </div>
        </article>
      )}

      {/* ══ EXPORT ══ */}
      {activeTab === 'export' && (
        <article className="panel" style={{ marginTop: '16px' }}>
          <div className="panel-header">
            <div><span className="panel-kicker">Sauvegarde</span><h2>Export ZIP</h2></div>
            <Download size={20} />
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.6 }}>
              Génère une archive ZIP contenant tous tes documents privés avec un manifeste JSON.
              Requiert une authentification valide.
            </p>
            <div className="detail-grid">
              <span>Documents<strong>{documents.length}</strong></span>
              <span>Taille totale<strong>{fileSize(totalSize)}</strong></span>
              <span>Expirés<strong style={{ color: '#f87171' }}>{expiredCount}</strong></span>
              <span>Expire bientôt<strong style={{ color: '#fbbf24' }}>{expiringSoonCount}</strong></span>
            </div>
            <button className="primary-action wide" type="button" onClick={handleExportZip}>
              <Download size={18} />Télécharger ZIP
            </button>
            <p style={{ fontSize: '10px', color: 'var(--text3)', textAlign: 'center', fontFamily: 'var(--mono)' }}>
              <FileLock2 size={10} style={{ display: 'inline', marginRight: '4px' }} />
              Fichiers servis exclusivement via token JWT
            </p>
          </div>
        </article>
      )}
    </div>
  )
}
