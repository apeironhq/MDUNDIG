import tailwindcss from '@tailwindcss/vite'

// Satu proyek: dashboard (SPA) + server API (Nitro, preset Vercel).
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  ssr: false,
  devtools: { enabled: false },
  typescript: { strict: true },
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },
  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      title: 'MDUNDIG — Manajemen Data Undangan Digital',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'robots', content: 'noindex, nofollow' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500&family=Ubuntu+Mono:wght@400&display=swap',
        },
      ],
    },
  },
  runtimeConfig: {
    // Server-only. Diisi lewat env: NUXT_SUPABASE_SECRET_KEY, NUXT_TOKEN_HASH_SECRET, NUXT_INTEGRATION_RATE_LIMIT
    supabaseSecretKey: '',
    tokenHashSecret: '',
    integrationRateLimit: 1200,
    public: {
      // Publik: NUXT_PUBLIC_SUPABASE_URL, NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NUXT_PUBLIC_APP_URL
      supabaseUrl: '',
      supabasePublishableKey: '',
      appUrl: '',
    },
  },
  nitro: {
    preset: process.env.NITRO_PRESET || (process.env.VERCEL ? 'vercel' : 'node-server'),
    vercel: { functions: { regions: ['sin1'], maxDuration: 30 } },
  },
  routeRules: {
    '/api/**': { headers: { 'cache-control': 'no-store, max-age=0', 'x-content-type-options': 'nosniff' } },
  },
})
