import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
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
