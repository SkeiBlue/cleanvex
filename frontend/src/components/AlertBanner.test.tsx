import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlertBanner } from './AlertBanner'

describe('AlertBanner', () => {
  it("n'affiche rien quand aucune alerte", () => {
    const { container } = render(
      <AlertBanner unreadNotifications={0} overdueTasks={0} openTasks={5} documentCount={3} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('affiche le compteur de tâches en retard en priorité', () => {
    render(<AlertBanner unreadNotifications={2} overdueTasks={3} openTasks={5} documentCount={1} />)
    expect(screen.getByText(/3 tâches en retard/i)).toBeInTheDocument()
  })

  it('singulier "1 tâche en retard"', () => {
    render(<AlertBanner unreadNotifications={0} overdueTasks={1} openTasks={2} documentCount={0} />)
    expect(screen.getByText(/^1 tâche en retard$/i)).toBeInTheDocument()
  })

  it('affiche le compteur de notifications si pas de retard', () => {
    render(<AlertBanner unreadNotifications={4} overdueTasks={0} openTasks={1} documentCount={0} />)
    expect(screen.getByText(/4 notifications non lues/i)).toBeInTheDocument()
  })
})
