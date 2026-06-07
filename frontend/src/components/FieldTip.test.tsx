import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FieldTip } from './FieldTip'

describe('FieldTip', () => {
  it('rend le label et les enfants', () => {
    render(
      <FieldTip label="Email" hint="Votre adresse mail">
        <input data-testid="i" />
      </FieldTip>,
    )
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByTestId('i')).toBeInTheDocument()
  })

  it('marque * quand required', () => {
    render(
      <FieldTip label="Nom" hint="h" required>
        <input />
      </FieldTip>,
    )
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('tooltip masquée par défaut, visible au clic', () => {
    render(
      <FieldTip label="X" hint="Mon astuce">
        <input />
      </FieldTip>,
    )
    expect(screen.queryByText('Mon astuce')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Mon astuce')).toBeInTheDocument()
  })

  it('tooltip toggle au second clic', () => {
    render(
      <FieldTip label="X" hint="Mon astuce">
        <input />
      </FieldTip>,
    )
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(screen.queryByText('Mon astuce')).not.toBeInTheDocument()
  })
})
