import { useMemo } from 'react'
import {
  Bar, BarChart, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import type { FinancialTransaction } from '../types'

const PIE_COLORS = ['#a78bfa', '#67e8f9', '#4ade80', '#fbbf24', '#f87171', '#f9a8d4', '#34d399', '#60a5fa']

type TooltipProps = { active?: boolean; payload?: { name: string; value: number }[]; label?: string }

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#141830', border: '1px solid #1e2347', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
      {label && <div style={{ color: '#7b82a8', marginBottom: '6px', fontFamily: 'var(--mono)', fontSize: '10px' }}>{label}</div>}
      {payload.map(p => (
        <div key={p.name} style={{ color: '#c9d1e0', display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
          <span style={{ color: '#7b82a8' }}>{p.name}</span>
          <strong>{Number(p.value).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong>
        </div>
      ))}
    </div>
  )
}

/* ────────────────────────────────────────────────────
   Bar chart : revenus / dépenses par mois (6 derniers)
──────────────────────────────────────────────────── */
export function MonthlyBarChart({ transactions, months = 6 }: { transactions: FinancialTransaction[]; months?: number }) {
  const data = useMemo(() => {
    return Array.from({ length: months }, (_, i) => {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (months - 1 - i))
      const y = d.getFullYear(), m = d.getMonth()
      const tx = transactions.filter(t => {
        const td = new Date(t.operationDate)
        return td.getFullYear() === y && td.getMonth() === m
      })
      return {
        mois: d.toLocaleDateString('fr-FR', { month: 'short', year: months > 6 ? '2-digit' : undefined }),
        Revenus:  +tx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0).toFixed(2),
        Dépenses: +tx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0).toFixed(2),
      }
    })
  }, [transactions, months])

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <XAxis dataKey="mois" tick={{ fill: '#7b82a8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#7b82a8', fontSize: 10 }} axisLine={false} tickLine={false} width={50} tickFormatter={v => `${v}€`} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: '11px', color: '#7b82a8', paddingTop: '8px' }} />
        <Bar dataKey="Revenus"  fill="#4ade80" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="Dépenses" fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ────────────────────────────────────────────────────
   Donut : répartition dépenses par catégorie
──────────────────────────────────────────────────── */
export function CategoryPieChart({ transactions }: { transactions: FinancialTransaction[] }) {
  const data = useMemo(() => {
    const byCat: Record<string, number> = {}
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const cat = t.category?.name ?? 'Sans catégorie'
      byCat[cat] = (byCat[cat] ?? 0) + Number(t.amount)
    })
    return Object.entries(byCat)
      .map(([name, value]) => ({ name, value: +value.toFixed(2) }))
      .sort((a, b) => b.value - a.value).slice(0, 7)
  }, [transactions])

  if (data.length === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text3)', fontSize: '12px' }}>
      Aucune dépense
    </div>
  )

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="40%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={0} />)}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const p = payload[0]
            const pct = total > 0 ? ((p.value as number) / total * 100).toFixed(1) : '0'
            return (
              <div style={{ background: '#141830', border: '1px solid #1e2347', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
                <div style={{ color: p.payload.fill, fontWeight: 700 }}>{p.name}</div>
                <div style={{ color: '#c9d1e0' }}>{Number(p.value).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € · {pct}%</div>
              </div>
            )
          }}
        />
        <Legend
          layout="vertical" align="right" verticalAlign="middle"
          wrapperStyle={{ fontSize: '10px', color: '#7b82a8', lineHeight: '1.8' }}
          formatter={(value: string, entry: { payload?: unknown }) => {
            const val = (entry.payload as { value?: number } | undefined)?.value
            return `${value} (${val != null ? Number(val).toFixed(0) : 0} €)`
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

/* ────────────────────────────────────────────────────
   Line chart : solde cumulatif dans le temps
──────────────────────────────────────────────────── */
export function BalanceLineChart({ transactions }: { transactions: FinancialTransaction[] }) {
  const data = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => new Date(a.operationDate).getTime() - new Date(b.operationDate).getTime())
    let balance = 0
    const monthly: Record<string, number> = {}
    sorted.forEach(t => {
      const d = new Date(t.operationDate)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      balance += t.type === 'income' ? Number(t.amount) : -Number(t.amount)
      monthly[key] = +balance.toFixed(2)
    })
    return Object.entries(monthly).slice(-12).map(([key, value]) => ({
      mois: new Date(key).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      Solde: value,
    }))
  }, [transactions])

  if (data.length < 2) return null

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="mois" tick={{ fill: '#7b82a8', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#7b82a8', fontSize: 10 }} axisLine={false} tickLine={false} width={52} tickFormatter={v => `${v}€`} />
        <Tooltip content={<ChartTooltip />} />
        <Line type="monotone" dataKey="Solde" stroke="#a78bfa" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#a78bfa' }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

/* ────────────────────────────────────────────────────
   Wrapper panneau pour les charts du dashboard
──────────────────────────────────────────────────── */
export function ChartPanel({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) {
  return (
    <article className="panel">
      <div className="panel-header">
        <div><span className="panel-kicker">{kicker}</span><h2>{title}</h2></div>
      </div>
      <div style={{ padding: '8px 20px 16px' }}>
        {children}
      </div>
    </article>
  )
}
