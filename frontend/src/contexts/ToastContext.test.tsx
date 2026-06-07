import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider, useToast } from './ToastContext'

function Probe({ kind, msg }: { kind: 'ok' | 'err' | 'info'; msg: string }) {
  const t = useToast()
  return <button onClick={() => t[kind](msg)}>fire</button>
}

describe('ToastContext', () => {
  it('affiche un toast au déclenchement', () => {
    render(
      <ToastProvider>
        <Probe kind="ok" msg="Sauvegardé" />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('fire'))
    expect(screen.getByText('Sauvegardé')).toBeInTheDocument()
  })

  it('dismiss au clic sur le toast', () => {
    render(
      <ToastProvider>
        <Probe kind="err" msg="Boom" />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('fire'))
    const toast = screen.getByText('Boom')
    fireEvent.click(toast)
    expect(screen.queryByText('Boom')).not.toBeInTheDocument()
  })

  it('useToast hors provider throw', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe kind="info" msg="x" />)).toThrow(/ToastProvider/)
    errSpy.mockRestore()
  })
})
