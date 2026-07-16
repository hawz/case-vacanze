<script setup lang="ts">
// EPIC 15 — Mini-sito pubblico (US-1501/1502/1503/1504 + US-1102, anteprima
// da PublishStep.vue). Pagina pubblica, fuori da /app, layout "default"
// (nessun header autenticato). Nessuna RLS da aggiungere: tutte le tabelle
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
    .select('id, name, property_type, address_line, city, province, short_description, long_description, theme_id, check_in_time, check_out_time, status')
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

const theme = computed(() => getTheme(property.value?.theme_id ?? 'default'))
const themeVars = computed(() => ({
  '--color-primary': theme.value.colors.primary,
  '--color-primary-dark': theme.value.colors.primaryDark,
  '--color-accent': theme.value.colors.accent,
  '--color-surface': theme.value.colors.surface,
  '--color-background': theme.value.colors.background,
  '--color-text': theme.value.colors.text,
  '--color-muted': theme.value.colors.muted,
}))

const locationLine = computed(() => {
  if (!property.value) return ''
  return [property.value.address_line, property.value.city, property.value.province].filter(Boolean).join(', ')
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

      <MiniSiteGallery :photos="photos" />

      <header class="minisite__header">
        <h1 class="minisite__name">
          {{ property.name }}
        </h1>
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

      <div
        v-if="occupancy"
        class="minisite-stats"
      >
        <span class="minisite-stats__item">{{ occupancy.max_guests }} {{ t('minisite.occupancy.maxGuests') }}</span>
        <span class="minisite-stats__item">{{ occupancy.bedrooms }} {{ t('minisite.occupancy.bedrooms') }}</span>
        <span class="minisite-stats__item">{{ occupancy.bathrooms }} {{ t('minisite.occupancy.bathrooms') }}</span>
        <span class="minisite-stats__item">{{ occupancy.beds }} {{ t('minisite.occupancy.beds') }}</span>
      </div>

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

      <div
        v-if="property.check_in_time || property.check_out_time"
        class="minisite-checktimes"
      >
        <span v-if="property.check_in_time"><strong>{{ t('minisite.checkIn') }}:</strong> {{ property.check_in_time
        }}</span>
        <span v-if="property.check_out_time"><strong>{{ t('minisite.checkOut') }}:</strong> {{ property.check_out_time
        }}</span>
      </div>

      <MiniSiteAnnouncements :announcements="activeAnnouncements" />
      <MiniSiteOptionals :optionals="optionals" />
      <MiniSiteHouseRules :house-rules="houseRules" />
      <MiniSiteAreaGuide
        :content="areaGuideContent"
        :pois="pois"
      />
      <MiniSiteCalendar :blocked-ranges="blockedRanges" />
      <MiniSiteOtaLinks :links="otaLinks" />
    </div>
  </div>
</template>

<style scoped>
.minisite {
  @apply mx-auto max-w-3xl px-4 py-8;
  background-color: var(--color-background);
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

.minisite__name {
  @apply text-2xl font-bold;
  color: var(--color-text);
}

.minisite__subline {
  @apply mt-1 text-sm;
  color: var(--color-muted);
}

.minisite-stats {
  @apply mt-4 flex flex-wrap gap-3 text-sm;
}

.minisite-stats__item {
  @apply rounded-full px-3 py-1;
  background-color: var(--color-surface);
  color: var(--color-text);
}

.minisite__short-description {
  @apply mt-4 text-base font-medium;
  color: var(--color-text);
}

.minisite__long-description {
  @apply mt-3 whitespace-pre-line text-sm;
  color: var(--color-text);
}

.minisite-checktimes {
  @apply mt-4 flex flex-wrap gap-4 text-sm;
  color: var(--color-text);
}
</style>
