import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TopHeader } from './TopHeader'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    authedFetch: vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
    setUnreadNotifications: vi.fn(),
    user: { id: '1', username: 'Clement', role: 'user' },
  }),
}))

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

function makeProps(overrides: Partial<Parameters<typeof TopHeader>[0]> = {}) {
  return {
    username: 'Clement',
    dateLabel: 'lun. 07 juin',
    unreadNotifications: 0,
    onLogout: vi.fn(),
    onMenuToggle: vi.fn(),
    onCmdOpen: vi.fn(),
    ...overrides,
  }
}

describe('TopHeader', () => {
  it('affiche le salut et la date', () => {
    renderWithRouter(<TopHeader {...makeProps()} />)
    expect(screen.getByText('Clement')).toBeInTheDocument()
    expect(screen.getByText(/lun\. 07 juin/)).toBeInTheDocument()
  })

  it('appelle onLogout au clic sur Déconnexion', () => {
    const onLogout = vi.fn()
    renderWithRouter(<TopHeader {...makeProps({ onLogout })} />)
    fireEvent.click(screen.getByRole('button', { name: /déconnexion/i }))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it("aria-label des notifications mentionne le compteur quand > 0", () => {
    renderWithRouter(<TopHeader {...makeProps({ unreadNotifications: 3 })} />)
    expect(screen.getByRole('button', { name: /notifications.*3 non lues/i })).toBeInTheDocument()
  })

  it('appelle onCmdOpen au clic sur Rechercher', () => {
    const onCmdOpen = vi.fn()
    renderWithRouter(<TopHeader {...makeProps({ onCmdOpen })} />)
    fireEvent.click(screen.getByTitle(/recherche globale/i))
    expect(onCmdOpen).toHaveBeenCalledTimes(1)
  })
})
