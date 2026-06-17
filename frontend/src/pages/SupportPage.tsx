import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft, ChevronRight, LifeBuoy, Plus, RefreshCw, Send,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { relativeDate } from '../utils/date'
import { SkeletonTabPage } from '../components/Skeleton'
import type { SupportTicket } from '../types'

export const CATEGORIES: Record<string, string> = {
  general: 'Général',
  bug: 'Bug',
  feature: 'Suggestion',
  account: 'Compte',
  billing: 'Facturation',
}

export const PRIORITIES: Record<string, string> = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
  urgent: 'Urgente',
}

export const STATUSES: Record<string, string> = {
  open: 'Ouvert',
  pending: 'En attente',
  resolved: 'Résolu',
  closed: 'Clôturé',
}

function statusColor(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'open': return { bg: 'rgba(52,211,153,0.15)', fg: '#34d399' }
    case 'pending': return { bg: 'rgba(251,191,36,0.15)', fg: '#fbbf24' }
    case 'resolved': return { bg: 'rgba(96,165,250,0.15)', fg: '#60a5fa' }
    case 'closed': return { bg: 'rgba(255,255,255,0.06)', fg: 'var(--text3)' }
    default: return { bg: 'rgba(255,255,255,0.06)', fg: 'var(--text3)' }
  }
}

export function priorityColor(priority: string): string {
  switch (priority) {
    case 'urgent': return '#f87171'
    case 'high': return '#fb923c'
    case 'low': return 'var(--text3)'
    default: return 'var(--text2)'
  }
}

export function Badge({ status }: { status: string }) {
  const c = statusColor(status)
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      background: c.bg, color: c.fg, whiteSpace: 'nowrap',
    }}>
      {STATUSES[status] ?? status}
    </span>
  )
}

export function SupportPage() {
  const { authedFetch } = useAuth()

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    // Chaque utilisateur ne voit que ses propres tickets. La gestion de tous
    // les tickets se fait dans le tableau de bord admin (onglet Support).
    const r = await authedFetch('/support')
    if (r.ok) setTickets(await r.json())
    setLoading(false)
  }, [authedFetch])

  useEffect(() => { load() }, [load])

  if (selectedId) {
    return (
      <TicketDetail
        id={selectedId}
        isAdmin={false}
        onBack={() => { setSelectedId(null); load() }}
      />
    )
  }

  if (loading && tickets.length === 0) return <SkeletonTabPage />

  // Les tickets clôturés sont masqués par défaut.
  const closedCount = tickets.filter(t => t.status === 'closed').length
  const visibleTickets = showClosed ? tickets : tickets.filter(t => t.status !== 'closed')

  return (
    <>
      <div className="panel-header" style={{ marginBottom: 20 }}>
        <div>
          <span className="panel-kicker">Assistance</span>
          <h2>Support</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={load} disabled={loading}>
            <RefreshCw size={14} style={{ marginRight: 6 }} />
            {loading ? 'Chargement…' : 'Actualiser'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} style={{ marginRight: 6 }} />
            Nouveau ticket
          </button>
        </div>
      </div>

      {showCreate && (
        <CreateTicketForm
          onClose={() => setShowCreate(false)}
          onCreated={(t) => { setShowCreate(false); setSelectedId(t.id) }}
        />
      )}

      {tickets.length === 0 ? (
        <div className="panel" style={{ padding: 40, textAlign: 'center' }}>
          <LifeBuoy size={32} style={{ color: 'var(--text3)', marginBottom: 12 }} />
          <p style={{ color: 'var(--text2)', marginBottom: 4 }}>Aucun ticket pour le moment.</p>
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>
            Ouvre un ticket pour signaler un problème ou poser une question.
          </p>
        </div>
      ) : (
        <>
          <div className="panel" style={{ padding: 0 }}>
            {visibleTickets.map(t => (
              <button key={t.id} className="support-row" onClick={() => setSelectedId(t.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{
                      color: 'var(--text)', fontSize: 14, fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {t.subject}
                    </span>
                    <Badge status={t.status} />
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>{CATEGORIES[t.category] ?? t.category}</span>
                    <span style={{ color: priorityColor(t.priority) }}>● {PRIORITIES[t.priority] ?? t.priority}</span>
                    <span>{t._count?.messages ?? 0} message(s)</span>
                    <span>· {relativeDate(t.updatedAt)}</span>
                  </div>
                </div>
                <ChevronRight size={16} className="support-chevron" />
              </button>
            ))}
            {visibleTickets.length === 0 && (
              <p style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                Aucun ticket actif. Tous tes tickets sont clôturés.
              </p>
            )}
          </div>

          {closedCount > 0 && (
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setShowClosed(v => !v)}>
                {showClosed
                  ? 'Masquer les tickets clôturés'
                  : `Afficher les tickets clôturés (${closedCount})`}
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}

/* ── Création d'un ticket ──────────────────────────────────────────── */
function CreateTicketForm({
  onClose, onCreated,
}: { onClose: () => void; onCreated: (t: SupportTicket) => void }) {
  const { authedFetch } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = {
      subject: String(fd.get('subject') ?? '').trim(),
      body: String(fd.get('body') ?? '').trim(),
      category: String(fd.get('category') ?? 'general'),
      priority: String(fd.get('priority') ?? 'normal'),
    }
    if (payload.subject.length < 3 || !payload.body) {
      setError('Sujet (3 caractères min.) et description sont requis.')
      return
    }
    setBusy(true)
    setError(null)
    const r = await authedFetch('/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setBusy(false)
    if (r.ok) onCreated(await r.json())
    else setError('Échec de la création du ticket.')
  }

  return (
    <form onSubmit={submit} className="panel" style={{ padding: 18, marginBottom: 20 }}>
      <h3 style={{ marginTop: 0, marginBottom: 14 }}>Nouveau ticket</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          name="subject" placeholder="Sujet" className="modal-input"
          maxLength={150} autoFocus
        />
        <div style={{ display: 'flex', gap: 12 }}>
          <select name="category" className="modal-select" defaultValue="general" style={{ flex: 1 }}>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="priority" className="modal-select" defaultValue="normal" style={{ flex: 1 }}>
            {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <textarea
          name="body" placeholder="Décris ton problème ou ta demande…"
          className="modal-input" rows={5} maxLength={5000}
          style={{ resize: 'vertical' }}
        />
        {error && <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Envoi…' : 'Créer le ticket'}
          </button>
        </div>
      </div>
    </form>
  )
}

/* ── Détail d'un ticket + fil de discussion ────────────────────────── */
export function TicketDetail({
  id, isAdmin, onBack, onUserClick,
}: {
  id: string
  isAdmin: boolean
  onBack: () => void
  // Optionnel (vue admin) : ouvre la popup d'infos sur le demandeur.
  onUserClick?: (owner: SupportTicket['user']) => void
}) {
  const { authedFetch } = useAuth()
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await authedFetch(`/support/${id}`)
    if (r.ok) setTicket(await r.json())
    setLoading(false)
  }, [authedFetch, id])

  useEffect(() => { load() }, [load])

  async function sendReply() {
    const body = reply.trim()
    if (!body) return
    setBusy(true)
    const r = await authedFetch(`/support/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    setBusy(false)
    if (r.ok) { setReply(''); load() }
  }

  async function patch(data: { status?: string; priority?: string }) {
    const r = await authedFetch(`/support/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (r.ok) load()
  }

  if (loading) return <SkeletonTabPage />
  if (!ticket) {
    return (
      <>
        <button className="btn btn-ghost" onClick={onBack}><ArrowLeft size={14} style={{ marginRight: 6 }} /> Retour</button>
        <p style={{ color: 'var(--text3)', marginTop: 20 }}>Ticket introuvable.</p>
      </>
    )
  }

  const closed = ticket.status === 'closed'

  return (
    <>
      <div className="panel-header" style={{ marginBottom: 16 }}>
        <button className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft size={14} style={{ marginRight: 6 }} /> Retour
        </button>
      </div>

      <div className="panel" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ margin: '0 0 6px' }}>{ticket.subject}</h2>
            <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span>{CATEGORIES[ticket.category] ?? ticket.category}</span>
              <span style={{ color: priorityColor(ticket.priority) }}>● {PRIORITIES[ticket.priority] ?? ticket.priority}</span>
              {isAdmin && ticket.user && (
                onUserClick ? (
                  <button
                    type="button"
                    onClick={() => onUserClick(ticket.user)}
                    title="Voir la fiche de l'utilisateur"
                    style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      color: '#a78bfa', fontSize: 12, fontFamily: 'var(--font)',
                      textDecoration: 'underline', textUnderlineOffset: 2,
                    }}
                  >
                    · {ticket.user.username ?? ticket.user.email}
                  </button>
                ) : (
                  <span>· {ticket.user.username ?? ticket.user.email}</span>
                )
              )}
              <span>· ouvert {relativeDate(ticket.createdAt)}</span>
            </div>
          </div>
          <Badge status={ticket.status} />
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', gap: 12, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              Statut
              <select className="modal-select" value={ticket.status} onChange={e => patch({ status: e.target.value })}>
                {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              Priorité
              <select className="modal-select" value={ticket.priority} onChange={e => patch({ priority: e.target.value })}>
                {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>

      {/* Fil de messages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {ticket.messages?.map(m => (
          <div
            key={m.id}
            className="panel"
            style={{
              padding: 14,
              borderLeft: `3px solid ${m.isStaff ? '#a78bfa' : 'var(--border)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                {m.author?.username ?? m.author?.email ?? 'Utilisateur'}
              </span>
              {m.isStaff && (
                <span style={{ fontSize: 10, fontWeight: 600, color: '#c4b5fd', background: 'rgba(124,58,237,0.15)', padding: '1px 7px', borderRadius: 20 }}>
                  Support
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>
                {relativeDate(m.createdAt)}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text2)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {m.body}
            </p>
          </div>
        ))}
      </div>

      {/* Réponse */}
      {closed ? (
        <p style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: 16 }}>
          Ce ticket est clôturé.{isAdmin ? ' Rouvre-le pour répondre.' : ' Contacte le support pour le rouvrir.'}
        </p>
      ) : (
        <div className="panel" style={{ padding: 14 }}>
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="Écris ta réponse…"
            className="modal-input"
            rows={3}
            maxLength={5000}
            style={{ resize: 'vertical', marginBottom: 10 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={sendReply} disabled={busy || !reply.trim()}>
              <Send size={14} style={{ marginRight: 4 }} />
              {busy ? 'Envoi…' : 'Envoyer'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
