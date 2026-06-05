import { useCallback, useEffect, useState } from 'react'
import { FileLock2, Pencil, Trash2, Upload, UserRound, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { ContactDetail, ContactItem, DocumentItem } from '../types'

type FormEv = { preventDefault(): void; currentTarget: HTMLFormElement }

const KIND_STYLE: Record<string, { color: string; label: string }> = {
  person:   { color: '#67e8f9', label: 'Personne' },
  company:  { color: '#a78bfa', label: 'Organisation' },
  supplier: { color: '#fbbf24', label: 'Fournisseur' },
  garage:   { color: '#4ade80', label: 'Garage' },
  insurer:  { color: '#f9a8d4', label: 'Assureur' },
}

function KindBadge({ kind }: { kind: string }) {
  const s = KIND_STYLE[kind] ?? { color: '#7b82a8', label: kind }
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

export function ContactsPage() {
  const { authedFetch } = useAuth()
  const [contacts, setContacts] = useState<ContactItem[]>([])
  const [selectedContact, setSelectedContact] = useState<ContactDetail | null>(null)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [message, setMessage] = useState('')
  const [editMode, setEditMode] = useState(false)

  const loadContactDetail = useCallback(async (id: string) => {
    const r = await authedFetch(`/contacts/${id}`)
    if (r.ok) setSelectedContact(await r.json())
  }, [authedFetch])

  const reload = useCallback(async () => {
    const [cr, dr] = await Promise.all([authedFetch('/contacts'), authedFetch('/documents')])
    if (cr.ok) setContacts(await cr.json())
    if (dr.ok) setDocuments(await dr.json())
  }, [authedFetch])

  useEffect(() => {
    async function load() {
      const [cr, dr] = await Promise.all([authedFetch('/contacts'), authedFetch('/documents')])
      if (cr.ok) {
        const d = await cr.json(); setContacts(d)
        if (d[0]) loadContactDetail(d[0].id)
      }
      if (dr.ok) setDocuments(await dr.json())
    }
    load()
  }, [authedFetch, loadContactDetail])

  async function handleCreateContact(event: FormEv) {
    event.preventDefault(); setMessage('')
    const form = event.currentTarget
    const data = new FormData(form)
    const r = await authedFetch('/contacts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: data.get('kind') || 'person',
        displayName: data.get('displayName'),
        organization: data.get('organization') || undefined,
        email: data.get('email') || undefined,
        phone: data.get('phone') || undefined,
        city: data.get('city') || undefined,
        notes: data.get('notes') || undefined,
      }),
    })
    if (!r.ok) { setMessage('Creation contact refusee.'); return }
    const created = await r.json()
    form.reset(); setMessage('Contact cree.')
    await reload(); await loadContactDetail(created.id)
  }

  async function handleUpdateContact(event: FormEv) {
    event.preventDefault()
    if (!selectedContact) return
    const form = event.currentTarget
    const data = new FormData(form)
    const r = await authedFetch(`/contacts/${selectedContact.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: data.get('displayName') || undefined,
        kind: data.get('kind') || undefined,
        organization: data.get('organization') || undefined,
        email: data.get('email') || undefined,
        phone: data.get('phone') || undefined,
        city: data.get('city') || undefined,
        notes: data.get('notes') || undefined,
      }),
    })
    if (!r.ok) { setMessage('Mise a jour refusee.'); return }
    setEditMode(false); setMessage('Contact mis a jour.')
    await reload(); await loadContactDetail(selectedContact.id)
  }

  async function handleDeleteContact() {
    if (!selectedContact) return
    if (!window.confirm(`Supprimer "${selectedContact.displayName}" ?`)) return
    const r = await authedFetch(`/contacts/${selectedContact.id}`, { method: 'DELETE' })
    if (!r.ok) { setMessage('Suppression refusee.'); return }
    setSelectedContact(null); setEditMode(false); setMessage('')
    await reload()
  }

  async function handleAddContactInteraction(event: FormEv) {
    event.preventDefault()
    if (!selectedContact) return
    const form = event.currentTarget
    const data = new FormData(form)
    const r = await authedFetch(`/contacts/${selectedContact.id}/interactions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: data.get('type'), title: data.get('title'),
        date: data.get('date'), notes: data.get('notes') || undefined,
      }),
    })
    if (r.ok) { form.reset(); await loadContactDetail(selectedContact.id) }
  }

  async function handleUploadContactDocument(event: FormEv) {
    event.preventDefault()
    if (!selectedContact) return
    const form = event.currentTarget
    const input = form.elements.namedItem('contactFile') as HTMLInputElement
    const file = input.files?.[0]
    if (!file) { setMessage('Choisis un fichier.'); return }
    const body = new FormData(); body.append('file', file)
    const expiresAt = (form.elements.namedItem('contactFileExpiresAt') as HTMLInputElement).value
    if (expiresAt) body.append('expiresAt', expiresAt)
    const context = (form.elements.namedItem('contactFileContext') as HTMLInputElement).value
    const upload = await authedFetch('/documents', { method: 'POST', body })
    if (!upload.ok) { setMessage('Upload refuse.'); return }
    const doc = await upload.json()
    const link = await authedFetch(`/contacts/${selectedContact.id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: doc.id, context: context || 'document' }),
    })
    if (!link.ok) { setMessage('Liaison refusee.'); return }
    form.reset(); setMessage('Document lie.')
    await reload(); await loadContactDetail(selectedContact.id)
  }

  async function handleLinkContactDocument(event: FormEv) {
    event.preventDefault()
    if (!selectedContact) return
    const form = event.currentTarget
    const data = new FormData(form)
    const documentId = data.get('documentId'); if (!documentId) return
    const r = await authedFetch(`/contacts/${selectedContact.id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId, context: data.get('context') || 'document' }),
    })
    if (r.ok) { form.reset(); await loadContactDetail(selectedContact.id) }
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
          <div><span className="panel-kicker">Carnet</span><h2>Contacts</h2></div>
          <span className="badge">{contacts.length} fiches</span>
        </div>

        <form className="compact-form" onSubmit={handleCreateContact}>
          <input name="displayName" placeholder="Nom *" required />
          <select name="kind" defaultValue="person" style={{ background: 'rgba(12,16,41,0.95)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '8px 10px', fontSize: '12px', fontFamily: 'var(--font)' }}>
            <option value="person">Personne</option>
            <option value="company">Organisation</option>
            <option value="supplier">Fournisseur</option>
            <option value="garage">Garage</option>
            <option value="insurer">Assureur</option>
          </select>
          <input name="organization" placeholder="Organisation" />
          <input name="email" type="email" placeholder="Email" />
          <input name="phone" placeholder="Téléphone" />
          <input name="city" placeholder="Ville" />
          <input name="notes" placeholder="Note" />
          <button className="primary-action" type="submit"><UserRound size={18} />Ajouter</button>
        </form>

        {message && <p className="form-message">{message}</p>}

        <div className="vehicle-list">
          {contacts.length === 0 ? (
            <p className="muted" style={{ padding: '0 20px' }}>Aucun contact.</p>
          ) : (
            contacts.map((c) => (
              <button
                className="vehicle-card"
                key={c.id}
                onClick={() => { loadContactDetail(c.id); setEditMode(false) }}
                style={{ borderColor: selectedContact?.id === c.id ? 'rgba(124,58,237,0.5)' : undefined }}
              >
                <div>
                  <strong>{c.displayName}</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text2)' }}>
                    {c.organization ?? c.email ?? c.phone ?? '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <KindBadge kind={c.kind} />
                  {c.city && <span style={{ fontSize: '10px', color: 'var(--text3)' }}>{c.city}</span>}
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
            <h2>{selectedContact?.displayName ?? 'Aucun contact'}</h2>
          </div>
          {selectedContact ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <KindBadge kind={selectedContact.kind} />
              <button className="hdr-btn" title="Modifier" onClick={() => setEditMode(m => !m)}><Pencil size={14} /></button>
              <button className="hdr-btn" title="Supprimer" style={{ color: '#f87171' }} onClick={handleDeleteContact}><Trash2 size={14} /></button>
            </div>
          ) : <UserRound size={20} />}
        </div>

        {!selectedContact && <p className="muted" style={{ padding: '16px 20px' }}>Sélectionne un contact dans la liste.</p>}

        {selectedContact && (
          <div className="vehicle-detail">

            {/* Edit form */}
            {editMode && (
              <form className="compact-form" onSubmit={handleUpdateContact} style={{ background: 'rgba(124,58,237,0.05)', borderRadius: '8px', border: '1px solid rgba(124,58,237,0.2)' }}>
                <input name="displayName" placeholder="Nom" defaultValue={selectedContact.displayName} />
                <select name="kind" defaultValue={selectedContact.kind} style={{ background: 'rgba(12,16,41,0.95)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '8px 10px', fontSize: '12px', fontFamily: 'var(--font)' }}>
                  <option value="person">Personne</option>
                  <option value="company">Organisation</option>
                  <option value="supplier">Fournisseur</option>
                  <option value="garage">Garage</option>
                  <option value="insurer">Assureur</option>
                </select>
                <input name="organization" placeholder="Organisation" defaultValue={selectedContact.organization ?? ''} />
                <input name="email" type="email" placeholder="Email" defaultValue={selectedContact.email ?? ''} />
                <input name="phone" placeholder="Téléphone" defaultValue={selectedContact.phone ?? ''} />
                <input name="city" placeholder="Ville" defaultValue={selectedContact.city ?? ''} />
                <input name="notes" placeholder="Notes" defaultValue={selectedContact.notes ?? ''} />
                <button className="primary-action" type="submit">Sauvegarder</button>
                <button className="btn-ghost" type="button" onClick={() => setEditMode(false)}><X size={14} />Annuler</button>
              </form>
            )}

            {/* Detail grid */}
            {!editMode && (
              <div className="detail-grid">
                <span>Email<strong>{selectedContact.email ?? '—'}</strong></span>
                <span>Téléphone<strong>{selectedContact.phone ?? '—'}</strong></span>
                <span>Organisation<strong>{selectedContact.organization ?? '—'}</strong></span>
                <span>Ville<strong>{selectedContact.city ?? '—'}</strong></span>
                {selectedContact.notes && <span style={{ gridColumn: '1/-1' }}>Note<strong style={{ fontSize: '12px', fontWeight: 400, fontFamily: 'var(--font)', color: 'var(--text2)' }}>{selectedContact.notes}</strong></span>}
              </div>
            )}

            {/* Interactions */}
            <form className="inline-form" onSubmit={handleAddContactInteraction}>
              <input name="title" placeholder="Interaction *" required />
              <select name="type" defaultValue="note" style={{ background: 'rgba(12,16,41,0.95)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '8px 10px', fontSize: '12px', fontFamily: 'var(--font)' }}>
                <option value="note">Note</option>
                <option value="call">Appel</option>
                <option value="email">Email</option>
                <option value="meeting">Réunion</option>
                <option value="quote">Devis</option>
              </select>
              <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              <input name="notes" placeholder="Détails" />
              <button className="primary-action" type="submit">Ajouter</button>
            </form>

            <div className="document-list">
              {selectedContact.interactions.length === 0 ? (
                <p className="muted">Aucune interaction enregistrée.</p>
              ) : (
                selectedContact.interactions.slice(0, 8).map((i) => (
                  <div className="document-row" key={i.id}>
                    <UserRound size={16} />
                    <span style={{ flex: 1 }}>
                      {i.title}
                      <em style={{ display: 'block', fontSize: '10px', color: 'var(--text3)', fontStyle: 'normal' }}>{i.type}</em>
                    </span>
                    <small>{new Date(i.date).toLocaleDateString('fr-FR')}</small>
                  </div>
                ))
              )}
            </div>

            {/* Documents */}
            <section className="linked-documents">
              <div className="panel-header compact-header">
                <div><span className="panel-kicker">Contact</span><h3>Documents liés</h3></div>
                <span className="badge">{selectedContact.documents.length}</span>
              </div>
              <form className="inline-form" onSubmit={handleUploadContactDocument}>
                <input name="contactFile" type="file" />
                <select name="contactFileContext" defaultValue="contrat" style={{ background: 'rgba(12,16,41,0.95)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '8px 10px', fontSize: '12px', fontFamily: 'var(--font)' }}>
                  <option value="contrat">Contrat</option>
                  <option value="devis">Devis</option>
                  <option value="facture">Facture</option>
                  <option value="document">Document</option>
                </select>
                <input name="contactFileExpiresAt" type="date" title="Expiration" />
                <button className="primary-action" type="submit"><Upload size={18} />Upload</button>
              </form>
              <form className="inline-form" onSubmit={handleLinkContactDocument}>
                <select name="documentId" defaultValue="">
                  <option value="" disabled>Document existant</option>
                  {documents.map((d) => <option value={d.id} key={d.id}>{d.name}</option>)}
                </select>
                <input name="context" placeholder="Contexte" defaultValue="document" />
                <button className="primary-action" type="submit">Associer</button>
              </form>
              <div className="document-list">
                {selectedContact.documents.length === 0 ? (
                  <p className="muted">Aucun document lié.</p>
                ) : (
                  selectedContact.documents.map((link) => (
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
