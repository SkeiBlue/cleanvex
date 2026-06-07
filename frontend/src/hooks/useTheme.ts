import { useCallback, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'ui.theme'

function readStored(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const v = window.localStorage.getItem(STORAGE_KEY)
  return v === 'light' ? 'light' : 'dark'
}

/** Applique l'attribut data-theme sur <html>. */
export function applyTheme(t: Theme) {
  if (typeof document === 'undefined') return
  if (t === 'light') document.documentElement.setAttribute('data-theme', 'light')
  else document.documentElement.removeAttribute('data-theme')
}

/** À appeler au boot (avant React render idéalement). */
export function initTheme() {
  applyTheme(readStored())
}

/** Hook UI : lit + persiste + applique le thème. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(readStored)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, t)
    setThemeState(t)
  }, [])

  return [theme, setTheme]
}
