import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { trackEvent } from '../analytics'

interface Props { children: ReactNode; label?: string }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Remonte au système d'analytics (no-op en V1, prêt pour PostHog en V2).
    trackEvent('error_boundary_caught', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      label: this.props.label,
    })
    // En dev, on garde la trace dans la console pour faciliter le debug.
    if (import.meta.env.DEV) {
       
      console.error('[ErrorBoundary]', error, info.componentStack)
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '240px', gap: '16px', padding: '32px', textAlign: 'center',
      }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '14px',
          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <AlertTriangle size={24} style={{ color: '#f87171' }} />
        </div>
        <div>
          <p style={{ fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
            {this.props.label ?? 'Une erreur inattendue est survenue'}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text3)', fontFamily: 'var(--mono)', margin: 0 }}>
            {this.state.error.message}
          </p>
        </div>
        <button
          className="btn-ghost"
          onClick={() => this.setState({ error: null })}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} /> Réessayer
        </button>
      </div>
    )
  }
}
