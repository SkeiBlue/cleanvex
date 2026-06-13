import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  /** Max width on desktop (default 560) */
  maxWidth?: number
  /** Icon/emoji shown next to the title */
  icon?: ReactNode
}

export function Modal({ open, onClose, title, subtitle, children, maxWidth = 560, icon }: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  /* ── Keyboard + body-scroll lock ── */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (contentRef.current && !contentRef.current.contains(e.target as Node)) onClose()
  }

  return createPortal(
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(6,8,25,0.75)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        /* desktop: center; mobile: align to bottom */
        alignItems: 'center',
        justifyContent: 'center',
      }}
      className="modal-backdrop"
    >
      <div
        ref={contentRef}
        className="modal-container"
        style={{
          maxWidth,
          width: '100%',
          // Fond/bordure/ombre déplacés dans .modal-container (styles.css) pour
          // être thémables (mode clair) — pas de couleur codée en dur ici.
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '12px',
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          {icon && (
            <div style={{
              width: 40, height: 40, borderRadius: '10px',
              background: 'rgba(124,58,237,0.15)',
              border: '1px solid rgba(124,58,237,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', flexShrink: 0,
            }}>
              {icon}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>{title}</h2>
            {subtitle && (
              <p style={{ fontSize: '12px', color: 'var(--text3)', margin: '4px 0 0', lineHeight: 1.4 }}>{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              flexShrink: 0, width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px', cursor: 'pointer',
              color: 'var(--text3)', transition: 'all 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.15)'; e.currentTarget.style.color = '#f87171' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.color = 'var(--text3)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px 24px' }}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
