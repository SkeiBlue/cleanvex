import { useCallback, useEffect, useState } from 'react'
import { Car, FileLock2, Gauge, Pencil, Trash2, Upload, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { DocumentItem, VehicleDetail, VehicleItem } from '../types'

type FormEv = { preventDefault(): void; currentTarget: HTMLFormElement }
type Tab = 'resume' | 'interventions' | 'alertes' | 'budget' | 'documents' | 'historique'

/* ─── constantes ─── */
const STATUS_COLORS: Record<string, { color: string; label: string }> = {
  active: { color: '#4ade80', label: 'Actif' },
  repair: { color: '#fbbf24', label: 'En réparation' },
  sold:   { color: '#f87171', label: 'Vendu' },
  parked: { color: '#7b82a8', label: 'Garé' },
}

const INTERV_STATUS: Record<string, { color: string; label: string }> = {
  'a-faire':    { color: '#7b82a8', label: 'À faire' },
  'en-cours':   { color: '#67e8f9', label: 'En cours' },
  'bloque':     { color: '#f87171', label: 'Bloqué' },
  'fait':       { color: '#4ade80', label: 'Fait' },
  // compatibilité valeurs anciennes
  'planned':    { color: '#7b82a8', label: 'À faire' },
  'done':       { color: '#4ade80', label: 'Fait' },
  'in_progress':{ color: '#67e8f9', label: 'En cours' },
}

const SELECT_STYLE: React.CSSProperties = {
  background: 'rgba(12,16,41,0.95)', border: '1px solid var(--border)',
  borderRadius: '8px', color: 'var(--text)', padding: '8px 10px',
  fontSize: '12px', fontFamily: 'var(--font)',
}

/* ─── helpers visuels ─── */
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { color: '#7b82a8', label: status }
  return (
    <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: `${s.color}20`, color: s.color, border: `1px solid ${s.color}40` }}>
      {s.label}
    </span>
  )
}

function IntervStatusBadge({ status }: { status: string }) {
  const s = INTERV_STATUS[status] ?? { color: '#7b82a8', label: status }
  return (
    <span style={{ fontSize: '9px', fontFamily: 'var(--mono)', fontWeight: 700, padding: '2px 6px', borderRadius: '20px', background: `${s.color}20`, color: s.color, border: `1px solid ${s.color}40` }}>
      {s.label}
    </span>
  )
}

function ProgressBar({ value, color = 'var(--p1)', label }: { value: number; color?: string; label?: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text2)', marginBottom: '6px' }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value}%</span>
      </div>
      <div style={{ height: '6px', borderRadius: '20px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, value)}%`, background: color, borderRadius: '20px', transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

function alertUrgency(dueDate: string | null): { color: string; label: string } {
  if (!dueDate) return { color: 'var(--text3)', label: '' }
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000)
  if (days < 0)   return { color: '#f87171', label: `Dépassée` }
  if (days <= 7)  return { color: '#f87171', label: `J-${days}` }
  if (days <= 30) return { color: '#fbbf24', label: `J-${days}` }
  return { color: '#4ade80', label: `J-${days}` }
}

function isDone(status: string) {
  return status === 'fait' || status === 'done'
}

/* ─── composant principal ─── */
export function VehiclesPage() {
  const { authedFetch } = useAuth()
  const [vehicles, setVehicles] = useState<VehicleItem[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleDetail | null>(null)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [message, setMessage] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('resume')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [intervStatusFilter, setIntervStatusFilter] = useState('all')
  const [budgetTarget, setBudgetTarget] = useState(0)

  const loadVehicleDetail = useCallback(async (id: string) => {
    const r = await authedFetch(`/vehicles/${id}`)
    if (r.ok) {
      const data = await r.json()
      setSelectedVehicle(data)
      const stored = localStorage.getItem(`vehicle-budget-${id}`)
      setBudgetTarget(stored ? Number(stored) : 0)
    }
  }, [authedFetch])

  const reload = useCallback(async () => {
    const [vr, dr] = await Promise.all([authedFetch('/vehicles'), authedFetch('/documents')])
    if (vr.ok) setVehicles(await vr.json())
    if (dr.ok) setDocuments(await dr.json())
  }, [authedFetch])

  useEffect(() => {
    async function load() {
      const [vr, dr] = await Promise.all([authedFetch('/vehicles'), authedFetch('/documents')])
      if (vr.ok) {
        const d = await vr.json(); setVehicles(d)
        if (d[0]) loadVehicleDetail(d[0].id)
      }
      if (dr.ok) setDocuments(await dr.json())
    }
    load()
  }, [authedFetch, loadVehicleDetail])

  /* ── handlers CRUD ── */
  async function handleCreateVehicle(event: FormEv) {
    event.preventDefault(); setMessage('')
    const form = event.currentTarget; const data = new FormData(form)
    const r = await authedFetch('/vehicles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name'), type: data.get('type'), status: data.get('status'),
        brand: data.get('brand') || undefined, model: data.get('model') || undefined,
        year: data.get('year') ? Number(data.get('year')) : undefined,
        mileage: data.get('mileage') ? Number(data.get('mileage')) : 0,
        registration: data.get('registration') || undefined,
      }),
    })
    if (!r.ok) { setMessage('Création refusée.'); return }
    const created = await r.json(); form.reset(); setMessage('Véhicule créé.')
    await reload(); await loadVehicleDetail(created.id)
  }

  async function handleUpdateVehicle(event: FormEv) {
    event.preventDefault(); if (!selectedVehicle) return
    const form = event.currentTarget; const data = new FormData(form)
    const r = await authedFetch(`/vehicles/${selectedVehicle.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name') || undefined, status: data.get('status') || undefined,
        registration: data.get('registration') || undefined, vin: data.get('vin') || undefined,
        brand: data.get('brand') || undefined, model: data.get('model') || undefined,
        year: data.get('year') ? Number(data.get('year')) : undefined,
      }),
    })
    if (!r.ok) { setMessage('Mise à jour refusée.'); return }
    setEditMode(false); setMessage('Véhicule mis à jour.')
    await reload(); await loadVehicleDetail(selectedVehicle.id)
  }

  async function handleDeleteVehicle() {
    if (!selectedVehicle) return
    if (!window.confirm(`Supprimer "${selectedVehicle.name}" ?`)) return
    await authedFetch(`/vehicles/${selectedVehicle.id}`, { method: 'DELETE' })
    setSelectedVehicle(null); setEditMode(false); await reload()
  }

  async function handleAddMileage(event: FormEv) {
    event.preventDefault(); if (!selectedVehicle) return
    const form = event.currentTarget; const data = new FormData(form)
    const r = await authedFetch(`/vehicles/${selectedVehicle.id}/mileage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mileage: Number(data.get('mileage')), date: data.get('date') }),
    })
    if (r.ok) { form.reset(); await loadVehicleDetail(selectedVehicle.id) }
  }

  async function handleAddIntervention(event: FormEv) {
    event.preventDefault(); if (!selectedVehicle) return
    const form = event.currentTarget; const data = new FormData(form)
    const r = await authedFetch(`/vehicles/${selectedVehicle.id}/interventions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.get('title'), date: data.get('date'),
        mileage: data.get('mileage') ? Number(data.get('mileage')) : undefined,
        costAmount: data.get('costAmount') ? Number(data.get('costAmount')) : undefined,
        notes: data.get('notes') || undefined,
        status: data.get('status') || 'a-faire',
      }),
    })
    if (r.ok) { form.reset(); await loadVehicleDetail(selectedVehicle.id) }
  }

  async function handleSetIntervStatus(interventionId: string, status: string) {
    if (!selectedVehicle) return
    await authedFetch(`/vehicles/${selectedVehicle.id}/interventions/${interventionId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await loadVehicleDetail(selectedVehicle.id)
  }

  async function handleDeleteIntervention(id: string) {
    if (!selectedVehicle) return
    await authedFetch(`/vehicles/${selectedVehicle.id}/interventions/${id}`, { method: 'DELETE' })
    await loadVehicleDetail(selectedVehicle.id)
  }

  async function handleAddAlert(event: FormEv) {
    event.preventDefault(); if (!selectedVehicle) return
    const form = event.currentTarget; const data = new FormData(form)
    const r = await authedFetch(`/vehicles/${selectedVehicle.id}/alerts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: data.get('type'), title: data.get('title'), dueDate: data.get('dueDate') || undefined }),
    })
    if (r.ok) { form.reset(); await loadVehicleDetail(selectedVehicle.id) }
  }

  async function handleCloseAlert(alertId: string) {
    if (!selectedVehicle) return
    await authedFetch(`/vehicles/${selectedVehicle.id}/alerts/${alertId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'closed' }),
    })
    await loadVehicleDetail(selectedVehicle.id)
  }

  async function handleDeleteAlert(alertId: string) {
    if (!selectedVehicle) return
    await authedFetch(`/vehicles/${selectedVehicle.id}/alerts/${alertId}`, { method: 'DELETE' })
    await loadVehicleDetail(selectedVehicle.id)
  }

  async function handleUploadDoc(event: FormEv) {
    event.preventDefault(); if (!selectedVehicle) return
    const form = event.currentTarget
    const input = form.elements.namedItem('vehicleFile') as HTMLInputElement
    const file = input.files?.[0]; if (!file) return
    const body = new FormData(); body.append('file', file)
    const expiresAt = (form.elements.namedItem('vehicleFileExpiresAt') as HTMLInputElement).value
    if (expiresAt) body.append('expiresAt', expiresAt)
    const context = (form.elements.namedItem('vehicleFileContext') as HTMLInputElement).value
    const upload = await authedFetch('/documents', { method: 'POST', body })
    if (!upload.ok) return
    const doc = await upload.json()
    await authedFetch(`/vehicles/${selectedVehicle.id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: doc.id, context: context || (file.type.startsWith('image/') ? 'avant' : 'document') }),
    })
    form.reset(); await reload(); await loadVehicleDetail(selectedVehicle.id)
  }

  async function handleLinkDoc(event: FormEv) {
    event.preventDefault(); if (!selectedVehicle) return
    const form = event.currentTarget; const data = new FormData(form)
    const documentId = data.get('documentId'); if (!documentId) return
    await authedFetch(`/vehicles/${selectedVehicle.id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId, context: data.get('context') || 'document' }),
    })
    form.reset(); await loadVehicleDetail(selectedVehicle.id)
  }

  async function downloadDoc(docId: string, name: string) {
    const r = await authedFetch(`/documents/${docId}/download`)
    if (!r.ok) return
    const blob = await r.blob(); const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }

  /* ── calculs stats ── */
  const sv = selectedVehicle
  const totalInterv = sv?.interventions.length ?? 0
  const doneInterv = sv?.interventions.filter(i => isDone(i.status)).length ?? 0
  const blockedInterv = sv?.interventions.filter(i => i.status === 'bloque').length ?? 0
  const openAlerts = sv?.alerts.filter(a => a.status === 'open').length ?? 0
  const closedAlerts = sv?.alerts.filter(a => a.status === 'closed').length ?? 0
  const totalAlerts = sv?.alerts.length ?? 0
  const totalItems = totalInterv + totalAlerts
  const doneItems = doneInterv + closedAlerts
  const progressPct = totalItems > 0 ? Math.round(doneItems / totalItems * 100) : 0
  const totalCost = sv?.interventions.reduce((s, i) => s + Number(i.costAmount ?? 0), 0) ?? 0
  const doneCost = sv?.interventions.filter(i => isDone(i.status)).reduce((s, i) => s + Number(i.costAmount ?? 0), 0) ?? 0
  const remainingCost = totalCost - doneCost
  const budgetUsedPct = budgetTarget > 0 ? Math.min(100, Math.round(totalCost / budgetTarget * 100)) : 0
  const kmVariation = sv && sv.mileageLogs.length >= 2
    ? sv.mileageLogs[0].mileage - sv.mileageLogs[sv.mileageLogs.length - 1].mileage
    : null

  /* ── filtres liste + interventions ── */
  const filteredVehicles = vehicles.filter(v => {
    const matchSearch = !searchQuery || v.name.toLowerCase().includes(searchQuery.toLowerCase())
      || (v.brand ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      || (v.registration ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    return matchSearch && (statusFilter === 'all' || v.status === statusFilter)
  })

  const filteredInterv = (sv?.interventions ?? []).filter(i =>
    intervStatusFilter === 'all' || i.status === intervStatusFilter ||
    (intervStatusFilter === 'a-faire' && i.status === 'planned') ||
    (intervStatusFilter === 'fait' && i.status === 'done')
  )

  /* ── photos / docs ── */
  const photos = sv?.documents.filter(l =>
    ['avant', 'apres', 'photo', 'travail', 'piece'].includes(l.context ?? '') ||
    l.document.mimeType.startsWith('image/')
  ) ?? []
  const otherDocs = sv?.documents.filter(l =>
    !['avant', 'apres', 'photo', 'travail', 'piece'].includes(l.context ?? '') &&
    !l.document.mimeType.startsWith('image/')
  ) ?? []

  /* ── style onglet ── */
  function tabStyle(t: Tab): React.CSSProperties {
    const active = activeTab === t
    return {
      padding: '7px 14px', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font)',
      cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
      borderBottom: active ? '2px solid var(--p1)' : '2px solid transparent',
      background: 'none', color: active ? '#c4b5fd' : 'var(--text2)', transition: 'all 0.15s',
    }
  }

  return (
    <section className="vehicles-layout">

      {/* ═══════════ LISTE ═══════════ */}
      <article className="panel">
        <div className="panel-header">
          <div><span className="panel-kicker">Garage</span><h2>Véhicules</h2></div>
          <span className="badge">{filteredVehicles.length}/{vehicles.length}</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', padding: '8px 20px 4px' }}>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Nom, marque, immat..."
            style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 10px', color: 'var(--text)', fontSize: '12px', fontFamily: 'var(--font)', outline: 'none' }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={SELECT_STYLE}>
            <option value="all">Tous</option>
            <option value="active">Actifs</option>
            <option value="repair">Réparation</option>
            <option value="parked">Garés</option>
            <option value="sold">Vendus</option>
          </select>
        </div>

        <form className="compact-form" onSubmit={handleCreateVehicle}>
          <input name="name" placeholder="Nom *" required />
          <select name="type" defaultValue="car" style={SELECT_STYLE}>
            <option value="car">Voiture</option>
            <option value="moto">Moto</option>
            <option value="truck">Camion</option>
            <option value="van">Utilitaire</option>
            <option value="other">Autre</option>
          </select>
          <select name="status" defaultValue="active" style={SELECT_STYLE}>
            <option value="active">Actif</option>
            <option value="repair">Réparation</option>
            <option value="parked">Garé</option>
            <option value="sold">Vendu</option>
          </select>
          <input name="brand" placeholder="Marque" />
          <input name="model" placeholder="Modèle" />
          <input name="year" type="number" placeholder="Année" />
          <input name="mileage" type="number" placeholder="Km initial" />
          <input name="registration" placeholder="Immatriculation" />
          <button className="primary-action" type="submit"><Car size={16} />Ajouter</button>
        </form>

        {message && <p className="form-message">{message}</p>}

        <div className="vehicle-list">
          {filteredVehicles.length === 0 ? (
            <p className="muted" style={{ padding: '0 20px' }}>Aucun véhicule.</p>
          ) : (
            filteredVehicles.map((v) => {
              const vProgress = v._count
                ? Math.round((v._count.interventions > 0 ? 0 : 0))
                : 0
              void vProgress
              return (
                <button className="vehicle-card" key={v.id}
                  onClick={() => { loadVehicleDetail(v.id); setEditMode(false); setActiveTab('resume') }}
                  style={{ borderColor: sv?.id === v.id ? 'rgba(124,58,237,0.5)' : undefined }}
                >
                  <div>
                    <strong>{v.name}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--text2)' }}>
                      {[v.brand, v.model, v.year].filter(Boolean).join(' ') || v.type}
                      {v.registration && <em style={{ marginLeft: '6px', color: 'var(--text3)', fontStyle: 'normal', fontFamily: 'var(--mono)', fontSize: '10px' }}>{v.registration}</em>}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <StatusBadge status={v.status} />
                    <span style={{ fontSize: '11px', color: 'var(--text2)' }}>{v.mileage.toLocaleString('fr-FR')} km</span>
                    {v._count && (
                      <span style={{ fontSize: '9px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                        {v._count.interventions} travaux · {v._count.alerts} alertes
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </article>

      {/* ═══════════ FICHE ═══════════ */}
      <article className="panel" style={{ overflow: 'hidden' }}>
        <div className="panel-header">
          <div><span className="panel-kicker">Fiche véhicule</span><h2>{sv?.name ?? 'Aucun véhicule sélectionné'}</h2></div>
          {sv ? (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <StatusBadge status={sv.status} />
              <button className="hdr-btn" onClick={() => setEditMode(m => !m)} title="Modifier"><Pencil size={13} /></button>
              <button className="hdr-btn" onClick={handleDeleteVehicle} style={{ color: '#f87171' }} title="Supprimer"><Trash2 size={13} /></button>
            </div>
          ) : <Gauge size={20} />}
        </div>

        {!sv && <p className="muted" style={{ padding: '20px' }}>Sélectionne un véhicule dans la liste.</p>}

        {sv && (
          <>
            {/* ── onglets ── */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingLeft: '12px', overflowX: 'auto' }}>
              <button style={tabStyle('resume')} onClick={() => setActiveTab('resume')}>Résumé</button>
              <button style={tabStyle('interventions')} onClick={() => setActiveTab('interventions')}>
                Travaux ({totalInterv}){blockedInterv > 0 ? ` ⚠` : ''}
              </button>
              <button style={tabStyle('alertes')} onClick={() => setActiveTab('alertes')}>
                Alertes ({openAlerts})
              </button>
              <button style={tabStyle('budget')} onClick={() => setActiveTab('budget')}>Budget</button>
              <button style={tabStyle('documents')} onClick={() => setActiveTab('documents')}>
                Docs & Photos ({sv.documents.length})
              </button>
              <button style={tabStyle('historique')} onClick={() => setActiveTab('historique')}>
                Historique km
              </button>
            </div>

            <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', padding: '0' }}>

              {/* ══ RÉSUMÉ ══ */}
              {activeTab === 'resume' && (
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* Édition */}
                  {editMode ? (
                    <form className="compact-form" onSubmit={handleUpdateVehicle} style={{ background: 'rgba(124,58,237,0.05)', borderRadius: '8px', border: '1px solid rgba(124,58,237,0.2)' }}>
                      <input name="name" defaultValue={sv.name} placeholder="Nom" />
                      <select name="status" defaultValue={sv.status} style={SELECT_STYLE}>
                        <option value="active">Actif</option>
                        <option value="repair">En réparation</option>
                        <option value="parked">Garé</option>
                        <option value="sold">Vendu</option>
                      </select>
                      <input name="registration" defaultValue={sv.registration ?? ''} placeholder="Immatriculation" />
                      <input name="vin" defaultValue={sv.vin ?? ''} placeholder="VIN" />
                      <input name="brand" defaultValue={sv.brand ?? ''} placeholder="Marque" />
                      <input name="model" defaultValue={sv.model ?? ''} placeholder="Modèle" />
                      <input name="year" type="number" defaultValue={sv.year ?? ''} placeholder="Année" />
                      <button className="primary-action" type="submit">Sauvegarder</button>
                      <button className="btn-ghost" type="button" onClick={() => setEditMode(false)}><X size={13} />Annuler</button>
                    </form>
                  ) : (
                    <div className="detail-grid">
                      <span>Kilométrage<strong>{sv.mileage.toLocaleString('fr-FR')} km</strong></span>
                      <span>Année<strong>{sv.year ?? '—'}</strong></span>
                      <span>Immatriculation<strong style={{ fontFamily: 'var(--mono)', fontSize: '13px' }}>{sv.registration ?? '—'}</strong></span>
                      <span>VIN<strong style={{ fontSize: '10px', fontFamily: 'var(--mono)' }}>{sv.vin ?? '—'}</strong></span>
                      <span>Marque / Modèle<strong>{[sv.brand, sv.model].filter(Boolean).join(' ') || '—'}</strong></span>
                      <span>Type<strong>{sv.type}</strong></span>
                    </div>
                  )}

                  {/* Barre de progression globale */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '12px' }}>AVANCEMENT GLOBAL</div>
                    <ProgressBar
                      value={progressPct}
                      color={progressPct >= 80 ? '#4ade80' : progressPct >= 40 ? '#fbbf24' : '#a78bfa'}
                      label={`${doneItems}/${totalItems} éléments terminés`}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '12px' }}>
                      {[
                        { label: 'Travaux faits', value: `${doneInterv}/${totalInterv}`, color: '#4ade80' },
                        { label: 'Bloqués', value: blockedInterv, color: blockedInterv > 0 ? '#f87171' : 'var(--text3)' },
                        { label: 'Alertes ouvertes', value: openAlerts, color: openAlerts > 0 ? '#fbbf24' : 'var(--text3)' },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                          <div style={{ fontSize: '18px', fontWeight: 700, color: String(s.color) }}>{s.value}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Travaux bloqués en alerte */}
                  {blockedInterv > 0 && (
                    <div style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '10px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '10px', color: '#f87171', fontFamily: 'var(--mono)', fontWeight: 700, marginBottom: '8px' }}>⚠ TRAVAUX BLOQUÉS</div>
                      {sv.interventions.filter(i => i.status === 'bloque').map(i => (
                        <div key={i.id} style={{ fontSize: '12px', color: 'var(--text)', padding: '3px 0', borderBottom: '1px solid rgba(244,63,94,0.1)' }}>
                          {i.title} {i.costAmount ? <span style={{ color: '#f87171', fontSize: '10px' }}>· {Number(i.costAmount).toFixed(0)} €</span> : null}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Résumé budget rapide */}
                  <div className="detail-grid">
                    <span>Coût total<strong style={{ color: '#f87171' }}>{totalCost.toLocaleString('fr-FR')} €</strong></span>
                    <span>Coût fait<strong style={{ color: '#4ade80' }}>{doneCost.toLocaleString('fr-FR')} €</strong></span>
                    <span>Reste à faire<strong style={{ color: '#fbbf24' }}>{remainingCost.toLocaleString('fr-FR')} €</strong></span>
                    {kmVariation !== null && <span>Km enregistrés<strong style={{ color: '#67e8f9' }}>+{kmVariation.toLocaleString('fr-FR')}</strong></span>}
                  </div>

                  {/* Maj km rapide */}
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '6px' }}>MISE À JOUR KILOMÉTRAGE</div>
                    <form className="inline-form" onSubmit={handleAddMileage}>
                      <input name="mileage" type="number" placeholder="Nouveau km *" required />
                      <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                      <button className="primary-action" type="submit">Enregistrer</button>
                    </form>
                  </div>
                </div>
              )}

              {/* ══ TRAVAUX ══ */}
              {activeTab === 'interventions' && (
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Form ajout */}
                  <form className="compact-form" onSubmit={handleAddIntervention}
                    style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <input name="title" placeholder="Titre *" required style={{ minWidth: '160px' }} />
                    <select name="status" defaultValue="a-faire" style={SELECT_STYLE}>
                      <option value="a-faire">À faire</option>
                      <option value="en-cours">En cours</option>
                      <option value="bloque">Bloqué</option>
                      <option value="fait">Fait</option>
                    </select>
                    <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                    <input name="mileage" type="number" placeholder="Km" />
                    <input name="costAmount" type="number" step="0.01" placeholder="Coût €" />
                    <input name="notes" placeholder="Notes / détails" style={{ minWidth: '160px' }} />
                    <button className="primary-action" type="submit">Ajouter</button>
                  </form>

                  {/* Filtre statut */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[
                      ['all', 'Tous', 'var(--text2)'],
                      ['a-faire', 'À faire', '#7b82a8'],
                      ['en-cours', 'En cours', '#67e8f9'],
                      ['bloque', 'Bloqué', '#f87171'],
                      ['fait', 'Fait', '#4ade80'],
                    ].map(([val, label, color]) => (
                      <button
                        key={val}
                        onClick={() => setIntervStatusFilter(val)}
                        style={{
                          padding: '4px 10px', borderRadius: '20px', border: `1px solid ${intervStatusFilter === val ? color : 'var(--border)'}`,
                          background: intervStatusFilter === val ? `${color}20` : 'none', color: intervStatusFilter === val ? color : 'var(--text3)',
                          fontSize: '11px', fontFamily: 'var(--mono)', cursor: 'pointer', fontWeight: 600,
                        }}
                      >
                        {label}
                        {val !== 'all' && (
                          <span style={{ marginLeft: '4px' }}>
                            ({sv.interventions.filter(i => {
                              if (val === 'a-faire') return i.status === 'a-faire' || i.status === 'planned'
                              if (val === 'fait') return i.status === 'fait' || i.status === 'done'
                              return i.status === val
                            }).length})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Total */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text2)', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <span>{filteredInterv.length} travaux affichés</span>
                    <span style={{ color: '#f87171', fontWeight: 600 }}>Total : {totalCost.toLocaleString('fr-FR')} €</span>
                  </div>

                  {filteredInterv.length === 0 ? (
                    <p className="muted">Aucun travail dans cette catégorie.</p>
                  ) : (
                    filteredInterv.map((i) => {
                      const s = INTERV_STATUS[i.status] ?? { color: '#7b82a8', label: i.status }
                      return (
                        <div key={i.id} style={{
                          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                          borderRadius: '10px', padding: '12px 14px',
                          borderLeft: `3px solid ${s.color}`,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>{i.title}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text3)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <span>{new Date(i.date).toLocaleDateString('fr-FR')}</span>
                                {i.mileage && <span>🔧 {Number(i.mileage).toLocaleString('fr-FR')} km</span>}
                                {i.costAmount && <span style={{ color: '#f87171', fontWeight: 600 }}>💰 {Number(i.costAmount).toFixed(2)} €</span>}
                              </div>
                              {i.notes && (
                                <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '6px', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontStyle: 'italic' }}>
                                  {i.notes}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                              {/* Statut selector rapide */}
                              <select
                                value={i.status === 'planned' ? 'a-faire' : i.status === 'done' ? 'fait' : i.status}
                                onChange={e => handleSetIntervStatus(i.id, e.target.value)}
                                style={{ ...SELECT_STYLE, fontSize: '10px', padding: '3px 6px', border: `1px solid ${s.color}40` }}
                              >
                                <option value="a-faire">À faire</option>
                                <option value="en-cours">En cours</option>
                                <option value="bloque">Bloqué</option>
                                <option value="fait">Fait</option>
                              </select>
                              <button className="btn-ghost" style={{ fontSize: '11px', padding: '3px 6px', color: '#f87171' }} onClick={() => handleDeleteIntervention(i.id)}>✕</button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* ══ ALERTES ══ */}
              {activeTab === 'alertes' && (
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <form className="compact-form" onSubmit={handleAddAlert} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <input name="title" placeholder="Titre *" required />
                    <select name="type" defaultValue="maintenance" style={SELECT_STYLE}>
                      <option value="maintenance">Maintenance</option>
                      <option value="ct">Contrôle technique</option>
                      <option value="insurance">Assurance</option>
                      <option value="tax">Taxe/Vignette</option>
                      <option value="revision">Révision</option>
                      <option value="other">Autre</option>
                    </select>
                    <input name="dueDate" type="date" />
                    <button className="primary-action" type="submit">Ajouter</button>
                  </form>

                  {sv.alerts.length === 0 ? (
                    <p className="muted">Aucune alerte.</p>
                  ) : (
                    sv.alerts.map((a) => {
                      const urg = alertUrgency(a.dueDate)
                      return (
                        <div key={a.id} style={{
                          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                          borderRadius: '10px', padding: '12px 14px',
                          borderLeft: `3px solid ${a.status === 'closed' ? 'var(--border)' : urg.color}`,
                          opacity: a.status === 'closed' ? 0.5 : 1,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{a.title}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '3px', display: 'flex', gap: '12px' }}>
                                <span style={{ fontFamily: 'var(--mono)' }}>{a.type}</span>
                                {a.dueDate && (
                                  <span style={{ color: urg.color, fontWeight: 600 }}>
                                    {new Date(a.dueDate).toLocaleDateString('fr-FR')}
                                    {urg.label && ` (${urg.label})`}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {a.status === 'open' && <button className="btn-ghost" style={{ fontSize: '10px', padding: '3px 8px' }} onClick={() => handleCloseAlert(a.id)}>Fermer</button>}
                              <button className="btn-ghost" style={{ fontSize: '11px', padding: '3px 6px', color: '#f87171' }} onClick={() => handleDeleteAlert(a.id)}>✕</button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* ══ BUDGET ══ */}
              {activeTab === 'budget' && (
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Budget cible */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '8px' }}>BUDGET CIBLE (stocké localement)</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number" step="0.01" min="0" value={budgetTarget || ''}
                        placeholder="Ex : 2000"
                        onChange={e => {
                          const v = Number(e.target.value) || 0
                          setBudgetTarget(v)
                          localStorage.setItem(`vehicle-budget-${sv.id}`, String(v))
                        }}
                        style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px', fontFamily: 'var(--font)', outline: 'none' }}
                      />
                      <span style={{ color: 'var(--text2)', fontSize: '13px' }}>€</span>
                    </div>
                    {budgetTarget > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <ProgressBar
                          value={budgetUsedPct}
                          color={budgetUsedPct >= 100 ? '#f87171' : budgetUsedPct >= 75 ? '#fbbf24' : '#4ade80'}
                          label={`${totalCost.toLocaleString('fr-FR')} € / ${budgetTarget.toLocaleString('fr-FR')} €`}
                        />
                      </div>
                    )}
                  </div>

                  {/* Synthèse */}
                  <div className="detail-grid">
                    <span>Total travaux<strong style={{ color: '#f87171' }}>{totalCost.toLocaleString('fr-FR')} €</strong></span>
                    <span>Déjà réalisé<strong style={{ color: '#4ade80' }}>{doneCost.toLocaleString('fr-FR')} €</strong></span>
                    <span>Restant estimé<strong style={{ color: '#fbbf24' }}>{remainingCost.toLocaleString('fr-FR')} €</strong></span>
                    {budgetTarget > 0 && (
                      <span>Disponible<strong style={{ color: budgetTarget - totalCost >= 0 ? '#4ade80' : '#f87171' }}>
                        {(budgetTarget - totalCost).toLocaleString('fr-FR')} €
                      </strong></span>
                    )}
                  </div>

                  {/* Répartition par statut */}
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '8px' }}>RÉPARTITION PAR STATUT</div>
                    {[
                      { key: ['a-faire', 'planned'], label: 'À faire', color: '#7b82a8' },
                      { key: ['en-cours', 'in_progress'], label: 'En cours', color: '#67e8f9' },
                      { key: ['bloque'], label: 'Bloqué', color: '#f87171' },
                      { key: ['fait', 'done'], label: 'Fait', color: '#4ade80' },
                    ].map(group => {
                      const groupInterv = sv.interventions.filter(i => group.key.includes(i.status))
                      const groupCost = groupInterv.reduce((s, i) => s + Number(i.costAmount ?? 0), 0)
                      if (groupInterv.length === 0) return null
                      return (
                        <div key={group.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', marginBottom: '4px', background: `${group.color}10`, borderRadius: '8px', border: `1px solid ${group.color}20` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: group.color }} />
                            <span style={{ fontSize: '12px', color: 'var(--text)' }}>{group.label}</span>
                            <span style={{ fontSize: '10px', color: 'var(--text3)' }}>{groupInterv.length} travaux</span>
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: group.color }}>{groupCost.toLocaleString('fr-FR')} €</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Liste détaillée */}
                  {sv.interventions.filter(i => Number(i.costAmount) > 0).length > 0 && (
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '8px' }}>DÉTAIL</div>
                      {sv.interventions.filter(i => Number(i.costAmount) > 0).sort((a, b) => Number(b.costAmount) - Number(a.costAmount)).map(i => {
                        const s = INTERV_STATUS[i.status] ?? { color: '#7b82a8', label: i.status }
                        return (
                          <div key={i.id} className="document-row">
                            <span style={{ flex: 1, fontSize: '12px' }}>{i.title}</span>
                            <IntervStatusBadge status={i.status} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: s.color }}>{Number(i.costAmount).toFixed(2)} €</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ══ DOCUMENTS & PHOTOS ══ */}
              {activeTab === 'documents' && (
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <form className="inline-form" onSubmit={handleUploadDoc} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)', padding: '12px' }}>
                    <input name="vehicleFile" type="file" />
                    <select name="vehicleFileContext" defaultValue="document" style={SELECT_STYLE}>
                      <option value="avant">📸 Photo avant</option>
                      <option value="apres">📸 Photo après</option>
                      <option value="travail">🔧 Photo travail</option>
                      <option value="piece">⚙️ Photo pièce</option>
                      <option value="document">📄 Document</option>
                      <option value="facture">🧾 Facture</option>
                      <option value="assurance">🛡 Assurance</option>
                      <option value="carte_grise">📋 Carte grise</option>
                      <option value="ct">✅ CT</option>
                    </select>
                    <input name="vehicleFileExpiresAt" type="date" title="Expiration" />
                    <button className="primary-action" type="submit"><Upload size={15} />Upload</button>
                  </form>

                  <form className="inline-form" onSubmit={handleLinkDoc}>
                    <select name="documentId" defaultValue="">
                      <option value="" disabled>Lier un document existant</option>
                      {documents.map((d) => <option value={d.id} key={d.id}>{d.name}</option>)}
                    </select>
                    <input name="context" placeholder="Contexte" defaultValue="document" />
                    <button className="btn-ghost" type="submit">Associer</button>
                  </form>

                  {/* Photos par catégorie */}
                  {['avant', 'apres', 'travail', 'piece'].map(cat => {
                    const catPhotos = sv.documents.filter(l =>
                      l.context === cat || (cat === 'avant' && !l.context && l.document.mimeType.startsWith('image/'))
                    )
                    if (catPhotos.length === 0) return null
                    const catLabel: Record<string, string> = { avant: '📸 Avant', apres: '📸 Après', travail: '🔧 Travail', piece: '⚙️ Pièce' }
                    return (
                      <div key={cat}>
                        <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '6px' }}>{catLabel[cat]} ({catPhotos.length})</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                          {catPhotos.map(link => (
                            <button key={link.id} onClick={() => downloadDoc(link.document.id, link.document.name)}
                              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 6px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '22px' }}>🖼️</span>
                              <span style={{ fontSize: '9px', color: 'var(--text3)', wordBreak: 'break-all', textAlign: 'center' }}>{link.document.name.slice(0, 18)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}

                  {/* Docs */}
                  {otherDocs.length > 0 && (
                    <>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>DOCUMENTS ({otherDocs.length})</div>
                      <div className="document-list" style={{ padding: 0 }}>
                        {otherDocs.map(link => (
                          <button className="document-row" key={link.id} onClick={() => downloadDoc(link.document.id, link.document.name)}>
                            <FileLock2 size={16} />
                            <span>{link.document.name}</span>
                            <small>{link.context ?? 'document'}</small>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {sv.documents.length === 0 && <p className="muted">Aucun document ou photo lié.</p>}
                </div>
              )}

              {/* ══ HISTORIQUE KM ══ */}
              {activeTab === 'historique' && (
                <div style={{ padding: '16px 20px' }}>
                  {sv.mileageLogs.length === 0 ? (
                    <p className="muted">Aucun historique kilométrage.</p>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px', fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', fontWeight: 700, padding: '0 4px' }}>
                        <span>DATE</span><span>KM</span><span>VARIATION</span>
                      </div>
                      {sv.mileageLogs.map((log, idx) => {
                        const prev = sv.mileageLogs[idx + 1]
                        const delta = prev ? log.mileage - prev.mileage : null
                        return (
                          <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '10px 4px', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                            <span style={{ color: 'var(--text2)', fontFamily: 'var(--mono)', fontSize: '11px' }}>{new Date(log.date).toLocaleDateString('fr-FR')}</span>
                            <span style={{ fontWeight: 600 }}>{log.mileage.toLocaleString('fr-FR')} km</span>
                            <span style={{ color: delta !== null ? '#67e8f9' : 'var(--text3)', fontSize: '11px' }}>
                              {delta !== null ? `+${delta.toLocaleString('fr-FR')} km` : '—'}
                            </span>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )}

            </div>
          </>
        )}
      </article>
    </section>
  )
}
