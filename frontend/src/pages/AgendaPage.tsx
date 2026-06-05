import { useCallback, useEffect, useState } from 'react'
import { Bell, CalendarDays, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { AgendaDashboard, NotificationItem, TaskItem } from '../types'

type FormEv = { preventDefault(): void; currentTarget: HTMLFormElement }

const PRIORITY_STYLE: Record<string, { color: string; label: string }> = {
  high:   { color: '#f87171', label: 'Haute' },
  normal: { color: '#fbbf24', label: 'Normale' },
  low:    { color: '#7b82a8', label: 'Basse' },
}

function PriorityBadge({ priority }: { priority: string }) {
  const s = PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.normal
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

export function AgendaPage() {
  const { authedFetch, setUnreadNotifications } = useAuth()
  const [agendaDashboard, setAgendaDashboard] = useState<AgendaDashboard | null>(null)
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [message, setMessage] = useState('')

  const reload = useCallback(async () => {
    const [ad, ta, no] = await Promise.all([
      authedFetch('/agenda/dashboard'),
      authedFetch('/agenda/tasks'),
      authedFetch('/agenda/notifications'),
    ])
    if (ad.ok) {
      const d = await ad.json()
      setAgendaDashboard(d)
      setUnreadNotifications(d.unreadNotifications ?? 0)
    }
    if (ta.ok) setTasks(await ta.json())
    if (no.ok) setNotifications(await no.json())
  }, [authedFetch, setUnreadNotifications])

  useEffect(() => { reload() }, [reload])

  async function handleCreateTask(event: FormEv) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const r = await authedFetch('/agenda/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.get('title'), description: data.get('description') || undefined,
        priority: data.get('priority') || 'normal', dueDate: data.get('dueDate') || undefined,
        moduleKey: data.get('moduleKey') || undefined,
      }),
    })
    if (!r.ok) { setMessage('Creation tache refusee.'); return }
    form.reset(); setMessage('Tache creee.'); await reload()
  }

  async function handleCompleteTask(taskId: string) {
    const r = await authedFetch(`/agenda/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    })
    if (r.ok) await reload()
  }

  async function handleReopenTask(taskId: string) {
    const r = await authedFetch(`/agenda/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'open' }),
    })
    if (r.ok) await reload()
  }

  async function handleToggleSubtask(taskId: string, subtaskId: string, isDone: boolean) {
    await authedFetch(`/agenda/tasks/${taskId}/subtasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '', isDone: !isDone }),
    })
    const r = await authedFetch(`/agenda/tasks/${taskId}`)
    if (r.ok) {
      const updated = await r.json()
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t))
    }
    void subtaskId
  }

  async function handleAddSubtask(event: FormEv) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const taskId = data.get('taskId'); if (!taskId) return
    const r = await authedFetch(`/agenda/tasks/${taskId}/subtasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: data.get('title'), position: Number(data.get('position') ?? 0) }),
    })
    if (!r.ok) { setMessage('Creation sous-tache refusee.'); return }
    form.reset(); await reload()
  }

  async function markNotificationRead(id: string) {
    const r = await authedFetch(`/agenda/notifications/${id}/read`, { method: 'PATCH' })
    if (r.ok) await reload()
  }

  async function markAllRead() {
    const unread = notifications.filter(n => !n.isRead)
    await Promise.all(unread.map(n => authedFetch(`/agenda/notifications/${n.id}/read`, { method: 'PATCH' })))
    await reload()
  }

  const openTasks = tasks.filter(t => t.status !== 'done')
  const doneTasks = tasks.filter(t => t.status === 'done')
  const now = new Date()
  const overdue = openTasks.filter(t => t.dueDate && new Date(t.dueDate) < now)
  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <section className="agenda-layout">
      {/* ─── TÂCHES ─── */}
      <article className="panel">
        <div className="panel-header">
          <div><span className="panel-kicker">Agenda</span><h2>Tâches</h2></div>
          <CalendarDays size={20} />
        </div>

        <div className="detail-grid">
          <span>Ouvertes<strong>{agendaDashboard?.openTasks ?? 0}</strong></span>
          <span>En retard<strong style={{ color: overdue.length > 0 ? '#f87171' : undefined }}>{agendaDashboard?.overdueTasks ?? 0}</strong></span>
          <span>Notifications<strong style={{ color: unreadCount > 0 ? '#fbbf24' : undefined }}>{agendaDashboard?.unreadNotifications ?? 0}</strong></span>
          <span>Terminées<strong>{doneTasks.length}</strong></span>
        </div>

        {/* Prochaines échéances */}
        {agendaDashboard?.upcomingTasks && agendaDashboard.upcomingTasks.length > 0 && (
          <div style={{ margin: '0 20px 8px', padding: '8px 12px', background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)', borderRadius: '8px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '6px' }}>PROCHAINES ÉCHÉANCES</div>
            {agendaDashboard.upcomingTasks.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '2px 0' }}>
                <span style={{ color: 'var(--text)' }}>{t.title}</span>
                <span style={{ color: 'var(--text3)', fontSize: '10px', fontFamily: 'var(--mono)' }}>{new Date(t.dueDate).toLocaleDateString('fr-FR')}</span>
              </div>
            ))}
          </div>
        )}

        {message && <p className="form-message">{message}</p>}

        <form className="finance-form" onSubmit={handleCreateTask}>
          <input name="title" placeholder="Titre de la tâche *" required />
          <input name="description" placeholder="Description" />
          <select name="priority" defaultValue="normal">
            <option value="high">🔴 Haute</option>
            <option value="normal">🟡 Normale</option>
            <option value="low">⚪ Basse</option>
          </select>
          <input name="dueDate" type="date" />
          <select name="moduleKey" defaultValue="">
            <option value="">Sans module</option>
            <option value="vehicles">🚗 Véhicules</option>
            <option value="finances">💸 Finances</option>
            <option value="stock">📦 Stock</option>
            <option value="real-estate">🏠 Immobilier</option>
          </select>
          <button className="primary-action" type="submit">Créer</button>
        </form>

        <form className="finance-form" onSubmit={handleAddSubtask} style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
          <select name="taskId" defaultValue="" required>
            <option value="" disabled>Tâche parente</option>
            {openTasks.map((t) => <option value={t.id} key={t.id}>{t.title}</option>)}
          </select>
          <input name="title" placeholder="Sous-tâche *" required />
          <button className="btn-ghost" type="submit">+ Sous-tâche</button>
        </form>

        {/* Liste tâches ouvertes */}
        <div className="document-list">
          {openTasks.length === 0 && <p className="muted">Aucune tâche ouverte.</p>}
          {openTasks.map((t) => {
            const isOverdue = t.dueDate && new Date(t.dueDate) < now
            return (
              <div key={t.id} style={{ borderLeft: `3px solid ${isOverdue ? '#f87171' : 'var(--border)'}`, paddingLeft: '8px', marginBottom: '6px' }}>
                <div className="document-row" style={{ padding: '6px 8px' }}>
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '0', display: 'flex' }}
                    onClick={() => handleCompleteTask(t.id)}
                    title="Marquer comme terminé"
                  >
                    <CheckCircle2 size={16} />
                  </button>
                  <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: isOverdue ? '#f87171' : 'var(--text)' }}>
                    {t.title}
                    {t.moduleKey && <em style={{ fontSize: '10px', color: 'var(--text3)', marginLeft: '6px', fontStyle: 'normal' }}>{t.moduleKey}</em>}
                  </span>
                  <PriorityBadge priority={t.priority} />
                  {t.dueDate && (
                    <small style={{ color: isOverdue ? '#f87171' : 'var(--text3)', fontFamily: 'var(--mono)', fontSize: '10px' }}>
                      {new Date(t.dueDate).toLocaleDateString('fr-FR')}
                    </small>
                  )}
                </div>
                {t.subtasks.length > 0 && (
                  <div style={{ paddingLeft: '24px', paddingBottom: '4px' }}>
                    {t.subtasks.map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0', fontSize: '12px', color: s.isDone ? 'var(--text3)' : 'var(--text2)' }}>
                        <input
                          type="checkbox"
                          checked={s.isDone}
                          onChange={() => handleToggleSubtask(t.id, s.id, s.isDone)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span style={{ textDecoration: s.isDone ? 'line-through' : 'none' }}>{s.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Terminées (repliées) */}
          {doneTasks.length > 0 && (
            <div style={{ marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '4px' }}>TERMINÉES ({doneTasks.length})</div>
              {doneTasks.slice(0, 5).map(t => (
                <div key={t.id} className="document-row muted-row" style={{ padding: '4px 8px' }}>
                  <CheckCircle2 size={14} style={{ color: '#4ade80' }} />
                  <span style={{ flex: 1, fontSize: '12px', textDecoration: 'line-through' }}>{t.title}</span>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: '10px', padding: '2px 6px' }}
                    onClick={() => handleReopenTask(t.id)}
                  >
                    Rouvrir
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </article>

      {/* ─── NOTIFICATIONS ─── */}
      <article className="panel">
        <div className="panel-header">
          <div>
            <span className="panel-kicker">Notifications</span>
            <h2>Cloche {unreadCount > 0 && <span className="badge" style={{ fontSize: '11px' }}>{unreadCount}</span>}</h2>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {unreadCount > 0 && (
              <button className="btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={markAllRead}>
                Tout lire
              </button>
            )}
            <Bell size={20} />
          </div>
        </div>

        <div className="document-list">
          {notifications.length === 0 ? (
            <p className="muted">Aucune notification.</p>
          ) : (
            notifications.map((n) => {
              const importanceColor = n.importance === 'high' ? '#f87171' : n.importance === 'normal' ? '#fbbf24' : 'var(--text3)'
              return (
                <button
                  className={n.isRead ? 'document-row muted-row' : 'document-row'}
                  key={n.id}
                  onClick={() => markNotificationRead(n.id)}
                  style={{ borderLeft: n.isRead ? undefined : `3px solid ${importanceColor}`, paddingLeft: n.isRead ? undefined : '8px' }}
                >
                  <Bell size={16} style={{ color: n.isRead ? 'var(--text3)' : importanceColor }} />
                  <span style={{ flex: 1 }}>
                    {n.title}
                    {n.message && <em style={{ display: 'block', fontSize: '10px', color: 'var(--text3)', fontStyle: 'normal' }}>{n.message}</em>}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    {!n.isRead && <span style={{ fontSize: '9px', color: importanceColor, fontFamily: 'var(--mono)', fontWeight: 700 }}>{n.importance.toUpperCase()}</span>}
                    {n.dueDate && <small style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{new Date(n.dueDate).toLocaleDateString('fr-FR')}</small>}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </article>
    </section>
  )
}
