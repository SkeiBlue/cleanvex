import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Source unique de version : frontend/package.json (aligné avec backend + racine).
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: false, // on utilise notre manifest.webmanifest custom dans /public
      workbox: {
        // mise en cache des assets statiques
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        // stratégie : network-first pour l'API en lecture seule (GET), cache-first pour les assets
        runtimeCaching: [
          {
            // Exclut auth/backups (sensibles). Couvre localhost dev + domaines prod cleanvex.fr.
            urlPattern: ({ url, request }) => {
              if (request.method !== 'GET') return false
              if (!url.pathname.startsWith('/api/')) return false
              if (url.pathname.startsWith('/api/auth/')) return false
              if (url.pathname.startsWith('/api/backups/')) return false
              return true
            },
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 80, maxAgeSeconds: 300 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // SW désactivé en dev (cause des ralentissements majeurs)
      },
    }),
  ],
})
