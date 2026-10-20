/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

const APP_NAME = 'Habit tracker'

/** Returns true if the key is a Supabase secret/service_role key, which must never ship to the browser. */
function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true
  const payload = key.split('.')[1]
  if (!payload) return false
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { role?: string }
    return json.role === 'service_role'
  } catch {
    return false
  }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // GitHub Pages serves the site under /<repo>/. The deploy workflow passes it explicitly.
  const base = env.BASE_PATH || '/habit-tracker/'

  const supabaseKey = env.VITE_SUPABASE_ANON_KEY ?? ''
  if (/\/(rest|auth)\/v1/.test(env.VITE_SUPABASE_URL ?? '')) {
    throw new Error('VITE_SUPABASE_URL must be the project URL only (https://<ref>.supabase.co), without /rest/v1.')
  }
  if (isSecretKey(supabaseKey)) {
    throw new Error('VITE_SUPABASE_ANON_KEY is a secret/service_role key. Use the public anon/publishable key.')
  }
  if (command === 'build' && mode === 'production' && (!env.VITE_SUPABASE_URL || !supabaseKey)) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY (see README).')
  }

  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    build: {
      rollupOptions: {
        output: {
          // Libraries in their own chunks: a deploy that only changes app code
          // doesn't make the iPhone download them again.
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/.test(id)) return 'react'
            if (id.includes('@supabase')) return 'supabase'
            return 'vendor'
          },
        },
      },
    },
    plugins: [
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'prompt',
        injectRegister: false,
        manifest: {
          id: base,
          name: APP_NAME,
          short_name: APP_NAME,
          description: 'Habits & to-dos',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          theme_color: '#f2f2f7',
          background_color: '#f2f2f7',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        },
        devOptions: {
          enabled: false,
          type: 'module',
        },
      }),
    ],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
