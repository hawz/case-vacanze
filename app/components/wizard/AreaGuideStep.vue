<script setup lang="ts">
// EPIC 8 — Wizard: Guida alla zona (US-801/802). Due parti indipendenti:
// - Testo guida libero, upsert su `area_guides` (PK = property_id), stesso
//   pattern one-row-per-property di OccupancySpacesStep.vue.
// - Punti di interesse, CRUD sul modello lista+card di OptionalsStep.vue.
//   `points_of_interest.area_guide_id` ha FK su `area_guides.property_id`
//   (non un id proprio: la tabella area_guides usa property_id come PK),
//   quindi va garantita l'esistenza della riga area_guides PRIMA di poter
//   inserire il primo POI (AC US-802) — la creiamo vuota al mount se manca.
// Niente riordino per i POI: a differenza di optionals/house_rules/photos,
// points_of_interest non ha una colonna sort_order nello schema.
interface PointOfInterest {
  id: string
  name: string
  category: string
  distance: string | null
  description: string | null
  external_url: string | null
  latitude: number | null
  longitude: number | null
}

const props = defineProps<{ propertyId: string }>()

const { t } = useI18n()
const supabase = useSupabaseClient()
const wizardStore = useWizardStore()

const CATEGORIES = ['RESTAURANT', 'BEACH', 'ATTRACTION', 'SHOP', 'TRANSPORT', 'OTHER'] as const

function categoryLabel(category: string) {
  return t(`wizard.areaGuide.pois.categories.${category}`)
}

const isLoading = ref(true)
const loadError = ref('')

// --- Testo guida (US-801) ---
const content = ref('')
const isSavingContent = ref(false)
const isContentSaved = ref(false)
const contentError = ref('')

async function ensureAreaGuide() {
  const { data, error } = await supabase
    .from('area_guides')
    .select('content')
    .eq('property_id', props.propertyId)
    .maybeSingle()

  if (error) return false

  if (data) {
    content.value = data.content ?? ''
    return true
  }

  const { error: insertError } = await supabase
    .from('area_guides')
    .insert({ property_id: props.propertyId })
  return !insertError
}

async function saveContent() {
  contentError.value = ''
  isSavingContent.value = true

  const { error } = await supabase
    .from('area_guides')
    .upsert({ property_id: props.propertyId, content: content.value.trim() || null })

  isSavingContent.value = false

  if (error) {
    contentError.value = t('wizard.areaGuide.content.errors.save')
    return
  }

  wizardStore.markComplete('area-guide')
  isContentSaved.value = true
  setTimeout(() => {
    isContentSaved.value = false
  }, 2000)
}

// --- Punti di interesse (US-802) ---
const pois = ref<PointOfInterest[]>([])
// Latitudine/longitudine tenute come stringhe separate da
// PointOfInterest.latitude/longitude (numero o null) per poter validare/
// digitare liberamente, come priceInputs in OptionalsStep.vue.
const latitudeInputs = ref<Record<string, string>>({})
const longitudeInputs = ref<Record<string, string>>({})

async function loadPois() {
  const { data, error } = await supabase
    .from('points_of_interest')
    .select('id, name, category, distance, description, external_url, latitude, longitude')
    .eq('area_guide_id', props.propertyId)
    .order('name', { ascending: true })

  if (error) return false

  pois.value = data ?? []
  for (const poi of pois.value) {
    latitudeInputs.value[poi.id] = poi.latitude != null ? String(poi.latitude) : ''
    longitudeInputs.value[poi.id] = poi.longitude != null ? String(poi.longitude) : ''
  }
  return true
}

async function loadAll() {
  isLoading.value = true
  loadError.value = ''

  const guideOk = await ensureAreaGuide()
  const poisOk = guideOk && await loadPois()

  isLoading.value = false

  if (!guideOk || !poisOk) {
    loadError.value = t('wizard.areaGuide.pois.errors.load')
    return
  }

  // Nessun requisito minimo per questo step: basta che il caricamento sia
  // andato a buon fine (stessa convenzione di optionals/house-rules).
  wizardStore.markComplete('area-guide')
}

onMounted(loadAll)

const newPoiName = ref('')
const addError = ref('')
const isAdding = ref(false)

async function addPoi() {
  const name = newPoiName.value.trim()
  if (!name) return

  addError.value = ''
  isAdding.value = true

  const { data, error } = await supabase
    .from('points_of_interest')
    .insert({ area_guide_id: props.propertyId, name })
    .select('id, name, category, distance, description, external_url, latitude, longitude')
    .single()

  isAdding.value = false

  if (error || !data) {
    addError.value = t('wizard.areaGuide.pois.errors.add')
    return
  }

  pois.value.push(data)
  latitudeInputs.value[data.id] = data.latitude != null ? String(data.latitude) : ''
  longitudeInputs.value[data.id] = data.longitude != null ? String(data.longitude) : ''
  wizardStore.markComplete('area-guide')
  newPoiName.value = ''
}

function parseOptionalCoordinate(value: string, min: number, max: number): { ok: boolean, value: number | null } {
  const trimmed = value.trim()
  if (!trimmed) return { ok: true, value: null }
  const num = Number(trimmed)
  if (Number.isNaN(num) || num < min || num > max) return { ok: false, value: null }
  return { ok: true, value: num }
}

const fieldErrors = ref<Record<string, string>>({})
const savingId = ref<string | null>(null)
const savedId = ref<string | null>(null)

async function savePoi(poi: PointOfInterest) {
  fieldErrors.value = { ...fieldErrors.value, [poi.id]: '' }

  const name = poi.name.trim()
  if (!name) {
    fieldErrors.value = { ...fieldErrors.value, [poi.id]: t('wizard.areaGuide.pois.validation.nameRequired') }
    return
  }

  const lat = parseOptionalCoordinate(latitudeInputs.value[poi.id] ?? '', -90, 90)
  if (!lat.ok) {
    fieldErrors.value = { ...fieldErrors.value, [poi.id]: t('wizard.areaGuide.pois.validation.latitudeInvalid') }
    return
  }

  const lng = parseOptionalCoordinate(longitudeInputs.value[poi.id] ?? '', -180, 180)
  if (!lng.ok) {
    fieldErrors.value = { ...fieldErrors.value, [poi.id]: t('wizard.areaGuide.pois.validation.longitudeInvalid') }
    return
  }

  savingId.value = poi.id
  const { error } = await supabase
    .from('points_of_interest')
    .update({
      name,
      category: poi.category,
      distance: poi.distance?.trim() || null,
      description: poi.description?.trim() || null,
      external_url: poi.external_url?.trim() || null,
      latitude: lat.value,
      longitude: lng.value,
    })
    .eq('id', poi.id)
  savingId.value = null

  if (error) {
    fieldErrors.value = { ...fieldErrors.value, [poi.id]: t('wizard.areaGuide.pois.errors.save') }
    return
  }

  poi.name = name
  poi.latitude = lat.value
  poi.longitude = lng.value
  savedId.value = poi.id
  setTimeout(() => {
    if (savedId.value === poi.id) savedId.value = null
  }, 2000)
}

const deletingId = ref<string | null>(null)
const isDeleting = ref(false)
const deleteError = ref('')

function askDelete(id: string) {
  deletingId.value = id
  deleteError.value = ''
}

function cancelDelete() {
  deletingId.value = null
  deleteError.value = ''
}

async function confirmDelete(poi: PointOfInterest) {
  isDeleting.value = true
  deleteError.value = ''

  const { error } = await supabase.from('points_of_interest').delete().eq('id', poi.id)

  isDeleting.value = false

  if (error) {
    deleteError.value = t('wizard.areaGuide.pois.errors.delete')
    return
  }

  pois.value = pois.value.filter(p => p.id !== poi.id)
  deletingId.value = null
}
</script>

<template>
  <div class="wizard-step">
    <h1 class="wizard-step__title">
      {{ t('wizard.areaGuide.title') }}
    </h1>
    <p class="wizard-step__subtitle">
      {{ t('wizard.areaGuide.subtitle') }}
    </p>

    <p
      v-if="loadError"
      class="wizard-form__alert"
      role="alert"
    >
      {{ loadError }}
    </p>

    <p
      v-else-if="isLoading"
      class="wizard-step__loading"
    >
      {{ t('auth.common.loading') }}
    </p>

    <template v-else>
      <div class="wizard-form__field area-guide-content">
        <label
          class="wizard-form__label"
          for="area-guide-content"
        >{{ t('wizard.areaGuide.content.label') }}</label>
        <textarea
          id="area-guide-content"
          v-model="content"
          rows="6"
          :placeholder="t('wizard.areaGuide.content.placeholder')"
          class="wizard-form__input"
        />
        <p
          v-if="contentError"
          class="wizard-form__field-error"
        >
          {{ contentError }}
        </p>
        <p
          v-if="isContentSaved"
          class="area-guide-content__saved"
        >
          {{ t('wizard.areaGuide.content.saved') }}
        </p>
        <button
          type="button"
          class="area-guide-content__save"
          :disabled="isSavingContent"
          @click="saveContent"
        >
          {{ isSavingContent ? t('auth.common.loading') : t('wizard.areaGuide.content.save') }}
        </button>
      </div>

      <h2 class="pois__title">
        {{ t('wizard.areaGuide.pois.title') }}
      </h2>

      <form
        class="pois-add"
        @submit.prevent="addPoi"
      >
        <div class="wizard-form__field">
          <label
            class="wizard-form__label"
            for="poi-new-name"
          >{{ t('wizard.areaGuide.pois.add.nameLabel') }}</label>
          <input
            id="poi-new-name"
            v-model="newPoiName"
            type="text"
            :placeholder="t('wizard.areaGuide.pois.add.namePlaceholder')"
            class="wizard-form__input"
          >
        </div>
        <button
          type="submit"
          class="pois-add__button"
          :disabled="isAdding || !newPoiName.trim()"
        >
          {{ isAdding ? t('auth.common.loading') : t('wizard.areaGuide.pois.add.button') }}
        </button>
      </form>

      <p
        v-if="addError"
        class="wizard-form__alert"
        role="alert"
      >
        {{ addError }}
      </p>

      <p
        v-if="pois.length === 0"
        class="pois-empty"
      >
        {{ t('wizard.areaGuide.pois.empty') }}
      </p>

      <ul
        v-else
        class="pois-list"
      >
        <li
          v-for="poi in pois"
          :key="poi.id"
          class="poi-card"
        >
          <div class="poi-card__field">
            <label class="poi-card__label">{{ t('wizard.areaGuide.pois.fields.nameLabel') }}</label>
            <input
              v-model="poi.name"
              type="text"
              class="poi-card__input"
            >
          </div>

          <div class="poi-card__field">
            <label class="poi-card__label">{{ t('wizard.areaGuide.pois.fields.categoryLabel') }}</label>
            <select
              v-model="poi.category"
              class="poi-card__input"
            >
              <option
                v-for="category in CATEGORIES"
                :key="category"
                :value="category"
              >
                {{ categoryLabel(category) }}
              </option>
            </select>
          </div>

          <div class="poi-card__field">
            <label class="poi-card__label">{{ t('wizard.areaGuide.pois.fields.distanceLabel') }}</label>
            <input
              v-model="poi.distance"
              type="text"
              :placeholder="t('wizard.areaGuide.pois.fields.distancePlaceholder')"
              class="poi-card__input"
            >
          </div>

          <div class="poi-card__field">
            <label class="poi-card__label">{{ t('wizard.areaGuide.pois.fields.descriptionLabel') }}</label>
            <textarea
              v-model="poi.description"
              rows="2"
              class="poi-card__input"
            />
          </div>

          <div class="poi-card__field">
            <label class="poi-card__label">{{ t('wizard.areaGuide.pois.fields.externalUrlLabel') }}</label>
            <input
              v-model="poi.external_url"
              type="text"
              class="poi-card__input"
            >
          </div>

          <div class="poi-card__row">
            <div class="poi-card__field">
              <label class="poi-card__label">{{ t('wizard.areaGuide.pois.fields.latitudeLabel') }}</label>
              <input
                v-model="latitudeInputs[poi.id]"
                type="text"
                inputmode="decimal"
                class="poi-card__input"
              >
            </div>
            <div class="poi-card__field">
              <label class="poi-card__label">{{ t('wizard.areaGuide.pois.fields.longitudeLabel') }}</label>
              <input
                v-model="longitudeInputs[poi.id]"
                type="text"
                inputmode="decimal"
                class="poi-card__input"
              >
            </div>
          </div>

          <p
            v-if="fieldErrors[poi.id]"
            class="poi-card__error"
          >
            {{ fieldErrors[poi.id] }}
          </p>
          <p
            v-if="savedId === poi.id"
            class="poi-card__saved"
          >
            {{ t('wizard.areaGuide.pois.saved') }}
          </p>

          <div class="poi-card__actions">
            <button
              type="button"
              class="poi-card__save"
              :disabled="savingId === poi.id"
              @click="savePoi(poi)"
            >
              {{ savingId === poi.id ? t('auth.common.loading') : t('wizard.areaGuide.pois.save') }}
            </button>
            <button
              type="button"
              class="poi-card__delete"
              @click="askDelete(poi.id)"
            >
              {{ t('wizard.areaGuide.pois.delete') }}
            </button>
          </div>

          <div
            v-if="deletingId === poi.id"
            class="poi-card__confirm"
          >
            <p class="poi-card__confirm-title">
              {{ t('wizard.areaGuide.pois.deleteConfirm.title') }}
            </p>
            <p
              v-if="deleteError"
              class="poi-card__confirm-error"
            >
              {{ deleteError }}
            </p>
            <div class="poi-card__confirm-actions">
              <button
                type="button"
                class="poi-card__confirm-cancel"
                :disabled="isDeleting"
                @click="cancelDelete"
              >
                {{ t('wizard.areaGuide.pois.deleteConfirm.cancel') }}
              </button>
              <button
                type="button"
                class="poi-card__confirm-submit"
                :disabled="isDeleting"
                @click="confirmDelete(poi)"
              >
                {{ isDeleting ? t('auth.common.loading') : t('wizard.areaGuide.pois.deleteConfirm.confirm') }}
              </button>
            </div>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
/*
  Titolo/sottotitolo/loading e campi "wizard-form__" condivisi con gli altri
  step (stessa convenzione introdotta in GeneralInfoStep.vue). Le classi
  "poi-card__" ricalcano "optional-card__" di OptionalsStep.vue.
*/
.wizard-step__title {
  @apply mt-6 text-2xl font-bold;
  color: var(--color-text);
}

.wizard-step__subtitle {
  @apply mt-1 text-sm;
  color: var(--color-muted);
}

.wizard-step__loading {
  @apply mt-6 text-sm;
  color: var(--color-muted);
}

.wizard-form__field {
  @apply space-y-1;
}

.wizard-form__label {
  @apply block text-sm font-medium;
  color: var(--color-text);
}

.wizard-form__input {
  @apply w-full rounded-md border px-3 py-2 text-base focus:outline-none focus:ring-2;
  border-color: #d1d5db;
  --tw-ring-color: var(--color-primary);
}

.wizard-form__field-error {
  @apply text-sm text-red-600;
}

.wizard-form__alert {
  @apply mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700;
}

.area-guide-content {
  @apply mt-6;
}

.area-guide-content__saved {
  @apply text-sm;
  color: #047857;
}

.area-guide-content__save {
  @apply rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50;
  background-color: var(--color-primary);
}

.pois__title {
  @apply mt-8 text-lg font-semibold;
  color: var(--color-text);
}

.pois-add {
  @apply mt-3 flex flex-wrap items-end gap-3;
}

.pois-add .wizard-form__field {
  @apply min-w-[240px] flex-1;
}

.pois-add__button {
  @apply rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50;
  background-color: var(--color-primary);
}

.pois-empty {
  @apply mt-6 text-sm;
  color: var(--color-muted);
}

.pois-list {
  @apply mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3;
}

.poi-card {
  @apply space-y-2 rounded-md border p-3;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
}

.poi-card__row {
  @apply grid gap-3 sm:grid-cols-2;
}

.poi-card__field {
  @apply space-y-1;
}

.poi-card__label {
  @apply block text-xs font-medium;
  color: var(--color-text);
}

.poi-card__input {
  @apply w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2;
  border-color: #d1d5db;
  --tw-ring-color: var(--color-primary);
}

.poi-card__error {
  @apply text-xs text-red-600;
}

.poi-card__saved {
  @apply text-xs;
  color: #047857;
}

.poi-card__actions {
  @apply flex items-center justify-between gap-2 pt-1;
}

.poi-card__save {
  @apply rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50;
  background-color: var(--color-primary);
}

.poi-card__delete {
  @apply text-sm font-medium text-red-600 underline underline-offset-2;
}

.poi-card__confirm {
  @apply space-y-2 rounded-md p-3 text-sm;
  background-color: #fef2f2;
}

.poi-card__confirm-title {
  @apply font-medium text-red-800;
}

.poi-card__confirm-error {
  @apply font-medium text-red-700;
}

.poi-card__confirm-actions {
  @apply flex gap-3;
}

.poi-card__confirm-cancel {
  @apply rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50;
  border-color: #d1d5db;
  color: var(--color-text);
}

.poi-card__confirm-submit {
  @apply rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50;
}
</style>
