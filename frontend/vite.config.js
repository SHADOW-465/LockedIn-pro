import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Treat .gguf and .wasm as static assets so Vite serves them correctly
  assetsInclude: ['**/*.gguf', '**/*.wasm'],
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'LockedIn Pro',
        short_name: 'LockedIn',
        description: 'Behavioral engineering. Absolute authority.',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Exclude large model/wasm files from precache — they're fetched on demand
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/models/**', '**/wllama/**'],
        // Don't cache Ollama API calls
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\./,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 10 } },
          },
        ],
      },
      devOptions: {
        // Enable PWA in dev mode so you can test install prompts locally
        enabled: true,
      },
    }),
  ],
  server: {
    // Allow access from devices on the same LAN (for mobile testing without building APK)
    host: '0.0.0.0',
    port: 5173,
  },
});
