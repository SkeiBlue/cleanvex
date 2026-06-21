import { AlertTriangle } from 'lucide-react'

type Props = {
  unreadNotifications: number
  overdueTasks: number
  openTasks: number
  documentCount: number
}

export function AlertBanner({ unreadNotifications, overdueTasks, openTasks, documentCount }: Props) {
  if (unreadNotifications === 0 && overdueTasks === 0) return null

  return (
    <div className="alert-banner">
      <div className="alert-icon"><AlertTriangle size={18} /></div>
      <div className="alert-content">
        <div className="alert-title">
          {overdueTasks > 0 ? `${overdueTasks} tâche${overdueTasks > 1 ? 's' : ''} en retard` : `${unreadNotifications} notifications non lues`}
        </div>
        <div className="alert-desc">
          {openTasks} tâches ouvertes · {documentCount} documents privés · {unreadNotifications} notifications
        </div>
      </div>
      <div className="alert-actions">
        <button className="btn btn-primary">Voir les alertes</button>
        <button className="btn btn-ghost">Ignorer</button>
      </div>
    </div>
  )
}
