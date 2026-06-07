import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConfirmButton } from './ConfirmButton'

describe('ConfirmButton', () => {
  it('1er clic affiche la confirmation, ne déclenche pas onConfirm', () => {
    const onConfirm = vi.fn()
    render(<ConfirmButton onConfirm={onConfirm} confirmLabel="Sûr" />)
    fireEvent.click(screen.getByRole('button', { name: /supprimer/i }))
    expect(screen.getByText(/Sûr \?/)).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('appelle onConfirm au clic sur Oui', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<ConfirmButton onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: /supprimer/i }))
    fireEvent.click(screen.getByRole('button', { name: /oui/i }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
  })

  it('annule au clic sur la croix', () => {
    const onConfirm = vi.fn()
    render(<ConfirmButton onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: /supprimer/i }))
    fireEvent.click(screen.getByRole('button', { name: /annuler/i }))
    expect(screen.queryByText(/Confirmer \?/)).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("utilise le label custom", () => {
    render(<ConfirmButton onConfirm={() => {}} label="Retirer" />)
    expect(screen.getByRole('button', { name: 'Retirer' })).toBeInTheDocument()
  })
})
