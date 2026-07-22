<script setup lang="ts">
// EPIC 15 — Mini-sito pubblico (US-1501/1502/1503/1504 + US-1102, anteprima
// da PublishStep.vue; US-1601/EPIC 16, form di richiesta disponibilità, è
// in mini-site/AvailabilityForm.vue). Pagina pubblica, fuori da /app, layout
// "default" (nessun header autenticato). Nessuna RLS da aggiungere: tutte le tabelle
// coinvolte hanno già una policy "*_public_read" gated su
// properties.status = 'PUBLISHED' (schema.sql), più "*_owner_read"/
// "owns_property" per l'owner — vedi il commento sulla query della
// proprietà per come questo si traduce nella query.
//
// US-1504: i tag OG/Twitter Card devono comparire nell'HTML della prima
// risposta, non solo dopo l'idratazione — i bot di anteprima social non
// eseguono JavaScript. Per questo il caricamento dati usa useAsyncData
// (SSR-aware: Nuxt attende la Promise prima di renderizzare la pagina)
// invece di onMounted (solo client, usato nella prima versione di questa
// pagina prima di questa story). L'anti-leak per proprietà non pubblicate
// resta comunque garantito dalla RLS stessa, non da questa logica: un bot
// di anteprima social non ha il cookie di sessione dell'owner, quindi la
// query vede "nessuna riga" esattamente come un visitatore anonimo — il
// controllo qui sotto su notFound/status è solo un ulteriore livello,
// rilevante soprattutto per l'anteprima nel browser dell'owner stesso.
import { getTheme } from '~~/config/themes'

interface PropertyDetail {
  id: string
  name: string
  property_type: string | null
  address_line: string | null
  city: string | null
  province: string | null
  latitude: number | null
  longitude: number | null
  short_description: string | null
  long_description: string | null
  theme_id: string
  check_in_time: string | null
  check_out_time: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'SUSPENDED'
}

interface MiniSiteData {
  property: PropertyDetail
  photos: { id: string, url: string, alt_text: string | null, is_cover: boolean }[]
  occupancy: { max_guests: number, bedrooms: number, bathrooms: number, beds: number } | null
  optionals: { id: string, name: string, description: string | null, price: number | null, unit: string | null }[]
  houseRules: { id: string, type: 'PETS' | 'SMOKING' | 'PARTIES' | 'OTHER', description: string | null }[]
  areaGuideContent: string | null
  pois: { id: string, name: string, category: 'RESTAURANT' | 'BEACH' | 'ATTRACTION' | 'SHOP' | 'TRANSPORT' | 'OTHER', distance: string | null, description: string | null, external_url: string | null }[]
  activeAnnouncements: { id: string, title: string, body: string, type: 'INFO' | 'WARNING' | 'URGENT' }[]
  otaLinks: { id: string, platform: 'AIRBNB' | 'BOOKING' | 'OTHER', url: string, label: string | null }[]
  blockedRanges: { start_date: string, end_date: string }[]
}

const { t } = useI18n()
const supabase = useSupabaseClient()
const route = useRoute()
const requestUrl = useRequestURL()

definePageMeta({ layout: 'default' })

const slug = computed(() => route.params.slug as string)

async function fetchMiniSite(): Promise<MiniSiteData | null> {
  // Nessun filtro status qui: si lascia decidere alla RLS (combinazione di
  // "properties_public_read_published" e "properties_owner_read_own").
  // Un visitatore anonimo vede solo le proprietà PUBLISHED; l'owner vede
  // anche le proprie in DRAFT/SUSPENDED (serve per l'anteprima pre-
  // pubblicazione, US-1102) — in entrambi i casi "nessuna riga" è la stessa
  // identica risposta di uno slug inesistente, nessuna fuga di informazioni.
  const { data: propertyData, error: propertyError } = await supabase
    .from('properties')
    .select('id, name, property_type, address_line, city, province, latitude, longitude, short_description, long_description, theme_id, check_in_time, check_out_time, status')
    .eq('slug', slug.value)
    .maybeSingle()

  if (propertyError) throw propertyError
  if (!propertyData) return null

  const [photosRes, occupancyRes, optionalsRes, houseRulesRes, areaGuideRes, poisRes, announcementsRes, otaLinksRes, blockedDatesRes] = await Promise.all([
    supabase.from('photos').select('id, url, alt_text, is_cover').eq('property_id', propertyData.id).order('sort_order', { ascending: true }),
    supabase.from('occupancy').select('max_guests, bedrooms, bathrooms, beds').eq('property_id', propertyData.id).maybeSingle(),
    supabase.from('optionals').select('id, name, description, price, unit').eq('property_id', propertyData.id).order('sort_order', { ascending: true }),
    supabase.from('house_rules').select('id, type, description').eq('property_id', propertyData.id).order('sort_order', { ascending: true }),
    supabase.from('area_guides').select('content').eq('property_id', propertyData.id).maybeSingle(),
    supabase.from('points_of_interest').select('id, name, category, distance, description, external_url').eq('area_guide_id', propertyData.id).order('name', { ascending: true }),
    // Niente filtro status="PUBLISHED" da ripetere: RLS pubblica sugli annunci
    // già lo garantisce. Il filtro per finestra di visibilità (visible_from/
    // visible_to vs now) si fa qui sotto invece che nella query, per non
    // costruire una stringa di filtro OR/AND fragile lato PostgREST.
    supabase.from('announcements').select('id, title, body, type, visible_from, visible_to').eq('property_id', propertyData.id),
    supabase.from('ota_links').select('id, platform, url, label').eq('property_id', propertyData.id).order('sort_order', { ascending: true }),
    // Niente colonna "reason": non deve mai arrivare al client pubblico (AC US-1502).
    supabase.from('blocked_dates').select('start_date, end_date').eq('property_id', propertyData.id).order('start_date', { ascending: true }),
  ])

  const now = new Date()
  const severity: Record<string, number> = { URGENT: 0, WARNING: 1, INFO: 2 }
  const activeAnnouncements = (announcementsRes.data ?? [])
    .filter(a => (!a.visible_from || new Date(a.visible_from) <= now) && (!a.visible_to || new Date(a.visible_to) >= now))
    .sort((a, b) => severity[a.type] - severity[b.type])

  return {
    property: propertyData,
    photos: photosRes.data ?? [],
    occupancy: occupancyRes.data ?? null,
    optionals: optionalsRes.data ?? [],
    houseRules: houseRulesRes.data ?? [],
    areaGuideContent: areaGuideRes.data?.content ?? null,
    pois: poisRes.data ?? [],
    activeAnnouncements,
    otaLinks: otaLinksRes.data ?? [],
    blockedRanges: blockedDatesRes.data ?? [],
  }
}

const { data, pending, error: fetchError } = await useAsyncData<MiniSiteData | null>(
  () => `minisite-${slug.value}`,
  fetchMiniSite,
  { watch: [slug] },
)

const isLoading = computed(() => pending.value)
const loadError = computed(() => (fetchError.value ? t('minisite.errors.load') : ''))
const notFound = computed(() => !pending.value && !fetchError.value && data.value === null)

const property = computed(() => data.value?.property ?? null)
const photos = computed(() => data.value?.photos ?? [])
const occupancy = computed(() => data.value?.occupancy ?? null)
const optionals = computed(() => data.value?.optionals ?? [])
const houseRules = computed(() => data.value?.houseRules ?? [])
const areaGuideContent = computed(() => data.value?.areaGuideContent ?? null)
const pois = computed(() => data.value?.pois ?? [])
const activeAnnouncements = computed(() => data.value?.activeAnnouncements ?? [])
const otaLinks = computed(() => data.value?.otaLinks ?? [])
const blockedRanges = computed(() => data.value?.blockedRanges ?? [])

const theme = computed(() => getTheme(property.value?.theme_id ?? 'meridiana'))
const themeVars = computed(() => ({
  '--color-primary': theme.value.colors.primary,
  '--color-primary-dark': theme.value.colors.primaryDark,
  '--color-accent': theme.value.colors.accent,
  '--color-on-primary': theme.value.colors.onPrimary,
  '--color-surface': theme.value.colors.surface,
  '--color-background': theme.value.colors.background,
  '--color-text': theme.value.colors.text,
  '--color-muted': theme.value.colors.muted,
  '--color-border': theme.value.colors.border,
  // Sovrascrivono le variabili omonime di app/assets/css/main.css SOLO
  // dentro questo sottoalbero (style inline sul contenitore .minisite):
  // il resto del sito (dashboard, wizard, home) non viene toccato. Vedi
  // il gotcha in CLAUDE.md sul perché serve ridichiarare `font-family`
  // esplicitamente sugli elementi, non basta sovrascrivere la custom
  // property, dato che l'inheritance normale di `font-family` propaga il
  // valore già risolto, non ri-legge la variabile ad ogni discendente.
  '--font-family-display': theme.value.fonts.display,
  '--font-display-weight': String(theme.value.fonts.displayWeight),
  '--font-family-base': theme.value.fonts.body,
  '--radius-base': theme.value.radius.base,
  '--radius-pill': theme.value.radius.pill,
}))

const locationLine = computed(() => {
  if (!property.value) return ''
  return [property.value.address_line, property.value.city, property.value.province].filter(Boolean).join(', ')
})

// US-2007: mappa mostrata solo se il proprietario ha impostato lat/lng
// (US-2006) — a differenza del wizard, qui non c'è nessun fallback "Sardegna"
// perché un visitatore non saprebbe cosa significhi una posizione non reale.
const mapCoordinates = computed(() => {
  if (property.value?.latitude == null || property.value?.longitude == null) return null
  return { latitude: property.value.latitude, longitude: property.value.longitude }
})

// US-2009: condivisione della posizione su WhatsApp — link standard
// "https://wa.me/?text=..." (nessuna API/secret coinvolta). Il link nel
// messaggio punta a Google Maps (solo URL pubblico, non l'SDK a pagamento)
// perché è quello che il destinatario ha più probabilmente installato,
// non al mini-sito stesso: la richiesta era condividere la posizione, non
// la pagina.
const whatsappLocationShareUrl = computed(() => {
  if (!mapCoordinates.value || !property.value) return ''
  const mapsLink = `https://www.google.com/maps?q=${mapCoordinates.value.latitude},${mapCoordinates.value.longitude}`
  const text = t('minisite.location.shareWhatsappText', { name: property.value.name, link: mapsLink })
  return `https://wa.me/?text=${encodeURIComponent(text)}`
})

// US-2010: condivisione del link del mini-sito stesso (non la posizione) —
// stesso pattern "wa.me", ma qui il link nel messaggio è requestUrl.href
// (già calcolato per og:url, US-1504), non Google Maps. Sempre visibile
// quando la proprietà è caricata: a differenza della mappa, il mini-sito
// esiste sempre, indipendentemente da lat/lng.
const whatsappPageShareUrl = computed(() => {
  if (!property.value) return ''
  const text = t('minisite.shareWhatsappText', { name: property.value.name, link: requestUrl.href })
  return `https://wa.me/?text=${encodeURIComponent(text)}`
})

// --- US-1504: tag SEO e anteprima di condivisione social ---
const coverImageUrl = computed(() => {
  const cover = photos.value.find(p => p.is_cover) ?? photos.value[0]
  return cover?.url
})

const metaDescription = computed(() => {
  const raw = property.value?.short_description?.trim() || property.value?.long_description?.trim() || ''
  if (!raw) return t('minisite.metaFallbackDescription')
  const singleLine = raw.replace(/\s+/g, ' ')
  return singleLine.length > 200 ? `${singleLine.slice(0, 197)}...` : singleLine
})

// Ulteriore livello, non la difesa principale (vedi commento in cima al
// file): niente indicizzazione per pagine inesistenti o non pubblicate.
const isUnlisted = computed(() => notFound.value || (property.value != null && property.value.status !== 'PUBLISHED'))

useSeoMeta({
  title: () => (notFound.value ? t('minisite.notFound.title') : property.value?.name),
  description: () => (notFound.value ? t('minisite.notFound.message') : metaDescription.value),
  ogTitle: () => property.value?.name,
  ogDescription: () => metaDescription.value,
  ogImage: () => coverImageUrl.value,
  ogUrl: () => requestUrl.href,
  ogType: 'website',
  ogSiteName: 'Portale Case Vacanze',
  twitterCard: 'summary_large_image',
  twitterTitle: () => property.value?.name,
  twitterDescription: () => metaDescription.value,
  twitterImage: () => coverImageUrl.value,
  robots: () => (isUnlisted.value ? 'noindex, nofollow' : undefined),
})
</script>

<template>
  <div
    class="minisite"
    :style="themeVars"
  >
    <p
      v-if="isLoading"
      class="minisite__loading"
    >
      {{ t('minisite.loading') }}
    </p>

    <p
      v-else-if="loadError"
      class="minisite__alert"
      role="alert"
    >
      {{ loadError }}
    </p>

    <div
      v-else-if="notFound"
      class="minisite__not-found"
    >
      <h1 class="minisite__not-found-title">
        {{ t('minisite.notFound.title') }}
      </h1>
      <p class="minisite__not-found-message">
        {{ t('minisite.notFound.message') }}
      </p>
    </div>

    <div
      v-else-if="property"
      class="minisite__content"
    >
      <p
        v-if="property.status !== 'PUBLISHED'"
        class="minisite__preview-banner"
      >
        {{ t('minisite.previewBanner') }}
      </p>

      <!--
        US-2101: nome, luogo e fatti chiave (ospiti/camere/bagni/letti +
        check-in/check-out) vengono prima della galleria, non dopo — sono le
        informazioni che un visitatore cerca per primo. Il check-in/check-out
        non è più isolato in fondo alla pagina (com'era prima di EPIC 21).
      -->
      <header class="minisite__header">
        <div class="minisite__header-row">
          <h1 class="minisite__name">
            {{ property.name }}
          </h1>
          <a
            :href="whatsappPageShareUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="minisite-share-button"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            ><circle
              cx="18"
              cy="5"
              r="2.4"
            /><circle
              cx="6"
              cy="12"
              r="2.4"
            /><circle
              cx="18"
              cy="19"
              r="2.4"
            /><path d="M8.2 10.7 15.8 6.3M8.2 13.3l7.6 4.4" /></svg>
            {{ t('minisite.shareWhatsapp') }}
          </a>
        </div>
        <p
          v-if="property.property_type || locationLine"
          class="minisite__subline"
        >
          <template v-if="property.property_type">
            {{ property.property_type }}
          </template>
          <template v-if="property.property_type && locationLine">
            ·
          </template>
          <template v-if="locationLine">
            {{ locationLine }}
          </template>
        </p>
      </header>

      <div class="minisite-facts">
        <span
          v-if="occupancy"
          class="minisite-facts__item"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><circle
            cx="12"
            cy="8"
            r="3.4"
          /><path d="M4.5 20c0-4.4 3.4-6.6 7.5-6.6s7.5 2.2 7.5 6.6" /></svg>
          <b>{{ occupancy.max_guests }}</b> {{ t('minisite.occupancy.maxGuests') }}
        </span>
        <span
          v-if="occupancy"
          class="minisite-facts__item"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><rect
            x="5"
            y="4"
            width="14"
            height="16"
            rx="1.5"
          /><circle
            cx="14.2"
            cy="12"
            r="1"
          /></svg>
          <b>{{ occupancy.bedrooms }}</b> {{ t('minisite.occupancy.bedrooms') }}
        </span>
        <span
          v-if="occupancy"
          class="minisite-facts__item"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><path d="M4 13h16v2.5A3.5 3.5 0 0 1 16.5 19h-9A3.5 3.5 0 0 1 4 15.5V13Z" /><path d="M6 13V9a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v1" /><path d="M4 19v1.4M20 19v1.4" /></svg>
          <b>{{ occupancy.beds }}</b> {{ t('minisite.occupancy.beds') }}
        </span>
        <span
          v-if="occupancy"
          class="minisite-facts__item"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><path d="M12 3c2.4 3 4.6 5.6 4.6 8.4A4.6 4.6 0 0 1 12 16a4.6 4.6 0 0 1-4.6-4.6C7.4 8.6 9.6 6 12 3Z" /></svg>
          <b>{{ occupancy.bathrooms }}</b> {{ t('minisite.occupancy.bathrooms') }}
        </span>
        <span
          v-if="property.check_in_time"
          class="minisite-facts__item"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><circle
            cx="12"
            cy="12"
            r="8.2"
          /><path d="M12 7.5V12l3.2 1.9" /></svg>
          {{ t('minisite.checkIn') }} <b>{{ property.check_in_time }}</b>
        </span>
        <span
          v-if="property.check_out_time"
          class="minisite-facts__item"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><circle
            cx="12"
            cy="12"
            r="8.2"
          /><path d="M12 7.5V12l3.2 1.9" /></svg>
          {{ t('minisite.checkOut') }} <b>{{ property.check_out_time }}</b>
        </span>
      </div>

      <MiniSiteGallery :photos="photos" />

      <section
        v-if="mapCoordinates"
        class="minisite-section"
      >
        <div class="minisite-section__header">
          <h2 class="minisite-section__title">
            {{ t('minisite.location.title') }}
          </h2>
          <a
            :href="whatsappLocationShareUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="minisite-share-button"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            ><circle
              cx="18"
              cy="5"
              r="2.4"
            /><circle
              cx="6"
              cy="12"
              r="2.4"
            /><circle
              cx="18"
              cy="19"
              r="2.4"
            /><path d="M8.2 10.7 15.8 6.3M8.2 13.3l7.6 4.4" /></svg>
            {{ t('minisite.location.shareWhatsapp') }}
          </a>
        </div>
        <MiniSiteLocationMap
          :latitude="mapCoordinates.latitude"
          :longitude="mapCoordinates.longitude"
        />
      </section>

      <p
        v-if="property.short_description"
        class="minisite__short-description"
      >
        {{ property.short_description }}
      </p>
      <p
        v-if="property.long_description"
        class="minisite__long-description"
      >
        {{ property.long_description }}
      </p>

      <MiniSiteAnnouncements :announcements="activeAnnouncements" />
      <MiniSiteOptionals :optionals="optionals" />
      <MiniSiteHouseRules :house-rules="houseRules" />
      <MiniSiteAreaGuide
        :content="areaGuideContent"
        :pois="pois"
      />
      <MiniSiteCalendar :blocked-ranges="blockedRanges" />
      <MiniSiteAvailabilityForm
        v-if="property.status === 'PUBLISHED'"
        :property-id="property.id"
        :max-guests="occupancy?.max_guests ?? null"
      />
      <MiniSiteOtaLinks :links="otaLinks" />
    </div>
  </div>
</template>

<style scoped>
.minisite {
  @apply mx-auto max-w-3xl px-4 py-8;
  background-color: var(--color-background);
  color: var(--color-text);
  /*
    Sovrascrive il font-family ereditato da html (main.css) SOLO qui dentro:
    var(--font-family-base) a questo punto risolve al valore impostato da
    themeVars sul :style di questo stesso elemento, non al default globale —
    ma va ridichiarato esplicitamente: il font-family già calcolato su html
    si eredita come valore risolto, non si ricalcola da solo quando la
    custom property viene sovrascritta più in basso nell'albero.
  */
  font-family: var(--font-family-base);
}

.minisite__loading {
  color: var(--color-muted);
}

.minisite__alert {
  @apply rounded-md bg-red-50 px-3 py-2 text-sm text-red-700;
}

.minisite__preview-banner {
  @apply rounded-md px-3 py-2 text-center text-sm font-medium;
  background-color: #fffbeb;
  color: #b45309;
}

.minisite__not-found {
  @apply py-16 text-center;
}

.minisite__not-found-title {
  @apply text-2xl font-bold;
  color: var(--color-text);
}

.minisite__not-found-message {
  @apply mt-2 text-sm;
  color: var(--color-muted);
}

.minisite__header {
  @apply mt-6;
}

.minisite__header-row {
  @apply flex flex-wrap items-center justify-between gap-2;
}

.minisite__name {
  @apply text-2xl;
  font-family: var(--font-family-display);
  font-weight: var(--font-display-weight, 700);
  color: var(--color-text);
}

.minisite__subline {
  @apply mt-1 text-sm;
  color: var(--color-muted);
}

/*
  flex-nowrap forzato: le pill non devono mai andare a capo (richiesta
  esplicita di Albe). overflow-x auto è solo una rete di sicurezza per
  viewport molto strette (poche decine di px in meno del necessario) — con
  padding/gap/font-size ridotti qui sotto, su schermi normali entrano tutte
  senza bisogno di scorrere.
*/
.minisite-facts {
  @apply mt-4 flex flex-nowrap gap-1.5 overflow-x-auto text-xs;
}

.minisite-facts__item {
  @apply flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 font-medium;
  background-color: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border, transparent);
  border-radius: var(--radius-pill, 999px);
}

.minisite-facts__item svg {
  @apply h-3.5 w-3.5 shrink-0;
  color: var(--color-primary);
}

.minisite__short-description {
  @apply mt-4 text-base font-medium;
  color: var(--color-text);
}

.minisite__long-description {
  @apply mt-3 whitespace-pre-line text-sm;
  color: var(--color-text);
}

/*
  Stessa coppia di classi usata dai componenti MiniSite* (es.
  mini-site/AreaGuide.vue) per i titoli di sezione: duplicata qui perché gli
  stili scoped di Vue non si condividono tra file, la mappa (US-2007) è
  l'unica sezione renderizzata direttamente nel template di questa pagina
  invece che in un componente dedicato.
*/
.minisite-section {
  @apply mt-8;
}

.minisite-section__title {
  @apply text-lg;
  font-family: var(--font-family-display);
  font-weight: var(--font-display-weight, 700);
  color: var(--color-text);
}

/* US-2009: intestazione della sezione mappa con il pulsante di condivisione */
.minisite-section__header {
  @apply flex flex-wrap items-center justify-between gap-2;
}

.minisite-share-button {
  @apply flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs font-medium;
  color: var(--color-text);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-pill, 999px);
}

.minisite-share-button svg {
  @apply h-3.5 w-3.5 shrink-0;
  color: var(--color-primary);
}
</style>
