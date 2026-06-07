import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.tsx'
import { initDensity } from './hooks/useDensity'
import { initTheme } from './hooks/useTheme'

initTheme()
initDensity()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
