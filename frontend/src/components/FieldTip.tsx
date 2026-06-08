import { Children, cloneElement, isValidElement, useId, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'

interface FieldTipProps {
  label: string
  hint: string
  required?: boolean
  children: ReactNode
  /** extra style on the wrapper div */
  style?: React.CSSProperties
}

export function FieldTip({ label, hint, required = false, children, style }: FieldTipProps) {
  const [visible, setVisible] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  // Lie le <label> à son input via id auto-généré pour l'accessibilité
  // (lecteurs d'écran, clic sur label, focus). Un enfant qui définit déjà
  // son propre id garde la main.
  const generatedId = useId()
  let inputId: string = generatedId
  let childWithId: ReactNode = children
  const onlyChild = Children.count(children) === 1 ? Children.only(children) : null
  if (isValidElement(onlyChild)) {
    const props = (onlyChild as ReactElement).props as { id?: string }
    inputId = props.id ?? generatedId
    if (!props.id) {
      childWithId = cloneElement(onlyChild as ReactElement<{ id?: string }>, { id: inputId })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', ...style }}>
      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <label htmlFor={inputId} style={{
          fontSize: '10px', fontFamily: 'var(--mono)', color: 'var(--text3)',
          textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600,
        }}>
          {label}{required && <span style={{ color: '#f87171', marginLeft: '2px' }}>*</span>}
        </label>

        {/* ? button */}
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <button
            ref={btnRef}
            type="button"
            tabIndex={-1}
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
            onFocus={() => setVisible(true)}
            onBlur={() => setVisible(false)}
            onClick={() => setVisible(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 16, height: 16, borderRadius: '50%',
              background: visible ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${visible ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.1)'}`,
              cursor: 'pointer', color: visible ? '#c4b5fd' : 'var(--text3)',
              transition: 'all 0.12s', padding: 0, flexShrink: 0,
            }}
            aria-label={`Aide : ${label}`}
          >
            <HelpCircle size={9} />
          </button>

          {/* Tooltip bubble */}
          {visible && (
            <div style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 2000,
              background: 'rgba(14,18,50,0.98)',
              border: '1px solid rgba(124,58,237,0.35)',
              borderRadius: '10px',
              padding: '10px 12px',
              width: 220,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              pointerEvents: 'none',
            }}>
              {/* Arrow */}
              <div style={{
                position: 'absolute',
                top: '100%', left: '50%',
                transform: 'translateX(-50%)',
                width: 0, height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '5px solid rgba(124,58,237,0.35)',
              }} />
              <p style={{
                margin: 0, fontSize: '11px', color: 'var(--text2)',
                lineHeight: 1.5, fontFamily: 'var(--font)',
              }}>
                {hint}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      {childWithId}
    </div>
  )
}
