import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Modal } from './Modal'

describe('Modal', () => {
  it("ne rend rien quand open=false", () => {
    render(
      <Modal open={false} onClose={() => {}} title="T">
        <div>contenu</div>
      </Modal>,
    )
    expect(screen.queryByText('contenu')).not.toBeInTheDocument()
  })

  it('rend titre, sous-titre et children quand open=true', () => {
    render(
      <Modal open onClose={() => {}} title="Mon titre" subtitle="Sous">
        <div>contenu</div>
      </Modal>,
    )
    expect(screen.getByText('Mon titre')).toBeInTheDocument()
    expect(screen.getByText('Sous')).toBeInTheDocument()
    expect(screen.getByText('contenu')).toBeInTheDocument()
  })

  it('appelle onClose sur Escape', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="T">
        <div>x</div>
      </Modal>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('appelle onClose au clic sur le backdrop mais pas sur le contenu', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="T">
        <div>contenu</div>
      </Modal>,
    )
    fireEvent.click(screen.getByText('contenu'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(document.querySelector('.modal-backdrop') as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('verrouille le scroll du body et le libère à la fermeture', () => {
    const { rerender } = render(
      <Modal open onClose={() => {}} title="T">
        <div>x</div>
      </Modal>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    rerender(
      <Modal open={false} onClose={() => {}} title="T">
        <div>x</div>
      </Modal>,
    )
    expect(document.body.style.overflow).toBe('')
  })
})
