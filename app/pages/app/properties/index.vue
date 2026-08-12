<script setup lang="ts">
import { z } from 'zod'
import type { DashboardKpiNextArrival } from '~/components/dashboard/KpiBar.vue'
import type { RequestsChartMonth } from '~/components/dashboard/RequestsChart.vue'
import type { ActivityEvent } from '~/components/dashboard/ActivityFeed.vue'

// EPIC 2 — Dashboard proprietario: elenco (US-201), creazione (US-202)
// ed eliminazione (US-203) delle proprietà dell'owner. La query non filtra
// esplicitamente per owner_id: la policy RLS "properties_owner_read_own"
// garantisce comunque che ognuno veda solo le proprie (o tutte, se admin).
const { t, locale } = useI18n()
const localePath = useLocalePath()
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const propertyStore = usePropertyStore()
const wizardStore = useWizardStore()

definePageMeta({ layout: 'app' })

const isLoading = ref(true)
const loadError = ref('')

// EPIC 22/US-2205: la query dell'elenco viene estesa con le risorse
// embedded via PostgREST necessarie per la completezza del wizard (vedi
// computeWizardCompleteness), invece di una query separata per proprietà
// (evita N+1). Per i conteggi si richiede solo `id` delle righe collegate
// (photos/optionals/house_rules/ota_links) e si usa `.length` lato client,
// non l'aggregato embedded `(count)` di PostgREST: quest'ultimo richiede
// `db-aggregates-enabled` sul server PostgREST, non verificabile qui (nessun
// ambiente di test disponibile, vedi CLAUDE.md) — questo pattern funziona
// con qualunque versione, stesso meccanismo di embed già usato altrove nel
// progetto (es. profiles(first_name,last_name) in admin/properties.vue).
interface PropertyRow {
  id: string
  slug: string
  name: string
  status: string
  suspension_reason: string | null
  address_line: string | null
  city: string | null
  short_description: string | null
  long_description: string | null
  created_at: string
  updated_at: string
  occupancy: { max_guests: number | null } | { max_guests: number | null }[] | null
  photos: { id: string, url: string, is_cover: boolean }[] | null
  optionals: { id: string }[] | null
  house_rules: { id: string }[] | null
  ota_links: { id: string }[] | null
  area_guides: { content: string | null } | { content: string | null }[] | null
}

// Le relazioni "1:1" (PK della tabella collegata = property_id) possono
// tornare da PostgREST come oggetto singolo o come array a seconda di come
// viene inferita la cardinalità — normalizzato qui per non doverci pensare
// ad ogni utilizzo.
function embedOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

const wizardCompleteness = ref<Record<string, number>>({})

// EPIC 22/US-2205 (riga compatta, allineata al mockup dopo revisione con
// Albe): dati aggiuntivi per riga non presenti nella forma minimale dello
// store condiviso (id/slug/name/status/suspension_reason, usata anche da
// GeneralInfoStep.vue) — tenuti in una mappa a parte invece di allargare il
// tipo dello store, stesso pattern di newRequestCounts/wizardCompleteness.
interface PropertyExtra {
  city: string | null
  coverUrl: string | null
  createdAt: string
  updatedAt: string
}

const propertyExtras = ref<Record<string, PropertyExtra>>({})

async function loadProperties() {
  isLoading.value = true
  loadError.value = ''

  const { data, error } = await supabase
    .from('properties')
    .select('id, slug, name, status, suspension_reason, address_line, city, short_description, long_description, created_at, updated_at, occupancy(max_guests), photos(id, url, is_cover), optionals(id), house_rules(id), ota_links(id), area_guides(content)')
    .order('created_at', { ascending: false })
    .returns<PropertyRow[]>()

  isLoading.value = false

  if (error) {
    loadError.value = t('properties.loadError')
    return
  }

  const rows = data ?? []

  propertyStore.setProperties(rows.map(row => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    suspension_reason: row.suspension_reason,
  })))

  const completeness: Record<string, number> = {}
  const extras: Record<string, PropertyExtra> = {}
  for (const row of rows) {
    completeness[row.id] = computeWizardCompleteness({
      addressLine: row.address_line,
      shortDescription: row.short_description,
      longDescription: row.long_description,
      occupancyMaxGuests: embedOne(row.occupancy)?.max_guests ?? null,
      photosCount: row.photos?.length ?? 0,
      optionalsCount: row.optionals?.length ?? 0,
      houseRulesCount: row.house_rules?.length ?? 0,
      otaLinksCount: row.ota_links?.length ?? 0,
      areaGuideContent: embedOne(row.area_guides)?.content ?? null,
      status: row.status,
    })

    const photos = row.photos ?? []
    const cover = photos.find(p => p.is_cover) ?? photos[0]
    extras[row.id] = {
      city: row.city,
      coverUrl: cover?.url ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
  wizardCompleteness.value = completeness
  propertyExtras.value = extras
}

// EPIC 14/US-1403: badge con contatore di richieste "Nuove" per proprietà,
// accanto al link "Richieste" di ogni riga. Query separata (non filtra per
// proprietà: RLS "availability_requests_owner_read" limita già ai risultati
// dell'owner corrente), i conteggi si ottengono raggruppando client-side.
const newRequestCounts = ref<Record<string, number>>({})

async function loadNewRequestCounts() {
  const { data } = await supabase
    .from('availability_requests')
    .select('property_id')
    .eq('status', 'NEW')

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.property_id] = (counts[row.property_id] ?? 0) + 1
  }
  newRequestCounts.value = counts
}

// EPIC 22/US-2202: barra KPI. Pubblicate/Totali/Bozze derivano da
// propertyStore.properties (già caricato per l'elenco, nessuna query in
// più); Richieste nuove somma newRequestCounts (già caricato sopra).
// "Prossimo arrivo" richiede invece una query dedicata su blocked_dates,
// unica tra tutte le proprietà dell'owner (RLS "blocked_dates_owner_write"
// copre già la lettura per l'owner tramite owns_property).
interface NextBlockedRow {
  start_date: string
  properties: { name: string } | null
}

const nextArrival = ref<DashboardKpiNextArrival | null>(null)

async function loadNextArrival() {
  const todayIso = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('blocked_dates')
    .select('start_date, properties(name)')
    .gte('start_date', todayIso)
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle<NextBlockedRow>()

  nextArrival.value = data ? { date: data.start_date, propertyName: data.properties?.name ?? '' } : null
}

// EPIC 22/US-2203: grafico a barre "Richieste di disponibilità" (ultimi 6
// mesi, mese corrente incluso). Raggruppamento per mese fatto lato client
// su un'unica query (nessuna funzione SQL di aggregazione), coerente con
// come il progetto ha sempre evitato RPC quando una query diretta basta.
const requestsByMonth = ref<RequestsChartMonth[]>([])

async function loadRequestsByMonth() {
  const now = new Date()
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const { data } = await supabase
    .from('availability_requests')
    .select('created_at')
    .gte('created_at', rangeStart.toISOString())

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const created = new Date(row.created_at)
    const key = `${created.getFullYear()}-${created.getMonth()}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const months: RequestsChartMonth[] = []
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${monthDate.getFullYear()}-${monthDate.getMonth()}`
    months.push({
      label: new Intl.DateTimeFormat(locale.value, { month: 'short' }).format(monthDate),
      count: counts.get(key) ?? 0,
      isCurrent: i === 0,
    })
  }
  requestsByMonth.value = months
}

// EPIC 22/US-2204: feed "Attività recente" — combina 4 fonti diverse in
// un'unica lista di eventi ordinata per data decrescente, tagliata alle
// prime 8. Nessuna nuova tabella: solo più query lato dashboard.
interface FeedRequestRow {
  created_at: string
  updated_at: string
  status: string
  properties: { name: string } | null
}

interface FeedPhotoRow {
  created_at: string
  property_id: string
  properties: { name: string } | null
}

interface FeedSuspendedRow {
  name: string
  updated_at: string
}

const activityEvents = ref<ActivityEvent[]>([])

async function loadActivityFeed() {
  const [requestsRes, photosRes, suspendedRes] = await Promise.all([
    supabase
      .from('availability_requests')
      .select('created_at, updated_at, status, properties(name)')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('photos')
      .select('created_at, property_id, properties(name)')
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('properties')
      .select('name, updated_at')
      .eq('status', 'SUSPENDED')
      .order('updated_at', { ascending: false })
      .limit(8),
  ])

  const events: ActivityEvent[] = []

  for (const row of (requestsRes.data ?? []) as FeedRequestRow[]) {
    const propertyName = row.properties?.name ?? ''
    events.push({ type: 'new-request', timestamp: row.created_at, propertyName })
    // updated_at > created_at solo se la riga è stata modificata almeno una
    // volta dopo la creazione (il trigger set_updated_at scatta solo su
    // UPDATE, non su INSERT) — così si evita un evento "accettata" fantasma
    // per richieste mai toccate dopo la creazione.
    if (row.status === 'ACCEPTED' && row.updated_at > row.created_at) {
      events.push({ type: 'accepted', timestamp: row.updated_at, propertyName })
    }
  }

  // Foto raggruppate per proprietà+giorno (AC: caricamenti in blocco
  // diventano un solo evento "N nuove foto", non N eventi separati).
  const photoGroups = new Map<string, { propertyName: string, count: number, latest: string }>()
  for (const row of (photosRes.data ?? []) as FeedPhotoRow[]) {
    const day = row.created_at.slice(0, 10)
    const key = `${row.property_id}-${day}`
    const group = photoGroups.get(key)
    if (group) {
      group.count += 1
      if (row.created_at > group.latest) group.latest = row.created_at
    }
    else {
      photoGroups.set(key, { propertyName: row.properties?.name ?? '', count: 1, latest: row.created_at })
    }
  }
  for (const group of photoGroups.values()) {
    events.push({ type: 'photos', timestamp: group.latest, propertyName: group.propertyName, photosCount: group.count })
  }

  for (const row of (suspendedRes.data ?? []) as FeedSuspendedRow[]) {
    events.push({ type: 'suspended', timestamp: row.updated_at, propertyName: row.name })
  }

  events.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
  activityEvents.value = events.slice(0, 8)
}

// Chiude il menu "⋯" di una riga se si clicca fuori — senza, resterebbe
// aperto finché non si clicca di nuovo sullo stesso pulsante, poco naturale
// per un menu a comparsa.
function closeActionsOnOutsideClick(event: MouseEvent) {
  if (openActionsId.value && !(event.target as HTMLElement).closest('.property-row__menu')) {
    openActionsId.value = null
  }
}

onMounted(() => {
  loadProperties()
  loadNewRequestCounts()
  loadNextArrival()
  loadRequestsByMonth()
  loadActivityFeed()
  window.addEventListener('click', closeActionsOnOutsideClick)
})

onUnmounted(() => {
  window.removeEventListener('click', closeActionsOnOutsideClick)
})

const todayLabel = computed(() => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()))

const publishedCount = computed(() => propertyStore.properties.filter(p => p.status === 'PUBLISHED').length)
const draftCount = computed(() => propertyStore.properties.filter(p => p.status === 'DRAFT').length)
const suspendedCount = computed(() => propertyStore.properties.filter(p => p.status === 'SUSPENDED').length)
const totalNewRequestsCount = computed(() => Object.values(newRequestCounts.value).reduce((sum, n) => sum + n, 0))

// --- Creazione (US-202): un solo campo (nome); lo slug si genera da quello.
// Il resto dei dati della proprietà si compila nel wizard (Epic 3+), non qui.
const createSchema = z.object({ name: z.string().trim().min(1).max(150) })

const showCreateForm = ref(false)
const newPropertyName = ref('')
const createFieldError = ref('')
const createError = ref('')
const isCreating = ref(false)

function toggleCreateForm() {
  showCreateForm.value = !showCreateForm.value
  createFieldError.value = ''
  createError.value = ''
  newPropertyName.value = ''
}

async function onSubmitCreate() {
  createError.value = ''
  createFieldError.value = ''

  const result = createSchema.safeParse({ name: newPropertyName.value })
  if (!result.success) {
    createFieldError.value = t('properties.create.nameRequired')
    return
  }
  if (!user.value) return

  isCreating.value = true

  const baseSlug = slugify(result.data.name) || 'proprieta'
  let slugAttempt = baseSlug
  let inserted: { id: string, slug: string, name: string, status: string } | null = null
  let lastErrorMessage = ''

  // Lo slug deve essere univoco (constraint DB): se collide, ne genero uno
  // con un suffisso casuale e riprovo, invece di far scegliere lo slug
  // manualmente all'owner in questo step minimale (potrà farlo in general-info).
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('properties')
      .insert({
        owner_id: user.value.id,
        name: result.data.name,
        slug: slugAttempt,
        status: 'DRAFT',
        theme_id: 'default',
      })
      .select('id, slug, name, status, suspension_reason')
      .single()

    if (!error) {
      inserted = data
      break
    }
    lastErrorMessage = error.message
    if (error.code === '23505') {
      slugAttempt = `${baseSlug}-${randomSlugSuffix()}`
      continue
    }
    break
  }

  isCreating.value = false

  if (!inserted) {
    createError.value = lastErrorMessage || t('properties.create.errorGeneric')
    return
  }

  propertyStore.setProperties([inserted, ...propertyStore.properties])
  wizardStore.reset()
  wizardStore.propertyId = inserted.id
  showCreateForm.value = false
  newPropertyName.value = ''

  await navigateTo(localePath(`/app/properties/${inserted.id}/edit`))
}

// EPIC 22/US-2205 (riga compatta): Calendario/Comunicazioni/Richieste/
// Elimina non sono più link sempre visibili ma vivono dietro un menu "⋯",
// dato che la riga stessa (nome+foto) è ora il link diretto ad "Apri" —
// decisione presa con Albe dopo aver confrontato il risultato col mockup.
const openActionsId = ref<string | null>(null)

function toggleActions(id: string) {
  openActionsId.value = openActionsId.value === id ? null : id
}

// --- Eliminazione (US-203): conferma inline per riga.
const deletingId = ref<string | null>(null)
const isDeleting = ref(false)
const deleteError = ref('')

function askDelete(id: string) {
  openActionsId.value = null
  deletingId.value = id
  deleteError.value = ''
}

function cancelDelete() {
  deletingId.value = null
  deleteError.value = ''
}

async function confirmDelete(id: string) {
  isDeleting.value = true
  deleteError.value = ''

  const { error } = await supabase.from('properties').delete().eq('id', id)
  isDeleting.value = false

  if (error) {
    deleteError.value = t('properties.deleteConfirm.errorGeneric')
    return
  }

  propertyStore.setProperties(propertyStore.properties.filter(p => p.id !== id))
  deletingId.value = null
}

function statusLabel(status: string) {
  if (status === 'PUBLISHED') return t('properties.status.published')
  if (status === 'SUSPENDED') return t('properties.status.suspended')
  return t('properties.status.draft')
}

function statusModifier(status: string) {
  if (status === 'PUBLISHED') return 'property-card__status--published'
  if (status === 'SUSPENDED') return 'property-card__status--suspended'
  return 'property-card__status--draft'
}

// EPIC 22/US-2205 (riga compatta): "{città} · {creata/aggiornata/sospesa} X
// fa" sotto il nome, come nel mockup. Draft → data di creazione (non è mai
// stata "aggiornata" in senso utile finché resta una bozza); Sospesa →
// data dell'ultimo aggiornamento (il momento della sospensione, salvo il
// limite noto già documentato in US-2204 sul trigger set_updated_at);
// Pubblicata → data dell'ultimo aggiornamento.
function metaLine(property: { id: string, status: string }) {
  const extra = propertyExtras.value[property.id]
  if (!extra) return ''

  const timestamp = property.status === 'DRAFT' ? extra.createdAt : extra.updatedAt
  const relative = formatRelativeTime(timestamp, locale.value)
  const key = property.status === 'DRAFT' ? 'created' : property.status === 'SUSPENDED' ? 'suspended' : 'updated'
  const statusPhrase = t(`properties.dashboard.meta.${key}`, { time: relative })

  return extra.city ? `${extra.city} · ${statusPhrase}` : statusPhrase
}

function thumbStyle(propertyId: string) {
  const coverUrl = propertyExtras.value[propertyId]?.coverUrl
  return coverUrl
    ? { backgroundImage: `url('${coverUrl}')` }
    : { backgroundImage: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))' }
}
</script>

<template>
  <section class="properties-list">
    <div class="properties-list__header">
      <h1 class="properties-list__title">
        {{ t('properties.title') }}
      </h1>
      <button
        type="button"
        class="properties-list__create-button"
        @click="toggleCreateForm"
      >
        {{ showCreateForm ? t('properties.create.cancel') : t('properties.createButton') }}
      </button>
    </div>
    <p class="properties-list__subtitle">
      {{ t('properties.dashboard.subtitle', { date: todayLabel }) }}
    </p>

    <DashboardKpiBar
      v-if="!isLoading && !loadError"
      :published-count="publishedCount"
      :total-count="propertyStore.properties.length"
      :new-requests-count="totalNewRequestsCount"
      :draft-count="draftCount"
      :next-arrival="nextArrival"
      class="properties-list__kpi-bar"
    />

    <div
      v-if="!isLoading && !loadError"
      class="properties-list__charts-row"
    >
      <DashboardRequestsChart :months="requestsByMonth" />
      <DashboardStatusDonut
        :published="publishedCount"
        :draft="draftCount"
        :suspended="suspendedCount"
      />
    </div>

    <form
      v-if="showCreateForm"
      class="properties-list__create-panel"
      novalidate
      @submit.prevent="onSubmitCreate"
    >
      <div class="properties-list__create-field">
        <label
          class="properties-list__create-label"
          for="new-property-name"
        >{{ t('properties.create.nameLabel') }}</label>
        <input
          id="new-property-name"
          v-model="newPropertyName"
          type="text"
          class="properties-list__create-input"
          :class="{ 'properties-list__create-input--invalid': createFieldError }"
        >
        <p
          v-if="createFieldError"
          class="properties-list__create-field-error"
        >
          {{ createFieldError }}
        </p>
      </div>

      <p
        v-if="createError"
        class="properties-list__create-alert"
        role="alert"
      >
        {{ createError }}
      </p>

      <button
        type="submit"
        class="properties-list__create-submit"
        :disabled="isCreating"
      >
        {{ isCreating ? t('auth.common.loading') : t('properties.create.submit') }}
      </button>
    </form>

    <div class="properties-list__lower-row">
      <div class="dashboard-card properties-list__main">
        <div class="dashboard-card__title">
          {{ t('properties.dashboard.listTitle') }}
          <small v-if="!isLoading && !loadError">{{ propertyStore.properties.length }}</small>
        </div>

        <p
          v-if="loadError"
          class="properties-list__alert"
          role="alert"
        >
          {{ loadError }}
        </p>

        <p
          v-else-if="isLoading"
          class="properties-list__loading"
        >
          {{ t('auth.common.loading') }}
        </p>

        <div
          v-else-if="propertyStore.properties.length === 0"
          class="properties-list__empty"
        >
          <p class="properties-list__empty-title">
            {{ t('properties.empty.title') }}
          </p>
          <p class="properties-list__empty-message">
            {{ t('properties.empty.message') }}
          </p>
        </div>

        <ul
          v-else
          class="property-rows"
        >
          <li
            v-for="property in propertyStore.properties"
            :key="property.id"
            class="property-row"
          >
            <NuxtLink
              :to="localePath(`/app/properties/${property.id}/edit`)"
              class="property-row__link"
            >
              <span
                class="property-row__thumb"
                :style="thumbStyle(property.id)"
              />
              <span class="property-row__main">
                <span class="property-row__name">{{ property.name }}</span>
                <span class="property-row__meta">{{ metaLine(property) }}</span>
              </span>
            </NuxtLink>

            <span
              class="property-row__status"
              :class="statusModifier(property.status)"
            >
              {{ statusLabel(property.status) }}
            </span>

            <div class="property-row__progress">
              <div class="property-row__progress-track">
                <div
                  class="property-row__progress-fill"
                  :style="{ width: `${((wizardCompleteness[property.id] ?? 0) / WIZARD_STEP_COUNT) * 100}%` }"
                />
              </div>
              <span class="property-row__progress-label">
                {{ t('properties.dashboard.completenessSteps', { done: wizardCompleteness[property.id] ?? 0, total: WIZARD_STEP_COUNT }) }}
              </span>
            </div>

            <div class="property-row__menu">
              <button
                type="button"
                class="property-row__menu-button"
                :aria-label="t('properties.dashboard.moreActions')"
                @click="toggleActions(property.id)"
              >
                ⋯
              </button>
              <div
                v-if="openActionsId === property.id"
                class="property-row__dropdown"
              >
                <NuxtLink
                  :to="localePath(`/app/properties/${property.id}/calendar`)"
                  class="property-row__dropdown-link"
                  @click="openActionsId = null"
                >
                  {{ t('properties.actions.calendar') }}
                </NuxtLink>
                <NuxtLink
                  :to="localePath(`/app/properties/${property.id}/announcements`)"
                  class="property-row__dropdown-link"
                  @click="openActionsId = null"
                >
                  {{ t('properties.actions.announcements') }}
                </NuxtLink>
                <NuxtLink
                  :to="localePath(`/app/properties/${property.id}/requests`)"
                  class="property-row__dropdown-link"
                  @click="openActionsId = null"
                >
                  {{ t('properties.actions.requests') }}
                  <span
                    v-if="newRequestCounts[property.id]"
                    class="property-card__requests-badge"
                  >
                    {{ newRequestCounts[property.id] }}
                  </span>
                </NuxtLink>
                <button
                  type="button"
                  class="property-row__dropdown-link property-row__dropdown-link--delete"
                  @click="askDelete(property.id)"
                >
                  {{ t('properties.actions.delete') }}
                </button>
              </div>
            </div>

            <p
              v-if="property.status === 'SUSPENDED' && property.suspension_reason"
              class="property-card__suspension-reason"
            >
              <strong>{{ t('properties.suspensionReasonLabel') }}:</strong> {{ property.suspension_reason }}
            </p>

            <div
              v-if="deletingId === property.id"
              class="property-card__confirm"
            >
              <p class="property-card__confirm-title">
                {{ t('properties.deleteConfirm.title') }}
              </p>
              <p class="property-card__confirm-message">
                {{ t('properties.deleteConfirm.message') }}
              </p>
              <p
                v-if="deleteError"
                class="property-card__confirm-error"
              >
                {{ deleteError }}
              </p>
              <div class="property-card__confirm-actions">
                <button
                  type="button"
                  class="property-card__confirm-cancel"
                  :disabled="isDeleting"
                  @click="cancelDelete"
                >
                  {{ t('properties.deleteConfirm.cancel') }}
                </button>
                <button
                  type="button"
                  class="property-card__confirm-submit"
                  :disabled="isDeleting"
                  @click="confirmDelete(property.id)"
                >
                  {{ isDeleting ? t('auth.common.loading') : t('properties.deleteConfirm.confirm') }}
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <DashboardActivityFeed
        v-if="!isLoading && !loadError"
        :events="activityEvents"
      />
    </div>
  </section>
</template>

<style scoped>
/*
  EPIC 22: da max-w-3xl a max-w-5xl — la dashboard ora ospita una barra KPI
  a 4 colonne e due righe a 2 colonne (grafici, poi elenco+feed), troppo
  strette nel contenitore originale pensato solo per l'elenco a card
  singola colonna di EPIC 2.
*/
.properties-list {
  @apply mx-auto max-w-5xl px-4 py-12;
}

.properties-list__header {
  @apply flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between;
}

.properties-list__kpi-bar {
  @apply mt-6;
}

.properties-list__charts-row {
  @apply mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr];
}

.properties-list__lower-row {
  @apply mt-4 grid items-start gap-4 lg:grid-cols-[1.4fr_1fr];
}

.properties-list__main {
  @apply min-w-0;
}

/*
  Stessa classe "dashboard-card" usata dai componenti dashboard/*.vue
  (RequestsChart, StatusDonut, ActivityFeed) — duplicata qui perché gli
  stili scoped di Vue non si condividono tra file (stessa convenzione già
  seguita per mini-site/*.vue). Angolo 10px come nel mockup approvato
  (docs/epic-22-mockup.html, --app-radius), non il rounded-md/6px usato
  altrove nel resto del backoffice: qui la card deve stare allo stesso
  livello visivo delle altre card della dashboard, non delle vecchie
  property-card.
*/
.dashboard-card {
  @apply border p-4;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
  border-radius: 10px;
}

.dashboard-card__title {
  @apply mb-1 flex items-baseline gap-2 text-sm font-semibold;
  color: var(--color-text);
}

.dashboard-card__title small {
  @apply text-xs font-medium;
  color: var(--color-muted);
}

.properties-list__title {
  @apply text-2xl font-bold;
  color: var(--color-text);
}

.properties-list__subtitle {
  @apply mt-1 text-sm;
  color: var(--color-muted);
}

.properties-list__create-button {
  @apply self-start rounded-md px-4 py-2 text-sm font-medium text-white sm:self-auto;
  background-color: var(--color-primary);
}

.properties-list__create-panel {
  @apply mt-4 space-y-3 rounded-md border p-4;
  border-color: #d1d5db;
}

.properties-list__create-field {
  @apply space-y-1;
}

.properties-list__create-label {
  @apply block text-sm font-medium;
  color: var(--color-text);
}

.properties-list__create-input {
  @apply w-full rounded-md border px-3 py-2 text-base focus:outline-none focus:ring-2;
  border-color: #d1d5db;
  --tw-ring-color: var(--color-primary);
}

.properties-list__create-input--invalid {
  @apply border-red-500;
}

.properties-list__create-field-error {
  @apply text-sm text-red-600;
}

.properties-list__create-alert {
  @apply rounded-md bg-red-50 px-3 py-2 text-sm text-red-700;
}

.properties-list__create-submit {
  @apply rounded-md px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50;
  background-color: var(--color-primary);
}

.properties-list__alert {
  @apply mt-8 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700;
}

.properties-list__loading {
  @apply mt-8 text-sm;
  color: var(--color-muted);
}

.properties-list__empty {
  @apply mt-12 rounded-md border border-dashed p-8 text-center;
  border-color: #d1d5db;
}

.properties-list__empty-title {
  @apply font-medium;
  color: var(--color-text);
}

.properties-list__empty-message {
  @apply mt-1 text-sm;
  color: var(--color-muted);
}

/*
  EPIC 22 (riga compatta, dopo revisione col mockup): le vecchie
  property-card (una per proprietà, bordo proprio, azioni sempre visibili)
  sono state sostituite da righe divise da un bordo dentro un'unica
  dashboard-card, come "Proprietà <N>" nel mockup approvato. Le azioni
  Calendario/Comunicazioni/Richieste/Elimina non sono più link diretti ma
  vivono nel menu "⋯" (property-row__dropdown): la riga stessa è ora il
  link ad "Apri" (property-row__link).
*/
.property-rows {
  @apply mt-3;
}

.property-row {
  @apply relative flex flex-wrap items-center gap-3 border-b py-3 last:border-b-0;
  border-color: #e5e7eb;
}

.property-row__link {
  @apply flex min-w-0 flex-1 items-center gap-3;
}

.property-row__thumb {
  @apply h-11 w-11 shrink-0 rounded-lg bg-cover bg-center;
}

.property-row__main {
  @apply flex min-w-0 flex-col;
}

.property-row__name {
  @apply truncate text-sm font-semibold;
  color: var(--color-text);
}

.property-row__meta {
  @apply truncate text-xs;
  color: var(--color-muted);
}

.property-row__status {
  @apply inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium;
}

.property-card__status--draft {
  background-color: #f3f4f6;
  color: #374151;
}

.property-card__status--published {
  background-color: #d1fae5;
  color: #047857;
}

.property-card__status--suspended {
  background-color: #fee2e2;
  color: #b91c1c;
}

.property-row__progress {
  @apply flex shrink-0 items-center gap-2;
}

.property-row__progress-track {
  @apply h-1.5 w-[70px] overflow-hidden rounded-full;
  background-color: #e5e7eb;
}

.property-row__progress-fill {
  @apply h-full;
  background-color: var(--color-primary);
}

.property-row__progress-label {
  @apply shrink-0 text-xs;
  color: var(--color-muted);
}

.property-row__menu {
  @apply relative shrink-0;
}

.property-row__menu-button {
  @apply flex h-7 w-7 items-center justify-center rounded-full text-base leading-none;
  color: var(--color-muted);
}

.property-row__menu-button:hover {
  background-color: #f3f4f6;
}

.property-row__dropdown {
  @apply absolute right-0 top-8 z-10 flex w-48 flex-col overflow-hidden rounded-md border py-1 text-sm shadow-lg;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
}

.property-row__dropdown-link {
  @apply flex items-center justify-between px-3 py-2 text-left;
  color: var(--color-text);
}

.property-row__dropdown-link:hover {
  background-color: #f9fafb;
}

.property-row__dropdown-link--delete {
  color: #dc2626;
}

.property-card__suspension-reason {
  @apply mt-1 w-full rounded-md px-3 py-2 text-sm;
  background-color: #fef2f2;
  color: #7f1d1d;
}

.property-card__requests-badge {
  @apply ml-1 rounded-full px-1.5 py-0.5 text-xs font-semibold;
  background-color: #fee2e2;
  color: #991b1b;
}

.property-card__confirm {
  @apply mt-1 w-full space-y-2 rounded-md p-3 text-sm;
  background-color: #fef2f2;
}

.property-card__confirm-title {
  @apply font-medium text-red-800;
}

.property-card__confirm-message {
  color: #991b1b;
}

.property-card__confirm-error {
  @apply font-medium text-red-700;
}

.property-card__confirm-actions {
  @apply flex flex-wrap gap-3;
}

.property-card__confirm-cancel {
  @apply rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50;
  border-color: #d1d5db;
  color: var(--color-text);
}

.property-card__confirm-submit {
  @apply rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50;
}
</style>
