import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'

type Props = { moduleKey: string; children: ReactNode }

export function ModuleGuard({ moduleKey, children }: Props) {
  const { modules } = useAuth()
  const mod = modules.find(m => m.key === moduleKey)

  if (mod && !mod.isEnabled) {
    return (
      <div className="module-disabled">
        <div className="module-disabled-inner">
          <span>🔒</span>
          <h2>Module désactivé</h2>
          <p>Le module <strong>{mod.title}</strong> est désactivé.</p>
          <p>Activez-le dans <Link to="/app/settings">Paramètres → Modules</Link>.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
