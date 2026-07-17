// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/i18n', '@nuxt/eslint', '@pinia/nuxt', '@nuxtjs/supabase'],

  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'it' },
      title: 'Portale Case Vacanze',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

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
  compatibilityDate: '2026-07-01',

  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'leaflet', // CJS
        'zod',
      ],
    },
  },

  typescript: {
    strict: true,
  },

  eslint: {
    config: {
      stylistic: true,
    },
  },

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

  // @nuxtjs/supabase: gestisce client, sessione SSR e redirect di autenticazione.
  // url/key letti di default da SUPABASE_URL/SUPABASE_KEY (già compatibili con le
  // nuove publishable/secret key di Supabase, non solo con le vecchie JWT).
  // Le route pubbliche (mini-sito, landing) sono escluse dal redirect automatico
  // verso il login, che scatta solo per l'area /app (backoffice).
  supabase: {
    redirectOptions: {
      login: '/app/login',
      callback: '/app/confirm',
      // '/test-connection' e '/test-upload' (verifica Supabase/Cloudinary) sono
      // state rimosse insieme alle pagine: EPIC 4 ha sostituito il flusso di
      // test con quello reale (server/api/properties/[id]/photos.post.ts).
      // '/property/**' era una rotta ipotizzata prima di costruire il mini-sito
      // (EPIC 15): il mini-sito è finito su /[slug].vue (root, un solo
      // segmento), non su /property/*, quindi il pattern non ha mai escluso
      // nulla di reale.
      // ATTENZIONE: questo modulo converte '*' in '.*' con una semplice
      // string.replace su un singolo carattere, senza semantica da vero glob
      // (vedi node_modules/@nuxtjs/supabase/dist/runtime/plugins/auth-redirect.js).
      // Un pattern tipo '/*' diventerebbe quindi la regex '^/.*$', che
      // combacia con QUALSIASI path — comprese le rotte /app/** che devono
      // restare protette, disattivando di fatto l'intero redirect di login.
      // '[^/]+' invece non contiene '*' e passa inalterato nella regex,
      // matchando esattamente un singolo segmento senza ulteriori slash: è
      // il modo per escludere solo /<slug> (e /en/<slug>) senza toccare
      // /app/qualsiasi-cosa.
      //
      // Bug preesistente (mai presente in nessun commit, non introdotto di
      // recente): /app/register e /app/forgot-password non sono mai stati in
      // questo elenco. "login"/"callback" sono gli unici due esclusi in modo
      // implicito dal modulo stesso — tutte le altre pagine di autenticazione
      // vanno elencate esplicitamente, altrimenti un visitatore senza
      // sessione che le apre viene rimbalzato su /app/login prima ancora di
      // poter compilare il form.
      //
      // Stesso bug, variante scoperta col language switcher (US-1801): il
      // modulo esclude automaticamente "login"/"callback" (righe sopra), ma
      // SOLO nella forma esatta configurata — /app/login, non /en/app/login.
      // Passando a inglese sulla pagina di login, /en/app/login non risultava
      // escluso, quindi senza sessione veniva rimbalzato su navigateTo(login)
      // = '/app/login' (letterale, senza prefisso /en/): l'utente tornava
      // alla pagina di login ma in italiano, sembrando che il cambio lingua
      // non avesse effetto. Va quindi elencata a mano anche la variante /en/
      // di ogni pagina che il modulo esclude "per nome" invece che tramite
      // questo array.
      exclude: [
        '/',
        '/en',
        '/owners',
        '/en/owners',
        '/[^/]+',
        '/en/[^/]+',
        '/app/register',
        '/en/app/register',
        '/app/forgot-password',
        '/en/app/forgot-password',
        '/en/app/login',
        '/en/app/confirm',
      ],
      // Salva in un cookie la pagina che l'utente stava cercando di raggiungere
      // quando è stato rimbalzato al login, così login.vue può riportarcelo
      // dopo l'accesso invece di mandarlo sempre alla dashboard di default.
      saveRedirectToCookie: true,
    },
  },
})
