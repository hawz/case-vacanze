<script setup lang="ts">
import { z } from 'zod'

// EPIC 9 — Wizard: Collegamento portali OTA (US-901). Stesso pattern
// lista+card con riordino di OptionalsStep.vue: un form "aggiungi" che
// inserisce subito la riga (qui platform + url, entrambi NOT NULL a
// schema), poi ogni card è editabile inline con "Salva". Nessun endpoint
// server necessario.
const PLATFORMS = ['AIRBNB', 'BOOKING', 'OTHER'] as const
type Platform = typeof PLATFORMS[number]

interface OtaLink {
  id: string
  platform: Platform
  url: string
  label: string | null
  sort_order: number
}

const props = defineProps<{ propertyId: string }>()

const { t } = useI18n()
const supabase = useSupabaseClient()
const wizardStore = useWizardStore()

function platformLabel(platform: string) {
  return t(`wizard.otaLinks.platforms.${platform}`)
}

const links = ref<OtaLink[]>([])
const sortedLinks = computed(() => [...links.value].sort((a, b) => a.sort_order - b.sort_order))

const isLoading = ref(true)
const loadError = ref('')

async function loadLinks() {
  isLoading.value = true
  loadError.value = ''

  const { data, error } = await supabase
    .from('ota_links')
    .select('id, platform, url, label, sort_order')
    .eq('property_id', props.propertyId)
    .order('sort_order', { ascending: true })

  isLoading.value = false

  if (error) {
    loadError.value = t('wizard.otaLinks.errors.load')
    return
  }

  links.value = data ?? []
  // Nessun requisito minimo per questo step (AC US-901): basta che il
  // caricamento sia andato a buon fine, come per optionals/house-rules.
  wizardStore.markComplete('ota-links')
}

onMounted(loadLinks)

// --- Aggiunta ---
const urlSchema = z.string().trim().url()

const newPlatform = ref<Platform>('AIRBNB')
const newUrl = ref('')
const addError = ref('')
const isAdding = ref(false)

async function addLink() {
  addError.value = ''

  const result = urlSchema.safeParse(newUrl.value)
  if (!result.success) {
    addError.value = newUrl.value.trim()
      ? t('wizard.otaLinks.validation.urlInvalid')
      : t('wizard.otaLinks.validation.urlRequired')
    return
  }

  isAdding.value = true

  const nextSortOrder = links.value.reduce((max, l) => Math.max(max, l.sort_order), -1) + 1

  const { data, error } = await supabase
    .from('ota_links')
    .insert({ property_id: props.propertyId, platform: newPlatform.value, url: result.data, sort_order: nextSortOrder })
    .select('id, platform, url, label, sort_order')
    .single()

  isAdding.value = false

  if (error || !data) {
    addError.value = t('wizard.otaLinks.errors.add')
    return
  }

  links.value.push(data)
  wizardStore.markComplete('ota-links')
  newUrl.value = ''
}

// --- Modifica campi ---
const fieldErrors = ref<Record<string, string>>({})
const savingId = ref<string | null>(null)
const savedId = ref<string | null>(null)

async function saveLink(link: OtaLink) {
  fieldErrors.value = { ...fieldErrors.value, [link.id]: '' }

  const result = urlSchema.safeParse(link.url)
  if (!result.success) {
    fieldErrors.value = {
      ...fieldErrors.value,
      [link.id]: link.url.trim() ? t('wizard.otaLinks.validation.urlInvalid') : t('wizard.otaLinks.validation.urlRequired'),
    }
    return
  }

  savingId.value = link.id
  const { error } = await supabase
    .from('ota_links')
    .update({ platform: link.platform, url: result.data, label: link.label?.trim() || null })
    .eq('id', link.id)
  savingId.value = null

  if (error) {
    fieldErrors.value = { ...fieldErrors.value, [link.id]: t('wizard.otaLinks.errors.save') }
    return
  }

  link.url = result.data
  savedId.value = link.id
  setTimeout(() => {
    if (savedId.value === link.id) savedId.value = null
  }, 2000)
}

// --- Riordino ---
const isReordering = ref(false)

async function swapSortOrder(a: OtaLink, b: OtaLink) {
  isReordering.value = true
  const aOrder = a.sort_order
  const bOrder = b.sort_order

  await Promise.all([
    supabase.from('ota_links').update({ sort_order: bOrder }).eq('id', a.id),
    supabase.from('ota_links').update({ sort_order: aOrder }).eq('id', b.id),
  ])

  a.sort_order = bOrder
  b.sort_order = aOrder
  isReordering.value = false
}

function moveUp(link: OtaLink) {
  const idx = sortedLinks.value.findIndex(l => l.id === link.id)
  if (idx <= 0) return
  swapSortOrder(link, sortedLinks.value[idx - 1])
}

function moveDown(link: OtaLink) {
  const idx = sortedLinks.value.findIndex(l => l.id === link.id)
  if (idx === -1 || idx >= sortedLinks.value.length - 1) return
  swapSortOrder(link, sortedLinks.value[idx + 1])
}

// --- Eliminazione ---
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

async function confirmDelete(link: OtaLink) {
  isDeleting.value = true
  deleteError.value = ''

  const { error } = await supabase.from('ota_links').delete().eq('id', link.id)

  isDeleting.value = false

  if (error) {
    deleteError.value = t('wizard.otaLinks.errors.delete')
    return
  }

  links.value = links.value.filter(l => l.id !== link.id)
  deletingId.value = null
}
</script>

<template>
  <div class="wizard-step">
    <h1 class="wizard-step__title">
      {{ t('wizard.otaLinks.title') }}
    </h1>
    <p class="wizard-step__subtitle">
      {{ t('wizard.otaLinks.subtitle') }}
    </p>

    <form
      class="ota-links-add"
      @submit.prevent="addLink"
    >
      <div class="wizard-form__field">
        <label
          class="wizard-form__label"
          for="ota-new-platform"
        >{{ t('wizard.otaLinks.add.platformLabel') }}</label>
        <select
          id="ota-new-platform"
          v-model="newPlatform"
          class="wizard-form__input"
        >
          <option
            v-for="platform in PLATFORMS"
            :key="platform"
            :value="platform"
          >
            {{ platformLabel(platform) }}
          </option>
        </select>
      </div>
      <div class="wizard-form__field ota-links-add__url">
        <label
          class="wizard-form__label"
          for="ota-new-url"
        >{{ t('wizard.otaLinks.add.urlLabel') }}</label>
        <input
          id="ota-new-url"
          v-model="newUrl"
          type="text"
          :placeholder="t('wizard.otaLinks.add.urlPlaceholder')"
          class="wizard-form__input"
        >
      </div>
      <button
        type="submit"
        class="ota-links-add__button"
        :disabled="isAdding"
      >
        {{ isAdding ? t('auth.common.loading') : t('wizard.otaLinks.add.button') }}
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

    <p
      v-else-if="sortedLinks.length === 0"
      class="ota-links-empty"
    >
      {{ t('wizard.otaLinks.empty') }}
    </p>

    <ul
      v-else
      class="ota-links-list"
    >
      <li
        v-for="(link, index) in sortedLinks"
        :key="link.id"
        class="ota-link-card"
      >
        <div class="ota-link-card__reorder">
          <button
            type="button"
            class="ota-link-card__reorder-button"
            :disabled="index === 0 || isReordering"
            :aria-label="t('wizard.otaLinks.moveUp')"
            @click="moveUp(link)"
          >
            ↑
          </button>
          <button
            type="button"
            class="ota-link-card__reorder-button"
            :disabled="index === sortedLinks.length - 1 || isReordering"
            :aria-label="t('wizard.otaLinks.moveDown')"
            @click="moveDown(link)"
          >
            ↓
          </button>
        </div>

        <div class="ota-link-card__field">
          <label class="ota-link-card__label">{{ t('wizard.otaLinks.fields.platformLabel') }}</label>
          <select
            v-model="link.platform"
            class="ota-link-card__input"
          >
            <option
              v-for="platform in PLATFORMS"
              :key="platform"
              :value="platform"
            >
              {{ platformLabel(platform) }}
            </option>
          </select>
        </div>

        <div class="ota-link-card__field">
          <label class="ota-link-card__label">{{ t('wizard.otaLinks.fields.urlLabel') }}</label>
          <input
            v-model="link.url"
            type="text"
            class="ota-link-card__input"
          >
        </div>

        <div class="ota-link-card__field">
          <label class="ota-link-card__label">{{ t('wizard.otaLinks.fields.labelLabel') }}</label>
          <input
            v-model="link.label"
            type="text"
            :placeholder="t('wizard.otaLinks.fields.labelPlaceholder')"
            class="ota-link-card__input"
          >
        </div>

        <p
          v-if="fieldErrors[link.id]"
          class="ota-link-card__error"
        >
          {{ fieldErrors[link.id] }}
        </p>
        <p
          v-if="savedId === link.id"
          class="ota-link-card__saved"
        >
          {{ t('wizard.otaLinks.saved') }}
        </p>

        <div class="ota-link-card__actions">
          <button
            type="button"
            class="ota-link-card__save"
            :disabled="savingId === link.id"
            @click="saveLink(link)"
          >
            {{ savingId === link.id ? t('auth.common.loading') : t('wizard.otaLinks.save') }}
          </button>
          <button
            type="button"
            class="ota-link-card__delete"
            @click="askDelete(link.id)"
          >
            {{ t('wizard.otaLinks.delete') }}
          </button>
        </div>

        <div
          v-if="deletingId === link.id"
          class="ota-link-card__confirm"
        >
          <p class="ota-link-card__confirm-title">
            {{ t('wizard.otaLinks.deleteConfirm.title') }}
          </p>
          <p
            v-if="deleteError"
            class="ota-link-card__confirm-error"
          >
            {{ deleteError }}
          </p>
          <div class="ota-link-card__confirm-actions">
            <button
              type="button"
              class="ota-link-card__confirm-cancel"
              :disabled="isDeleting"
              @click="cancelDelete"
            >
              {{ t('wizard.otaLinks.deleteConfirm.cancel') }}
            </button>
            <button
              type="button"
              class="ota-link-card__confirm-submit"
              :disabled="isDeleting"
              @click="confirmDelete(link)"
            >
              {{ isDeleting ? t('auth.common.loading') : t('wizard.otaLinks.deleteConfirm.confirm') }}
            </button>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/*
  Titolo/sottotitolo/loading e campi "wizard-form__" condivisi con gli altri
  step (stessa convenzione introdotta in GeneralInfoStep.vue). Le classi
  "ota-link-card__" ricalcano "optional-card__" di OptionalsStep.vue.
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

.wizard-form__alert {
  @apply mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700;
}

.ota-links-add {
  @apply mt-6 flex flex-wrap items-end gap-3;
}

.ota-links-add__url {
  @apply min-w-[240px] flex-1;
}

.ota-links-add__button {
  @apply rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50;
  background-color: var(--color-primary);
}

.ota-links-empty {
  @apply mt-8 text-sm;
  color: var(--color-muted);
}

.ota-links-list {
  @apply mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3;
}

.ota-link-card {
  @apply space-y-2 rounded-md border p-3;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
}

.ota-link-card__reorder {
  @apply flex justify-end gap-1;
}

.ota-link-card__reorder-button {
  @apply rounded-md border px-2 py-1 text-sm disabled:opacity-30;
  border-color: #d1d5db;
  color: var(--color-text);
}

.ota-link-card__field {
  @apply space-y-1;
}

.ota-link-card__label {
  @apply block text-xs font-medium;
  color: var(--color-text);
}

.ota-link-card__input {
  @apply w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2;
  border-color: #d1d5db;
  --tw-ring-color: var(--color-primary);
}

.ota-link-card__error {
  @apply text-xs text-red-600;
}

.ota-link-card__saved {
  @apply text-xs;
  color: #047857;
}

.ota-link-card__actions {
  @apply flex items-center justify-between gap-2 pt-1;
}

.ota-link-card__save {
  @apply rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50;
  background-color: var(--color-primary);
}

.ota-link-card__delete {
  @apply text-sm font-medium text-red-600 underline underline-offset-2;
}

.ota-link-card__confirm {
  @apply space-y-2 rounded-md p-3 text-sm;
  background-color: #fef2f2;
}

.ota-link-card__confirm-title {
  @apply font-medium text-red-800;
}

.ota-link-card__confirm-error {
  @apply font-medium text-red-700;
}

.ota-link-card__confirm-actions {
  @apply flex gap-3;
}

.ota-link-card__confirm-cancel {
  @apply rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50;
  border-color: #d1d5db;
  color: var(--color-text);
}

.ota-link-card__confirm-submit {
  @apply rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50;
}
</style>
