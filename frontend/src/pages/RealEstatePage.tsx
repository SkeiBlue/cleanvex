import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft, CalendarDays, FileText, FileLock2,
  Home, Pencil, Plus, Upload, Wallet,
} from 'lucide-react'
import { ConfirmButton } from '../components/ConfirmButton'
import { FieldTip } from '../components/FieldTip'
import { Modal } from '../components/Modal'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import type { DocumentItem, PropertyDetail, PropertyItem } from '../types'

type FormEv = { preventDefault(): void; currentTarget: HTMLFormElement }
type Tab = 'infos' | 'evenements' | 'documents' | 'finances'

const STATUS_STYLE: Record<string, { color: string; label: string }> = {
  owned:    { color: '#4ade80', label: 'Propriété' },
  rented:   { color: '#67e8f9', label: 'Location' },
  for_sale: { color: '#fbbf24', label: 'En vente' },
  sold:     { color: '#f87171', label: 'Vendu' },
}

const TYPE_ICONS: Record<string, string> = {
  apartment: '🏢', house: '🏠', land: '🌿', parking: '🅿️', commercial: '🏪', other: '🏗️',
}

const SELECT_STYLE: React.CSSProperties = {
  background: 'rgba(12,16,41,0.95)', border: '1px solid var(--border)',
  borderRadius: '8px', color: 'var(--text)', padding: '8px 10px',
  fontSize: '12px', fontFamily: 'var(--font)',
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { color: '#7b82a8', label: status }
  return (
    <span style={{ fontSize: '9px', fontFamily: 'var(--mono)', fontWeight: 700, padding: '3px 8px', borderRadius: '20px', background: `${s.color}20`, color: s.color, border: `1px solid ${s.color}40` }}>
      {s.label}
    </span>
  )
}

const NAV: { tab: Tab; icon: React.ReactNode; label: string }[] = [
  { tab: 'infos',       icon: <Home size={16} />,         label: 'Infos' },
  { tab: 'evenements',  icon: <CalendarDays size={16} />, label: 'Événements' },
  { tab: 'finances',    icon: <Wallet size={16} />,       label: 'Finances' },
  { tab: 'documents',   icon: <FileText size={16} />,     label: 'Documents' },
]

export function RealEstatePage() {
  const { authedFetch } = useAuth()
  const toast = useToast()
  const [properties, setProperties] = useState<PropertyItem[]>([])
  const [selected, setSelected] = useState<PropertyDetail | null>(null)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [activeTab, setActiveTab] = useState<Tab>('infos')
  const [editMode, setEditMode] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [showUploadDoc, setShowUploadDoc] = useState(false)

  const loadDetail = useCallback(async (id: string) => {
    const r = await authedFetch(`/real-estate/properties/${id}`)
    if (r.ok) setSelected(await r.json())
  }, [authedFetch])

  const reload = useCallback(async () => {
    const [pr, dr] = await Promise.all([authedFetch('/real-estate/properties'), authedFetch('/documents')])
    if (pr.ok) setProperties(await pr.json())
    if (dr.ok) { const d = await dr.json(); setDocuments(d.data ?? d) }
  }, [authedFetch])

  useEffect(() => {
    async function load() {
      const [pr, dr] = await Promise.all([authedFetch('/real-estate/properties'), authedFetch('/documents')])
      if (pr.ok) setProperties(await pr.json())
      if (dr.ok) { const d = await dr.json(); setDocuments(d.data ?? d) }
    }
    load()
  }, [authedFetch])

  /* ── handlers ── */
  async function handleCreate(event: FormEv) {
    event.preventDefault()
    const form = event.currentTarget; const data = new FormData(form)
    const r = await authedFetch('/real-estate/properties', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name'), type: data.get('type'), status: data.get('status'),
        address: data.get('address') || undefined, city: data.get('city') || undefined,
        postalCode: data.get('postalCode') || undefined,
        surface: data.get('surface') ? Number(data.get('surface')) : undefined,
        rooms: data.get('rooms') ? Number(data.get('rooms')) : undefined,
        purchasePrice: data.get('purchasePrice') ? Number(data.get('purchasePrice')) : undefined,
        estimatedValue: data.get('estimatedValue') ? Number(data.get('estimatedValue')) : undefined,
        notes: data.get('notes') || undefined,
      }),
    })
    if (!r.ok) { toast.err('Création refusée.'); return }
    const created = await r.json()
    form.reset(); setShowCreate(false); toast.ok('Bien créé.')
    await reload(); await loadDetail(created.id)
    setView('detail'); setActiveTab('infos'); setEditMode(false)
  }

  async function handleUpdate(event: FormEv) {
    event.preventDefault(); if (!selected) return
    const form = event.currentTarget; const data = new FormData(form)
    const r = await authedFetch(`/real-estate/properties/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name') || undefined, status: data.get('status') || undefined,
        address: data.get('address') || undefined, city: data.get('city') || undefined,
        postalCode: data.get('postalCode') || undefined,
        surface: data.get('surface') ? Number(data.get('surface')) : undefined,
        rooms: data.get('rooms') ? Number(data.get('rooms')) : undefined,
        purchasePrice: data.get('purchasePrice') ? Number(data.get('purchasePrice')) : undefined,
        estimatedValue: data.get('estimatedValue') ? Number(data.get('estimatedValue')) : undefined,
        notes: data.get('notes') || undefined,
      }),
    })
    if (!r.ok) { toast.err('Mise à jour refusée.'); return }
    setEditMode(false); toast.ok('Bien mis à jour.'); await reload(); await loadDetail(selected.id)
  }

  async function handleDelete() {
    if (!selected) return
    const r = await authedFetch(`/real-estate/properties/${selected.id}`, { method: 'DELETE' })
    if (!r.ok) { toast.err('Suppression refusée.'); return }
    setSelected(null); setView('list'); await reload()
  }

  async function handleAddEvent(event: FormEv) {
    event.preventDefault(); if (!selected) return
    const form = event.currentTarget; const data = new FormData(form)
    const r = await authedFetch(`/real-estate/properties/${selected.id}/events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: data.get('type'), title: data.get('title'), date: data.get('date'),
        amount: data.get('amount') ? Number(data.get('amount')) : undefined,
        status: data.get('status') || 'planned',
      }),
    })
    if (r.ok) { form.reset(); setShowAddEvent(false); toast.ok('Événement ajouté.'); await loadDetail(selected.id) }
  }

  async function handleDeleteEvent(id: string) {
    if (!selected) return
    const r = await authedFetch(`/real-estate/properties/${selected.id}/events/${id}`, { method: 'DELETE' })
    if (!r.ok) { toast.err('Suppression refusée.'); return }
    await loadDetail(selected.id)
  }

  async function handleUploadDoc(event: FormEv) {
    event.preventDefault(); if (!selected) return
    const form = event.currentTarget
    const input = form.elements.namedItem('propertyFile') as HTMLInputElement
    const file = input.files?.[0]; if (!file) { toast.err('Choisis un fichier.'); return }
    const body = new FormData(); body.append('file', file)
    const expiresAt = (form.elements.namedItem('propertyFileExpiresAt') as HTMLInputElement).value
    if (expiresAt) body.append('expiresAt', expiresAt)
    const context = (form.elements.namedItem('propertyFileContext') as HTMLInputElement).value
    const upload = await authedFetch('/documents', { method: 'POST', body })
    if (!upload.ok) { toast.err('Upload refusé.'); return }
    const doc = await upload.json()
    await authedFetch(`/real-estate/properties/${selected.id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: doc.id, context: context || 'document' }),
    })
    form.reset(); setShowUploadDoc(false); toast.ok('Document lié.'); await reload(); await loadDetail(selected.id)
  }

  async function handleLinkDoc(event: FormEv) {
    event.preventDefault(); if (!selected) return
    const form = event.currentTarget; const data = new FormData(form)
    const documentId = data.get('documentId'); if (!documentId) return
    await authedFetch(`/real-estate/properties/${selected.id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId, context: data.get('context') || 'document' }),
    })
    form.reset(); await loadDetail(selected.id)
  }

  async function downloadDoc(docId: string, name: string) {
    const r = await authedFetch(`/documents/${docId}/download`)
    if (!r.ok) return
    const blob = await r.blob(); const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }

  /* ── stats finances ── */
  const totalExpenses = selected?.events.filter(e => e.status === 'done' && Number(e.amount) > 0).reduce((s, e) => s + Number(e.amount), 0) ?? 0
  const plannedExpenses = selected?.events.filter(e => e.status === 'planned' && Number(e.amount) > 0).reduce((s, e) => s + Number(e.amount), 0) ?? 0
  const plusValue = selected?.estimatedValue && selected.purchasePrice
    ? Number(selected.estimatedValue) - Number(selected.purchasePrice)
    : null

  /* ══ VUE LISTE ══ */
  if (view === 'list') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Patrimoine</span>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: '2px 0 0' }}>Immobilier</h1>
        </div>
        <button className="primary-action" onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={15} /> Ajouter un bien
        </button>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau bien immobilier" subtitle="Ajoute un bien à ton patrimoine : appartement, maison, terrain, garage, local…" icon="🏠">
        <form onSubmit={handleCreate}>
          <div className="modal-grid">
            <FieldTip label="Nom du bien" hint="Nom court pour identifier ce bien dans toutes les listes. Ex : 'Appart Lyon 3', 'Maison Clermont'." required style={{ gridColumn: '1/-1' }}>
              <input name="name" className="modal-input" placeholder="Ex : Appartement Lyon 3ème" required autoFocus />
            </FieldTip>
            <FieldTip label="Type" hint="Nature du bien. Influence l'icône et les filtres dans la liste.">
              <select name="type" className="modal-select" defaultValue="apartment">
                <option value="apartment">🏢 Appartement</option>
                <option value="house">🏠 Maison</option>
                <option value="land">🌿 Terrain</option>
                <option value="parking">🅿️ Parking</option>
                <option value="commercial">🏪 Commercial</option>
                <option value="other">🏗️ Autre</option>
              </select>
            </FieldTip>
            <FieldTip label="Statut" hint="Ton rapport à ce bien : propriétaire (tu le possèdes), locataire (tu le loues), en vente, ou vendu (archivé).">
              <select name="status" className="modal-select" defaultValue="owned">
                <option value="owned">✅ Propriété</option>
                <option value="rented">🔑 Location</option>
                <option value="for_sale">🏷️ En vente</option>
                <option value="sold">📦 Vendu</option>
              </select>
            </FieldTip>
            <FieldTip label="Adresse" hint="Adresse postale complète pour retrouver le bien facilement." style={{ gridColumn: '1/-1' }}>
              <input name="address" className="modal-input" placeholder="Ex : 12 rue de la Paix" />
            </FieldTip>
            <FieldTip label="Ville" hint="Ville du bien — utilisée dans les filtres et le résumé.">
              <input name="city" className="modal-input" placeholder="Ex : Lyon" />
            </FieldTip>
            <FieldTip label="Code postal" hint="Code postal de la commune.">
              <input name="postalCode" className="modal-input" placeholder="Ex : 69003" />
            </FieldTip>
            <FieldTip label="Surface (m²)" hint="Surface habitable ou totale selon le type de bien. Utilisée dans les statistiques.">
              <input name="surface" type="number" min="0" step="0.01" className="modal-input" placeholder="Ex : 65" />
            </FieldTip>
            <FieldTip label="Nb de pièces" hint="Nombre de pièces principales (salon + chambres). Indicateur affiché sur la card.">
              <input name="rooms" type="number" min="0" className="modal-input" placeholder="Ex : 3" />
            </FieldTip>
            <FieldTip label="Prix d'achat (€)" hint="Prix payé à l'acquisition (acte notarié). Sert à calculer la plus-value potentielle.">
              <input name="purchasePrice" type="number" step="0.01" className="modal-input" placeholder="Ex : 180000" />
            </FieldTip>
            <FieldTip label="Valeur estimée (€)" hint="Estimation actuelle du bien (agence, Meilleurs Agents…). Calculée en plus-value vs. prix d'achat.">
              <input name="estimatedValue" type="number" step="0.01" className="modal-input" placeholder="Ex : 210000" />
            </FieldTip>
            <FieldTip label="Notes / contexte" hint="Infos libres : diagnostics à faire, situation locative, charges, contacts du syndic, travaux prévus, etc." style={{ gridColumn: '1/-1' }}>
              <textarea name="notes" className="modal-input" rows={3} placeholder="Ex : Charges 280€/mois. Locataire jusqu'en mars 2026. DPE : D." style={{ resize: 'vertical' }} />
            </FieldTip>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Annuler</button>
            <button type="submit" className="primary-action"><Home size={14} /> Créer le bien</button>
          </div>
        </form>
      </Modal>

      {properties.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
          <Home size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <p style={{ fontSize: '14px' }}>Aucun bien immobilier — ajoute-en un !</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {properties.map(p => {
            const s = STATUS_STYLE[p.status] ?? { color: '#7b82a8', label: p.status }
            const plusV = p.estimatedValue && p.purchasePrice ? Number(p.estimatedValue) - Number(p.purchasePrice) : null
            return (
              <button key={p.id}
                onClick={async () => { await loadDetail(p.id); setView('detail'); setActiveTab('infos'); setEditMode(false) }}
                style={{ background: 'var(--card)', border: `1px solid var(--border)`, borderRadius: '16px', padding: '0', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, transform 0.1s', borderTop: `3px solid ${s.color}`, overflow: 'hidden' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.borderTopColor = s.color }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none' }}
              >
                <div style={{ padding: '18px 18px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '28px' }}>{TYPE_ICONS[p.type] ?? '🏗️'}</span>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{p.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '1px' }}>{[p.city, p.postalCode].filter(Boolean).join(', ') || p.type}</div>
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '6px', fontSize: '11px', color: 'var(--text3)' }}>
                    {p.surface && <span>📐 {Number(p.surface).toLocaleString('fr-FR')} m²</span>}
                    {p.rooms && <span>🚪 {p.rooms} pièces</span>}
                  </div>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', padding: '10px 18px', display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.1)', fontSize: '11px' }}>
                  {p.estimatedValue ? <span style={{ color: '#4ade80', fontWeight: 600 }}>~{Number(p.estimatedValue).toLocaleString('fr-FR')} €</span> : <span style={{ color: 'var(--text3)' }}>Valeur non renseignée</span>}
                  {plusV !== null && <span style={{ color: plusV >= 0 ? '#4ade80' : '#f87171', fontWeight: 600 }}>{plusV >= 0 ? '+' : ''}{plusV.toLocaleString('fr-FR')} €</span>}
                </div>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 0 20px', flexWrap: 'wrap' }}>
        <button onClick={() => { setView('list'); setEditMode(false) }} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 14px', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer' }}>
          <ArrowLeft size={14} /> Immobilier
        </button>
        <span style={{ fontSize: '28px' }}>{TYPE_ICONS[selected.type] ?? '🏗️'}</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase' }}>Fiche bien</span>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '2px 0 0' }}>{selected.name}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StatusBadge status={selected.status} />
          <button className="hdr-btn" onClick={() => setEditMode(m => !m)}><Pencil size={13} /></button>
          <ConfirmButton onConfirm={handleDelete} confirmLabel="Supprimer ?" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '150px', flexShrink: 0 }}>
          {NAV.map(({ tab, icon, label }) => {
            const active = activeTab === tab
            let badge = 0
            if (tab === 'evenements') badge = selected.events.filter(e => e.status !== 'done').length
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
                <span>Surface<strong>{selected.surface ? `${Number(selected.surface).toLocaleString('fr-FR')} m²` : '—'}</strong></span>
                <span>Pièces<strong>{selected.rooms ?? '—'}</strong></span>
                <span>Valeur estimée<strong style={{ color: '#4ade80' }}>{selected.estimatedValue ? `${Number(selected.estimatedValue).toLocaleString('fr-FR')} €` : '—'}</strong></span>
                <span>Prix d'achat<strong>{selected.purchasePrice ? `${Number(selected.purchasePrice).toLocaleString('fr-FR')} €` : '—'}</strong></span>
                <span>Ville<strong>{[selected.city, selected.postalCode].filter(Boolean).join(' ') || '—'}</strong></span>
                <span>Type<strong>{TYPE_ICONS[selected.type] ?? ''} {selected.type}</strong></span>
                {selected.address && <span style={{ gridColumn: '1/-1' }}>Adresse<strong style={{ fontWeight: 400, fontSize: '12px', color: 'var(--text2)', fontFamily: 'var(--font)' }}>{selected.address}</strong></span>}
                {selected.notes && <span style={{ gridColumn: '1/-1' }}>Notes<p style={{ fontSize: '12px', color: 'var(--text2)', margin: '4px 0 0', lineHeight: 1.5 }}>{selected.notes}</p></span>}
              </div>

              <Modal open={editMode} onClose={() => setEditMode(false)} title={`Modifier : ${selected.name}`} subtitle="Mets à jour les informations de ce bien." icon={<Pencil size={16} />}>
                <form onSubmit={handleUpdate}>
                  <div className="modal-grid">
                    <FieldTip label="Nom du bien" hint="Identifiant court pour les listes." required style={{ gridColumn: '1/-1' }}>
                      <input name="name" className="modal-input" defaultValue={selected.name} required autoFocus />
                    </FieldTip>
                    <FieldTip label="Statut" hint="Ton rapport actuel à ce bien.">
                      <select name="status" className="modal-select" defaultValue={selected.status}>
                        <option value="owned">✅ Propriété</option>
                        <option value="rented">🔑 Location</option>
                        <option value="for_sale">🏷️ En vente</option>
                        <option value="sold">📦 Vendu</option>
                      </select>
                    </FieldTip>
                    <FieldTip label="Adresse" hint="Adresse postale complète." style={{ gridColumn: '1/-1' }}>
                      <input name="address" className="modal-input" defaultValue={selected.address ?? ''} />
                    </FieldTip>
                    <FieldTip label="Ville" hint="Commune du bien.">
                      <input name="city" className="modal-input" defaultValue={selected.city ?? ''} />
                    </FieldTip>
                    <FieldTip label="Code postal" hint="Code postal.">
                      <input name="postalCode" className="modal-input" defaultValue={selected.postalCode ?? ''} />
                    </FieldTip>
                    <FieldTip label="Surface m²" hint="Surface habitable ou totale.">
                      <input name="surface" type="number" min="0" step="0.01" className="modal-input" defaultValue={selected.surface ?? ''} />
                    </FieldTip>
                    <FieldTip label="Pièces" hint="Nombre de pièces principales.">
                      <input name="rooms" type="number" min="0" className="modal-input" defaultValue={selected.rooms ?? ''} />
                    </FieldTip>
                    <FieldTip label="Prix d'achat €" hint="Prix à l'acquisition (notaire). Sert au calcul de plus-value.">
                      <input name="purchasePrice" type="number" step="0.01" className="modal-input" defaultValue={selected.purchasePrice ?? ''} />
                    </FieldTip>
                    <FieldTip label="Valeur estimée €" hint="Valeur de marché actuelle estimée.">
                      <input name="estimatedValue" type="number" step="0.01" className="modal-input" defaultValue={selected.estimatedValue ?? ''} />
                    </FieldTip>
                    <FieldTip label="Notes" hint="Infos libres : diagnostics, charges, locataire, contacts…" style={{ gridColumn: '1/-1' }}>
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

          {/* ── ÉVÉNEMENTS ── */}
          {activeTab === 'evenements' && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button className="primary-action" style={{ display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start' }} onClick={() => setShowAddEvent(true)}>
                <Plus size={14} /> Nouvel événement
              </button>

              <Modal open={showAddEvent} onClose={() => setShowAddEvent(false)} title="Nouvel événement" subtitle="Enregistre un travaux, une taxe, un loyer ou tout autre événement lié à ce bien." icon="📅">
                <form onSubmit={handleAddEvent}>
                  <div className="modal-grid">
                    <FieldTip label="Titre" hint="Description courte de l'événement. Ex : 'Remplacement chauffe-eau', 'Taxe foncière 2025'." required style={{ gridColumn: '1/-1' }}>
                      <input name="title" className="modal-input" placeholder="Ex : Taxe foncière 2025" required autoFocus />
                    </FieldTip>
                    <FieldTip label="Type" hint="Catégorie de l'événement — utilisée dans les graphiques financiers.">
                      <select name="type" className="modal-select" defaultValue="maintenance">
                        <option value="maintenance">🔧 Maintenance</option>
                        <option value="renovation">🏗️ Rénovation</option>
                        <option value="tax">🧾 Taxe/Charge</option>
                        <option value="insurance">🛡️ Assurance</option>
                        <option value="rent">💶 Loyer</option>
                        <option value="other">📝 Autre</option>
                      </select>
                    </FieldTip>
                    <FieldTip label="Statut" hint="'Planifié' : prévu mais pas encore fait. 'Fait' : dépense réelle comptabilisée.">
                      <select name="status" className="modal-select" defaultValue="planned">
                        <option value="planned">📋 Planifié</option>
                        <option value="done">✅ Fait</option>
                      </select>
                    </FieldTip>
                    <FieldTip label="Date" hint="Date de l'événement ou de la dépense." required>
                      <input name="date" type="date" className="modal-input" defaultValue={new Date().toISOString().slice(0,10)} required />
                    </FieldTip>
                    <FieldTip label="Montant (€)" hint="Coût de l'événement. Comptabilisé dans l'onglet Finances de ce bien." style={{ gridColumn: '1/-1' }}>
                      <input name="amount" type="number" min="0" step="0.01" className="modal-input" placeholder="Ex : 1200" />
                    </FieldTip>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn-ghost" onClick={() => setShowAddEvent(false)}>Annuler</button>
                    <button type="submit" className="primary-action"><CalendarDays size={14} /> Ajouter</button>
                  </div>
                </form>
              </Modal>

              {selected.events.length === 0 ? <p className="muted">Aucun événement enregistré.</p>
                : selected.events.map(ev => (
                  <div key={ev.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', borderLeft: `3px solid ${ev.status === 'done' ? '#4ade80' : '#fbbf24'}` }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <CalendarDays size={16} style={{ color: ev.status === 'done' ? '#4ade80' : '#fbbf24', marginTop: '1px', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{ev.title}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '3px', fontFamily: 'var(--mono)' }}>{ev.type} · {new Date(ev.date).toLocaleDateString('fr-FR')}</div>
                      </div>
                      {ev.amount && <div style={{ fontSize: '13px', fontWeight: 600, color: '#f87171', whiteSpace: 'nowrap' }}>{Number(ev.amount).toLocaleString('fr-FR')} €</div>}
                      <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '20px', background: ev.status === 'done' ? '#4ade8020' : '#fbbf2420', color: ev.status === 'done' ? '#4ade80' : '#fbbf24', border: `1px solid ${ev.status === 'done' ? '#4ade8040' : '#fbbf2440'}`, fontFamily: 'var(--mono)', fontWeight: 700 }}>
                        {ev.status === 'done' ? 'Fait' : 'Planifié'}
                      </span>
                      <ConfirmButton onConfirm={() => handleDeleteEvent(ev.id)} confirmLabel="Suppr" />
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* ── FINANCES ── */}
          {activeTab === 'finances' && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                {[
                  { label: 'Prix d\'achat',    value: selected.purchasePrice ? `${Number(selected.purchasePrice).toLocaleString('fr-FR')} €` : '—', color: 'var(--text2)' },
                  { label: 'Valeur estimée',  value: selected.estimatedValue ? `${Number(selected.estimatedValue).toLocaleString('fr-FR')} €` : '—', color: '#4ade80' },
                  { label: 'Plus-value',      value: plusValue !== null ? `${plusValue >= 0 ? '+' : ''}${plusValue.toLocaleString('fr-FR')} €` : '—', color: plusValue !== null ? (plusValue >= 0 ? '#4ade80' : '#f87171') : 'var(--text3)' },
                  { label: 'Dépenses réelles', value: `${totalExpenses.toLocaleString('fr-FR')} €`, color: '#f87171' },
                  { label: 'Planifié',         value: `${plannedExpenses.toLocaleString('fr-FR')} €`, color: '#fbbf24' },
                  { label: 'Total à prévoir',  value: `${(totalExpenses + plannedExpenses).toLocaleString('fr-FR')} €`, color: '#a78bfa' },
                ].map(s => (
                  <div key={s.label} style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '6px' }}>{s.label.toUpperCase()}</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {selected.events.filter(e => Number(e.amount) > 0).length > 0 && (
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '8px' }}>DÉTAIL DES DÉPENSES</div>
                  {selected.events.filter(e => Number(e.amount) > 0).sort((a, b) => Number(b.amount) - Number(a.amount)).map(ev => (
                    <div key={ev.id} className="document-row">
                      <span style={{ flex: 1 }}>{ev.title}</span>
                      <small>{ev.type}</small>
                      <span style={{ fontWeight: 600, color: ev.status === 'done' ? '#f87171' : '#fbbf24' }}>{Number(ev.amount).toLocaleString('fr-FR')} €</span>
                    </div>
                  ))}
                </div>
              )}
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
              <Modal open={showUploadDoc} onClose={() => setShowUploadDoc(false)} title="Ajouter un document" subtitle={selected.name} icon={<Upload size={20} />} maxWidth={460}>
                <form onSubmit={handleUploadDoc}>
                  <div className="modal-grid">
                    <FieldTip label="Fichier" hint="Le document à lier à ce bien : diagnostic, acte notarié, plan, taxe foncière… Stocké de façon privée dans votre bibliothèque." required style={{ gridColumn: '1/-1' }}>
                      <input name="propertyFile" type="file" required className="modal-input" style={{ width: '100%', boxSizing: 'border-box', cursor: 'pointer' }} />
                    </FieldTip>
                    <FieldTip label="Type de document" hint="Catégorisez le document pour le retrouver et le contextualiser facilement.">
                      <select name="propertyFileContext" defaultValue="diagnostic" className="modal-select">
                        <option value="diagnostic">Diagnostic</option>
                        <option value="acte">Acte notarié</option>
                        <option value="plan">Plan</option>
                        <option value="assurance">Assurance</option>
                        <option value="taxe">Taxe foncière</option>
                        <option value="document">Document</option>
                      </select>
                    </FieldTip>
                    <FieldTip label="Date d'expiration" hint="Optionnel. Pour les documents à durée de validité limitée : assurance, garantie décennale, diagnostic DPE…">
                      <input name="propertyFileExpiresAt" type="date" className="modal-input" />
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
