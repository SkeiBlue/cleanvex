type TrendClass = 'trend-up' | 'trend-down' | 'trend-flat'
type ColorClass = 'c1' | 'c2' | 'c3' | 'c4'

type Props = {
  colorClass: ColorClass
  label: string
  value: string | number
  icon: string
  sub?: string
  trend?: string
  trendClass?: TrendClass
}

export function StatCard({ colorClass, label, value, icon, sub, trend, trendClass = 'trend-flat' }: Props) {
  return (
    <div className={`stat-card ${colorClass}`}>
      <div className="stat-header">
        <div className="stat-label">{label}</div>
        <div className="stat-ico">{icon}</div>
      </div>
      <div className="stat-val">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      {trend && <div className={`stat-trend ${trendClass}`}>{trend}</div>}
    </div>
  )
}
