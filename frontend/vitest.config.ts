import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Source unique de version : frontend/package.json (mêmes valeurs qu'en build prod).
// Nécessaire ici parce que vitest.config.ts ne lit pas vite.config.ts → sans
// ça, les composants qui référencent __APP_VERSION__ (ex: Sidebar) crashent
// en runtime de test avec "__APP_VERSION__ is not defined".
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
) as { version: string }

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
