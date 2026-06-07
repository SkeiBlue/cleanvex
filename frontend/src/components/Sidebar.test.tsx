import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import type { ModuleItem, User } from '../types'

const user: User = { id: 'u1', email: 'clement@example.com', username: 'Clement', role: 'admin', emailVerified: true }

function mods(...keys: string[]): ModuleItem[] {
  return keys.map((k, i) => ({ id: `m${i}`, key: k, title: k, version: '1.0.0', isEnabled: true }))
}

function wrap(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>)
}

describe('Sidebar', () => {
  it('rend les liens des modules activés', () => {
    wrap(<Sidebar user={user} modules={mods('vehicles', 'finances')} />)
    expect(screen.getByRole('link', { name: /véhicules|vehicles/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /finances/i })).toBeInTheDocument()
  })

  it('affiche un badge "Off" sur les modules désactivés', () => {
    const modules: ModuleItem[] = [
      { id: 'a', key: 'vehicles', title: 'Véhicules', version: '1.0.0', isEnabled: true },
      { id: 'b', key: 'finances', title: 'Finances', version: '1.0.0', isEnabled: false },
    ]
    const { container } = wrap(<Sidebar user={user} modules={modules} />)
    const financesLink = screen.getByRole('link', { name: /finances/i })
    expect(financesLink.querySelector('.nav-badge')).toHaveTextContent('Off')
    expect(container.querySelectorAll('.nav-badge')).toHaveLength(1)
  })

  it('appelle onToggleCollapse au clic sur le bouton', () => {
    const onToggleCollapse = vi.fn()
    wrap(<Sidebar user={user} modules={[]} onToggleCollapse={onToggleCollapse} />)
    fireEvent.click(screen.getByRole('button', { name: /réduire la sidebar/i }))
    expect(onToggleCollapse).toHaveBeenCalledTimes(1)
  })

  it('inverse aria-label quand collapsed=true', () => {
    wrap(<Sidebar user={user} modules={[]} collapsed onToggleCollapse={() => {}} />)
    expect(screen.getByRole('button', { name: /déplier la sidebar/i })).toBeInTheDocument()
  })
})
