import { describe, it, expect, vi } from 'vitest'
import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { TopHeader } from './TopHeader'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    authedFetch: vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
    setUnreadNotifications: vi.fn(),
  }),
}))

function makeProps(overrides: Partial<Parameters<typeof TopHeader>[0]> = {}) {
  return {
    username: 'Clement',
    dateLabel: 'lun. 07 juin',
    unreadNotifications: 0,
    onLogout: vi.fn(),
    onMenuToggle: vi.fn(),
    onCmdOpen: vi.fn(),
    searchQuery: '',
    onSearchChange: vi.fn(),
    onSearch: vi.fn(e => e.preventDefault()),
    searchResults: [],
    searchOpen: false,
    onSearchResultClick: vi.fn(),
    onSearchClose: vi.fn(),
    searchRef: createRef<HTMLDivElement>(),
    ...overrides,
  }
}

describe('TopHeader', () => {
  it('affiche le salut et la date', () => {
    render(<TopHeader {...makeProps()} />)
    expect(screen.getByText('Clement')).toBeInTheDocument()
    expect(screen.getByText(/LUN\. 07 JUIN/)).toBeInTheDocument()
  })

  it('appelle onLogout au clic sur Déconnexion', () => {
    const onLogout = vi.fn()
    render(<TopHeader {...makeProps({ onLogout })} />)
    fireEvent.click(screen.getByRole('button', { name: /déconnexion/i }))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it("aria-label des notifications mentionne le compteur quand > 0", () => {
    render(<TopHeader {...makeProps({ unreadNotifications: 3 })} />)
    expect(screen.getByRole('button', { name: /notifications.*3 non lues/i })).toBeInTheDocument()
  })

  it('appelle onCmdOpen au clic sur Rechercher', () => {
    const onCmdOpen = vi.fn()
    render(<TopHeader {...makeProps({ onCmdOpen })} />)
    fireEvent.click(screen.getByTitle(/recherche globale/i))
    expect(onCmdOpen).toHaveBeenCalledTimes(1)
  })
})
