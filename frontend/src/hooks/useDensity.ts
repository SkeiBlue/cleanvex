import { useCallback, useEffect, useState } from 'react'

export type Density = 'comfortable' | 'compact'

const STORAGE_KEY = 'ui.density'

function readStored(): Density {
  if (typeof window === 'undefined') return 'comfortable'
  const v = window.localStorage.getItem(STORAGE_KEY)
  return v === 'compact' ? 'compact' : 'comfortable'
}

/** Applique l'attribut data-density sur <html>. À appeler au boot. */
export function applyDensity(d: Density) {
  if (typeof document === 'undefined') return
  if (d === 'compact') document.documentElement.setAttribute('data-density', 'compact')
  else document.documentElement.removeAttribute('data-density')
}

/** Initialise la densité au plus tôt (avant React mount idéalement). */
export function initDensity() {
  applyDensity(readStored())
}

/** Hook UI : lit + persiste + applique la densité. */
export function useDensity(): [Density, (d: Density) => void] {
  const [density, setDensityState] = useState<Density>(readStored)

  useEffect(() => {
    applyDensity(density)
  }, [density])

  const setDensity = useCallback((d: Density) => {
    window.localStorage.setItem(STORAGE_KEY, d)
    setDensityState(d)
  }, [])

  return [density, setDensity]
}
