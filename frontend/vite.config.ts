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
        // stratégie : network-first pour l'API, cache-first pour les assets
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/localhost:3000\/api\//i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: true, // active le service worker en développement
        type: 'module',
      },
    }),
  ],
})
