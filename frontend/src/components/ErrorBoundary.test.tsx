import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from './ErrorBoundary'

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom')
  return <div>contenu sain</div>
}

describe('ErrorBoundary', () => {
  let errSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => errSpy.mockRestore())

  it('rend les enfants quand pas d\'erreur', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('contenu sain')).toBeInTheDocument()
  })

  it('affiche le fallback avec label custom quand un enfant throw', () => {
    render(
      <ErrorBoundary label="Échec du module">
        <Boom shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Échec du module')).toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /réessayer/i })).toBeInTheDocument()
  })

  it('reset l\'état au clic Réessayer', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <ErrorBoundary>
        <Boom shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('boom')).toBeInTheDocument()
    rerender(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    )
    await user.click(screen.getByRole('button', { name: /réessayer/i }))
    expect(screen.getByText('contenu sain')).toBeInTheDocument()
  })
})
