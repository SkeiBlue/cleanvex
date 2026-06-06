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

/* ── Rapport Véhicule ──────────────────────────────────────────── */
export interface VehicleForPDF {
  name: string
  brand?: string | null
  model?: string | null
  year?: number | null
  mileage: number
  fuelType?: string | null
  status: string
  licensePlate?: string | null
  purchaseDate?: string | null
  purchasePrice?: string | number | null
  notes?: string | null
}

export function generateVehiclePDF(vehicle: VehicleForPDF) {
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' })
  doc.setFillColor(...DARK)
  doc.rect(0, 0, 210, 297, 'F')

  header(doc, vehicle.name, `Fiche véhicule — ${vehicle.licensePlate ?? 'Plaque non renseignée'}`)

  let y = 40
  y = section(doc, y, 'Informations générales')

  const infos: [string, string][] = [
    ['Marque', vehicle.brand ?? '—'],
    ['Modèle', vehicle.model ?? '—'],
    ['Année', vehicle.year?.toString() ?? '—'],
    ['Kilométrage', `${vehicle.mileage.toLocaleString('fr-FR')} km`],
    ['Carburant', vehicle.fuelType ?? '—'],
    ['Statut', vehicle.status],
    ['Date achat', vehicle.purchaseDate ? new Date(vehicle.purchaseDate).toLocaleDateString('fr-FR') : '—'],
    ['Prix achat', vehicle.purchasePrice != null ? `${Number(vehicle.purchasePrice).toLocaleString('fr-FR')} €` : '—'],
  ]
  infos.forEach(([k, v], i) => {
    y = row(doc, y, [k, v], [60, 126], i % 2 === 0)
  })

  if (vehicle.notes) {
    y += 4
    y = section(doc, y, 'Notes')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...LIGHT)
    const lines = doc.splitTextToSize(vehicle.notes, 180)
    doc.text(lines, 12, y)
    y += lines.length * 5
  }

  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text('Fiche Véhicule · Plateforme Personnelle', 104, 287, { align: 'center' })
  doc.save(`vehicule_${vehicle.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`)
}
