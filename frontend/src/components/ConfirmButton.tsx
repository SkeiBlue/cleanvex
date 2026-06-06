import { useState } from 'react'
import { Check, Trash2, X } from 'lucide-react'

type Props = {
  onConfirm: () => void | Promise<void>
  label?: string
  confirmLabel?: string
  danger?: boolean
  icon?: React.ReactNode
  style?: React.CSSProperties
  size?: 'sm' | 'md'
}

export function ConfirmButton({
  onConfirm,
  label,
  confirmLabel = 'Confirmer',
  danger = true,
  icon,
  style,
  size = 'sm',
}: Props) {
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(false)

  const btnSize = size === 'sm' ? { width: '26px', height: '26px' } : { padding: '6px 12px' }

  if (!pending) {
    return (
      <button
        className="hdr-btn"
        title={label ?? 'Supprimer'}
        style={{ ...btnSize, color: danger ? '#f87171' : 'var(--text2)', flexShrink: 0, ...style }}
        onClick={e => { e.stopPropagation(); setPending(true) }}
      >
        {icon ?? <Trash2 size={12} />}
      </button>
    )
  }

  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
      onClick={e => e.stopPropagation()}
    >
      <span style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
        {confirmLabel} ?
      </span>
      <button
        className="hdr-btn"
        style={{ width: '22px', height: '22px', color: '#4ade80' }}
        disabled={loading}
        onClick={async () => {
          setLoading(true)
          try { await onConfirm() } finally { setLoading(false); setPending(false) }
        }}
        title="Oui"
      >
        <Check size={11} />
      </button>
      <button
        className="hdr-btn"
        style={{ width: '22px', height: '22px', color: 'var(--text3)' }}
        onClick={() => setPending(false)}
        title="Annuler"
      >
        <X size={11} />
      </button>
    </span>
  )
}
