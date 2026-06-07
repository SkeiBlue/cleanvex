import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CommandPalette } from './CommandPalette'

const stableAuthedFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
const stableAuth = { authedFetch: stableAuthedFetch }
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => stableAuth,
}))

function wrap(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>)
}

describe('CommandPalette', () => {
  it('ne rend rien si open=false', () => {
    wrap(<CommandPalette open={false} onClose={() => {}} />)
    expect(screen.queryByPlaceholderText(/rechercher partout/i)).not.toBeInTheDocument()
  })

  it('affiche les quick links quand vide', () => {
    wrap(<CommandPalette open onClose={() => {}} />)
    expect(screen.getByText('NAVIGATION RAPIDE')).toBeInTheDocument()
    expect(screen.getByText('Tableau de bord')).toBeInTheDocument()
    expect(screen.getByText('Véhicules')).toBeInTheDocument()
  })

  it('Escape déclenche onClose', () => {
    const onClose = vi.fn()
    wrap(<CommandPalette open onClose={onClose} />)
    fireEvent.keyDown(screen.getByPlaceholderText(/rechercher partout/i), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clic sur quick link déclenche onClose', () => {
    const onClose = vi.fn()
    wrap(<CommandPalette open onClose={onClose} />)
    fireEvent.click(screen.getByText('Véhicules'))
    expect(onClose).toHaveBeenCalled()
  })
})
