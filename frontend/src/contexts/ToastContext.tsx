import { createContext, useCallback, useContext, useRef, useState } from 'react'

type ToastKind = 'ok' | 'err' | 'info'

export type Toast = {
  id: number
  message: string
  kind: ToastKind
}

type ToastContextType = {
  toasts: Toast[]
  toast: {
    ok: (msg: string) => void
    err: (msg: string) => void
    info: (msg: string) => void
  }
}

const ToastContext = createContext<ToastContextType | null>(null)

let counter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const add = useCallback((message: string, kind: ToastKind) => {
    const id = ++counter
    setToasts(prev => [...prev, { id, message, kind }])
    const t = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      timers.current.delete(id)
    }, 3500)
    timers.current.set(id, t)
  }, [])

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id)
    if (t) { clearTimeout(t); timers.current.delete(id) }
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = {
    ok:   (msg: string) => add(msg, 'ok'),
    err:  (msg: string) => add(msg, 'err'),
    info: (msg: string) => add(msg, 'info'),
  }

  return (
    <ToastContext.Provider value={{ toasts, toast }}>
      {children}
      <ToastList toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx.toast
}

const KIND: Record<ToastKind, { bg: string; border: string; color: string; icon: string }> = {
  ok:   { bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.25)',  color: '#4ade80', icon: '✓' },
  err:  { bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)', color: '#f87171', icon: '✕' },
  info: { bg: 'rgba(103,232,249,0.08)', border: 'rgba(103,232,249,0.25)', color: '#67e8f9', icon: 'ℹ' },
}

function ToastList({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="toast-container">
      {toasts.map(t => {
        const s = KIND[t.kind]
        return (
          <div
            key={t.id}
            className="toast"
            style={{ background: s.bg, border: `1px solid ${s.border}` }}
            onClick={() => onDismiss(t.id)}
          >
            <span className="toast-icon" style={{ color: s.color }}>{s.icon}</span>
            <span className="toast-msg" style={{ color: s.color }}>{t.message}</span>
          </div>
        )
      })}
    </div>
  )
}
