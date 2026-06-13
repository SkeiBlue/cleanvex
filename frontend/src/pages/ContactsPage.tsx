import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft, FileLock2, FileText, MessageSquare, Pencil, Plus,
  Upload, UserRound,
} from 'lucide-react'
import { ConfirmButton } from '../components/ConfirmButton'
import { FieldTip } from '../components/FieldTip'
import { Modal } from '../components/Modal'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import type { ContactDetail, ContactItem, DocumentItem } from '../types'

type FormEv = { preventDefault(): void; currentTarget: HTMLFormElement }
type Tab = 'infos' | 'interactions' | 'documents'

const KIND_STYLE: Record<string, { color: string; label: string }> = {
  person:   { color: '#67e8f9', label: 'Personne' },
  company:  { color: '#a78bfa', label: 'Organisation' },
  supplier: { color: '#fbbf24', label: 'Fournisseur' },
  garage:   { color: '#4ade80', label: 'Garage' },
  insurer:  { color: '#f9a8d4', label: 'Assureur' },
}

const INTERACT_ICONS: Record<string, string> = {
  call: '📞', email: '✉️', meeting: '🤝', quote: '📋', note: '📝',
}

const SELECT_STYLE: React.CSSProperties = {
  background: 'var(--bg2)', border: '1px solid var(--border)',
  borderRadius: '8px', color: 'var(--text)', padding: '8px 10px',
  fontSize: '12px', fontFamily: 'var(--font)',
}

function KindBadge({ kind }: { kind: string }) {
  const s = KIND_STYLE[kind] ?? { color: '#7b82a8', label: kind }
  return (
    <span style={{ fontSize: '9px', fontFamily: 'var(--mono)', fontWeight: 700, padding: '3px 8px', borderRadius: '20px', background: `${s.color}20`, color: s.color, border: `1px solid ${s.color}40` }}>
      {s.label}
    </span>
  )
}

function Avatar({ name, kind }: { name: string; kind: string }) {
  const s = KIND_STYLE[kind] ?? { color: '#7b82a8' }
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `${s.color}20`, border: `2px solid ${s.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: s.color, flexShrink: 0, fontFamily: 'var(--mono)' }}>
      {initials || '?'}
    </div>
  )
}

const NAV: { tab: Tab; icon: React.ReactNode; label: string }[] = [
  { tab: 'infos',        icon: <UserRound size={16} />,     label: 'Infos' },
  { tab: 'interactions', icon: <MessageSquare size={16} />, label: 'Interactions' },
  { tab: 'documents',    icon: <FileText size={16} />,      label: 'Documents' },
]

export function ContactsPage() {
  const { authedFetch } = useAuth()
  const toast = useToast()
  const [contacts, setContacts] = useState<ContactItem[]>([])
  const [selected, setSelected] = useState<ContactDetail | null>(null)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [activeTab, setActiveTab] = useState<Tab>('infos')
  const [editMode, setEditMode] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState('all')

  const loadDetail = useCallback(async (id: string) => {
    const r = await authedFetch(`/contacts/${id}`)
    if (r.ok) setSelected(await r.json())
  }, [authedFetch])

  const reload = useCallback(async () => {
    const [cr, dr] = await Promise.all([authedFetch('/contacts'), authedFetch('/documents')])
    if (cr.ok) setContacts(await cr.json())
    if (dr.ok) { const d = await dr.json(); setDocuments(d.data ?? d) }
  }, [authedFetch])

  useEffect(() => {
    async function load() {
      const [cr, dr] = await Promise.all([authedFetch('/contacts'), authedFetch('/documents')])
      if (cr.ok) setContacts(await cr.json())
      if (dr.ok) { const d = await dr.json(); setDocuments(d.data ?? d) }
    }
    load()
  }, [authedFetch])

  /* ── handlers ── */
  async function handleCreate(event: FormEv) {
    event.preventDefault()
    const form = event.currentTarget; const data = new FormData(form)
    const r = await authedFetch('/contacts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: data.get('kind') || 'person', displayName: data.get('displayName'),
        organization: data.get('organization') || undefined,
        email: data.get('email') || undefined, phone: data.get('phone') || undefined,
        city: data.get('city') || undefined, notes: data.get('notes') || undefined,
      }),
    })
    if (!r.ok) { toast.err('Création refusée.'); return }
    const created = await r.json()
    form.reset(); setShowCreate(false); toast.ok('Contact créé.')
    await reload(); await loadDetail(created.id)
    setView('detail'); setActiveTab('infos'); setEditMode(false)
  }

  const [showAddInteraction, setShowAddInteraction] = useState(false)
  const [showUploadDoc, setShowUploadDoc] = useState(false)

  async function handleUpdate(event: FormEv) {
    event.preventDefault(); if (!selected) return
    const form = event.currentTarget; const data = new FormData(form)
    const r = await authedFetch(`/contacts/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: data.get('displayName') || undefined, kind: data.get('kind') || undefined,
        organization: data.get('organization') || undefined,
        email: data.get('email') || undefined, phone: data.get('phone') || undefined,
        city: data.get('city') || undefined, notes: data.get('notes') || undefined,
      }),
    })
    if (!r.ok) { toast.err('Mise à jour refusée.'); return }
    setEditMode(false); toast.ok('Contact mis à jour.')
    await reload(); await loadDetail(selected.id)
  }

  async function handleDelete() {
    if (!selected) return
    const r = await authedFetch(`/contacts/${selected.id}`, { method: 'DELETE' })
    if (!r.ok) { toast.err('Suppression refusée.'); return }
    setSelected(null); setView('list'); await reload()
  }

  async function handleAddInteraction(event: FormEv) {
    event.preventDefault(); if (!selected) return
    const form = event.currentTarget; const data = new FormData(form)
    const r = await authedFetch(`/contacts/${selected.id}/interactions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: data.get('type'), title: data.get('title'), date: data.get('date'), notes: data.get('notes') || undefined }),
    })
    if (r.ok) { form.reset(); setShowAddInteraction(false); toast.ok('Interaction ajoutée.'); await loadDetail(selected.id) }
  }

  async function handleDeleteInteraction(id: string) {
    if (!selected) return
    const r = await authedFetch(`/contacts/${selected.id}/interactions/${id}`, { method: 'DELETE' })
    if (!r.ok) { toast.err('Suppression refusée.'); return }
    await loadDetail(selected.id)
  }

  async function handleUploadDoc(event: FormEv) {
    event.preventDefault(); if (!selected) return
    const form = event.currentTarget
    const input = form.elements.namedItem('contactFile') as HTMLInputElement
    const file = input.files?.[0]; if (!file) { toast.err('Choisis un fichier.'); return }
    const body = new FormData(); body.append('file', file)
    const expiresAt = (form.elements.namedItem('contactFileExpiresAt') as HTMLInputElement).value
    if (expiresAt) body.append('expiresAt', expiresAt)
    const context = (form.elements.namedItem('contactFileContext') as HTMLInputElement).value
    const upload = await authedFetch('/documents', { method: 'POST', body })
    if (!upload.ok) { toast.err('Upload refusé.'); return }
    const doc = await upload.json()
    await authedFetch(`/contacts/${selected.id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: doc.id, context: context || 'document' }),
    })
    form.reset(); setShowUploadDoc(false); toast.ok('Document lié.'); await reload(); await loadDetail(selected.id)
  }

  async function handleLinkDoc(event: FormEv) {
    event.preventDefault(); if (!selected) return
    const form = event.currentTarget; const data = new FormData(form)
    const documentId = data.get('documentId'); if (!documentId) return
    await authedFetch(`/contacts/${selected.id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId, context: data.get('context') || 'document' }),
    })
    form.reset(); toast.ok('Document associé.'); await loadDetail(selected.id)
  }

  async function downloadDoc(docId: string, name: string) {
    const r = await authedFetch(`/documents/${docId}/download`)
    if (!r.ok) return
    const blob = await r.blob(); const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase()
    const matchQ = !q || c.displayName.toLowerCase().includes(q) || (c.organization ?? '').toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q)
    return matchQ && (kindFilter === 'all' || c.kind === kindFilter)
  })

  /* ══ VUE LISTE ══ */
  if (view === 'list') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Carnet</span>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: '2px 0 0' }}>Contacts</h1>
        </div>
        <button className="primary-action" onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={15} /> Nouveau contact
        </button>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau contact" subtitle="Ajoute une personne, une entreprise ou un prestataire à ton carnet." icon={<UserRound size={18} />}>
        <form onSubmit={handleCreate}>
          <div className="modal-grid">
            <FieldTip label="Nom complet" hint="Prénom + Nom pour une personne, raison sociale pour une entreprise. Utilisé pour les recherches et les tris." required style={{ gridColumn: '1/-1' }}>
              <input name="displayName" className="modal-input" placeholder="Ex : Michel Dupont" required autoFocus />
            </FieldTip>
            <FieldTip label="Type" hint="Catégorie du contact — influence les filtres et l'affichage. 'Garage' et 'Assureur' sont des types spécialisés pour le module Véhicules.">
              <select name="kind" className="modal-select" defaultValue="person">
                <option value="person">👤 Personne</option>
                <option value="company">🏢 Organisation</option>
                <option value="supplier">🏭 Fournisseur</option>
                <option value="garage">🔧 Garage</option>
                <option value="insurer">🛡️ Assureur</option>
              </select>
            </FieldTip>
            <FieldTip label="Organisation" hint="Entreprise ou structure à laquelle appartient ce contact. Affiché sous le nom dans les listes.">
              <input name="organization" className="modal-input" placeholder="Ex : Garage Martin SARL" />
            </FieldTip>
            <FieldTip label="Email" hint="Adresse email de contact. Un clic dans la fiche ouvre directement ton client mail.">
              <input name="email" type="email" className="modal-input" placeholder="contact@exemple.fr" />
            </FieldTip>
            <FieldTip label="Téléphone" hint="Numéro de téléphone. Un clic dans la fiche initie l'appel sur mobile.">
              <input name="phone" className="modal-input" placeholder="+33 6 …" />
            </FieldTip>
            <FieldTip label="Ville" hint="Ville principale du contact — utile pour filtrer par zone géographique.">
              <input name="city" className="modal-input" placeholder="Ex : Lyon" />
            </FieldTip>
            <FieldTip label="Notes / contexte" hint="Toutes les infos utiles : comment tu l'as connu, conditions commerciales, spécialités, etc. Sera affiché dans la fiche." style={{ gridColumn: '1/-1' }}>
              <textarea name="notes" className="modal-input" rows={3} placeholder="Ex : Spécialisé Peugeot, tarif préférentiel, disponible sam matin." style={{ resize: 'vertical' }} />
            </FieldTip>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Annuler</button>
            <button type="submit" className="primary-action"><UserRound size={14} /> Créer le contact</button>
          </div>
        </form>
      </Modal>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, email, organisation…"
          style={{ flex: 1, minWidth: '200px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text)', fontSize: '13px', fontFamily: 'var(--font)', outline: 'none' }} />
        {(['all', 'person', 'company', 'supplier', 'garage', 'insurer'] as const).map(k => {
          const label = k === 'all' ? 'Tous' : KIND_STYLE[k]?.label ?? k
          const color = k === 'all' ? 'var(--text2)' : KIND_STYLE[k]?.color ?? 'var(--text2)'
          return (
            <button key={k} onClick={() => setKindFilter(k)} style={{ padding: '7px 12px', borderRadius: '20px', border: `1px solid ${kindFilter === k ? color : 'var(--border)'}`, background: kindFilter === k ? `${color}18` : 'none', color: kindFilter === k ? color : 'var(--text3)', fontSize: '11px', fontFamily: 'var(--mono)', cursor: 'pointer', fontWeight: 600 }}>
              {label}
            </button>
          )
        })}
      </div>

      {/* Grille */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
          <UserRound size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <p style={{ fontSize: '14px' }}>{search ? 'Aucun résultat.' : 'Aucun contact — ajoute-en un !'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {filtered.map(c => {
            const s = KIND_STYLE[c.kind] ?? { color: '#7b82a8' }
            return (
              <button key={c.id} onClick={async () => { await loadDetail(c.id); setView('detail'); setActiveTab('infos'); setEditMode(false) }}
                style={{ background: 'var(--card)', border: `1px solid var(--border)`, borderRadius: '14px', padding: '16px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, transform 0.1s', borderLeft: `3px solid ${s.color}` }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderLeftColor = s.color; (e.currentTarget as HTMLElement).style.transform = 'translateX(2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderLeftColor = s.color; (e.currentTarget as HTMLElement).style.transform = 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <Avatar name={c.displayName} kind={c.kind} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.displayName}</div>
                    {c.organization && <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px' }}>{c.organization}</div>}
                  </div>
                  <KindBadge kind={c.kind} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {c.email && <span>✉ {c.email}</span>}
                  {c.phone && <span>📞 {c.phone}</span>}
                  {c.city && <span>📍 {c.city}</span>}
                </div>
                {(c._count?.interactions ?? 0) > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                    {c._count!.interactions} interaction{c._count!.interactions > 1 ? 's' : ''}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  /* ══ VUE DÉTAIL ══ */
  if (!selected) return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text3)' }}><p>Chargement…</p></div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 0 20px', flexWrap: 'wrap' }}>
        <button onClick={() => { setView('list'); setEditMode(false) }} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 14px', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer' }}>
          <ArrowLeft size={14} /> Contacts
        </button>
        <Avatar name={selected.displayName} kind={selected.kind} />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase' }}>Fiche contact</span>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '2px 0 0' }}>{selected.displayName}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <KindBadge kind={selected.kind} />
          <button className="hdr-btn" onClick={() => setEditMode(m => !m)}><Pencil size={13} /></button>
          <ConfirmButton onConfirm={handleDelete} confirmLabel="Supprimer ?" />
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '150px', flexShrink: 0 }}>
          {NAV.map(({ tab, icon, label }) => {
            const active = activeTab === tab
            let badge = 0
            if (tab === 'interactions') badge = selected.interactions.length
            if (tab === 'documents') badge = selected.documents.length
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: active ? 'rgba(124,58,237,0.18)' : 'none', color: active ? '#c4b5fd' : 'var(--text2)', fontSize: '13px', fontWeight: active ? 600 : 400, textAlign: 'left', transition: 'all 0.12s' }}>
                {icon} <span style={{ flex: 1 }}>{label}</span>
                {badge > 0 && <span style={{ fontSize: '9px', background: 'rgba(124,58,237,0.4)', color: '#c4b5fd', borderRadius: '20px', padding: '1px 5px', fontWeight: 700 }}>{badge}</span>}
              </button>
            )
          })}
        </nav>

        {/* Contenu */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px' }}>

          {/* ── INFOS ── */}
          {activeTab === 'infos' && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="detail-grid">
                <span>Email<strong>{selected.email ? <a href={`mailto:${selected.email}`} style={{ color: '#67e8f9' }}>{selected.email}</a> : '—'}</strong></span>
                <span>Téléphone<strong>{selected.phone ? <a href={`tel:${selected.phone}`} style={{ color: '#67e8f9' }}>{selected.phone}</a> : '—'}</strong></span>
                <span>Organisation<strong>{selected.organization ?? '—'}</strong></span>
                <span>Ville<strong>{selected.city ?? '—'}</strong></span>
                <span>Type<strong><KindBadge kind={selected.kind} /></strong></span>
                <span>Interactions<strong style={{ color: '#a78bfa' }}>{selected.interactions.length}</strong></span>
                {selected.notes && <span style={{ gridColumn: '1/-1' }}>Note<p style={{ fontSize: '12px', color: 'var(--text2)', margin: '4px 0 0', lineHeight: 1.5 }}>{selected.notes}</p></span>}
              </div>

              <Modal open={editMode} onClose={() => setEditMode(false)} title={`Modifier : ${selected.displayName}`} subtitle="Mets à jour les informations de ce contact." icon={<Pencil size={16} />}>
                <form onSubmit={handleUpdate}>
                  <div className="modal-grid">
                    <FieldTip label="Nom complet" hint="Prénom + Nom ou raison sociale. Utilisé dans toutes les listes." required style={{ gridColumn: '1/-1' }}>
                      <input name="displayName" className="modal-input" defaultValue={selected.displayName} required autoFocus />
                    </FieldTip>
                    <FieldTip label="Type" hint="Catégorie du contact pour le filtrage.">
                      <select name="kind" className="modal-select" defaultValue={selected.kind}>
                        <option value="person">👤 Personne</option>
                        <option value="company">🏢 Organisation</option>
                        <option value="supplier">🏭 Fournisseur</option>
                        <option value="garage">🔧 Garage</option>
                        <option value="insurer">🛡️ Assureur</option>
                      </select>
                    </FieldTip>
                    <FieldTip label="Organisation" hint="Entreprise ou structure associée.">
                      <input name="organization" className="modal-input" defaultValue={selected.organization ?? ''} placeholder="Optionnel" />
                    </FieldTip>
                    <FieldTip label="Email" hint="Adresse de contact — cliquable dans la fiche.">
                      <input name="email" type="email" className="modal-input" defaultValue={selected.email ?? ''} />
                    </FieldTip>
                    <FieldTip label="Téléphone" hint="Numéro — cliquable sur mobile.">
                      <input name="phone" className="modal-input" defaultValue={selected.phone ?? ''} />
                    </FieldTip>
                    <FieldTip label="Ville" hint="Pour le filtrage géographique.">
                      <input name="city" className="modal-input" defaultValue={selected.city ?? ''} />
                    </FieldTip>
                    <FieldTip label="Notes / contexte" hint="Informations libres : spécialités, conditions, historique de la relation." style={{ gridColumn: '1/-1' }}>
                      <textarea name="notes" className="modal-input" rows={3} defaultValue={selected.notes ?? ''} style={{ resize: 'vertical' }} />
                    </FieldTip>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn-ghost" onClick={() => setEditMode(false)}>Annuler</button>
                    <button type="submit" className="primary-action">Sauvegarder</button>
                  </div>
                </form>
              </Modal>
            </div>
          )}

          {/* ── INTERACTIONS ── */}
          {activeTab === 'interactions' && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <button className="primary-action" style={{ display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start' }} onClick={() => setShowAddInteraction(true)}>
                <Plus size={14} /> Nouvelle interaction
              </button>

              <Modal open={showAddInteraction} onClose={() => setShowAddInteraction(false)} title="Nouvelle interaction" subtitle="Enregistre un échange avec ce contact pour garder un historique complet." icon="🤝">
                <form onSubmit={handleAddInteraction}>
                  <div className="modal-grid">
                    <FieldTip label="Titre" hint="Sujet de l'échange. Ex : 'Appel devis pneus', 'Réunion bilan annuel'." required style={{ gridColumn: '1/-1' }}>
                      <input name="title" className="modal-input" placeholder="Ex : Appel pour demande de devis" required autoFocus />
                    </FieldTip>
                    <FieldTip label="Type" hint="Nature de l'échange — filtre et icône dans la liste des interactions.">
                      <select name="type" className="modal-select" defaultValue="note">
                        <option value="note">📝 Note</option>
                        <option value="call">📞 Appel</option>
                        <option value="email">✉️ Email</option>
                        <option value="meeting">🤝 Réunion</option>
                        <option value="quote">📋 Devis</option>
                      </select>
                    </FieldTip>
                    <FieldTip label="Date" hint="Quand cet échange a-t-il eu lieu ? Par défaut : aujourd'hui." required>
                      <input name="date" type="date" className="modal-input" defaultValue={new Date().toISOString().slice(0,10)} required />
                    </FieldTip>
                    <FieldTip label="Détails / notes" hint="Résumé de l'échange, conclusions, prochaines étapes, montants évoqués, etc." style={{ gridColumn: '1/-1' }}>
                      <textarea name="notes" className="modal-input" rows={3} placeholder="Ex : Devis demandé pour 4 pneus hiver Michelin 205/55R16 — retour attendu lundi." style={{ resize: 'vertical' }} />
                    </FieldTip>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn-ghost" onClick={() => setShowAddInteraction(false)}>Annuler</button>
                    <button type="submit" className="primary-action">Enregistrer</button>
                  </div>
                </form>
              </Modal>

              {selected.interactions.length === 0 ? <p className="muted">Aucune interaction enregistrée.</p>
                : selected.interactions.map(i => (
                  <div key={i.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '20px', flexShrink: 0 }}>{INTERACT_ICONS[i.type] ?? '📝'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{i.title}</div>
                      {i.notes && <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px', fontStyle: 'italic' }}>{i.notes}</div>}
                      <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '4px', fontFamily: 'var(--mono)' }}>
                        {i.type} · {new Date(i.date).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                    <ConfirmButton onConfirm={() => handleDeleteInteraction(i.id)} confirmLabel="Suppr" />
                  </div>
                ))
              }
            </div>
          )}

          {/* ── DOCUMENTS ── */}
          {activeTab === 'documents' && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="primary-action" onClick={() => setShowUploadDoc(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <Upload size={13} /> Uploader un document
                </button>
              </div>
              <Modal open={showUploadDoc} onClose={() => setShowUploadDoc(false)} title="Ajouter un document" subtitle={selected.displayName} icon={<Upload size={20} />} maxWidth={460}>
                <form onSubmit={handleUploadDoc}>
                  <div className="modal-grid">
                    <FieldTip label="Fichier" hint="Le document à lier à ce contact : contrat, devis, facture, bon de commande… Stocké de façon privée dans votre bibliothèque." required style={{ gridColumn: '1/-1' }}>
                      <input name="contactFile" type="file" required className="modal-input" style={{ width: '100%', boxSizing: 'border-box', cursor: 'pointer' }} />
                    </FieldTip>
                    <FieldTip label="Type de document" hint="Catégorisez le document pour le retrouver facilement dans la liste.">
                      <select name="contactFileContext" defaultValue="contrat" className="modal-select">
                        <option value="contrat">Contrat</option>
                        <option value="devis">Devis</option>
                        <option value="facture">Facture</option>
                        <option value="document">Document</option>
                      </select>
                    </FieldTip>
                    <FieldTip label="Date d'expiration" hint="Optionnel. Pour les documents avec une date de validité : contrat à renouveler, devis limité dans le temps…">
                      <input name="contactFileExpiresAt" type="date" className="modal-input" />
                    </FieldTip>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn-ghost" onClick={() => setShowUploadDoc(false)}>Annuler</button>
                    <button type="submit" className="primary-action"><Upload size={13} /> Uploader</button>
                  </div>
                </form>
              </Modal>
              <form className="inline-form" onSubmit={handleLinkDoc}>
                <select name="documentId" defaultValue="" style={SELECT_STYLE}>
                  <option value="" disabled>Lier un document existant</option>
                  {documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <input name="context" placeholder="Contexte" defaultValue="document" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text)', fontSize: '12px', fontFamily: 'var(--font)', outline: 'none' }} />
                <button className="btn-ghost" type="submit">Associer</button>
              </form>
              {selected.documents.length === 0 ? <p className="muted">Aucun document lié.</p>
                : <div className="document-list" style={{ padding: 0 }}>
                  {selected.documents.map(link => (
                    <button key={link.id} className="document-row" onClick={() => downloadDoc(link.document.id, link.document.name)}>
                      <FileLock2 size={16} />
                      <span>{link.document.name}</span>
                      <small>{link.context ?? 'document'}</small>
                    </button>
                  ))}
                </div>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
