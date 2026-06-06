export function relativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffH = Math.floor(diffMin / 60)
  const diffD = Math.floor(diffH / 24)

  if (diffSec < 60) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffH < 24) return `il y a ${diffH}h`
  if (diffD === 1) return 'hier'
  if (diffD < 7) return `il y a ${diffD} j`
  if (diffD < 30) return `il y a ${Math.floor(diffD / 7)} sem`
  if (diffD < 365) return `il y a ${Math.floor(diffD / 30)} mois`
  return `il y a ${Math.floor(diffD / 365)} an${Math.floor(diffD / 365) > 1 ? 's' : ''}`
}

export function shortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
