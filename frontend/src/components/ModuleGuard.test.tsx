import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ModuleGuard } from './ModuleGuard'

const mockAuth = vi.hoisted(() => ({ modules: [] as Array<{ key: string; title: string; isEnabled: boolean }> }))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}))

function wrap(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>)
}

describe('ModuleGuard', () => {
  it('rend les enfants si le module est activé', () => {
    mockAuth.modules = [{ key: 'vehicles', title: 'Véhicules', isEnabled: true }]
    wrap(
      <ModuleGuard moduleKey="vehicles">
        <div>contenu vehicules</div>
      </ModuleGuard>,
    )
    expect(screen.getByText('contenu vehicules')).toBeInTheDocument()
  })

  it('affiche le placeholder si le module est désactivé', () => {
    mockAuth.modules = [{ key: 'vehicles', title: 'Véhicules', isEnabled: false }]
    wrap(
      <ModuleGuard moduleKey="vehicles">
        <div>contenu vehicules</div>
      </ModuleGuard>,
    )
    expect(screen.getByText('Module désactivé')).toBeInTheDocument()
    expect(screen.getByText('Véhicules')).toBeInTheDocument()
    expect(screen.queryByText('contenu vehicules')).not.toBeInTheDocument()
  })

  it("rend les enfants si le module est introuvable (fallback permissif)", () => {
    mockAuth.modules = []
    wrap(
      <ModuleGuard moduleKey="vehicles">
        <div>contenu vehicules</div>
      </ModuleGuard>,
    )
    expect(screen.getByText('contenu vehicules')).toBeInTheDocument()
  })
})
