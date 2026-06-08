import { useEffect } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

const TOUR_STORAGE_KEY = 'monespace.onboarding.completed.v1'

const STEPS = [
  {
    element: '[data-tour="sidebar"]',
    popover: {
      title: 'Bienvenue sur MonEspace 👋',
      description: "Voici la navigation principale. Chaque module (véhicules, finances, agenda…) a sa section ici. Tu peux la replier avec la flèche en haut.",
      side: 'right' as const, align: 'start' as const,
    },
  },
  {
    element: '[data-tour="sidebar-modules"]',
    popover: {
      title: 'Les modules',
      description: "Active ou désactive un module depuis l'administration. Les modules désactivés disparaissent de cette liste.",
      side: 'right' as const, align: 'center' as const,
    },
  },
  {
    element: '[data-tour="dashboard-title"]',
    popover: {
      title: 'Le tableau de bord',
      description: "Une vue synthétique de tout ce qui se passe : tâches en retard, finances, véhicules, documents… Il se remplira au fur et à mesure que tu utilises l'app.",
      side: 'bottom' as const, align: 'start' as const,
    },
  },
  {
    element: '[data-tour="user-card"]',
    popover: {
      title: 'Ton compte',
      description: "Ton profil, ton rôle et la version de l'app. Tu peux modifier tes infos dans Paramètres.",
      side: 'right' as const, align: 'end' as const,
    },
  },
  {
    element: '[data-tour="settings-link"]',
    popover: {
      title: 'Paramètres',
      description: "Mot de passe, 2FA, préférences. Et si tu veux refaire ce tour : c'est ici, dans la section « Aide ».",
      side: 'right' as const, align: 'center' as const,
    },
  },
  {
    popover: {
      title: "C'est parti ! 🚀",
      description: "Tu peux maintenant explorer librement. N'hésite pas à ajouter ton premier véhicule, document ou rappel — le dashboard se remplira automatiquement.",
    },
  },
]

function startTour() {
  const d = driver({
    showProgress: true,
    progressText: '{{current}} / {{total}}',
    nextBtnText: 'Suivant →',
    prevBtnText: '← Précédent',
    doneBtnText: 'Terminer',
    overlayColor: 'rgba(0,0,0,0.65)',
    smoothScroll: true,
    allowClose: true,
    // On filtre les étapes dont l'élément cible n'est pas dans le DOM
    // (ex : sidebar repliée, page différente). Sans ça driver.js skippe en silence.
    steps: STEPS.filter(s => !s.element || document.querySelector(s.element)),
    onDestroyed: () => {
      try { localStorage.setItem(TOUR_STORAGE_KEY, '1') } catch { /* localStorage indispo */ }
    },
  })
  d.drive()
}

/** Affiche le tour à la première connexion. Cible : nouveaux utilisateurs.
 *  Le bouton "Refaire le tour" (Settings) appelle startOnboardingTour() en direct. */
export function OnboardingTour() {
  useEffect(() => {
    let done = false
    try { done = localStorage.getItem(TOUR_STORAGE_KEY) === '1' } catch { /* ignore */ }
    if (done) return

    // Laisse au DOM le temps de rendre les éléments ciblés (lazy routes, animations).
    const t = setTimeout(startTour, 600)
    return () => clearTimeout(t)
  }, [])

  return null
}

/** Permet à un bouton "Refaire le tour" de relancer manuellement. */
export function startOnboardingTour() {
  try { localStorage.removeItem(TOUR_STORAGE_KEY) } catch { /* ignore */ }
  startTour()
}
