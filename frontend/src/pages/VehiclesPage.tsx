import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, ArrowLeft, Bell, Car, FileText,
  FileLock2, Gauge, Package, Pencil, Plus, Settings2, Trash2, TrendingUp,
  Truck, Upload, Wallet, Wrench,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { ConfirmButton } from '../components/ConfirmButton'
import { FieldTip } from '../components/FieldTip'
import { Modal } from '../components/Modal'
import { useToast } from '../contexts/ToastContext'
import { parseApiError } from '../hooks/useApiError'
import type { DocumentItem, VehicleDetail, VehicleItem, VehiclePart } from '../types'
import { generateVehiclePDF } from '../utils/pdf'

type FormEv = { preventDefault(): void; currentTarget: HTMLFormElement }
type Tab = 'resume' | 'pieces' | 'interventions' | 'alertes' | 'budget' | 'documents' | 'historique'

/* ─── constantes ─── */
const STATUS_COLORS: Record<string, { color: string; label: string }> = {
  active: { color: '#4ade80', label: 'Actif' },
  repair: { color: '#fbbf24', label: 'En réparation' },
  sold:   { color: '#f87171', label: 'Vendu' },
  parked: { color: '#7b82a8', label: 'Garé' },
}

const INTERV_STATUS: Record<string, { color: string; label: string }> = {
  'a-faire':     { color: '#7b82a8', label: 'À faire' },
  'en-cours':    { color: '#67e8f9', label: 'En cours' },
  'bloque':      { color: '#f87171', label: 'Bloqué' },
  'fait':        { color: '#4ade80', label: 'Fait' },
  'planned':     { color: '#7b82a8', label: 'À faire' },
  'done':        { color: '#4ade80', label: 'Fait' },
  'in_progress': { color: '#67e8f9', label: 'En cours' },
}

const SELECT_STYLE: React.CSSProperties = {
  background: 'rgba(12,16,41,0.95)', border: '1px solid var(--border)',
  borderRadius: '8px', color: 'var(--text)', padding: '8px 10px',
  fontSize: '12px', fontFamily: 'var(--font)',
}

const NAV_ITEMS: { tab: Tab; icon: React.ReactNode; label: string }[] = [
  { tab: 'resume',        icon: <Gauge size={16} />,         label: 'Résumé' },
  { tab: 'interventions', icon: <Wrench size={16} />,        label: 'Travaux' },
  { tab: 'pieces',        icon: <Settings2 size={16} />,     label: 'Pièces' },
  { tab: 'alertes',       icon: <Bell size={16} />,          label: 'Alertes' },
  { tab: 'budget',        icon: <Wallet size={16} />,        label: 'Budget' },
  { tab: 'documents',     icon: <FileText size={16} />,      label: 'Documents' },
  { tab: 'historique',    icon: <TrendingUp size={16} />,    label: 'Historique km' },
]

/* ─── helpers ─── */
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { color: '#7b82a8', label: status }
  return (
    <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: `${s.color}20`, color: s.color, border: `1px solid ${s.color}40` }}>
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

function alertUrgency(dueDate: string | null) {
  if (!dueDate) return { color: 'var(--text3)', label: '' }
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000)
  if (days < 0)   return { color: '#f87171', label: `Dépassée` }
  if (days <= 7)  return { color: '#f87171', label: `J-${days}` }
  if (days <= 30) return { color: '#fbbf24', label: `J-${days}` }
  return { color: '#4ade80', label: `J-${days}` }
}

function isDone(status: string) { return status === 'fait' || status === 'done' }

function VehicleTypeIcon({ type }: { type: string }) {
  const size = 28
  if (type === 'moto') return <Gauge size={size} style={{ color: 'var(--text3)' }} />
  if (type === 'truck' || type === 'van') return <Truck size={size} style={{ color: 'var(--text3)' }} />
  return <Car size={size} style={{ color: 'var(--text3)' }} />
}

/* ─── composant principal ─── */
export function VehiclesPage() {
  const { authedFetch } = useAuth()
  const toast = useToast()

  const [vehicles, setVehicles] = useState<VehicleItem[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleDetail | null>(null)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('resume')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [intervStatusFilter, setIntervStatusFilter] = useState('all')
  const [budgetTarget, setBudgetTarget] = useState(0)
  const [parts, setParts] = useState<VehiclePart[]>([])
  const [partFilter, setPartFilter] = useState('all')
  const [editingPart, setEditingPart] = useState<VehiclePart | null>(null)
  const [showAddIntervention, setShowAddIntervention] = useState(false)
  const [showAddAlert, setShowAddAlert] = useState(false)
  const [showAddPart, setShowAddPart] = useState(false)
  const [showUploadDoc, setShowUploadDoc] = useState(false)

  // S2 — Stock du user pour lier des pièces à un travail dans la modal
  // "Nouveau travail". Chargé une fois au mount via /stock/items (échoue
  // silencieusement si le module stock est désactivé pour le user).
  const [stockItems, setStockItems] = useState<{ id: string; name: string; unit: string; quantity: string }[]>([])
  const [usePartsFromStock, setUsePartsFromStock] = useState(false)
  const [stockUsages, setStockUsages] = useState<{ stockItemId: string; quantity: number }[]>([])

  const loadVehicleDetail = useCallback(async (id: string) => {
    const [vr, pr] = await Promise.all([
      authedFetch(`/vehicles/${id}`),
      authedFetch(`/vehicles/${id}/parts`),
    ])
    if (vr.ok) {
      const data = await vr.json()
      setSelectedVehicle(data)
      const stored = localStorage.getItem(`vehicle-budget-${id}`)
      setBudgetTarget(stored ? Number(stored) : 0)
    }
    if (pr.ok) setParts(await pr.json())
  }, [authedFetch])

  const reload = useCallback(async () => {
    const [vr, dr] = await Promise.all([authedFetch('/vehicles'), authedFetch('/documents')])
    if (vr.ok) setVehicles(await vr.json())
    if (dr.ok) { const d = await dr.json(); setDocuments(d.data ?? d) }
  }, [authedFetch])

  useEffect(() => {
    async function load() {
      const [vr, dr, sr] = await Promise.all([
        authedFetch('/vehicles'),
        authedFetch('/documents'),
        // /stock/items renvoie 403 si le module stock est désactivé → on
        // ignore silencieusement et stockItems reste vide (la checkbox
        // "Inclure des pièces du stock" sera juste masquée).
        authedFetch('/stock/items'),
      ])
      if (vr.ok) setVehicles(await vr.json())
      if (dr.ok) { const d = await dr.json(); setDocuments(d.data ?? d) }
      if (sr.ok) setStockItems(await sr.json())
    }
    load()
  }, [authedFetch])

  /* ── handlers CRUD ── */
  async function handleCreateVehicle(event: FormEv) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const r = await authedFetch('/vehicles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name'), type: data.get('type'), status: data.get('status'),
        brand: data.get('brand') || undefined, model: data.get('model') || undefined,
        year: data.get('year') ? Number(data.get('year')) : undefined,
        mileage: data.get('mileage') ? Number(data.get('mileage')) : 0,
        registration: data.get('registration') || undefined,
        fuelType: data.get('fuelType') || undefined,
        color: data.get('color') || undefined,
        power: data.get('power') ? Number(data.get('power')) : undefined,
        purchaseDate: data.get('purchaseDate') || undefined,
        purchasePrice: data.get('purchasePrice') ? Number(data.get('purchasePrice')) : undefined,
        insuranceExpiry: data.get('insuranceExpiry') || undefined,
        ctExpiry: data.get('ctExpiry') || undefined,
        notes: data.get('notes') || undefined,
      }),
    })
    if (!r.ok) { toast.err('Création refusée.'); return }
    const created = await r.json()
    form.reset(); setShowCreateForm(false); toast.ok('Véhicule créé.')
    await reload()
    await loadVehicleDetail(created.id)
    setView('detail'); setActiveTab('resume')
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
        fuelType: data.get('fuelType') || undefined,
        color: data.get('color') || undefined,
        power: data.get('power') ? Number(data.get('power')) : undefined,
        purchaseDate: data.get('purchaseDate') || undefined,
        purchasePrice: data.get('purchasePrice') ? Number(data.get('purchasePrice')) : undefined,
        insuranceExpiry: data.get('insuranceExpiry') || undefined,
        ctExpiry: data.get('ctExpiry') || undefined,
        notes: data.get('notes') || undefined,
      }),
    })
    if (!r.ok) { toast.err('Mise à jour refusée.'); return }
    setEditMode(false); toast.ok('Véhicule mis à jour.')
    await reload(); await loadVehicleDetail(selectedVehicle.id)
  }

  async function handleDeleteVehicle() {
    if (!selectedVehicle) return
    if (!window.confirm(`Supprimer "${selectedVehicle.name}" ?`)) return
    await authedFetch(`/vehicles/${selectedVehicle.id}`, { method: 'DELETE' })
    toast.ok('Véhicule supprimé.')
    setSelectedVehicle(null); setView('list'); await reload()
  }

  async function handleAddMileage(event: FormEv) {
    event.preventDefault(); if (!selectedVehicle) return
    const form = event.currentTarget; const data = new FormData(form)
    const r = await authedFetch(`/vehicles/${selectedVehicle.id}/mileage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mileage: Number(data.get('mileage')), date: data.get('date') }),
    })
    if (!r.ok) { toast.err(await parseApiError(r, 'Kilométrage refusé.')); return }
    form.reset(); toast.ok('Kilométrage enregistré.'); await loadVehicleDetail(selectedVehicle.id)
  }

  async function handleAddIntervention(event: FormEv) {
    event.preventDefault(); if (!selectedVehicle) return
    const form = event.currentTarget; const data = new FormData(form)

    // S2 — si l'utilisateur a coché "Inclure des pièces du stock", on
    // envoie le tableau stockUsages au backend. La validation côté front
    // (pièce sélectionnée + quantité >0) est faite en amont via l'UI ;
    // une qty invalide est rejetée par le backend avec un message clair.
    const usagesPayload = usePartsFromStock
      ? stockUsages.filter(u => u.stockItemId && u.quantity > 0)
      : []

    const r = await authedFetch(`/vehicles/${selectedVehicle.id}/interventions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.get('title'), date: data.get('date'),
        mileage: data.get('mileage') ? Number(data.get('mileage')) : undefined,
        costAmount: data.get('costAmount') ? Number(data.get('costAmount')) : undefined,
        notes: data.get('notes') || undefined,
        status: data.get('status') || 'a-faire',
        stockUsages: usagesPayload.length > 0 ? usagesPayload : undefined,
      }),
    })
    if (!r.ok) { toast.err(await parseApiError(r, 'Création du travail refusée.')); return }
    form.reset()
    setShowAddIntervention(false)
    setUsePartsFromStock(false)
    setStockUsages([])
    toast.ok(usagesPayload.length > 0
      ? `Travail ajouté (${usagesPayload.length} pièce${usagesPayload.length > 1 ? 's' : ''} du stock consommée${usagesPayload.length > 1 ? 's' : ''}).`
      : 'Travail ajouté.',
    )
    await loadVehicleDetail(selectedVehicle.id)
  }

  async function handleSetIntervStatus(interventionId: string, status: string) {
    if (!selectedVehicle) return
    const r = await authedFetch(`/vehicles/${selectedVehicle.id}/interventions/${interventionId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!r.ok) { toast.err(await parseApiError(r, 'Changement de statut refusé.')); return }
    await loadVehicleDetail(selectedVehicle.id)
  }

  async function handleDeleteIntervention(id: string) {
    if (!selectedVehicle) return
    const r = await authedFetch(`/vehicles/${selectedVehicle.id}/interventions/${id}`, { method: 'DELETE' })
    if (!r.ok) { toast.err(await parseApiError(r, 'Suppression refusée.')); return }
    await loadVehicleDetail(selectedVehicle.id)
  }

  async function handleAddPart(event: FormEv) {
    event.preventDefault(); if (!selectedVehicle) return
    const form = event.currentTarget; const data = new FormData(form)
    const r = await authedFetch(`/vehicles/${selectedVehicle.id}/parts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name'),
        quantity: data.get('quantity') ? Number(data.get('quantity')) : 1,
        category: data.get('category') || 'autre',
        status: data.get('status') || 'a-acheter',
        urgency: data.get('urgency') || 'normal',
        priority: data.get('priority') || 'fiabilite',
        reference: data.get('reference') || undefined,
        dimension: data.get('dimension') || undefined,
        estimatedPrice: data.get('estimatedPrice') ? Number(data.get('estimatedPrice')) : undefined,
        realPrice: data.get('realPrice') ? Number(data.get('realPrice')) : undefined,
        link: data.get('link') || undefined,
        comment: data.get('comment') || undefined,
      }),
    })
    if (!r.ok) { toast.err(await parseApiError(r, 'Ajout de la pièce refusé.')); return }
    form.reset(); setShowAddPart(false); toast.ok('Pièce ajoutée.')
    const pr = await authedFetch(`/vehicles/${selectedVehicle.id}/parts`); if (pr.ok) setParts(await pr.json())
  }

  async function handleUpdatePart(event: FormEv, partId: string) {
    event.preventDefault(); if (!selectedVehicle) return
    const form = event.currentTarget; const data = new FormData(form)
    const r = await authedFetch(`/vehicles/${selectedVehicle.id}/parts/${partId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name') || undefined,
        quantity: data.get('quantity') ? Number(data.get('quantity')) : undefined,
        category: data.get('category') || undefined,
        status: data.get('status') || undefined,
        urgency: data.get('urgency') || undefined,
        reference: data.get('reference') || undefined,
        estimatedPrice: data.get('estimatedPrice') ? Number(data.get('estimatedPrice')) : undefined,
        realPrice: data.get('realPrice') ? Number(data.get('realPrice')) : undefined,
        link: data.get('link') || undefined,
        comment: data.get('comment') || undefined,
      }),
    })
    if (!r.ok) { toast.err(await parseApiError(r, 'Mise à jour refusée.')); return }
    setEditingPart(null); toast.ok('Pièce mise à jour.')
    const pr = await authedFetch(`/vehicles/${selectedVehicle.id}/parts`)
    if (pr.ok) setParts(await pr.json())
  }

  async function handlePartStatus(partId: string, status: string) {
    if (!selectedVehicle) return
    const r = await authedFetch(`/vehicles/${selectedVehicle.id}/parts/${partId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!r.ok) { toast.err(await parseApiError(r, 'Changement de statut refusé.')); return }
    const pr = await authedFetch(`/vehicles/${selectedVehicle.id}/parts`)
    if (pr.ok) setParts(await pr.json())
  }

  async function handleDeletePart(partId: string) {
    if (!selectedVehicle) return
    const r = await authedFetch(`/vehicles/${selectedVehicle.id}/parts/${partId}`, { method: 'DELETE' })
    if (!r.ok) { toast.err(await parseApiError(r, 'Suppression refusée.')); return }
    setParts(p => p.filter(x => x.id !== partId))
    toast.ok('Pièce supprimée.')
  }

  async function handleAddAlert(event: FormEv) {
    event.preventDefault(); if (!selectedVehicle) return
    const form = event.currentTarget; const data = new FormData(form)
    const r = await authedFetch(`/vehicles/${selectedVehicle.id}/alerts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: data.get('type'), title: data.get('title'), dueDate: data.get('dueDate') || undefined }),
    })
    if (!r.ok) { toast.err(await parseApiError(r, 'Création de l\'alerte refusée.')); return }
    form.reset(); setShowAddAlert(false); toast.ok('Alerte créée.'); await loadVehicleDetail(selectedVehicle.id)
  }

  async function handleCloseAlert(alertId: string) {
    if (!selectedVehicle) return
    const r = await authedFetch(`/vehicles/${selectedVehicle.id}/alerts/${alertId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    })
    if (!r.ok) { toast.err(await parseApiError(r, 'Fermeture refusée.')); return }
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
    const file = input.files?.[0]; if (!file) { toast.err('Sélectionne un fichier.'); return }
    const body = new FormData(); body.append('file', file)
    const expiresAt = (form.elements.namedItem('vehicleFileExpiresAt') as HTMLInputElement).value
    if (expiresAt) body.append('expiresAt', expiresAt)
    const context = (form.elements.namedItem('vehicleFileContext') as HTMLInputElement).value
    const upload = await authedFetch('/documents', { method: 'POST', body })
    if (!upload.ok) { toast.err(await parseApiError(upload, 'Upload du document refusé.')); return }
    const doc = await upload.json()
    const link = await authedFetch(`/vehicles/${selectedVehicle.id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: doc.id, context: context || (file.type.startsWith('image/') ? 'avant' : 'document') }),
    })
    if (!link.ok) { toast.err(await parseApiError(link, 'Liaison au véhicule refusée.')); return }
    form.reset(); setShowUploadDoc(false); toast.ok('Document ajouté.'); await reload(); await loadVehicleDetail(selectedVehicle.id)
  }

  async function handleLinkDoc(event: FormEv) {
    event.preventDefault(); if (!selectedVehicle) return
    const form = event.currentTarget; const data = new FormData(form)
    const documentId = data.get('documentId'); if (!documentId) { toast.err('Sélectionne un document.'); return }
    const r = await authedFetch(`/vehicles/${selectedVehicle.id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId, context: data.get('context') || 'document' }),
    })
    if (!r.ok) { toast.err(await parseApiError(r, 'Liaison refusée.')); return }
    form.reset(); toast.ok('Document associé.'); await loadVehicleDetail(selectedVehicle.id)
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
  const toOrder    = parts.filter(p => p.status === 'a-acheter').length
  const ordered    = parts.filter(p => p.status === 'commande').length
  const received   = parts.filter(p => p.status === 'recu').length
  const mounted    = parts.filter(p => p.status === 'monte').length
  const blocking   = parts.filter(p => p.urgency === 'bloquant' && p.status !== 'monte').length
  const estimatedPartsCost = parts.reduce((s, p) => s + Number(p.estimatedPrice ?? 0) * p.quantity, 0)
  const realPartsCost      = parts.reduce((s, p) => s + Number(p.realPrice ?? 0) * p.quantity, 0)
  const filteredParts = partFilter === 'all' ? parts : parts.filter(p => p.status === partFilter)

  const totalInterv   = sv?.interventions.length ?? 0
  const doneInterv    = sv?.interventions.filter(i => isDone(i.status)).length ?? 0
  const blockedInterv = sv?.interventions.filter(i => i.status === 'bloque').length ?? 0
  const openAlerts    = sv?.alerts.filter(a => a.status === 'open').length ?? 0
  const totalItems    = totalInterv + (sv?.alerts.length ?? 0)
  const doneItems     = doneInterv + (sv?.alerts.filter(a => a.status === 'closed').length ?? 0)
  const progressPct   = totalItems > 0 ? Math.round(doneItems / totalItems * 100) : 0
  const totalCost     = sv?.interventions.reduce((s, i) => s + Number(i.costAmount ?? 0), 0) ?? 0
  const doneCost      = sv?.interventions.filter(i => isDone(i.status)).reduce((s, i) => s + Number(i.costAmount ?? 0), 0) ?? 0
  const remainingCost = totalCost - doneCost
  const budgetUsedPct = budgetTarget > 0 ? Math.min(100, Math.round(totalCost / budgetTarget * 100)) : 0
  const kmVariation   = sv && sv.mileageLogs.length >= 2
    ? sv.mileageLogs[0].mileage - sv.mileageLogs[sv.mileageLogs.length - 1].mileage
    : null

  const filteredVehicles = vehicles.filter(v => {
    const matchSearch = !searchQuery
      || v.name.toLowerCase().includes(searchQuery.toLowerCase())
      || (v.brand ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      || (v.registration ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    return matchSearch && (statusFilter === 'all' || v.status === statusFilter)
  })

  const filteredInterv = (sv?.interventions ?? []).filter(i =>
    intervStatusFilter === 'all' || i.status === intervStatusFilter
    || (intervStatusFilter === 'a-faire' && i.status === 'planned')
    || (intervStatusFilter === 'fait' && i.status === 'done')
  )

  // Tout ce qui n'est PAS dans une catégorie photo va dans "Documents",
  // y compris les images uploadées avec un context non-photo (ex : photo
  // d'une carte grise scannée avec context='carte_grise'). Sans cette
  // inclusion, ces images disparaissaient complètement de la liste.
  const otherDocs = sv?.documents.filter(l =>
    !['avant', 'apres', 'photo', 'travail', 'piece'].includes(l.context ?? '')
  ) ?? []

  const statusColors: Record<string, string> = { 'a-acheter': '#f87171', commande: '#fbbf24', recu: '#67e8f9', monte: '#4ade80', 'a-verifier': '#a78bfa' }
  const statusLabels: Record<string, string> = { 'a-acheter': 'À acheter', commande: 'Commandé', recu: 'Reçu', monte: 'Monté', 'a-verifier': 'À vérifier' }

  /* ══════════════════════════════════════════════════
     VUE LISTE
  ══════════════════════════════════════════════════ */
  if (view === 'list') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── En-tête ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Garage</span>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: '2px 0 0' }}>Véhicules & Atelier</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-ghost" style={{ fontSize: '12px' }} onClick={async () => { const r = await authedFetch('/vehicles/export.csv'); if (!r.ok) return; const blob = await r.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `vehicules_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url); }}>⬇ CSV</button>
          <button
            className="primary-action"
            onClick={() => setShowCreateForm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={15} /> Ajouter un véhicule
          </button>
        </div>
      </div>

      <Modal open={showCreateForm} onClose={() => setShowCreateForm(false)} title="Nouveau véhicule" subtitle="Renseignez les informations de votre véhicule" icon={<Car size={20} />} maxWidth={640}>
        <form onSubmit={handleCreateVehicle}>
          <div className="modal-grid">
            <FieldTip label="Nom du véhicule" hint="Donnez un nom court et mémorable : 'Clio du quotidien', 'BMW projet'. C'est le nom affiché partout dans l'appli." required style={{ gridColumn: '1/-1' }}>
              <input name="name" required className="modal-input" placeholder="Ex : Renault Clio, BMW 320d…" style={{ width: '100%', boxSizing: 'border-box' }} />
            </FieldTip>
            <FieldTip label="Type" hint="La catégorie du véhicule — influence l'icône affichée et certaines statistiques.">
              <select name="type" defaultValue="car" className="modal-select">
                <option value="car">🚗 Voiture</option>
                <option value="moto">🏍 Moto</option>
                <option value="truck">🚚 Camion</option>
                <option value="van">🚐 Utilitaire</option>
                <option value="other">Autre</option>
              </select>
            </FieldTip>
            <FieldTip label="Statut" hint="L'état opérationnel actuel. 'Actif' = en service quotidien. 'En réparation' = immobilisé au garage. Modifiable à tout moment.">
              <select name="status" defaultValue="active" className="modal-select">
                <option value="active">Actif</option>
                <option value="repair">En réparation</option>
                <option value="parked">Garé</option>
                <option value="sold">Vendu</option>
              </select>
            </FieldTip>
            <FieldTip label="Marque" hint="Ex : Renault, BMW, Honda… Utilisé pour les recherches et affiché dans la fiche.">
              <input name="brand" className="modal-input" placeholder="Ex : Renault" />
            </FieldTip>
            <FieldTip label="Modèle" hint="Ex : Clio, 320d, CB500F… Affiché avec la marque dans les détails.">
              <input name="model" className="modal-input" placeholder="Ex : Clio" />
            </FieldTip>
            <FieldTip label="Année" hint="L'année de fabrication ou mise en circulation. Utile pour estimer la valeur et anticiper les révisions.">
              <input name="year" type="number" className="modal-input" placeholder="Ex : 2018" min={1900} max={2030} />
            </FieldTip>
            <FieldTip label="Kilométrage initial" hint="Le kilométrage au moment où vous ajoutez le véhicule. Sert de point de départ pour le suivi des km.">
              <input name="mileage" type="number" className="modal-input" placeholder="Ex : 45000" />
            </FieldTip>
            <FieldTip label="Immatriculation" hint="La plaque d'immatriculation officielle. Pratique pour retrouver rapidement les docs administratifs.">
              <input name="registration" className="modal-input" placeholder="Ex : AB-123-CD" />
            </FieldTip>
            <FieldTip label="Carburant" hint="Le type d'énergie. Renseigné ici, il apparaît dans la fiche récapitulative et le suivi des dépenses.">
              <select name="fuelType" defaultValue="" className="modal-select">
                <option value="">— Carburant —</option>
                <option value="essence">⛽ Essence</option>
                <option value="diesel">🛢 Diesel</option>
                <option value="electrique">⚡ Électrique</option>
                <option value="hybride">🔋 Hybride</option>
                <option value="gpl">🔵 GPL</option>
              </select>
            </FieldTip>
            <FieldTip label="Couleur" hint="Purement descriptif, pratique si vous gérez plusieurs véhicules similaires.">
              <input name="color" className="modal-input" placeholder="Ex : Blanc nacré" />
            </FieldTip>
            <FieldTip label="Puissance (CV)" hint="Puissance en chevaux. Indicatif, utile pour certaines déclarations ou comparaisons.">
              <input name="power" type="number" className="modal-input" placeholder="Ex : 110" />
            </FieldTip>
            <FieldTip label="Prix d'achat (€)" hint="Montant payé lors de l'acquisition. Sert à calculer le coût total de possession dans l'onglet Budget.">
              <input name="purchasePrice" type="number" step="0.01" className="modal-input" placeholder="Ex : 12000" />
            </FieldTip>
            <FieldTip label="Date d'achat" hint="La date d'acquisition. Permet de calculer l'ancienneté et de contextualiser les dépenses.">
              <input name="purchaseDate" type="date" className="modal-input" />
            </FieldTip>
            <FieldTip label="Fin d'assurance" hint="Date d'expiration de l'assurance. Une alerte apparaîtra à l'approche de l'échéance.">
              <input name="insuranceExpiry" type="date" className="modal-input" />
            </FieldTip>
            <FieldTip label="Fin du contrôle technique" hint="Date d'expiration du CT. Vous serez alerté avant la date limite pour ne pas oublier de le renouveler.">
              <input name="ctExpiry" type="date" className="modal-input" />
            </FieldTip>
            <FieldTip label="Notes" hint="Tout ce que vous voulez noter : particularités techniques, historique, rappels personnels…" style={{ gridColumn: '1/-1' }}>
              <textarea name="notes" className="modal-input" rows={3} placeholder="Notes libres, contexte, particularités du véhicule…" style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
            </FieldTip>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={() => setShowCreateForm(false)}>Annuler</button>
            <button type="submit" className="primary-action"><Car size={15} /> Créer le véhicule</button>
          </div>
        </form>
      </Modal>

      {/* ── Filtres ── */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Rechercher nom, marque, immat..."
          style={{ flex: 1, minWidth: 'min(200px, 100%)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text)', fontSize: '13px', fontFamily: 'var(--font)', outline: 'none' }}
        />
        {(['all', 'active', 'repair', 'parked', 'sold'] as const).map(s => {
          const label = s === 'all' ? 'Tous' : STATUS_COLORS[s]?.label ?? s
          const color = s === 'all' ? 'var(--text2)' : STATUS_COLORS[s]?.color ?? 'var(--text2)'
          return (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '7px 14px', borderRadius: '20px', border: `1px solid ${statusFilter === s ? color : 'var(--border)'}`,
              background: statusFilter === s ? `${color}18` : 'none', color: statusFilter === s ? color : 'var(--text3)',
              fontSize: '12px', fontFamily: 'var(--mono)', cursor: 'pointer', fontWeight: 600,
            }}>{label}</button>
          )
        })}
      </div>

      {/* ── Grille de cartes ── */}
      {filteredVehicles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
          <Car size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <p style={{ fontSize: '14px' }}>{searchQuery ? 'Aucun résultat.' : 'Aucun véhicule — ajoute-en un !'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {filteredVehicles.map((v) => {
            const sc = STATUS_COLORS[v.status] ?? { color: '#7b82a8', label: v.status }
            const hasAlerts = (v._count?.alerts ?? 0) > 0
            return (
              <button
                key={v.id}
                onClick={async () => {
                  await loadVehicleDetail(v.id)
                  setView('detail'); setActiveTab('resume'); setEditMode(false)
                }}
                style={{
                  background: 'var(--card)', border: `1px solid var(--border)`,
                  borderRadius: '16px', padding: '0', cursor: 'pointer', textAlign: 'left',
                  overflow: 'hidden', transition: 'border-color 0.15s, transform 0.1s',
                  borderTop: `3px solid ${sc.color}`,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = sc.color; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = 'none' }}
              >
                {/* Haut de la carte */}
                <div style={{ padding: '20px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <VehicleTypeIcon type={v.type} />
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{v.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '1px' }}>
                          {[v.brand, v.model, v.year].filter(Boolean).join(' ') || v.type}
                        </div>
                      </div>
                    </div>
                    {v.registration && (
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text3)', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        {v.registration}
                      </span>
                    )}
                  </div>
                  <StatusBadge status={v.status} />
                </div>

                {/* Bas de la carte */}
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text2)', fontSize: '12px' }}>
                    <Gauge size={13} />
                    <span style={{ fontWeight: 600 }}>{v.mileage.toLocaleString('fr-FR')} km</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text3)' }}>
                    {v._count && (
                      <>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Wrench size={11} /> {v._count.interventions}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: hasAlerts ? '#fbbf24' : 'var(--text3)' }}>
                          <Bell size={11} /> {v._count.alerts}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  /* ══════════════════════════════════════════════════
     VUE DÉTAIL
  ══════════════════════════════════════════════════ */
  if (!sv) return (
    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text3)' }}>
      <p>Chargement...</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0' }}>

      {/* ── Header fiche ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 0 20px', flexWrap: 'wrap' }}>
        <button
          onClick={() => { setView('list'); setEditMode(false) }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 14px', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer' }}
        >
          <ArrowLeft size={14} /> Véhicules
        </button>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase' }}>Fiche véhicule</span>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '2px 0 0' }}>{sv.name}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StatusBadge status={sv.status} />
          <button className="hdr-btn" onClick={() => setEditMode(m => !m)} title="Modifier"><Pencil size={13} /></button>
          <button className="btn-ghost" style={{ fontSize: '12px' }} title="Exporter PDF" onClick={() => generateVehiclePDF(sv)}>📄 PDF</button>
          <ConfirmButton onConfirm={handleDeleteVehicle} confirmLabel="Supprimer ?" />
        </div>
      </div>

      {/* ── Layout sidebar + contenu ── */}
      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>

        {/* ── Navigation verticale ── */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '160px', flexShrink: 0 }}>
          {NAV_ITEMS.map(({ tab, icon, label }) => {
            const active = activeTab === tab
            let badge = 0
            if (tab === 'interventions') badge = blockedInterv
            if (tab === 'pieces')        badge = blocking
            if (tab === 'alertes')       badge = openAlerts
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  background: active ? 'rgba(124,58,237,0.18)' : 'none',
                  color: active ? '#c4b5fd' : 'var(--text2)',
                  fontSize: '13px', fontWeight: active ? 600 : 400,
                  textAlign: 'left', transition: 'all 0.12s', position: 'relative',
                }}
              >
                {icon}
                <span style={{ flex: 1 }}>{label}</span>
                {badge > 0 && (
                  <span style={{ fontSize: '9px', background: '#f87171', color: '#fff', borderRadius: '20px', padding: '1px 5px', fontWeight: 700 }}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* ── Contenu ── */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px' }}>

          {/* ══ RÉSUMÉ ══ */}
          {activeTab === 'resume' && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <Modal open={editMode} onClose={() => setEditMode(false)} title="Modifier le véhicule" subtitle={sv.name} icon={<Pencil size={20} />} maxWidth={640}>
                <form onSubmit={handleUpdateVehicle}>
                  <div className="modal-grid">
                    <FieldTip label="Nom" hint="Le nom affiché partout dans l'appli. Peut être un surnom : 'Clio du boulot', 'BMW projet'." required>
                      <input name="name" defaultValue={sv.name} required className="modal-input" placeholder="Nom du véhicule" />
                    </FieldTip>
                    <FieldTip label="Marque" hint="Ex : Renault, BMW, Honda…">
                      <input name="brand" defaultValue={sv.brand ?? ''} className="modal-input" placeholder="Marque" />
                    </FieldTip>
                    <FieldTip label="Modèle" hint="Ex : Clio, 320d, CB500F…">
                      <input name="model" defaultValue={sv.model ?? ''} className="modal-input" placeholder="Modèle" />
                    </FieldTip>
                    <FieldTip label="Immatriculation" hint="La plaque d'immatriculation officielle, format libre.">
                      <input name="registration" defaultValue={sv.registration ?? ''} className="modal-input" placeholder="AB-123-CD" />
                    </FieldTip>
                    <FieldTip label="VIN" hint="Numéro d'identification du véhicule (châssis). 17 caractères, visible sur la carte grise.">
                      <input name="vin" defaultValue={sv.vin ?? ''} className="modal-input" placeholder="VIN / Châssis" />
                    </FieldTip>
                    <FieldTip label="Année" hint="Année de fabrication ou de mise en circulation.">
                      <input name="year" type="number" defaultValue={sv.year ?? ''} className="modal-input" placeholder="Ex : 2018" />
                    </FieldTip>
                    <FieldTip label="Couleur" hint="Couleur de la carrosserie. Purement descriptif.">
                      <input name="color" defaultValue={sv.color ?? ''} className="modal-input" placeholder="Ex : Blanc nacré" />
                    </FieldTip>
                    <FieldTip label="Puissance (CV)" hint="Puissance en chevaux. Indicatif, peut être utile pour certaines déclarations.">
                      <input name="power" type="number" defaultValue={sv.power ?? ''} className="modal-input" placeholder="Ex : 110" />
                    </FieldTip>
                    <FieldTip label="Prix d'achat (€)" hint="Montant payé à l'acquisition. Sert dans le calcul du coût total de possession.">
                      <input name="purchasePrice" type="number" step="0.01" defaultValue={sv.purchasePrice ?? ''} className="modal-input" placeholder="Ex : 12000" />
                    </FieldTip>
                    <FieldTip label="Date d'achat" hint="La date à laquelle vous avez acquis ce véhicule.">
                      <input name="purchaseDate" type="date" defaultValue={sv.purchaseDate ? sv.purchaseDate.slice(0,10) : ''} className="modal-input" />
                    </FieldTip>
                    <FieldTip label="Fin d'assurance" hint="Date d'expiration de l'assurance. Une alerte apparaîtra à l'approche de l'échéance.">
                      <input name="insuranceExpiry" type="date" defaultValue={sv.insuranceExpiry ? sv.insuranceExpiry.slice(0,10) : ''} className="modal-input" />
                    </FieldTip>
                    <FieldTip label="Fin du CT" hint="Date d'expiration du contrôle technique. Vous serez alerté avant la limite.">
                      <input name="ctExpiry" type="date" defaultValue={sv.ctExpiry ? sv.ctExpiry.slice(0,10) : ''} className="modal-input" />
                    </FieldTip>
                    <FieldTip label="Carburant" hint="Le type d'énergie utilisé par le véhicule.">
                      <select name="fuelType" defaultValue={sv.fuelType ?? ''} className="modal-select">
                        <option value="">—</option>
                        <option value="essence">⛽ Essence</option>
                        <option value="diesel">🛢 Diesel</option>
                        <option value="electrique">⚡ Électrique</option>
                        <option value="hybride">🔋 Hybride</option>
                        <option value="gpl">🔵 GPL</option>
                      </select>
                    </FieldTip>
                    <FieldTip label="Statut" hint="L'état opérationnel actuel. Affecte les filtres et l'affichage dans la liste.">
                      <select name="status" defaultValue={sv.status} className="modal-select">
                        <option value="active">Actif</option>
                        <option value="repair">En réparation</option>
                        <option value="parked">Garé</option>
                        <option value="sold">Vendu</option>
                      </select>
                    </FieldTip>
                    <FieldTip label="Notes" hint="Tout ce que vous voulez noter : particularités, historique, rappels…" style={{ gridColumn: '1/-1' }}>
                      <textarea name="notes" defaultValue={sv.notes ?? ''} rows={3} className="modal-input" placeholder="Notes générales…" style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
                    </FieldTip>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn-ghost" onClick={() => setEditMode(false)}>Annuler</button>
                    <button type="submit" className="primary-action">Sauvegarder</button>
                  </div>
                </form>
              </Modal>

              <div className="detail-grid">
                <span>Kilométrage<strong>{sv.mileage.toLocaleString('fr-FR')} km</strong></span>
                <span>Année<strong>{sv.year ?? '—'}</strong></span>
                <span>Immatriculation<strong style={{ fontFamily: 'var(--mono)' }}>{sv.registration ?? '—'}</strong></span>
                <span>Carburant<strong>{sv.fuelType ? { essence:'⛽ Essence', diesel:'🛢 Diesel', electrique:'⚡ Électrique', hybride:'🔋 Hybride', gpl:'🔵 GPL' }[sv.fuelType] ?? sv.fuelType : '—'}</strong></span>
                <span>Marque / Modèle<strong>{[sv.brand, sv.model].filter(Boolean).join(' ') || '—'}</strong></span>
                <span>Puissance<strong>{sv.power ? `${sv.power} CV` : '—'}</strong></span>
                <span>Couleur<strong>{sv.color ?? '—'}</strong></span>
                <span>VIN<strong style={{ fontSize: '10px', fontFamily: 'var(--mono)' }}>{sv.vin ?? '—'}</strong></span>
                <span>Prix d'achat<strong>{sv.purchasePrice ? `${Number(sv.purchasePrice).toLocaleString('fr-FR')} €` : '—'}</strong></span>
                <span>Date d'achat<strong>{sv.purchaseDate ? new Date(sv.purchaseDate).toLocaleDateString('fr-FR') : '—'}</strong></span>
                {sv.insuranceExpiry && (
                  <span>Fin assurance<strong style={{ color: new Date(sv.insuranceExpiry) < new Date(Date.now() + 30*864e5) ? '#f87171' : 'var(--text)' }}>
                    {new Date(sv.insuranceExpiry).toLocaleDateString('fr-FR')}
                    {new Date(sv.insuranceExpiry) < new Date() ? ' ⚠ EXPIRÉE' : new Date(sv.insuranceExpiry) < new Date(Date.now() + 30*864e5) ? ' ⚠ bientôt' : ''}
                  </strong></span>
                )}
                {sv.ctExpiry && (
                  <span>Fin CT<strong style={{ color: new Date(sv.ctExpiry) < new Date(Date.now() + 30*864e5) ? '#f87171' : 'var(--text)' }}>
                    {new Date(sv.ctExpiry).toLocaleDateString('fr-FR')}
                    {new Date(sv.ctExpiry) < new Date() ? ' ⚠ EXPIRÉ' : new Date(sv.ctExpiry) < new Date(Date.now() + 30*864e5) ? ' ⚠ bientôt' : ''}
                  </strong></span>
                )}
              </div>
              {sv.notes && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', color: 'var(--text2)', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                  {sv.notes}
                </div>
              )}

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '12px' }}>AVANCEMENT GLOBAL</div>
                <ProgressBar value={progressPct} color={progressPct >= 80 ? '#4ade80' : progressPct >= 40 ? '#fbbf24' : '#a78bfa'} label={`${doneItems}/${totalItems} éléments terminés`} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', marginTop: '12px' }}>
                  {[
                    { label: 'Travaux faits', value: `${doneInterv}/${totalInterv}`, color: '#4ade80' },
                    { label: 'Bloqués',       value: blockedInterv, color: blockedInterv > 0 ? '#f87171' : 'var(--text3)' },
                    { label: 'Alertes open',  value: openAlerts,    color: openAlerts > 0 ? '#fbbf24' : 'var(--text3)' },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: String(s.color) }}>{s.value}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {blockedInterv > 0 && (
                <div style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', color: '#f87171', fontFamily: 'var(--mono)', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={12} /> TRAVAUX BLOQUÉS
                  </div>
                  {sv.interventions.filter(i => i.status === 'bloque').map(i => (
                    <div key={i.id} style={{ fontSize: '12px', color: 'var(--text)', padding: '3px 0', borderBottom: '1px solid rgba(244,63,94,0.1)' }}>
                      {i.title} {i.costAmount ? <span style={{ color: '#f87171', fontSize: '10px' }}>· {Number(i.costAmount).toFixed(0)} €</span> : null}
                    </div>
                  ))}
                </div>
              )}

              <div className="detail-grid">
                <span>Coût total<strong style={{ color: '#f87171' }}>{totalCost.toLocaleString('fr-FR')} €</strong></span>
                <span>Déjà réalisé<strong style={{ color: '#4ade80' }}>{doneCost.toLocaleString('fr-FR')} €</strong></span>
                <span>Reste à faire<strong style={{ color: '#fbbf24' }}>{remainingCost.toLocaleString('fr-FR')} €</strong></span>
                {kmVariation !== null && <span>Km enregistrés<strong style={{ color: '#67e8f9' }}>+{kmVariation.toLocaleString('fr-FR')}</strong></span>}
              </div>

              <div>
                <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '8px' }}>MISE À JOUR KILOMÉTRAGE</div>
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
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>Travaux & interventions</span>
                <button className="primary-action" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }} onClick={() => setShowAddIntervention(true)}>
                  <Plus size={13} /> Ajouter un travail
                </button>
              </div>
              <Modal open={showAddIntervention} onClose={() => setShowAddIntervention(false)} title="Nouvelle intervention" subtitle={sv.name} icon={<Wrench size={20} />} maxWidth={520}>
                <form onSubmit={handleAddIntervention}>
                  <div className="modal-grid">
                    <FieldTip label="Titre" hint="Le nom de l'intervention : 'Changement de plaquettes', 'Révision 60 000 km'… Soyez précis pour retrouver facilement." required style={{ gridColumn: '1/-1' }}>
                      <input name="title" required className="modal-input" placeholder="Ex : Changement plaquettes, Révision…" style={{ width: '100%', boxSizing: 'border-box' }} />
                    </FieldTip>
                    <FieldTip label="Statut" hint="L'avancement de ce travail. 'À faire' = planifié. 'En cours' = en atelier. 'Fait' = terminé.">
                      <select name="status" defaultValue="a-faire" className="modal-select">
                        <option value="a-faire">À faire</option>
                        <option value="en-cours">En cours</option>
                        <option value="bloque">Bloqué</option>
                        <option value="fait">Fait</option>
                      </select>
                    </FieldTip>
                    <FieldTip label="Date" hint="La date de réalisation ou la date prévue si c'est planifié." required>
                      <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="modal-input" />
                    </FieldTip>
                    <FieldTip label="Kilométrage" hint="Le kilométrage du véhicule au moment de l'intervention. Permet de savoir à quel intervalle elle a eu lieu.">
                      <input name="mileage" type="number" className="modal-input" placeholder="Ex : 45000" />
                    </FieldTip>
                    <FieldTip label="Coût (€)" hint="Le montant dépensé pour cette intervention (pièces + main d'œuvre). Alimentera le budget total du véhicule.">
                      <input name="costAmount" type="number" step="0.01" className="modal-input" placeholder="Ex : 250" />
                    </FieldTip>
                    <FieldTip label="Notes" hint="Détails supplémentaires : qui a réalisé les travaux, observations, pièces utilisées…" style={{ gridColumn: '1/-1' }}>
                      <textarea name="notes" className="modal-input" rows={3} placeholder="Détails, observations, références pièces…" style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
                    </FieldTip>

                    {/* S2 — Liaison avec le stock : on n'affiche le toggle que si
                        le module stock est activé (sinon /stock/items renvoie 403
                        au mount → stockItems reste vide). */}
                    {stockItems.length > 0 && (
                      <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text)', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: usePartsFromStock ? 'rgba(124,58,237,0.06)' : 'rgba(255,255,255,0.02)' }}>
                          <input
                            type="checkbox"
                            checked={usePartsFromStock}
                            onChange={e => { setUsePartsFromStock(e.target.checked); if (!e.target.checked) setStockUsages([]) }}
                            style={{ width: 16, height: 16, accentColor: '#7c3aed', cursor: 'pointer' }}
                          />
                          <Package size={15} style={{ color: '#a78bfa' }} />
                          <span style={{ fontWeight: 600 }}>Ajouter une ou plusieurs pièces du stock</span>
                          <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                            (décrémente le stock automatiquement)
                          </span>
                        </label>

                        {usePartsFromStock && (
                          <div style={{ padding: '12px', background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {stockUsages.length === 0 && (
                              <p style={{ margin: 0, fontSize: 12, color: 'var(--text3)' }}>
                                Aucune pièce ajoutée pour l'instant. Utilise la ligne du bas pour en sélectionner.
                              </p>
                            )}
                            {stockUsages.map((usage, i) => {
                              const item = stockItems.find(s => s.id === usage.stockItemId)
                              const stockQty = item ? Number(item.quantity) : 0
                              const exceeds = usage.quantity > stockQty
                              return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: exceeds ? '1px solid rgba(248,113,113,0.4)' : '1px solid transparent' }}>
                                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>
                                    {item?.name ?? '(pièce inconnue)'}
                                  </span>
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    max={stockQty}
                                    value={usage.quantity || ''}
                                    onChange={e => {
                                      const v = Number(e.target.value)
                                      setStockUsages(u => u.map((x, idx) => idx === i ? { ...x, quantity: Number.isFinite(v) ? v : 0 } : x))
                                    }}
                                    style={{ width: 80, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 12, textAlign: 'right' }}
                                  />
                                  <span style={{ fontSize: 11, color: exceeds ? '#f87171' : 'var(--text3)', fontFamily: 'var(--mono)', minWidth: 50 }}>
                                    / {stockQty} {item?.unit ?? ''}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setStockUsages(u => u.filter((_, idx) => idx !== i))}
                                    aria-label="Retirer cette pièce"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', display: 'flex', padding: 4 }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )
                            })}
                            {/* Sélecteur d'ajout : filtre les items déjà ajoutés et ceux à 0 */}
                            <div style={{ display: 'flex', gap: 8, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                              <select
                                value=""
                                onChange={e => {
                                  const id = e.target.value
                                  if (!id) return
                                  setStockUsages(u => [...u, { stockItemId: id, quantity: 1 }])
                                  e.target.value = ''
                                }}
                                style={{ flex: 1, background: 'rgba(12,16,41,0.95)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font)' }}
                              >
                                <option value="">+ Ajouter une pièce…</option>
                                {stockItems
                                  .filter(s => Number(s.quantity) > 0 && !stockUsages.some(u => u.stockItemId === s.id))
                                  .map(s => (
                                    <option key={s.id} value={s.id}>
                                      {s.name} — {Number(s.quantity).toLocaleString('fr-FR')} {s.unit} dispo
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn-ghost" onClick={() => { setShowAddIntervention(false); setUsePartsFromStock(false); setStockUsages([]) }}>Annuler</button>
                    <button type="submit" className="primary-action"><Wrench size={13} /> Ajouter le travail</button>
                  </div>
                </form>
              </Modal>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[['all','Tous','var(--text2)'],['a-faire','À faire','#7b82a8'],['en-cours','En cours','#67e8f9'],['bloque','Bloqué','#f87171'],['fait','Fait','#4ade80']].map(([val, label, color]) => (
                  <button key={val} onClick={() => setIntervStatusFilter(val)} style={{ padding: '4px 12px', borderRadius: '20px', border: `1px solid ${intervStatusFilter === val ? color : 'var(--border)'}`, background: intervStatusFilter === val ? `${color}18` : 'none', color: intervStatusFilter === val ? color : 'var(--text3)', fontSize: '11px', fontFamily: 'var(--mono)', cursor: 'pointer', fontWeight: 600 }}>
                    {label}
                  </button>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#f87171', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                  Total : {totalCost.toLocaleString('fr-FR')} €
                </span>
              </div>

              {filteredInterv.length === 0 ? <p className="muted">Aucun travail.</p> : filteredInterv.map((i) => {
                const s = INTERV_STATUS[i.status] ?? { color: '#7b82a8', label: i.status }
                return (
                  <div key={i.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px', borderLeft: `3px solid ${s.color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '5px' }}>{i.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text3)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          <span>{new Date(i.date).toLocaleDateString('fr-FR')}</span>
                          {i.mileage && <span>🔧 {Number(i.mileage).toLocaleString('fr-FR')} km</span>}
                          {i.costAmount && <span style={{ color: '#f87171', fontWeight: 600 }}>💰 {Number(i.costAmount).toFixed(2)} €</span>}
                        </div>
                        {i.notes && <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '6px', fontStyle: 'italic' }}>{i.notes}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                        <select value={i.status === 'planned' ? 'a-faire' : i.status === 'done' ? 'fait' : i.status} onChange={e => handleSetIntervStatus(i.id, e.target.value)} style={{ ...SELECT_STYLE, fontSize: '11px', padding: '4px 8px', border: `1px solid ${s.color}40` }}>
                          <option value="a-faire">À faire</option>
                          <option value="en-cours">En cours</option>
                          <option value="bloque">Bloqué</option>
                          <option value="fait">Fait</option>
                        </select>
                        <button className="btn-ghost" style={{ color: '#f87171', padding: '4px 8px' }} onClick={() => handleDeleteIntervention(i.id)}>✕</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ══ PIÈCES ══ */}
          {activeTab === 'pieces' && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                {[
                  { label: 'À acheter', value: toOrder,   color: '#f87171' },
                  { label: 'Commandé',  value: ordered,   color: '#fbbf24' },
                  { label: 'Reçu',      value: received,  color: '#67e8f9' },
                  { label: 'Monté',     value: mounted,   color: '#4ade80' },
                  { label: 'Bloquant',  value: blocking,  color: blocking > 0 ? '#f43f5e' : 'var(--text3)' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '10px 4px', background: `${s.color}10`, borderRadius: '10px', border: `1px solid ${s.color}20` }}>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '9px', color: 'var(--text3)', marginTop: '3px', fontFamily: 'var(--mono)' }}>{s.label.toUpperCase()}</div>
                  </div>
                ))}
              </div>

              {parts.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                  <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '4px' }}>ESTIMÉ</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#fbbf24' }}>{estimatedPartsCost.toLocaleString('fr-FR')} €</div>
                  </div>
                  <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '4px' }}>RÉEL (facturé)</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#4ade80' }}>{realPartsCost.toLocaleString('fr-FR')} €</div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="primary-action" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }} onClick={() => setShowAddPart(true)}>
                  <Plus size={13} /> Ajouter une pièce
                </button>
              </div>

              <Modal open={showAddPart} onClose={() => setShowAddPart(false)} title="Ajouter une pièce" subtitle={sv.name} icon={<Settings2 size={20} />} maxWidth={580}>
                <form onSubmit={handleAddPart}>
                  <div className="modal-grid">
                    <FieldTip label="Nom de la pièce" hint="Le nom exact de la pièce : 'Plaquettes de frein AV', 'Filtre à huile', 'Courroie de distribution'… Plus c'est précis, plus c'est utile." required style={{ gridColumn: '1/-1' }}>
                      <input name="name" required className="modal-input" placeholder="Ex : Plaquettes de frein avant, Filtre à huile…" style={{ width: '100%', boxSizing: 'border-box' }} />
                    </FieldTip>
                    <FieldTip label="Quantité" hint="Le nombre d'exemplaires nécessaires. Ex : 1 filtre, 4 bougies, 2 plaquettes (jeu).">
                      <input name="quantity" type="number" min="1" defaultValue="1" className="modal-input" />
                    </FieldTip>
                    <FieldTip label="Catégorie" hint="La famille technique de la pièce. Aide à organiser et filtrer votre liste de pièces par système du véhicule.">
                      <select name="category" defaultValue="autre" className="modal-select">
                        <option value="moteur">Moteur</option>
                        <option value="freinage">Freinage</option>
                        <option value="carrosserie">Carrosserie</option>
                        <option value="interieur">Intérieur</option>
                        <option value="electricite">Électricité</option>
                        <option value="train-roulant">Train roulant</option>
                        <option value="stock">Stock</option>
                        <option value="outillage">Outillage</option>
                        <option value="autre">Autre</option>
                      </select>
                    </FieldTip>
                    <FieldTip label="Statut" hint="L'état actuel de la pièce dans votre processus : à commander, déjà commandée, reçue et en stock, ou montée sur le véhicule.">
                      <select name="status" defaultValue="a-acheter" className="modal-select">
                        <option value="a-acheter">À acheter</option>
                        <option value="commande">Commandé</option>
                        <option value="recu">Reçu</option>
                        <option value="monte">Monté</option>
                        <option value="a-verifier">À vérifier</option>
                      </select>
                    </FieldTip>
                    <FieldTip label="Urgence" hint="Le niveau de priorité. 'Bloquant' = le véhicule ne peut pas rouler sans. 'Important' = à faire vite. 'Normal' = dans le planning. 'Optionnel' = amélioration.">
                      <select name="urgency" defaultValue="normal" className="modal-select">
                        <option value="bloquant">🔴 Bloquant</option>
                        <option value="important">🟡 Important</option>
                        <option value="normal">⚪ Normal</option>
                        <option value="optionnel">💤 Optionnel</option>
                      </select>
                    </FieldTip>
                    <FieldTip label="Référence" hint="La référence fabricant ou OEM de la pièce. Permet de commander exactement la bonne pièce et évite les erreurs de compatibilité.">
                      <input name="reference" className="modal-input" placeholder="Ex : NGK-BKR6E, OEM-1234567" />
                    </FieldTip>
                    <FieldTip label="Prix estimé (€)" hint="Le montant que vous prévoyez de dépenser pour cette pièce. Sert à calculer le budget prévisionnel du projet véhicule.">
                      <input name="estimatedPrice" type="number" step="0.01" className="modal-input" placeholder="Ex : 45.00" />
                    </FieldTip>
                    <FieldTip label="Prix réel (€)" hint="Le prix réellement payé une fois la pièce achetée. Alimentera le coût total réel du véhicule.">
                      <input name="realPrice" type="number" step="0.01" className="modal-input" placeholder="Ex : 38.50" />
                    </FieldTip>
                    <FieldTip label="Lien d'achat" hint="L'URL de la page produit chez le fournisseur. Vous pourrez y accéder directement depuis la liste des pièces." style={{ gridColumn: '1/-1' }}>
                      <input name="link" className="modal-input" placeholder="https://www.oscaro.com/…" style={{ width: '100%', boxSizing: 'border-box' }} />
                    </FieldTip>
                    <FieldTip label="Commentaire" hint="Toute note utile : dimensions spécifiques, compatibilité, retour d'expérience, point d'attention lors du montage…" style={{ gridColumn: '1/-1' }}>
                      <textarea name="comment" className="modal-input" rows={2} placeholder="Dimensions, compatibilité, conseils de montage…" style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
                    </FieldTip>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn-ghost" onClick={() => setShowAddPart(false)}>Annuler</button>
                    <button type="submit" className="primary-action"><Settings2 size={13} /> Ajouter la pièce</button>
                  </div>
                </form>
              </Modal>

              {/* Modal édition pièce */}
              {editingPart && (
                <Modal open={true} onClose={() => setEditingPart(null)} title="Modifier la pièce" subtitle={editingPart.name} icon={<Settings2 size={20} />} maxWidth={560}>
                  <form onSubmit={e => { e.preventDefault(); handleUpdatePart(e as unknown as FormEv, editingPart.id) }}>
                    <div className="modal-grid">
                      <FieldTip label="Nom" hint="Le nom complet de la pièce." required style={{ gridColumn: '1/-1' }}>
                        <input name="name" defaultValue={editingPart.name} required className="modal-input" style={{ width: '100%', boxSizing: 'border-box' }} />
                      </FieldTip>
                      <FieldTip label="Quantité" hint="Nombre d'exemplaires nécessaires.">
                        <input name="quantity" type="number" min="1" defaultValue={editingPart.quantity} className="modal-input" />
                      </FieldTip>
                      <FieldTip label="Statut" hint="Avancement : à acheter, commandé, reçu ou monté.">
                        <select name="status" defaultValue={editingPart.status} className="modal-select">
                          <option value="a-acheter">À acheter</option>
                          <option value="commande">Commandé</option>
                          <option value="recu">Reçu</option>
                          <option value="monte">Monté</option>
                          <option value="a-verifier">À vérifier</option>
                        </select>
                      </FieldTip>
                      <FieldTip label="Urgence" hint="Bloquant = le véhicule est immobilisé. Important = à faire vite. Normal = dans le planning.">
                        <select name="urgency" defaultValue={editingPart.urgency} className="modal-select">
                          <option value="bloquant">🔴 Bloquant</option>
                          <option value="important">🟡 Important</option>
                          <option value="normal">⚪ Normal</option>
                          <option value="optionnel">💤 Optionnel</option>
                        </select>
                      </FieldTip>
                      <FieldTip label="Référence" hint="Référence fabricant ou OEM pour commander la bonne pièce.">
                        <input name="reference" defaultValue={editingPart.reference ?? ''} className="modal-input" placeholder="Ex : NGK-BKR6E" />
                      </FieldTip>
                      <FieldTip label="Prix estimé (€)" hint="Budget prévu pour cette pièce.">
                        <input name="estimatedPrice" type="number" step="0.01" defaultValue={editingPart.estimatedPrice ?? ''} className="modal-input" placeholder="Ex : 45.00" />
                      </FieldTip>
                      <FieldTip label="Prix réel (€)" hint="Prix effectivement payé après achat.">
                        <input name="realPrice" type="number" step="0.01" defaultValue={editingPart.realPrice ?? ''} className="modal-input" placeholder="Ex : 38.50" />
                      </FieldTip>
                      <FieldTip label="Lien d'achat" hint="URL directe vers la page produit du fournisseur." style={{ gridColumn: '1/-1' }}>
                        <input name="link" defaultValue={editingPart.link ?? ''} className="modal-input" placeholder="https://…" style={{ width: '100%', boxSizing: 'border-box' }} />
                      </FieldTip>
                      <FieldTip label="Commentaire" hint="Notes, dimensions, conseils de montage, compatibilité…" style={{ gridColumn: '1/-1' }}>
                        <textarea name="comment" defaultValue={editingPart.comment ?? ''} rows={2} className="modal-input" placeholder="Commentaire libre…" style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
                      </FieldTip>
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn-ghost" onClick={() => setEditingPart(null)}>Annuler</button>
                      <button type="submit" className="primary-action">Sauvegarder</button>
                    </div>
                  </form>
                </Modal>
              )}

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[['all','Toutes','var(--text2)'],['a-acheter','À acheter','#f87171'],['commande','Commandé','#fbbf24'],['recu','Reçu','#67e8f9'],['monte','Monté','#4ade80'],['a-verifier','À vérifier','#a78bfa']].map(([val, label, color]) => (
                  <button key={val} onClick={() => setPartFilter(val)} style={{ padding: '4px 12px', borderRadius: '20px', border: `1px solid ${partFilter === val ? color : 'var(--border)'}`, background: partFilter === val ? `${color}18` : 'none', color: partFilter === val ? color : 'var(--text3)', fontSize: '11px', fontFamily: 'var(--mono)', cursor: 'pointer', fontWeight: 600 }}>
                    {label}{val !== 'all' && ` (${parts.filter(p => p.status === val).length})`}
                  </button>
                ))}
              </div>

              {filteredParts.length === 0 ? <p className="muted">Aucune pièce.</p> : filteredParts.map((part) => {
                const urgencyColors: Record<string, string> = { bloquant: '#f43f5e', important: '#fbbf24', normal: 'var(--border)', optionnel: 'var(--border)' }
                const isEditing = editingPart?.id === part.id
                return (
                  <div key={part.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', borderLeft: `3px solid ${urgencyColors[part.urgency] ?? 'var(--border)'}` }}>
                    {isEditing ? null : (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600 }}>{part.name}</span>
                            {part.quantity > 1 && <span style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>×{part.quantity}</span>}
                            <span style={{ fontSize: '9px', fontFamily: 'var(--mono)', fontWeight: 700, padding: '2px 7px', borderRadius: '20px', background: `${statusColors[part.status] ?? '#7b82a8'}20`, color: statusColors[part.status] ?? '#7b82a8', border: `1px solid ${statusColors[part.status] ?? '#7b82a8'}40` }}>
                              {statusLabels[part.status] ?? part.status}
                            </span>
                            <span style={{ fontSize: '9px', color: 'var(--text3)' }}>{part.category}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text3)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            {part.reference && <span>Réf: <strong style={{ color: 'var(--text2)' }}>{part.reference}</strong></span>}
                            {part.estimatedPrice && <span>Estimé: <strong style={{ color: '#fbbf24' }}>{Number(part.estimatedPrice).toFixed(2)} €</strong></span>}
                            {part.realPrice && <span>Réel: <strong style={{ color: '#4ade80' }}>{Number(part.realPrice).toFixed(2)} €</strong></span>}
                          </div>
                          {part.comment && <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px', fontStyle: 'italic' }}>{part.comment}</div>}
                          {part.link && <a href={part.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', color: '#a78bfa', marginTop: '4px', display: 'block' }}>🔗 Lien achat</a>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                          <select value={part.status} onChange={e => handlePartStatus(part.id, e.target.value)} style={{ ...SELECT_STYLE, fontSize: '10px', padding: '3px 6px', border: `1px solid ${statusColors[part.status] ?? 'var(--border)'}40` }}>
                            <option value="a-acheter">À acheter</option>
                            <option value="commande">Commandé</option>
                            <option value="recu">Reçu</option>
                            <option value="monte">Monté</option>
                            <option value="a-verifier">À vérifier</option>
                          </select>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button className="btn-ghost" style={{ fontSize: '11px', padding: '3px 6px' }} onClick={() => setEditingPart(part)}><Pencil size={11} /></button>
                            <button className="btn-ghost" style={{ fontSize: '11px', padding: '3px 6px', color: '#f87171' }} onClick={() => handleDeletePart(part.id)}>✕</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ══ ALERTES ══ */}
          {activeTab === 'alertes' && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>Alertes & échéances</span>
                <button className="primary-action" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }} onClick={() => setShowAddAlert(true)}>
                  <Plus size={13} /> Nouvelle alerte
                </button>
              </div>
              <Modal open={showAddAlert} onClose={() => setShowAddAlert(false)} title="Nouvelle alerte" subtitle={sv.name} icon={<Bell size={20} />} maxWidth={480}>
                <form onSubmit={handleAddAlert}>
                  <div className="modal-grid">
                    <FieldTip label="Titre" hint="Ce que vous souhaitez être rappelé : 'Renouveler assurance', 'CT à passer', 'Révision annuelle'…" required style={{ gridColumn: '1/-1' }}>
                      <input name="title" required className="modal-input" placeholder="Ex : Renouveler assurance, CT à passer…" style={{ width: '100%', boxSizing: 'border-box' }} />
                    </FieldTip>
                    <FieldTip label="Type d'alerte" hint="La catégorie de l'alerte. Permet de filtrer et d'afficher une icône adaptée.">
                      <select name="type" defaultValue="maintenance" className="modal-select">
                        <option value="maintenance">Maintenance</option>
                        <option value="ct">Contrôle technique</option>
                        <option value="insurance">Assurance</option>
                        <option value="tax">Taxe / Vignette</option>
                        <option value="revision">Révision</option>
                        <option value="other">Autre</option>
                      </select>
                    </FieldTip>
                    <FieldTip label="Date d'échéance" hint="La date limite. L'application affichera un compte à rebours et changera de couleur à l'approche.">
                      <input name="dueDate" type="date" className="modal-input" />
                    </FieldTip>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn-ghost" onClick={() => setShowAddAlert(false)}>Annuler</button>
                    <button type="submit" className="primary-action"><Bell size={13} /> Créer l'alerte</button>
                  </div>
                </form>
              </Modal>

              {sv.alerts.length === 0 ? <p className="muted">Aucune alerte.</p> : sv.alerts.map((a) => {
                const urg = alertUrgency(a.dueDate)
                return (
                  <div key={a.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px', borderLeft: `3px solid ${a.status === 'closed' ? 'var(--border)' : urg.color}`, opacity: a.status === 'closed' ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{a.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '3px', display: 'flex', gap: '10px' }}>
                          <span style={{ fontFamily: 'var(--mono)' }}>{a.type}</span>
                          {a.dueDate && <span style={{ color: urg.color, fontWeight: 600 }}>{new Date(a.dueDate).toLocaleDateString('fr-FR')}{urg.label && ` · ${urg.label}`}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {a.status === 'open' && <button className="btn-ghost" style={{ fontSize: '11px' }} onClick={() => handleCloseAlert(a.id)}>Fermer</button>}
                        <button className="btn-ghost" style={{ color: '#f87171' }} onClick={() => handleDeleteAlert(a.id)}>✕</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ══ BUDGET ══ */}
          {activeTab === 'budget' && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Budget cible */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '8px' }}>BUDGET CIBLE</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="number" step="0.01" min="0" value={budgetTarget || ''} placeholder="Ex : 2000" onChange={e => { const v = Number(e.target.value) || 0; setBudgetTarget(v); localStorage.setItem(`vehicle-budget-${sv.id}`, String(v)) }} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '14px', fontFamily: 'var(--font)', outline: 'none' }} />
                  <span style={{ color: 'var(--text2)' }}>€</span>
                </div>
                {budgetTarget > 0 && <div style={{ marginTop: '12px' }}><ProgressBar value={budgetUsedPct} color={budgetUsedPct >= 100 ? '#f87171' : budgetUsedPct >= 75 ? '#fbbf24' : '#4ade80'} label={`${totalCost.toLocaleString('fr-FR')} € / ${budgetTarget.toLocaleString('fr-FR')} €`} /></div>}
              </div>

              {/* KPIs */}
              {(() => {
                const stockCost = sv.stockMovements.reduce((s, m) => s + Number(m.valueAmount ?? 0), 0)
                const grandTotal = totalCost + stockCost
                return (
                  <div className="detail-grid">
                    <span>Travaux (interv.)<strong style={{ color: '#f87171' }}>{totalCost.toLocaleString('fr-FR')} €</strong></span>
                    <span>Pièces / consommables<strong style={{ color: '#fbbf24' }}>{stockCost.toLocaleString('fr-FR')} €</strong></span>
                    <span>Total engagé<strong style={{ color: '#f87171', fontSize: '16px' }}>{grandTotal.toLocaleString('fr-FR')} €</strong></span>
                    <span>Déjà réalisé<strong style={{ color: '#4ade80' }}>{doneCost.toLocaleString('fr-FR')} €</strong></span>
                    <span>Reste à faire<strong style={{ color: '#fbbf24' }}>{remainingCost.toLocaleString('fr-FR')} €</strong></span>
                    {budgetTarget > 0 && <span>Disponible<strong style={{ color: budgetTarget - grandTotal >= 0 ? '#4ade80' : '#f87171' }}>{(budgetTarget - grandTotal).toLocaleString('fr-FR')} €</strong></span>}
                  </div>
                )
              })()}

              {/* Coûts interventions */}
              {sv.interventions.filter(i => Number(i.costAmount) > 0).length > 0 && (
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '8px' }}>🔧 TRAVAUX</div>
                  {sv.interventions.filter(i => Number(i.costAmount) > 0).sort((a, b) => Number(b.costAmount) - Number(a.costAmount)).map(i => {
                    const s = INTERV_STATUS[i.status] ?? { color: '#7b82a8' }
                    return (
                      <div key={i.id} className="document-row">
                        <span style={{ flex: 1, fontSize: '13px' }}>{i.title}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{new Date(i.date).toLocaleDateString('fr-FR')}</span>
                        <IntervStatusBadge status={i.status} />
                        <span style={{ fontSize: '14px', fontWeight: 600, color: s.color }}>{Number(i.costAmount).toFixed(2)} €</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Sorties stock */}
              {sv.stockMovements.length > 0 && (
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '8px' }}>📦 PIÈCES & CONSOMMABLES (sorties stock)</div>
                  {sv.stockMovements.map(m => (
                    <div key={m.id} className="document-row">
                      <span style={{ fontSize: '15px' }}>📦</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{m.stockItem.name}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text3)' }}>{Number(m.quantity).toLocaleString('fr-FR')} {m.stockItem.unit} · {new Date(m.createdAt).toLocaleDateString('fr-FR')}</div>
                        {m.note && <div style={{ fontSize: '10px', color: 'var(--text3)', fontStyle: 'italic' }}>{m.note}</div>}
                      </div>
                      {m.valueAmount && <span style={{ fontSize: '13px', fontWeight: 600, color: '#fbbf24', fontFamily: 'var(--mono)' }}>{Number(m.valueAmount).toFixed(2)} €</span>}
                    </div>
                  ))}
                </div>
              )}

              {sv.interventions.filter(i => Number(i.costAmount) > 0).length === 0 && sv.stockMovements.length === 0 && (
                <p className="muted" style={{ textAlign: 'center', padding: '20px 0' }}>Aucun coût enregistré pour ce véhicule.</p>
              )}
            </div>
          )}

          {/* ══ DOCUMENTS ══ */}
          {activeTab === 'documents' && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="primary-action" onClick={() => setShowUploadDoc(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <Upload size={13} /> Uploader un fichier
                </button>
              </div>

              <Modal open={showUploadDoc} onClose={() => setShowUploadDoc(false)} title="Ajouter un document" subtitle={sv.name} icon={<Upload size={20} />} maxWidth={480}>
                <form onSubmit={handleUploadDoc}>
                  <div className="modal-grid">
                    <FieldTip label="Fichier" hint="Sélectionnez le fichier à uploader : photo, facture, carte grise, diagnostic… Le fichier sera stocké dans votre bibliothèque privée et lié à ce véhicule." required style={{ gridColumn: '1/-1' }}>
                      <input name="vehicleFile" type="file" required className="modal-input" style={{ width: '100%', boxSizing: 'border-box', cursor: 'pointer' }} />
                    </FieldTip>
                    <FieldTip label="Type de document" hint="Catégorisez le fichier pour le retrouver facilement dans la galerie : photo avant/après travaux, facture, document administratif…">
                      <select name="vehicleFileContext" defaultValue="document" className="modal-select">
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
                    </FieldTip>
                    <FieldTip label="Date d'expiration" hint="Optionnel. Pour les documents à durée limitée (assurance, CT, contrôle technique) : une alerte apparaîtra à l'approche de la date.">
                      <input name="vehicleFileExpiresAt" type="date" className="modal-input" />
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
                  {documents.map((d) => <option value={d.id} key={d.id}>{d.name}</option>)}
                </select>
                <input name="context" placeholder="Contexte" defaultValue="document" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', color: 'var(--text)', fontSize: '12px', fontFamily: 'var(--font)', outline: 'none' }} />
                <button className="btn-ghost" type="submit">Associer</button>
              </form>

              {['avant', 'apres', 'travail', 'piece'].map(cat => {
                const catPhotos = sv.documents.filter(l => l.context === cat || (cat === 'avant' && !l.context && l.document.mimeType.startsWith('image/')))
                if (catPhotos.length === 0) return null
                const catLabel: Record<string, string> = { avant: '📸 Avant', apres: '📸 Après', travail: '🔧 Travail', piece: '⚙️ Pièce' }
                return (
                  <div key={cat}>
                    <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '8px' }}>{catLabel[cat]} ({catPhotos.length})</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                      {catPhotos.map(link => (
                        <button key={link.id} onClick={() => downloadDoc(link.document.id, link.document.name)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '28px' }}>🖼️</span>
                          <span style={{ fontSize: '9px', color: 'var(--text3)', wordBreak: 'break-all', textAlign: 'center' }}>{link.document.name.slice(0, 16)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}

              {otherDocs.length > 0 && (
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '8px' }}>DOCUMENTS ({otherDocs.length})</div>
                  <div className="document-list" style={{ padding: 0 }}>
                    {otherDocs.map(link => (
                      <button className="document-row" key={link.id} onClick={() => downloadDoc(link.document.id, link.document.name)}>
                        <FileLock2 size={16} />
                        <span style={{ flex: 1 }}>{link.document.name}</span>
                        <small>{link.context ?? 'document'}</small>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {sv.documents.length === 0 && <p className="muted">Aucun document ou photo lié.</p>}
            </div>
          )}

          {/* ══ HISTORIQUE KM ══ */}
          {activeTab === 'historique' && (
            <div style={{ padding: '20px' }}>
              {sv.mileageLogs.length === 0 ? (
                <p className="muted">Aucun historique kilométrage.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginBottom: '8px', fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--mono)', fontWeight: 700, padding: '0 8px' }}>
                    <span>DATE</span><span>KM</span><span>VARIATION</span>
                  </div>
                  {sv.mileageLogs.map((log, idx) => {
                    const prev = sv.mileageLogs[idx + 1]
                    const delta = prev ? log.mileage - prev.mileage : null
                    return (
                      <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '12px 8px', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                        <span style={{ color: 'var(--text2)', fontFamily: 'var(--mono)', fontSize: '12px' }}>{new Date(log.date).toLocaleDateString('fr-FR')}</span>
                        <span style={{ fontWeight: 600 }}>{log.mileage.toLocaleString('fr-FR')} km</span>
                        <span style={{ color: delta !== null ? '#67e8f9' : 'var(--text3)', fontSize: '12px' }}>
                          {delta !== null ? `+${delta.toLocaleString('fr-FR')} km` : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
