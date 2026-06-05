import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, FileLock2, Home, Pencil, Trash2, Upload, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { DocumentItem, PropertyDetail, PropertyItem } from '../types'

type FormEv = { preventDefault(): void; currentTarget: HTMLFormElement }

const STATUS_STYLE: Record<string, { color: string; label: string }> = {
  owned:    { color: '#4ade80', label: 'Propriété' },
  rented:   { color: '#67e8f9', label: 'Location' },
  for_sale: { color: '#fbbf24', label: 'En vente' },
  sold:     { color: '#f87171', label: 'Vendu' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { color: '#7b82a8', label: status }
  return (
    <span style={{
      fontSize: '9px', fontFamily: 'var(--mono)', fontWeight: 700,
      padding: '2px 6px', borderRadius: '20px',
      background: `${s.color}20`, color: s.color, border: `1px solid ${s.color}40`,
    }}>
      {s.label}
    </span>
  )
}

export function RealEstatePage() {
  const { authedFetch } = useAuth()
  const [properties, setProperties] = useState<PropertyItem[]>([])
  const [selectedProperty, setSelectedProperty] = useState<PropertyDetail | null>(null)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [message, setMessage] = useState('')
  const [editMode, setEditMode] = useState(false)

  const loadPropertyDetail = useCallback(async (id: string) => {
    const r = await authedFetch(`/real-estate/properties/${id}`)
    if (r.ok) setSelectedProperty(await r.json())
  }, [authedFetch])

  const reload = useCallback(async () => {
    const [pr, dr] = await Promise.all([authedFetch('/real-estate/properties'), authedFetch('/documents')])
    if (pr.ok) setProperties(await pr.json())
    if (dr.ok) setDocuments(await dr.json())
  }, [authedFetch])

  useEffect(() => {
    async function load() {
      const [pr, dr] = await Promise.all([authedFetch('/real-estate/properties'), authedFetch('/documents')])
      if (pr.ok) {
        const d = await pr.json(); setProperties(d)
        if (d[0]) loadPropertyDetail(d[0].id)
      }
      if (dr.ok) setDocuments(await dr.json())
    }
    load()
  }, [authedFetch, loadPropertyDetail])

  async function handleCreateProperty(event: FormEv) {
    event.preventDefault(); setMessage('')
    const form = event.currentTarget
    const data = new FormData(form)
    const r = await authedFetch('/real-estate/properties', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name'), type: data.get('type'), status: data.get('status'),
        address: data.get('address') || undefined,
        city: data.get('city') || undefined,
        postalCode: data.get('postalCode') || undefined,
        surface: data.get('surface') ? Number(data.get('surface')) : undefined,
        rooms: data.get('rooms') ? Number(data.get('rooms')) : undefined,
        purchasePrice: data.get('purchasePrice') ? Number(data.get('purchasePrice')) : undefined,
        estimatedValue: data.get('estimatedValue') ? Number(data.get('estimatedValue')) : undefined,
        notes: data.get('notes') || undefined,
      }),
    })
    if (!r.ok) { setMessage('Creation bien refusee.'); return }
    const created = await r.json()
    form.reset(); setMessage('Bien cree.')
    await reload(); await loadPropertyDetail(created.id)
  }

  async function handleUpdateProperty(event: FormEv) {
    event.preventDefault()
    if (!selectedProperty) return
    const form = event.currentTarget
    const data = new FormData(form)
    const r = await authedFetch(`/real-estate/properties/${selectedProperty.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name') || undefined,
        status: data.get('status') || undefined,
        address: data.get('address') || undefined,
        city: data.get('city') || undefined,
        postalCode: data.get('postalCode') || undefined,
        surface: data.get('surface') ? Number(data.get('surface')) : undefined,
        rooms: data.get('rooms') ? Number(data.get('rooms')) : undefined,
        purchasePrice: data.get('purchasePrice') ? Number(data.get('purchasePrice')) : undefined,
        estimatedValue: data.get('estimatedValue') ? Number(data.get('estimatedValue')) : undefined,
        notes: data.get('notes') || undefined,
      }),
    })
    if (!r.ok) { setMessage('Mise a jour refusee.'); return }
    setEditMode(false); setMessage('Bien mis a jour.')
    await reload(); await loadPropertyDetail(selectedProperty.id)
  }

  async function handleDeleteProperty() {
    if (!selectedProperty) return
    if (!window.confirm(`Supprimer "${selectedProperty.name}" ? Cette action est irréversible.`)) return
    const r = await authedFetch(`/real-estate/properties/${selectedProperty.id}`, { method: 'DELETE' })
    if (!r.ok) { setMessage('Suppression refusee.'); return }
    setSelectedProperty(null); setEditMode(false); setMessage('')
    await reload()
  }

  async function handleAddPropertyEvent(event: FormEv) {
    event.preventDefault()
    if (!selectedProperty) return
    const form = event.currentTarget
    const data = new FormData(form)
    const r = await authedFetch(`/real-estate/properties/${selectedProperty.id}/events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: data.get('type'), title: data.get('title'), date: data.get('date'),
        amount: data.get('amount') ? Number(data.get('amount')) : undefined,
        status: data.get('status') || 'planned',
      }),
    })
    if (r.ok) { form.reset(); await loadPropertyDetail(selectedProperty.id) }
  }

  async function handleUploadPropertyDocument(event: FormEv) {
    event.preventDefault()
    if (!selectedProperty) return
    const form = event.currentTarget
    const input = form.elements.namedItem('propertyFile') as HTMLInputElement
    const file = input.files?.[0]
    if (!file) { setMessage('Choisis un fichier.'); return }
    const body = new FormData(); body.append('file', file)
    const expiresAt = (form.elements.namedItem('propertyFileExpiresAt') as HTMLInputElement).value
    if (expiresAt) body.append('expiresAt', expiresAt)
    const context = (form.elements.namedItem('propertyFileContext') as HTMLInputElement).value
    const upload = await authedFetch('/documents', { method: 'POST', body })
    if (!upload.ok) { setMessage('Upload refuse.'); return }
    const doc = await upload.json()
    const link = await authedFetch(`/real-estate/properties/${selectedProperty.id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: doc.id, context: context || 'document' }),
    })
    if (!link.ok) { setMessage('Liaison refusee.'); return }
    form.reset(); setMessage('Document lie.')
    await reload(); await loadPropertyDetail(selectedProperty.id)
  }

  async function handleLinkPropertyDocument(event: FormEv) {
    event.preventDefault()
    if (!selectedProperty) return
    const form = event.currentTarget
    const data = new FormData(form)
    const documentId = data.get('documentId'); if (!documentId) return
    const r = await authedFetch(`/real-estate/properties/${selectedProperty.id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId, context: data.get('context') || 'document' }),
    })
    if (r.ok) { form.reset(); await loadPropertyDetail(selectedProperty.id) }
  }

  async function downloadDoc(docId: string, name: string) {
    const r = await authedFetch(`/documents/${docId}/download`)
    if (!r.ok) return
    const blob = await r.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="vehicles-layout">
      {/* ─── LISTE ─── */}
      <article className="panel">
        <div className="panel-header">
          <div><span className="panel-kicker">Patrimoine</span><h2>Immobilier</h2></div>
          <span className="badge">{properties.length} biens</span>
        </div>

        <form className="compact-form" onSubmit={handleCreateProperty}>
          <input name="name" placeholder="Nom du bien *" required />
          <select name="type" defaultValue="apartment" style={{ background: 'rgba(12,16,41,0.95)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '8px 10px', fontSize: '12px', fontFamily: 'var(--font)' }}>
            <option value="apartment">Appartement</option>
            <option value="house">Maison</option>
            <option value="land">Terrain</option>
            <option value="parking">Parking</option>
            <option value="commercial">Commercial</option>
            <option value="other">Autre</option>
          </select>
          <select name="status" defaultValue="owned" style={{ background: 'rgba(12,16,41,0.95)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '8px 10px', fontSize: '12px', fontFamily: 'var(--font)' }}>
            <option value="owned">Propriété</option>
            <option value="rented">Location</option>
            <option value="for_sale">En vente</option>
            <option value="sold">Vendu</option>
          </select>
          <input name="address" placeholder="Adresse" />
          <input name="city" placeholder="Ville" />
          <input name="postalCode" placeholder="Code postal" />
          <input name="surface" type="number" step="0.01" placeholder="Surface m²" />
          <input name="rooms" type="number" placeholder="Pièces" />
          <input name="purchasePrice" type="number" step="0.01" placeholder="Prix achat €" />
          <input name="estimatedValue" type="number" step="0.01" placeholder="Valeur estimée €" />
          <button className="primary-action" type="submit"><Home size={18} />Ajouter</button>
        </form>

        {message && <p className="form-message">{message}</p>}

        <div className="vehicle-list">
          {properties.length === 0 ? (
            <p className="muted" style={{ padding: '0 20px' }}>Aucun bien immobilier.</p>
          ) : (
            properties.map((p) => (
              <button
                className="vehicle-card"
                key={p.id}
                onClick={() => { loadPropertyDetail(p.id); setEditMode(false) }}
                style={{ borderColor: selectedProperty?.id === p.id ? 'rgba(124,58,237,0.5)' : undefined }}
              >
                <div>
                  <strong>{p.name}</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text2)' }}>
                    {[p.city, p.postalCode].filter(Boolean).join(' ') || p.type}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <StatusBadge status={p.status} />
                  {p.surface && <span style={{ fontSize: '10px', color: 'var(--text3)' }}>{Number(p.surface).toLocaleString('fr-FR')} m²</span>}
                  {p.estimatedValue && <span style={{ fontSize: '10px', color: '#4ade80' }}>{Number(p.estimatedValue).toLocaleString('fr-FR')} €</span>}
                </div>
              </button>
            ))
          )}
        </div>
      </article>

      {/* ─── FICHE ─── */}
      <article className="panel">
        <div className="panel-header">
          <div>
            <span className="panel-kicker">Fiche</span>
            <h2>{selectedProperty?.name ?? 'Aucun bien'}</h2>
          </div>
          {selectedProperty ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <StatusBadge status={selectedProperty.status} />
              <button className="hdr-btn" title="Modifier" onClick={() => setEditMode(m => !m)}><Pencil size={14} /></button>
              <button className="hdr-btn" title="Supprimer" style={{ color: '#f87171' }} onClick={handleDeleteProperty}><Trash2 size={14} /></button>
            </div>
          ) : <Home size={20} />}
        </div>

        {!selectedProperty && <p className="muted" style={{ padding: '16px 20px' }}>Sélectionne un bien dans la liste.</p>}

        {selectedProperty && (
          <div className="vehicle-detail">

            {/* Edit form */}
            {editMode && (
              <form className="compact-form" onSubmit={handleUpdateProperty} style={{ background: 'rgba(124,58,237,0.05)', borderRadius: '8px', border: '1px solid rgba(124,58,237,0.2)' }}>
                <input name="name" placeholder="Nom" defaultValue={selectedProperty.name} />
                <select name="status" defaultValue={selectedProperty.status} style={{ background: 'rgba(12,16,41,0.95)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '8px 10px', fontSize: '12px', fontFamily: 'var(--font)' }}>
                  <option value="owned">Propriété</option>
                  <option value="rented">Location</option>
                  <option value="for_sale">En vente</option>
                  <option value="sold">Vendu</option>
                </select>
                <input name="address" placeholder="Adresse" defaultValue={selectedProperty.address ?? ''} />
                <input name="city" placeholder="Ville" defaultValue={selectedProperty.city ?? ''} />
                <input name="postalCode" placeholder="Code postal" defaultValue={selectedProperty.postalCode ?? ''} />
                <input name="surface" type="number" step="0.01" placeholder="Surface m²" defaultValue={selectedProperty.surface ?? ''} />
                <input name="rooms" type="number" placeholder="Pièces" defaultValue={selectedProperty.rooms ?? ''} />
                <input name="purchasePrice" type="number" step="0.01" placeholder="Prix achat €" defaultValue={selectedProperty.purchasePrice ?? ''} />
                <input name="estimatedValue" type="number" step="0.01" placeholder="Valeur estimée €" defaultValue={selectedProperty.estimatedValue ?? ''} />
                <button className="primary-action" type="submit">Sauvegarder</button>
                <button className="btn-ghost" type="button" onClick={() => setEditMode(false)}><X size={14} />Annuler</button>
              </form>
            )}

            {/* Detail grid */}
            {!editMode && (
              <div className="detail-grid">
                <span>Surface<strong>{selectedProperty.surface ? `${Number(selectedProperty.surface).toLocaleString('fr-FR')} m²` : '—'}</strong></span>
                <span>Pièces<strong>{selectedProperty.rooms ?? '—'}</strong></span>
                <span>Valeur estimée<strong style={{ color: '#4ade80' }}>{selectedProperty.estimatedValue ? `${Number(selectedProperty.estimatedValue).toLocaleString('fr-FR')} €` : '—'}</strong></span>
                <span>Prix achat<strong>{selectedProperty.purchasePrice ? `${Number(selectedProperty.purchasePrice).toLocaleString('fr-FR')} €` : '—'}</strong></span>
                <span>Ville<strong>{selectedProperty.city ?? '—'}</strong></span>
                <span>Type<strong>{selectedProperty.type}</strong></span>
                {selectedProperty.address && <span style={{ gridColumn: '1/-1' }}>Adresse<strong style={{ fontWeight: 400, fontSize: '12px', color: 'var(--text2)', fontFamily: 'var(--font)' }}>{selectedProperty.address}</strong></span>}
              </div>
            )}

            {/* Événements */}
            <form className="inline-form" onSubmit={handleAddPropertyEvent}>
              <input name="title" placeholder="Événement *" required />
              <select name="type" defaultValue="maintenance" style={{ background: 'rgba(12,16,41,0.95)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '8px 10px', fontSize: '12px', fontFamily: 'var(--font)' }}>
                <option value="maintenance">Maintenance</option>
                <option value="renovation">Rénovation</option>
                <option value="tax">Taxe/Charge</option>
                <option value="insurance">Assurance</option>
                <option value="rent">Loyer</option>
                <option value="other">Autre</option>
              </select>
              <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              <input name="amount" type="number" step="0.01" placeholder="Montant €" />
              <select name="status" defaultValue="planned" style={{ background: 'rgba(12,16,41,0.95)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '8px 10px', fontSize: '12px', fontFamily: 'var(--font)' }}>
                <option value="planned">Planifié</option>
                <option value="done">Fait</option>
              </select>
              <button className="primary-action" type="submit">Ajouter</button>
            </form>

            <div className="document-list">
              {selectedProperty.events.length === 0 ? (
                <p className="muted">Aucun événement enregistré.</p>
              ) : (
                selectedProperty.events.slice(0, 8).map((ev) => (
                  <div className="document-row" key={ev.id}>
                    <CalendarDays size={16} style={{ color: ev.status === 'done' ? '#4ade80' : '#fbbf24' }} />
                    <span style={{ flex: 1 }}>
                      {ev.title}
                      <em style={{ display: 'block', fontSize: '10px', color: 'var(--text3)', fontStyle: 'normal' }}>{ev.type}</em>
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      {ev.amount && <div style={{ fontSize: '11px', color: '#f87171', fontFamily: 'var(--mono)' }}>{Number(ev.amount).toLocaleString('fr-FR')} €</div>}
                      <small>{new Date(ev.date).toLocaleDateString('fr-FR')}</small>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Documents */}
            <section className="linked-documents">
              <div className="panel-header compact-header">
                <div><span className="panel-kicker">Immobilier</span><h3>Documents liés</h3></div>
                <span className="badge">{selectedProperty.documents.length}</span>
              </div>
              <form className="inline-form" onSubmit={handleUploadPropertyDocument}>
                <input name="propertyFile" type="file" />
                <select name="propertyFileContext" defaultValue="diagnostic" style={{ background: 'rgba(12,16,41,0.95)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '8px 10px', fontSize: '12px', fontFamily: 'var(--font)' }}>
                  <option value="diagnostic">Diagnostic</option>
                  <option value="acte">Acte notarié</option>
                  <option value="plan">Plan</option>
                  <option value="assurance">Assurance</option>
                  <option value="taxe">Taxe foncière</option>
                  <option value="document">Document</option>
                </select>
                <input name="propertyFileExpiresAt" type="date" title="Expiration" />
                <button className="primary-action" type="submit"><Upload size={18} />Upload</button>
              </form>
              <form className="inline-form" onSubmit={handleLinkPropertyDocument}>
                <select name="documentId" defaultValue="">
                  <option value="" disabled>Document existant</option>
                  {documents.map((d) => <option value={d.id} key={d.id}>{d.name}</option>)}
                </select>
                <input name="context" placeholder="Contexte" defaultValue="document" />
                <button className="primary-action" type="submit">Associer</button>
              </form>
              <div className="document-list">
                {selectedProperty.documents.length === 0 ? (
                  <p className="muted">Aucun document lié.</p>
                ) : (
                  selectedProperty.documents.map((link) => (
                    <button className="document-row" key={link.id} onClick={() => downloadDoc(link.document.id, link.document.name)}>
                      <FileLock2 size={18} />
                      <span>{link.document.name}</span>
                      <small>{link.context ?? 'document'}</small>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </article>
    </section>
  )
}
