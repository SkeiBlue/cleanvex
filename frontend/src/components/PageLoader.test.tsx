import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageLoader } from './PageLoader'

describe('PageLoader', () => {
  it('rend le texte de chargement', () => {
    render(<PageLoader />)
    expect(screen.getByText(/chargement/i)).toBeInTheDocument()
  })

  it('rend un spinner via la classe attendue', () => {
    const { container } = render(<PageLoader />)
    expect(container.querySelector('.page-loader-spinner')).not.toBeNull()
  })
})
