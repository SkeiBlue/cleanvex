import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from './StatCard'

describe('StatCard', () => {
  it('rend label, valeur et icône', () => {
    render(<StatCard colorClass="c1" label="Véhicules" value={3} icon="🚗" />)
    expect(screen.getByText('Véhicules')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('🚗')).toBeInTheDocument()
  })

  it('omet sub et trend si non fournis', () => {
    const { container } = render(<StatCard colorClass="c2" label="X" value="0" icon="•" />)
    expect(container.querySelector('.stat-sub')).toBeNull()
    expect(container.querySelector('.stat-trend')).toBeNull()
  })

  it('affiche sub et trend avec la classe par défaut trend-flat', () => {
    const { container } = render(
      <StatCard colorClass="c3" label="X" value="42" icon="•" sub="ce mois" trend="+5%" />,
    )
    expect(screen.getByText('ce mois')).toBeInTheDocument()
    expect(screen.getByText('+5%')).toBeInTheDocument()
    expect(container.querySelector('.stat-trend.trend-flat')).not.toBeNull()
  })

  it('applique trendClass custom', () => {
    const { container } = render(
      <StatCard colorClass="c4" label="X" value="1" icon="•" trend="↑" trendClass="trend-up" />,
    )
    expect(container.querySelector('.stat-trend.trend-up')).not.toBeNull()
  })
})
