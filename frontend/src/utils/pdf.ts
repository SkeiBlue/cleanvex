import { jsPDF } from 'jspdf'

/* ── Helpers ───────────────────────────────────────────────────── */
const PURPLE = [124, 58, 237] as const
const DARK   = [12, 16, 41]  as const
const LIGHT  = [201, 209, 224] as const
const MUTED  = [123, 130, 168] as const

function header(doc: jsPDF, title: string, sub: string) {
  doc.setFillColor(...DARK)
  doc.rect(0, 0, 210, 28, 'F')

  doc.setFillColor(...PURPLE)
  doc.rect(0, 0, 4, 28, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text(title, 12, 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(sub, 12, 21)

  const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  doc.text(now, 198, 13, { align: 'right' })
}

function section(doc: jsPDF, y: number, label: string): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...PURPLE)
  doc.text(label.toUpperCase(), 12, y)
  doc.setDrawColor(...PURPLE)
  doc.setLineWidth(0.3)
  doc.line(12, y + 1, 198, y + 1)
  return y + 8
}

function row(doc: jsPDF, y: number, cols: string[], widths: number[], isAlt: boolean): number {
  if (isAlt) {
    doc.setFillColor(20, 24, 48)
    doc.rect(8, y - 4, 194, 6, 'F')
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...LIGHT)
  let x = 12
  cols.forEach((col, i) => {
    doc.text(col, x, y, { maxWidth: widths[i] - 2 })
    x += widths[i]
  })
  return y + 7
}

function checkPage(doc: jsPDF, y: number, footer: string): number {
  if (y > 270) {
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(footer, 104, 287, { align: 'center' })
    doc.addPage()
    doc.setFillColor(...DARK)
    doc.rect(0, 0, 210, 297, 'F')
    return 18
  }
  return y
}

/* ── Rapport Finances ──────────────────────────────────────────── */
export interface TxForPDF {
  operationDate: string
  label: string
  type: string
  amount: string | number
  category?: { name: string } | null
  account: { name: string }
  note?: string | null
}

export function generateFinancePDF(
  transactions: TxForPDF[],
  summary: { income: number; expense: number; balance: number; accountCount: number },
  period?: string,
) {
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' })
  doc.setFillColor(...DARK)
  doc.rect(0, 0, 210, 297, 'F')

  header(doc, 'Rapport Finances', period ?? 'Toutes les opérations')

  let y = 38
  y = section(doc, y, 'Résumé')

  // Summary boxes
  const boxes = [
    { label: 'Revenus',   value: `+${summary.income.toFixed(2)} €`,   color: [74, 222, 128] as [number,number,number] },
    { label: 'Dépenses',  value: `-${summary.expense.toFixed(2)} €`,  color: [248, 113, 113] as [number,number,number] },
    { label: 'Solde net', value: `${summary.balance >= 0 ? '+' : ''}${summary.balance.toFixed(2)} €`, color: (summary.balance >= 0 ? [74, 222, 128] : [248, 113, 113]) as [number,number,number] },
    { label: 'Comptes',   value: `${summary.accountCount}`,           color: [123, 130, 168] as [number,number,number] },
  ]
  boxes.forEach((b, i) => {
    const bx = 12 + i * 47
    doc.setFillColor(20, 24, 48)
    doc.roundedRect(bx, y, 43, 18, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(b.color[0], b.color[1], b.color[2])
    doc.text(b.value, bx + 21.5, y + 10, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(b.label, bx + 21.5, y + 16, { align: 'center' })
  })
  y += 26

  // Category breakdown
  const byCat: Record<string, number> = {}
  transactions.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.category?.name ?? 'Sans catégorie'
    byCat[cat] = (byCat[cat] ?? 0) + Number(t.amount)
  })
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8)
  if (cats.length) {
    y = section(doc, y, 'Dépenses par catégorie')
    cats.forEach(([ cat, amt ], i) => {
      y = row(doc, y, [cat, `${amt.toFixed(2)} €`], [140, 46], i % 2 === 1)
      y = checkPage(doc, y, 'Rapport Finances · Plateforme Personnelle')
    })
    y += 4
  }

  // Transactions list
  y = section(doc, y, `Opérations (${transactions.length})`)

  // Column headers
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  ;['Date', 'Libellé', 'Compte / Catégorie', 'Montant'].forEach((h, i) => {
    doc.text(h, [12, 42, 112, 166][i], y)
  })
  y += 5
  doc.setDrawColor(30, 35, 71)
  doc.setLineWidth(0.2)
  doc.line(12, y, 198, y)
  y += 4

  const sorted = [...transactions].sort((a, b) => new Date(b.operationDate).getTime() - new Date(a.operationDate).getTime())
  sorted.forEach((t, i) => {
    y = checkPage(doc, y, 'Rapport Finances · Plateforme Personnelle')
    const date = new Date(t.operationDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const label = t.label.slice(0, 36)
    const acctCat = `${t.account.name}${t.category ? ` · ${t.category.name}` : ''}`
    const amt = `${t.type === 'expense' ? '-' : '+'}${Number(t.amount).toFixed(2)} €`
    y = row(doc, y, [date, label, acctCat.slice(0, 30), amt], [30, 70, 54, 32], i % 2 === 0)
    // Color the amount
    doc.setTextColor(t.type === 'expense' ? 248 : 74, t.type === 'expense' ? 113 : 222, t.type === 'expense' ? 113 : 128)
    doc.text(amt, 166, y - 7)
    doc.setTextColor(...LIGHT)
  })

  // Footer
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text('Rapport Finances · Plateforme Personnelle', 104, 287, { align: 'center' })

  doc.save(`rapport_finances_${new Date().toISOString().slice(0, 10)}.pdf`)
}

/* ── Carnet d'entretien Véhicule ───────────────────────────────── */
export interface VehicleForPDF {
  name: string
  brand?: string | null
  model?: string | null
  year?: number | null
  mileage: number
  fuelType?: string | null
  power?: number | null
  status: string
  // Immatriculation (champ `registration` côté modèle). `licensePlate` est
  // conservé en alias optionnel pour rétro-compat d'éventuels appels existants.
  registration?: string | null
  licensePlate?: string | null
  vin?: string | null
  purchaseDate?: string | null
  purchasePrice?: string | number | null
  notes?: string | null
}

export interface InterventionForPDF {
  title: string
  date: string
  status: string
  mileage?: number | null
  costAmount?: string | number | null
  executor?: 'self' | 'pro' | null
  professionalName?: string | null
  professionalContact?: { displayName: string; organization: string | null } | null
  category?: string | null
  notes?: string | null
  nextDueDate?: string | null
  nextDueMileage?: number | null
}

export interface PartForPDF {
  name: string
  quantity: number
  status: string
  reference?: string | null
  estimatedPrice?: string | number | null
  realPrice?: string | number | null
}

export interface MileageLogForPDF {
  mileage: number
  date: string
}

export interface VehiclePDFData {
  interventions?: InterventionForPDF[]
  parts?: PartForPDF[]
  mileageLogs?: MileageLogForPDF[]
  budget?: number | null
}

const STATUS_LABELS_FR: Record<string, string> = {
  in_use: 'En fonction', restoration: 'En restauration', sold: 'Vendu',
  planned_purchase: 'Achat prévu', donor: 'Donneuse',
  active: 'En fonction', repair: 'En restauration', parked: 'En fonction',
}
const INTERV_STATUS_FR: Record<string, string> = {
  planned: 'Planifié', todo: 'À faire', in_progress: 'En cours',
  waiting: 'En attente', done: 'Terminé', cancelled: 'Annulé',
  'a-faire': 'À faire', 'en-cours': 'En cours', bloque: 'Bloqué', fait: 'Terminé',
}
const PART_STATUS_FR: Record<string, string> = {
  'a-acheter': 'À acheter', commande: 'Commandé', recu: 'Reçu',
  monte: 'Monté', 'a-verifier': 'À vérifier',
}
function isDoneStatus(s: string) { return s === 'done' || s === 'fait' }
function eur(n: number) { return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` }
function shortDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
}
function intervBy(i: InterventionForPDF) {
  if (i.executor === 'pro') {
    return i.professionalContact?.displayName ?? i.professionalName ?? 'Professionnel'
  }
  return 'Soi-même'
}

export function generateVehiclePDF(vehicle: VehicleForPDF, data: VehiclePDFData = {}) {
  const FOOTER = `Carnet d'entretien · ${vehicle.name}`
  const interventions = [...(data.interventions ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
  const parts = data.parts ?? []
  const mileageLogs = [...(data.mileageLogs ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
  const plate = vehicle.registration ?? vehicle.licensePlate ?? null

  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' })
  doc.setFillColor(...DARK)
  doc.rect(0, 0, 210, 297, 'F')

  header(doc, vehicle.name, `Carnet d'entretien — ${plate ?? 'Immatriculation non renseignée'}`)

  let y = 38

  /* ── Synthèse ── */
  y = section(doc, y, 'Synthèse')
  const totalCost = interventions.reduce((s, i) => s + Number(i.costAmount ?? 0), 0)
  const doneCount = interventions.filter(i => isDoneStatus(i.status)).length
  const boxes = [
    { label: 'Interventions', value: `${interventions.length}`, color: [103, 232, 249] as [number, number, number] },
    { label: 'Terminées', value: `${doneCount}`, color: [74, 222, 128] as [number, number, number] },
    { label: 'Coût total', value: eur(totalCost), color: [248, 113, 113] as [number, number, number] },
    { label: 'Km actuel', value: `${vehicle.mileage.toLocaleString('fr-FR')}`, color: [167, 139, 250] as [number, number, number] },
  ]
  boxes.forEach((b, i) => {
    const bx = 12 + i * 47
    doc.setFillColor(20, 24, 48)
    doc.roundedRect(bx, y, 43, 18, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(b.value.length > 9 ? 10 : 13)
    doc.setTextColor(b.color[0], b.color[1], b.color[2])
    doc.text(b.value, bx + 21.5, y + 10, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(b.label, bx + 21.5, y + 16, { align: 'center' })
  })
  y += 26

  /* ── Informations générales ── */
  y = checkPage(doc, y, FOOTER)
  y = section(doc, y, 'Informations générales')
  const infos: [string, string][] = [
    ['Marque / Modèle', `${vehicle.brand ?? '—'} ${vehicle.model ?? ''}`.trim()],
    ['Année', vehicle.year?.toString() ?? '—'],
    ['Immatriculation', plate ?? '—'],
    ['VIN', vehicle.vin ?? '—'],
    ['Carburant', vehicle.fuelType ?? '—'],
    ['Puissance', vehicle.power != null ? `${vehicle.power} ch` : '—'],
    ['Statut', STATUS_LABELS_FR[vehicle.status] ?? vehicle.status],
    ['Date achat', shortDate(vehicle.purchaseDate)],
    ['Prix achat', vehicle.purchasePrice != null ? eur(Number(vehicle.purchasePrice)) : '—'],
    ...(data.budget != null && data.budget > 0 ? [['Budget prévu', eur(data.budget)] as [string, string]] : []),
  ]
  infos.forEach(([k, v], i) => {
    y = checkPage(doc, y, FOOTER)
    y = row(doc, y, [k, v], [60, 126], i % 2 === 0)
  })
  y += 4

  /* ── Historique des interventions ── */
  y = checkPage(doc, y, FOOTER)
  y = section(doc, y, `Historique des interventions (${interventions.length})`)
  if (interventions.length === 0) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...MUTED)
    doc.text('Aucune intervention enregistrée.', 12, y); y += 8
  } else {
    const cols = [22, 18, 64, 38, 28, 16]
    const headers = ['Date', 'Km', 'Travail', 'Par', 'Coût', 'État']
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...MUTED)
    let hx = 12
    headers.forEach((h, i) => { doc.text(h, hx, y); hx += cols[i] })
    y += 3
    doc.setDrawColor(30, 35, 71); doc.setLineWidth(0.2); doc.line(12, y, 198, y); y += 4
    interventions.forEach((it, i) => {
      y = checkPage(doc, y, FOOTER)
      const title = it.category ? `${it.title} · ${it.category}` : it.title
      y = row(doc, y, [
        shortDate(it.date),
        it.mileage != null ? it.mileage.toLocaleString('fr-FR') : '—',
        title.slice(0, 42),
        intervBy(it).slice(0, 22),
        it.costAmount != null ? eur(Number(it.costAmount)) : '—',
        INTERV_STATUS_FR[it.status] ?? it.status,
      ], cols, i % 2 === 1)
    })
    y += 4
  }

  /* ── Pièces ── */
  if (parts.length > 0) {
    y = checkPage(doc, y, FOOTER)
    y = section(doc, y, `Pièces (${parts.length})`)
    const cols = [66, 16, 50, 26, 28]
    const headers = ['Pièce', 'Qté', 'Référence', 'État', 'Prix']
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...MUTED)
    let hx = 12
    headers.forEach((h, i) => { doc.text(h, hx, y); hx += cols[i] })
    y += 3
    doc.setDrawColor(30, 35, 71); doc.setLineWidth(0.2); doc.line(12, y, 198, y); y += 4
    parts.forEach((p, i) => {
      y = checkPage(doc, y, FOOTER)
      const price = p.realPrice != null ? Number(p.realPrice) : (p.estimatedPrice != null ? Number(p.estimatedPrice) : null)
      y = row(doc, y, [
        p.name.slice(0, 44),
        `${p.quantity}`,
        (p.reference ?? '—').slice(0, 32),
        PART_STATUS_FR[p.status] ?? p.status,
        price != null ? eur(price) : '—',
      ], cols, i % 2 === 1)
    })
    y += 4
  }

  /* ── Prochaines échéances ── */
  const upcoming = interventions.filter(i => i.nextDueDate || i.nextDueMileage)
  if (upcoming.length > 0) {
    y = checkPage(doc, y, FOOTER)
    y = section(doc, y, 'Prochaines échéances')
    upcoming.forEach((it, i) => {
      y = checkPage(doc, y, FOOTER)
      const due = [
        it.nextDueDate ? shortDate(it.nextDueDate) : null,
        it.nextDueMileage != null ? `${it.nextDueMileage.toLocaleString('fr-FR')} km` : null,
      ].filter(Boolean).join(' · ')
      y = row(doc, y, [it.title.slice(0, 60), due], [120, 66], i % 2 === 1)
    })
    y += 4
  }

  /* ── Historique kilométrique (15 derniers relevés) ── */
  if (mileageLogs.length > 0) {
    y = checkPage(doc, y, FOOTER)
    y = section(doc, y, 'Historique kilométrique')
    mileageLogs.slice(0, 15).forEach((m, i) => {
      y = checkPage(doc, y, FOOTER)
      y = row(doc, y, [shortDate(m.date), `${m.mileage.toLocaleString('fr-FR')} km`], [60, 126], i % 2 === 1)
    })
    y += 4
  }

  /* ── Notes ── */
  if (vehicle.notes) {
    y = checkPage(doc, y, FOOTER)
    y = section(doc, y, 'Notes')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...LIGHT)
    const lines = doc.splitTextToSize(vehicle.notes, 186) as string[]
    lines.forEach((line) => {
      y = checkPage(doc, y, FOOTER)
      doc.text(line, 12, y); y += 5
    })
  }

  doc.setFontSize(7); doc.setTextColor(...MUTED)
  doc.text(FOOTER, 104, 287, { align: 'center' })
  doc.save(`carnet_entretien_${vehicle.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`)
}
