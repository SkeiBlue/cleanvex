import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
  Skeleton,
  SkeletonCard,
  SkeletonRow,
  SkeletonStatTile,
  SkeletonGridPage,
  SkeletonDashboard,
  SkeletonTabPage,
} from './Skeleton'

describe('Skeleton', () => {
  it('applique width et height par défaut', () => {
    const { container } = render(<Skeleton />)
    const node = container.firstElementChild as HTMLElement
    expect(node.style.width).toBe('100%')
    expect(node.style.height).toBe('14px')
  })

  it('applique width et height custom', () => {
    const { container } = render(<Skeleton width="42px" height="9px" />)
    const node = container.firstElementChild as HTMLElement
    expect(node.style.width).toBe('42px')
    expect(node.style.height).toBe('9px')
  })

  it('SkeletonCard contient plusieurs blocs', () => {
    const { container } = render(<SkeletonCard />)
    expect(container.querySelectorAll('div').length).toBeGreaterThan(3)
  })

  it('SkeletonRow et SkeletonStatTile rendent sans erreur', () => {
    const { container: c1 } = render(<SkeletonRow />)
    const { container: c2 } = render(<SkeletonStatTile />)
    expect(c1.firstElementChild).not.toBeNull()
    expect(c2.firstElementChild).not.toBeNull()
  })

  it('SkeletonGridPage respecte le count', () => {
    const { container } = render(<SkeletonGridPage count={3} />)
    const grid = container.querySelector('div > div:last-child')
    expect(grid?.children.length).toBe(3)
  })

  it('SkeletonDashboard et SkeletonTabPage rendent sans erreur', () => {
    const { container: c1 } = render(<SkeletonDashboard />)
    const { container: c2 } = render(<SkeletonTabPage rows={2} />)
    expect(c1.firstElementChild).not.toBeNull()
    expect(c2.firstElementChild).not.toBeNull()
  })
})
