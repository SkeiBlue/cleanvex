import { useEffect } from 'react'

/**
 * Active la classe `is-visible` sur tout élément `.reveal` qui entre dans
 * la viewport pour déclencher l'animation d'apparition. IntersectionObserver
 * natif, pas de dépendance. Ignoré quand prefers-reduced-motion via CSS.
 */
export function useScrollReveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const els = document.querySelectorAll<HTMLElement>('.reveal')
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible')
          io.unobserve(e.target)
        }
      })
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
}
