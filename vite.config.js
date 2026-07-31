import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isDemoMode = env.VITE_APP_MODE !== 'live'
  const publicSiteUrl = (env.PUBLIC_APP_URL || 'https://sakli-terapi.vercel.app').replace(/\/$/, '')
  const siteMetadata = {
    name: 'site-metadata',
    transformIndexHtml(html) {
      return html.replaceAll('__PUBLIC_SITE_URL__', publicSiteUrl)
    },
  }

  return {
    plugins: [siteMetadata, react()],
    resolve: {
      alias: isDemoMode
        ? {
            '@supabase/supabase-js': fileURLToPath(
              new URL('./src/lib/supabase-demo-client.js', import.meta.url),
            ),
          }
        : {},
    },
    server: {
      allowedHosts: true,
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    },
  }
})
