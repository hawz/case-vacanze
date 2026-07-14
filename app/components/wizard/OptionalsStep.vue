<script setup lang="ts">
import { z } from 'zod'

// EPIC 6 — Wizard: Optional (US-601). Segue il pattern lista+card di
// PhotosStep.vue (riordino via sort_order, eliminazione con conferma), ma
// senza upload: ogni riga nasce con un piccolo form "aggiungi" (solo nome,
// obbligatorio) e viene poi arricchita inline. Nessun endpoint server
// necessario, nessun secret coinvolto.
interface OptionalItem {
  id: string
  name: string
  description: string | null
  price: number | null
  unit: string | null
  sort_order: number
}

const props = defineProps<{ propertyId: string }>()

const { t } = useI18n()
const supabase = useSupabaseClient()
const wizardStore = useWizardStore()

const optionals = ref<OptionalItem[]>([])
const sortedOptionals = computed(() => [...optionals.value].sort((a, b) => a.sort_order - b.sort_order))
// Il prezzo è tenuto come stringa separata da OptionalItem.price (numero o
// null) per poter validare/digitare liberamente senza forzare un numero ad
// ogni keystroke; sincronizzato in loadOptionals/addOptional/saveOptional.
const priceInputs = ref<Record<string, string>>({})

const isLoading = ref(true)
const loadError = ref('')

async function loadOptionals() {
  isLoading.value = true
  loadError.value = ''

  const { data, error } = await supabase
    .from('optionals')
    .select('id, name, description, price, unit, sort_order')
    .eq('property_id', props.propertyId)
    .order('sort_order', { ascending: true })

  isLoading.value = false

  if (error) {
    loadError.value = t('wizard.optionals.errors.load')
    return
  }

  optionals.value = data ?? []
  for (const optional of optionals.value) {
    priceInputs.value[optional.id] = optional.price != null ? String(optional.price) : ''
  }
  // La lista può restare vuota (AC US-601): lo step non ha requisiti minimi,
  // quindi basta che il caricamento sia andato a buon fine.
  wizardStore.markComplete('optionals')
}

onMounted(loadOptionals)

// --- Aggiunta (US-601) ---
const newName = ref('')
const addError = ref('')
const isAdding = ref(false)

async function addOptional() {
  const name = newName.value.trim()
  if (!name) return

  addError.value = ''
  isAdding.value = true

  const nextSortOrder = optionals.value.reduce((max, o) => Math.max(max, o.sort_order), -1) + 1

  const { data, error } = await supabase
    .from('optionals')
    .insert({ property_id: props.propertyId, name, sort_order: nextSortOrder })
    .select('id, name, description, price, unit, sort_order')
    .single()

  isAdding.value = false

  if (error || !data) {
    addError.value = t('wizard.optionals.errors.add')
    return
  }

  optionals.value.push(data)
  priceInputs.value[data.id] = data.price != null ? String(data.price) : ''
  wizardStore.markComplete('optionals')
  newName.value = ''
}

// --- Modifica campi (US-601) ---
const fieldErrors = ref<Record<string, string>>({})
const savingId = ref<string | null>(null)
const savedId = ref<string | null>(null)

const priceSchema = z.coerce.number().nonnegative()

async function saveOptional(optional: OptionalItem) {
  fieldErrors.value = { ...fieldErrors.value, [optional.id]: '' }

  const name = optional.name.trim()
  if (!name) {
    fieldErrors.value = { ...fieldErrors.value, [optional.id]: t('wizard.optionals.validation.nameRequired') }
    return
  }

  const rawPrice = priceInputs.value[optional.id] ?? ''
  let price: number | null = null
  if (rawPrice.trim() !== '') {
    const result = priceSchema.safeParse(rawPrice)
    if (!result.success) {
      fieldErrors.value = { ...fieldErrors.value, [optional.id]: t('wizard.optionals.validation.priceInvalid') }
      return
    }
    price = result.data
  }

  savingId.value = optional.id
  const { error } = await supabase
    .from('optionals')
    .update({
      name,
      description: optional.description?.trim() || null,
      price,
      unit: optional.unit?.trim() || null,
    })
    .eq('id', optional.id)
  savingId.value = null

  if (error) {
    fieldErrors.value = { ...fieldErrors.value, [optional.id]: t('wizard.optionals.errors.save') }
    return
  }

  optional.name = name
  optional.price = price
  savedId.value = optional.id
  setTimeout(() => {
    if (savedId.value === optional.id) savedId.value = null
  }, 2000)
}

// --- Riordino (US-601) ---
const isReordering = ref(false)

async function swapSortOrder(a: OptionalItem, b: OptionalItem) {
  isReordering.value = true
  const aOrder = a.sort_order
  const bOrder = b.sort_order

  await Promise.all([
    supabase.from('optionals').update({ sort_order: bOrder }).eq('id', a.id),
    supabase.from('optionals').update({ sort_order: aOrder }).eq('id', b.id),
  ])

  a.sort_order = bOrder
  b.sort_order = aOrder
  isReordering.value = false
}

function moveUp(optional: OptionalItem) {
  const idx = sortedOptionals.value.findIndex(o => o.id === optional.id)
  if (idx <= 0) return
  swapSortOrder(optional, sortedOptionals.value[idx - 1])
}

function moveDown(optional: OptionalItem) {
  const idx = sortedOptionals.value.findIndex(o => o.id === optional.id)
  if (idx === -1 || idx >= sortedOptionals.value.length - 1) return
  swapSortOrder(optional, sortedOptionals.value[idx + 1])
}

// --- Eliminazione (US-601) ---
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

async function confirmDelete(optional: OptionalItem) {
  isDeleting.value = true
  deleteError.value = ''

  const { error } = await supabase.from('optionals').delete().eq('id', optional.id)

  isDeleting.value = false

  if (error) {
    deleteError.value = t('wizard.optionals.errors.delete')
    return
  }

  optionals.value = optionals.value.filter(o => o.id !== optional.id)
  deletingId.value = null
}
</script>

<template>
  <div class="wizard-step">
    <h1 class="wizard-step__title">
      {{ t('wizard.optionals.title') }}
    </h1>
    <p class="wizard-step__subtitle">
      {{ t('wizard.optionals.subtitle') }}
    </p>

    <form
      class="optionals-add"
      @submit.prevent="addOptional"
    >
      <div class="wizard-form__field">
        <label
          class="wizard-form__label"
          for="optional-new-name"
        >{{ t('wizard.optionals.add.nameLabel') }}</label>
        <input
          id="optional-new-name"
          v-model="newName"
          type="text"
          :placeholder="t('wizard.optionals.add.namePlaceholder')"
          class="wizard-form__input"
        >
      </div>
      <button
        type="submit"
        class="optionals-add__button"
        :disabled="isAdding || !newName.trim()"
      >
        {{ isAdding ? t('auth.common.loading') : t('wizard.optionals.add.button') }}
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
      v-else-if="sortedOptionals.length === 0"
      class="optionals-empty"
    >
      {{ t('wizard.optionals.empty') }}
    </p>

    <ul
      v-else
      class="optionals-list"
    >
      <li
        v-for="(optional, index) in sortedOptionals"
        :key="optional.id"
        class="optional-card"
      >
        <div class="optional-card__reorder">
          <button
            type="button"
            class="optional-card__reorder-button"
            :disabled="index === 0 || isReordering"
            :aria-label="t('wizard.optionals.moveUp')"
            @click="moveUp(optional)"
          >
            ↑
          </button>
          <button
            type="button"
            class="optional-card__reorder-button"
            :disabled="index === sortedOptionals.length - 1 || isReordering"
            :aria-label="t('wizard.optionals.moveDown')"
            @click="moveDown(optional)"
          >
            ↓
          </button>
        </div>

        <div class="optional-card__field">
          <label class="optional-card__label">{{ t('wizard.optionals.fields.nameLabel') }}</label>
          <input
            v-model="optional.name"
            type="text"
            class="optional-card__input"
          >
        </div>

        <div class="optional-card__field">
          <label class="optional-card__label">{{ t('wizard.optionals.fields.descriptionLabel') }}</label>
          <textarea
            v-model="optional.description"
            rows="2"
            class="optional-card__input"
          />
        </div>

        <div class="optional-card__row">
          <div class="optional-card__field">
            <label class="optional-card__label">{{ t('wizard.optionals.fields.priceLabel') }}</label>
            <input
              v-model="priceInputs[optional.id]"
              type="text"
              inputmode="decimal"
              class="optional-card__input"
            >
          </div>
          <div class="optional-card__field">
            <label class="optional-card__label">{{ t('wizard.optionals.fields.unitLabel') }}</label>
            <input
              v-model="optional.unit"
              type="text"
              :placeholder="t('wizard.optionals.fields.unitPlaceholder')"
              class="optional-card__input"
            >
          </div>
        </div>

        <p
          v-if="fieldErrors[optional.id]"
          class="optional-card__error"
        >
          {{ fieldErrors[optional.id] }}
        </p>
        <p
          v-if="savedId === optional.id"
          class="optional-card__saved"
        >
          {{ t('wizard.optionals.saved') }}
        </p>

        <div class="optional-card__actions">
          <button
            type="button"
            class="optional-card__save"
            :disabled="savingId === optional.id"
            @click="saveOptional(optional)"
          >
            {{ savingId === optional.id ? t('auth.common.loading') : t('wizard.optionals.save') }}
          </button>
          <button
            type="button"
            class="optional-card__delete"
            @click="askDelete(optional.id)"
          >
            {{ t('wizard.optionals.delete') }}
          </button>
        </div>

        <div
          v-if="deletingId === optional.id"
          class="optional-card__confirm"
        >
          <p class="optional-card__confirm-title">
            {{ t('wizard.optionals.deleteConfirm.title') }}
          </p>
          <p
            v-if="deleteError"
            class="optional-card__confirm-error"
          >
            {{ deleteError }}
          </p>
          <div class="optional-card__confirm-actions">
            <button
              type="button"
              class="optional-card__confirm-cancel"
              :disabled="isDeleting"
              @click="cancelDelete"
            >
              {{ t('wizard.optionals.deleteConfirm.cancel') }}
            </button>
            <button
              type="button"
              class="optional-card__confirm-submit"
              :disabled="isDeleting"
              @click="confirmDelete(optional)"
            >
              {{ isDeleting ? t('auth.common.loading') : t('wizard.optionals.deleteConfirm.confirm') }}
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
  "optional-card__" ricalcano "photo-card__" di PhotosStep.vue.
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

.optionals-add {
  @apply mt-6 flex flex-wrap items-end gap-3;
}

.optionals-add .wizard-form__field {
  @apply min-w-[240px] flex-1;
}

.optionals-add__button {
  @apply rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50;
  background-color: var(--color-primary);
}

.optionals-empty {
  @apply mt-8 text-sm;
  color: var(--color-muted);
}

.optionals-list {
  @apply mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3;
}

.optional-card {
  @apply space-y-2 rounded-md border p-3;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
}

.optional-card__reorder {
  @apply flex justify-end gap-1;
}

.optional-card__reorder-button {
  @apply rounded-md border px-2 py-1 text-sm disabled:opacity-30;
  border-color: #d1d5db;
  color: var(--color-text);
}

.optional-card__row {
  @apply grid gap-3 sm:grid-cols-2;
}

.optional-card__field {
  @apply space-y-1;
}

.optional-card__label {
  @apply block text-xs font-medium;
  color: var(--color-text);
}

.optional-card__input {
  @apply w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2;
  border-color: #d1d5db;
  --tw-ring-color: var(--color-primary);
}

.optional-card__error {
  @apply text-xs text-red-600;
}

.optional-card__saved {
  @apply text-xs;
  color: #047857;
}

.optional-card__actions {
  @apply flex items-center justify-between gap-2 pt-1;
}

.optional-card__save {
  @apply rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50;
  background-color: var(--color-primary);
}

.optional-card__delete {
  @apply text-sm font-medium text-red-600 underline underline-offset-2;
}

.optional-card__confirm {
  @apply space-y-2 rounded-md p-3 text-sm;
  background-color: #fef2f2;
}

.optional-card__confirm-title {
  @apply font-medium text-red-800;
}

.optional-card__confirm-error {
  @apply font-medium text-red-700;
}

.optional-card__confirm-actions {
  @apply flex gap-3;
}

.optional-card__confirm-cancel {
  @apply rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50;
  border-color: #d1d5db;
  color: var(--color-text);
}

.optional-card__confirm-submit {
  @apply rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50;
}
</style>
