// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-07-01',
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/i18n', '@nuxt/eslint', '@pinia/nuxt', '@nuxtjs/supabase'],

  // IMPORTANTE: qui dentro i valori restano SEMPRE stringhe vuote/placeholder.
  // Non leggere mai process.env.* direttamente in questo file per valori
  // segreti: nuxt.config.ts viene valutato in fase di build, quindi il
  // valore verrebbe scritto in chiaro nel bundle compilato (è esattamente
  // l'errore che ha fatto fallire la build su Netlify). I valori reali
  // arrivano solo a runtime tramite variabili d'ambiente con prefisso
  // NUXT_ (es. NUXT_CLOUDINARY_API_SECRET), che Nitro applica da solo.
  runtimeConfig: {
    // Solo lato server, per operazioni con privilegi elevati (es. azioni admin).
    // Chiave "secret" del nuovo schema Supabase (sb_secret_...).
    supabaseSecretKey: '',
    // Cloudinary: l'upload delle foto passa sempre da un endpoint server
    // (vedi server/api/), quindi anche cloudName/apiKey restano lato server.
    cloudinary: {
      cloudName: '',
      apiKey: '',
      apiSecret: '',
    },
  },

  // @nuxtjs/supabase: gestisce client, sessione SSR e redirect di autenticazione.
  // url/key letti di default da SUPABASE_URL/SUPABASE_KEY (già compatibili con le
  // nuove publishable/secret key di Supabase, non solo con le vecchie JWT).
  // Le route pubbliche (mini-sito, landing) sono escluse dal redirect automatico
  // verso il login, che scatta solo per l'area /app (backoffice).
  supabase: {
    redirectOptions: {
      login: '/app/login',
      callback: '/app/confirm',
      // '/test-connection' e '/test-upload' sono pagine temporanee di verifica:
      // vanno rimosse dall'exclude (e cancellate) una volta completata la struttura reale.
      exclude: ['/', '/en', '/owners', '/en/owners', '/property/**', '/en/property/**', '/test-connection', '/en/test-connection', '/test-upload', '/en/test-upload'],
    },
  },

  css: ['~/assets/css/main.css'],

  // Design mobile-first: nessun breakpoint extra richiesto qui,
  // Tailwind è già mobile-first di default (min-width breakpoints).

  // @nuxtjs/i18n v10: i file di lingua vivono in i18n/locales/ (restructureDir
  // di default è 'i18n' alla radice del progetto, non più dentro app/).
  // "lazy" non esiste più come opzione: il lazy loading è sempre attivo.
  i18n: {
    locales: [
      { code: 'it', name: 'Italiano', file: 'it.json' },
      { code: 'en', name: 'English', file: 'en.json' },
    ],
    defaultLocale: 'it',
    strategy: 'prefix_except_default',
    // Disattivato di proposito per ora: il default del modulo rileva la lingua
    // del browser/cookie e la "ricorda" anche su "/", cosa che senza un
    // selettore di lingua in UI risultava solo confusa in fase di test.
    // Da riattivare consapevolmente quando costruiremo il language switcher.
    detectBrowserLanguage: false,
  },

  app: {
    head: {
      htmlAttrs: { lang: 'it' },
      title: 'Portale Case Vacanze',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },

  eslint: {
    config: {
      stylistic: true,
    },
  },

  typescript: {
    strict: true,
  },
})
