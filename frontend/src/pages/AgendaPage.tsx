import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ChevronsUpDown, Plus } from 'lucide-react'
import { ConfirmButton } from '../components/ConfirmButton'
import { FieldTip } from '../components/FieldTip'
import { Modal } from '../components/Modal'
import { useAuth } from '../contexts/AuthContext'
import { SkeletonTabPage } from '../components/Skeleton'
import { SubSidebar } from '../components/SubSidebar'
import { useToast } from '../contexts/ToastContext'
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
  const toast = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'taches' | 'notifications' | 'calendrier'>('taches')
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); d.setDate(1); return d })

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
    setIsLoading(false)
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
    if (!r.ok) { toast.err('Création tâche refusée.'); return }
    form.reset(); setShowCreateTask(false); toast.ok('Tâche créée.'); await reload()
  }

  async function handleDeleteTask(taskId: string, _title: string) {
    const r = await authedFetch(`/agenda/tasks/${taskId}`, { method: 'DELETE' })
    if (!r.ok) { toast.err('Suppression refusée.'); return }
    toast.ok('Tâche supprimée.'); await reload()
  }

  async function handleCreateNotification(event: FormEv) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const r = await authedFetch('/agenda/notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: data.get('type') || 'reminder',
        title: data.get('title'),
        message: data.get('notifMessage') || undefined,
        importance: data.get('importance') || 'normal',
        dueDate: data.get('dueDate') || undefined,
      }),
    })
    if (!r.ok) { toast.err('Création notification refusée.'); return }
    form.reset(); setShowCreateNotif(false); toast.ok('Notification créée.'); await reload()
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
    await authedFetch(`/agenda/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDone: !isDone }),
    }).catch(() =>
      authedFetch(`/agenda/tasks/${taskId}/subtasks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '', isDone: !isDone }),
      })
    )
    const r = await authedFetch(`/agenda/tasks/${taskId}`)
    if (r.ok) {
      const updated = await r.json()
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t))
    }
  }

  async function handleDeleteNotification(id: string) {
    const r = await authedFetch(`/agenda/notifications/${id}`, { method: 'DELETE' })
    if (!r.ok) { toast.err('Suppression refusée.'); return }
    toast.ok('Notification supprimée.'); await reload()
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
    if (!r.ok) { toast.err('Création sous-tâche refusée.'); return }
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

  const [showCreateTask, setShowCreateTask]   = useState(false)
  const [showCreateNotif, setShowCreateNotif] = useState(false)
  const [taskSort, setTaskSort] = useState<'priority' | 'dueDate' | 'created'>('priority')
  const PRIORITY_ORDER: Record<string, number> = { high: 0, normal: 1, low: 2 }

  const now = new Date()
  const openTasks = useMemo(() => {
    const open = tasks.filter(t => t.status !== 'done')
    return [...open].sort((a, b) => {
      if (taskSort === 'priority') return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
      if (taskSort === 'dueDate') {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      }
      return 0
    })
  }, [tasks, taskSort])
  const doneTasks = tasks.filter(t => t.status === 'done')
  const overdue = openTasks.filter(t => t.dueDate && new Date(t.dueDate) < now)
  const unreadCount = notifications.filter(n => !n.isRead).length

  if (isLoading) return <SkeletonTabPage rows={8} />

  type Tab = 'taches' | 'notifications' | 'calendrier'
  const tabs = [
    { key: 'taches'        as Tab, label: `Tâches (${openTasks.length}${overdue.length > 0 ? ` · ${overdue.length} en retard` : ''})`, icon: <CheckCircle2 size={15} /> },
    { key: 'notifications' as Tab, label: `Alertes${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`, icon: <Bell size={15} /> },
    { key: 'calendrier'    as Tab, label: 'Calendrier', icon: <CalendarDays size={15} /> },
  ]

  return (
    <SubSidebar
      items={tabs}
      activeKey={activeTab}
      onSelect={setActiveTab}
      ariaLabel="Sections de l'agenda"
    >

      {/* ══ TÂCHES ══ */}
      {activeTab === 'taches' && (
        <article className="panel" style={{ marginTop: '16px' }}>
          <div className="panel-header">
            <div><span className="panel-kicker">Agenda</span><h2>Tâches</h2></div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <select
                value={taskSort}
                onChange={e => setTaskSort(e.target.value as typeof taskSort)}
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text2)', padding: '4px 8px', fontSize: '11px', fontFamily: 'var(--mono)', cursor: 'pointer' }}
              >
                <option value="priority">Priorité</option>
                <option value="dueDate">Échéance</option>
                <option value="created">Création</option>
              </select>
              <ChevronsUpDown size={14} style={{ color: 'var(--text3)' }} />
            </div>
          </div>

          <div className="detail-grid">
            <span>Ouvertes<strong>{agendaDashboard?.openTasks ?? 0}</strong></span>
            <span>En retard<strong style={{ color: overdue.length > 0 ? '#f87171' : undefined }}>{agendaDashboard?.overdueTasks ?? 0}</strong></span>
            <span>Terminées<strong>{doneTasks.length}</strong></span>
          </div>

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

          <div style={{ padding: '0 20px 12px', display: 'flex', gap: '8px' }}>
            <button className="primary-action" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowCreateTask(true)}>
              <Plus size={14} /> Nouvelle tâche
            </button>
            {openTasks.length > 0 && (
              <form className="finance-form" onSubmit={handleAddSubtask} style={{ flex: 1 }}>
                <select name="taskId" defaultValue="" required style={{ flex: 1 }}>
                  <option value="" disabled>Tâche parente</option>
                  {openTasks.map((t) => <option value={t.id} key={t.id}>{t.title}</option>)}
                </select>
                <input name="title" placeholder="Sous-tâche *" required style={{ flex: 2 }} />
                <button className="btn-ghost" type="submit" style={{ whiteSpace: 'nowrap' }}>+ Sous-tâche</button>
              </form>
            )}
          </div>

          <Modal open={showCreateTask} onClose={() => setShowCreateTask(false)} title="Nouvelle tâche" subtitle="Décris précisément ce qu'il faut faire et pourquoi." icon="✅">
            <form onSubmit={handleCreateTask}>
              <div className="modal-grid">
                <FieldTip label="Titre" hint="Nom court de la tâche — sois précis pour t'en souvenir plus tard." required style={{ gridColumn: '1/-1' }}>
                  <input name="title" className="modal-input" placeholder="Ex : Appeler le garage pour révision" required autoFocus />
                </FieldTip>
                <FieldTip label="Description / contexte" hint="Explique pourquoi tu crées cette tâche, les étapes, ou les infos utiles. Plus c'est détaillé, moins tu perdras de temps à te remémorer le contexte." style={{ gridColumn: '1/-1' }}>
                  <textarea name="description" className="modal-input" rows={3} placeholder="Ex : Suite à l'alerte CT rouge, appeler Michel au 06… pour fixer un RDV avant fin juin." style={{ resize: 'vertical' }} />
                </FieldTip>
                <FieldTip label="Priorité" hint="Haute = apparaît en tête de liste et génère des rappels plus fréquents. Basse = visible mais sans urgence.">
                  <select name="priority" className="modal-select" defaultValue="normal">
                    <option value="high">🔴 Haute</option>
                    <option value="normal">🟡 Normale</option>
                    <option value="low">⚪ Basse</option>
                  </select>
                </FieldTip>
                <FieldTip label="Date d'échéance" hint="Quand cette tâche doit-elle être terminée ? Les tâches en retard apparaissent en rouge.">
                  <input name="dueDate" type="date" className="modal-input" />
                </FieldTip>
                <FieldTip label="Module associé" hint="Lie cette tâche à un module (véhicules, finances…) pour la retrouver dans son contexte." style={{ gridColumn: '1/-1' }}>
                  <select name="moduleKey" className="modal-select" defaultValue="">
                    <option value="">Aucun module</option>
                    <option value="vehicles">🚗 Véhicules</option>
                    <option value="finances">💶 Finances</option>
                    <option value="stock">📦 Stock</option>
                    <option value="real-estate">🏠 Immobilier</option>
                  </select>
                </FieldTip>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setShowCreateTask(false)}>Annuler</button>
                <button type="submit" className="primary-action"><CalendarDays size={14} /> Créer la tâche</button>
              </div>
            </form>
          </Modal>

          <div className="document-list">
            {openTasks.length === 0 && <p className="muted">Aucune tâche ouverte — tout est à jour.</p>}
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
                    <ConfirmButton onConfirm={() => handleDeleteTask(t.id, t.title)} />
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
      )}

      {/* ══ CALENDRIER ══ */}
      {activeTab === 'calendrier' && (() => {
        const year = calMonth.getFullYear()
        const month = calMonth.getMonth()
        const firstDay = new Date(year, month, 1).getDay()
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        const startOffset = firstDay === 0 ? 6 : firstDay - 1 // lundi en premier
        const cells: (number | null)[] = [
          ...Array(startOffset).fill(null),
          ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
        ]
        while (cells.length % 7 !== 0) cells.push(null)

        const tasksByDay: Record<number, TaskItem[]> = {}
        tasks.forEach(t => {
          if (!t.dueDate) return
          const d = new Date(t.dueDate)
          if (d.getFullYear() === year && d.getMonth() === month) {
            const day = d.getDate()
            tasksByDay[day] = [...(tasksByDay[day] ?? []), t]
          }
        })

        const todayDay = new Date().getFullYear() === year && new Date().getMonth() === month ? new Date().getDate() : -1
        const monthName = calMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

        return (
          <article className="panel" style={{ marginTop: '16px' }}>
            <div className="panel-header">
              <div><span className="panel-kicker">Agenda</span><h2 style={{ textTransform: 'capitalize' }}>{monthName}</h2></div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="hdr-btn" onClick={() => setCalMonth(new Date(year, month - 1, 1))}><ChevronLeft size={16} /></button>
                <button className="btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setCalMonth(new Date())}>Aujourd'hui</button>
                <button className="hdr-btn" onClick={() => setCalMonth(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button>
              </div>
            </div>

            <div style={{ padding: '0 16px 16px' }}>
              {/* En-têtes jours */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontFamily: 'var(--mono)', color: 'var(--text3)', padding: '4px 0', fontWeight: 700 }}>{d}</div>
                ))}
              </div>

              {/* Grille */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                {cells.map((day, idx) => {
                  if (!day) return <div key={idx} />
                  const dayTasks = tasksByDay[day] ?? []
                  const isToday = day === todayDay
                  const hasOverdue = dayTasks.some(t => t.status !== 'done' && new Date(t.dueDate!).getTime() < Date.now())
                  return (
                    <div key={idx} style={{
                      minHeight: '64px', padding: '4px', borderRadius: '6px',
                      background: isToday ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isToday ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`,
                    }}>
                      <div style={{
                        fontSize: '11px', fontWeight: isToday ? 700 : 400,
                        color: isToday ? '#c4b5fd' : 'var(--text2)',
                        marginBottom: '2px', textAlign: 'right',
                      }}>{day}</div>
                      {dayTasks.slice(0, 3).map(t => (
                        <div key={t.id} style={{
                          fontSize: '9px', padding: '1px 4px', borderRadius: '3px', marginBottom: '1px',
                          background: t.status === 'done' ? 'rgba(74,222,128,0.1)' : hasOverdue ? 'rgba(248,113,113,0.15)' : 'rgba(124,58,237,0.15)',
                          color: t.status === 'done' ? '#4ade80' : hasOverdue ? '#f87171' : '#c4b5fd',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          textDecoration: t.status === 'done' ? 'line-through' : 'none',
                        }} title={t.title}>{t.title}</div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div style={{ fontSize: '9px', color: 'var(--text3)', textAlign: 'center' }}>+{dayTasks.length - 3}</div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Légende */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px', fontSize: '10px', color: 'var(--text3)', justifyContent: 'flex-end' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(124,58,237,0.3)', display: 'inline-block' }} />À faire</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(248,113,113,0.3)', display: 'inline-block' }} />En retard</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(74,222,128,0.2)', display: 'inline-block' }} />Terminée</span>
              </div>
            </div>
          </article>
        )
      })()}

      {/* ══ NOTIFICATIONS ══ */}
      {activeTab === 'notifications' && (
        <article className="panel" style={{ marginTop: '16px' }}>
          <div className="panel-header">
            <div>
              <span className="panel-kicker">Alertes</span>
              <h2>Notifications {unreadCount > 0 && <span className="badge" style={{ fontSize: '11px' }}>{unreadCount}</span>}</h2>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {unreadCount > 0 && (
                <button className="btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={markAllRead}>
                  Tout lire
                </button>
              )}
              <button className="primary-action" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }} onClick={() => setShowCreateNotif(true)}>
                <Plus size={13} /> Nouvelle alerte
              </button>
            </div>
          </div>

          <Modal open={showCreateNotif} onClose={() => setShowCreateNotif(false)} title="Nouvelle alerte / rappel" subtitle="Crée un rappel ou une notification à afficher à une date donnée." icon="🔔">
            <form onSubmit={handleCreateNotification}>
              <div className="modal-grid">
                <FieldTip label="Titre" hint="Intitulé court du rappel. Il apparaîtra dans la cloche en haut à droite." required style={{ gridColumn: '1/-1' }}>
                  <input name="title" className="modal-input" placeholder="Ex : Renouveler assurance véhicule" required autoFocus />
                </FieldTip>
                <FieldTip label="Message" hint="Détails supplémentaires visibles quand tu cliques sur la notification — contexte, numéros, liens utiles." style={{ gridColumn: '1/-1' }}>
                  <textarea name="notifMessage" className="modal-input" rows={2} placeholder="Ex : Contacter AXA avant le 30/06, ref contrat AX-2024-XXX" style={{ resize: 'vertical' }} />
                </FieldTip>
                <FieldTip label="Importance" hint="Haute = badge rouge dans la cloche. Normale = badge jaune. Basse = discret.">
                  <select name="importance" className="modal-select" defaultValue="normal">
                    <option value="low">⚪ Basse</option>
                    <option value="normal">🟡 Normale</option>
                    <option value="high">🔴 Haute</option>
                  </select>
                </FieldTip>
                <FieldTip label="Date d'échéance" hint="Date à laquelle tu veux être rappelé. Les alertes expirées restent visibles jusqu'à lecture.">
                  <input name="dueDate" type="date" className="modal-input" />
                </FieldTip>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setShowCreateNotif(false)}>Annuler</button>
                <button type="submit" className="primary-action"><Bell size={14} /> Créer l'alerte</button>
              </div>
            </form>
          </Modal>

          <div className="document-list">
            {notifications.length === 0 ? (
              <p className="muted">Aucune notification.</p>
            ) : (
              notifications.map((n) => {
                const importanceColor = n.importance === 'high' ? '#f87171' : n.importance === 'normal' ? '#fbbf24' : 'var(--text3)'
                return (
                  <div
                    className={n.isRead ? 'document-row muted-row' : 'document-row'}
                    key={n.id}
                    style={{ borderLeft: n.isRead ? undefined : `3px solid ${importanceColor}`, paddingLeft: n.isRead ? undefined : '8px', cursor: 'default' }}
                  >
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }} onClick={() => markNotificationRead(n.id)} title="Marquer comme lu">
                      <Bell size={16} style={{ color: n.isRead ? 'var(--text3)' : importanceColor }} />
                    </button>
                    <span style={{ flex: 1 }}>
                      {n.title}
                      {n.message && <em style={{ display: 'block', fontSize: '10px', color: 'var(--text3)', fontStyle: 'normal' }}>{n.message}</em>}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                      {!n.isRead && <span style={{ fontSize: '9px', color: importanceColor, fontFamily: 'var(--mono)', fontWeight: 700 }}>{n.importance.toUpperCase()}</span>}
                      {n.dueDate && <small style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{new Date(n.dueDate).toLocaleDateString('fr-FR')}</small>}
                    </div>
                    <ConfirmButton onConfirm={() => handleDeleteNotification(n.id)} confirmLabel="Suppr" />
                  </div>
                )
              })
            )}
          </div>
        </article>
      )}
    </SubSidebar>
  )
}
