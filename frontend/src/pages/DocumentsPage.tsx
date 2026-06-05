import { useCallback, useEffect, useState } from 'react'
import { Download, FileLock2, Trash2, Upload } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
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

export function DocumentsPage() {
  const { authedFetch } = useAuth()
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')

  const reload = useCallback(async () => {
    const r = await authedFetch('/documents')
    if (r.ok) setDocuments(await r.json())
  }, [authedFetch])

  useEffect(() => { reload() }, [reload])

  async function handleUpload(event: FormEv) {
    event.preventDefault(); setMessage('')
    const form = event.currentTarget
    const input = form.elements.namedItem('file') as HTMLInputElement
    const file = input.files?.[0]
    if (!file) { setMessage('Choisis un fichier.'); return }
    const body = new FormData(); body.append('file', file)
    const expiresAt = (form.elements.namedItem('expiresAt') as HTMLInputElement).value
    if (expiresAt) body.append('expiresAt', expiresAt)
    const r = await authedFetch('/documents', { method: 'POST', body })
    if (!r.ok) { setMessage('Upload refuse ou module Documents desactive.'); return }
    form.reset(); setMessage('Document ajoute.'); await reload()
  }

  async function downloadDoc(id: string, name: string) {
    const r = await authedFetch(`/documents/${id}/download`)
    if (!r.ok) return
    const blob = await r.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }

  async function deleteDoc(id: string, name: string) {
    if (!window.confirm(`Supprimer "${name}" ? Les liens vers ce document seront aussi supprimés.`)) return
    const r = await authedFetch(`/documents/${id}`, { method: 'DELETE' })
    if (!r.ok) { setMessage('Suppression refusee.'); return }
    setMessage('Document supprime.'); await reload()
  }

  async function handleExportZip() {
    const r = await authedFetch('/backups/export.zip')
    if (!r.ok) { setMessage('Export ZIP refuse.'); return }
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

  return (
    <section className="stability-layout">
      {/* ─── BIBLIOTHÈQUE ─── */}
      <article className="panel">
        <div className="panel-header">
          <div><span className="panel-kicker">Documents</span><h2>Bibliothèque privée</h2></div>
          <span className="badge">{documents.length} · {fileSize(totalSize)}</span>
        </div>

        {message && <p className="form-message">{message}</p>}

        <form className="upload-form" onSubmit={handleUpload}>
          <input name="file" type="file" />
          <input name="expiresAt" type="date" title="Date d'expiration" />
          <button className="primary-action" type="submit"><Upload size={18} />Upload</button>
        </form>

        <div style={{ padding: '4px 20px 8px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filtrer par nom..."
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 12px', color: 'var(--text)', fontSize: '12px', fontFamily: 'var(--font)', outline: 'none' }}
          />
        </div>

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
                      {fileSize(doc.size)}
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
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '4px', display: 'flex', borderRadius: '6px' }}
                    onClick={() => deleteDoc(doc.id, doc.name)}
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </article>

      {/* ─── EXPORT ─── */}
      <article className="panel">
        <div className="panel-header">
          <div><span className="panel-kicker">Sauvegarde</span><h2>Export ZIP</h2></div>
          <Download size={20} />
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.6 }}>
            Génère un archive ZIP protégé contenant tous tes documents privés avec un manifeste JSON.
            Requiert une authentification valide.
          </p>
          <div className="detail-grid">
            <span>Documents<strong>{documents.length}</strong></span>
            <span>Taille totale<strong>{fileSize(totalSize)}</strong></span>
            <span>Expirés<strong style={{ color: '#f87171' }}>{documents.filter(d => d.expiresAt && new Date(d.expiresAt) < new Date()).length}</strong></span>
            <span>Expire bientôt<strong style={{ color: '#fbbf24' }}>{documents.filter(d => d.expiresAt && new Date(d.expiresAt) >= new Date() && new Date(d.expiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length}</strong></span>
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
    </section>
  )
}
