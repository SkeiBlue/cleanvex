import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChartPanel } from './ChartsSection'

describe('ChartPanel', () => {
  it('rend le titre, le kicker et les enfants', () => {
    render(
      <ChartPanel title="Revenus" kicker="6 derniers mois">
        <div>graph</div>
      </ChartPanel>,
    )
    expect(screen.getByText('Revenus')).toBeInTheDocument()
    expect(screen.getByText('6 derniers mois')).toBeInTheDocument()
    expect(screen.getByText('graph')).toBeInTheDocument()
  })
})
