<script setup lang="ts">
// EPIC 7 — Wizard: Regole della casa (US-701). Due parti distinte sullo
// stesso modello `house_rules`:
// - Animali/Fumo/Feste: policy singole (al più una riga per tipo), UI
//   guidata con toggle Consentito/Non consentito + nota facoltativa, come
//   deciso con Albe per velocizzare l'inserimento rispetto a testo libero.
// - Altro: lista libera, stesso pattern CRUD di OptionalsStep.vue (aggiungi
//   + card editabile inline + riordino + eliminazione con conferma).
//
// Il testo del toggle viene composto nella lingua dell'interfaccia corrente
// e salvato as-is in `description` (è testo libero mostrato agli ospiti,
// non richiede traduzione automatica — decisione già presa per i contenuti
// owner, vedi EPIC 18). Se in futuro l'owner modifica lo step con
// l'interfaccia in un'altra lingua, il parsing del prefisso può non
// combaciare: in quel caso il testo esistente non va perso, finisce per
// intero nella nota (vedi parseFixedRule) e il toggle va solo riconfermato.
const FIXED_TYPES = ['PETS', 'SMOKING', 'PARTIES'] as const
type FixedType = typeof FIXED_TYPES[number]

interface HouseRule {
  id: string
  type: FixedType | 'OTHER'
  description: string | null
  sort_order: number
}

interface FixedSectionState {
  ruleId: string | null
  allowed: boolean | null
  note: string
  isSaving: boolean
  isSaved: boolean
  error: string
}

const props = defineProps<{ propertyId: string }>()

const { t } = useI18n()
const supabase = useSupabaseClient()
const wizardStore = useWizardStore()

const isLoading = ref(true)
const loadError = ref('')

const fixedSections = reactive<Record<FixedType, FixedSectionState>>({
  PETS: { ruleId: null, allowed: null, note: '', isSaving: false, isSaved: false, error: '' },
  SMOKING: { ruleId: null, allowed: null, note: '', isSaving: false, isSaved: false, error: '' },
  PARTIES: { ruleId: null, allowed: null, note: '', isSaving: false, isSaved: false, error: '' },
})

const otherRules = ref<HouseRule[]>([])
const sortedOtherRules = computed(() => [...otherRules.value].sort((a, b) => a.sort_order - b.sort_order))

function composeDescription(allowed: boolean, note: string) {
  const prefix = allowed ? t('wizard.houseRules.allowedLabel') : t('wizard.houseRules.notAllowedLabel')
  const trimmedNote = note.trim()
  return trimmedNote ? `${prefix}: ${trimmedNote}` : prefix
}

function parseFixedRule(description: string | null): { allowed: boolean | null, note: string } {
  if (!description) return { allowed: null, note: '' }

  for (const allowed of [true, false]) {
    const prefix = allowed ? t('wizard.houseRules.allowedLabel') : t('wizard.houseRules.notAllowedLabel')
    if (description === prefix) return { allowed, note: '' }
    if (description.startsWith(`${prefix}: `)) return { allowed, note: description.slice(prefix.length + 2) }
  }

  return { allowed: true, note: description }
}

async function loadHouseRules() {
  isLoading.value = true
  loadError.value = ''

  const { data, error } = await supabase
    .from('house_rules')
    .select('id, type, description, sort_order')
    .eq('property_id', props.propertyId)
    .order('sort_order', { ascending: true })

  isLoading.value = false

  if (error) {
    loadError.value = t('wizard.houseRules.errors.load')
    return
  }

  const rows = data ?? []
  otherRules.value = rows.filter(r => r.type === 'OTHER')

  for (const type of FIXED_TYPES) {
    const row = rows.find(r => r.type === type)
    if (row) {
      const parsed = parseFixedRule(row.description)
      fixedSections[type].ruleId = row.id
      fixedSections[type].allowed = parsed.allowed
      fixedSections[type].note = parsed.note
    }
  }

  // Nessun requisito minimo per questo step (AC US-701): basta che il
  // caricamento sia andato a buon fine, come per occupancy-spaces/optionals.
  wizardStore.markComplete('house-rules')
}

onMounted(loadHouseRules)

// --- Sezioni fisse: Animali/Fumo/Feste ---
async function saveFixedSection(type: FixedType) {
  const section = fixedSections[type]

  if (section.allowed === null) {
    section.error = t('wizard.houseRules.validation.choiceRequired')
    return
  }

  section.error = ''
  section.isSaving = true
  const description = composeDescription(section.allowed, section.note)

  if (section.ruleId) {
    const { error } = await supabase.from('house_rules').update({ description }).eq('id', section.ruleId)
    section.isSaving = false
    if (error) {
      section.error = t('wizard.houseRules.errors.save')
      return
    }
  }
  else {
    const { data, error } = await supabase
      .from('house_rules')
      .insert({ property_id: props.propertyId, type, description, sort_order: 0 })
      .select('id')
      .single()
    section.isSaving = false
    if (error || !data) {
      section.error = t('wizard.houseRules.errors.save')
      return
    }
    section.ruleId = data.id
  }

  wizardStore.markComplete('house-rules')
  section.isSaved = true
  setTimeout(() => {
    if (section.isSaved) section.isSaved = false
  }, 2000)
}

// --- Altre regole (lista libera) ---
const newOtherDescription = ref('')
const addError = ref('')
const isAdding = ref(false)

async function addOtherRule() {
  const description = newOtherDescription.value.trim()
  if (!description) return

  addError.value = ''
  isAdding.value = true

  const nextSortOrder = otherRules.value.reduce((max, r) => Math.max(max, r.sort_order), -1) + 1

  const { data, error } = await supabase
    .from('house_rules')
    .insert({ property_id: props.propertyId, type: 'OTHER', description, sort_order: nextSortOrder })
    .select('id, type, description, sort_order')
    .single()

  isAdding.value = false

  if (error || !data) {
    addError.value = t('wizard.houseRules.other.errors.add')
    return
  }

  otherRules.value.push(data)
  wizardStore.markComplete('house-rules')
  newOtherDescription.value = ''
}

const otherFieldErrors = ref<Record<string, string>>({})
const otherSavingId = ref<string | null>(null)
const otherSavedId = ref<string | null>(null)

async function saveOtherRule(rule: HouseRule) {
  otherFieldErrors.value = { ...otherFieldErrors.value, [rule.id]: '' }

  const description = rule.description?.trim() || ''
  if (!description) {
    otherFieldErrors.value = { ...otherFieldErrors.value, [rule.id]: t('wizard.houseRules.other.validation.descriptionRequired') }
    return
  }

  otherSavingId.value = rule.id
  const { error } = await supabase.from('house_rules').update({ description }).eq('id', rule.id)
  otherSavingId.value = null

  if (error) {
    otherFieldErrors.value = { ...otherFieldErrors.value, [rule.id]: t('wizard.houseRules.other.errors.save') }
    return
  }

  rule.description = description
  otherSavedId.value = rule.id
  setTimeout(() => {
    if (otherSavedId.value === rule.id) otherSavedId.value = null
  }, 2000)
}

const isReordering = ref(false)

async function swapSortOrder(a: HouseRule, b: HouseRule) {
  isReordering.value = true
  const aOrder = a.sort_order
  const bOrder = b.sort_order

  await Promise.all([
    supabase.from('house_rules').update({ sort_order: bOrder }).eq('id', a.id),
    supabase.from('house_rules').update({ sort_order: aOrder }).eq('id', b.id),
  ])

  a.sort_order = bOrder
  b.sort_order = aOrder
  isReordering.value = false
}

function moveUp(rule: HouseRule) {
  const idx = sortedOtherRules.value.findIndex(r => r.id === rule.id)
  if (idx <= 0) return
  swapSortOrder(rule, sortedOtherRules.value[idx - 1])
}

function moveDown(rule: HouseRule) {
  const idx = sortedOtherRules.value.findIndex(r => r.id === rule.id)
  if (idx === -1 || idx >= sortedOtherRules.value.length - 1) return
  swapSortOrder(rule, sortedOtherRules.value[idx + 1])
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

async function confirmDelete(rule: HouseRule) {
  isDeleting.value = true
  deleteError.value = ''

  const { error } = await supabase.from('house_rules').delete().eq('id', rule.id)

  isDeleting.value = false

  if (error) {
    deleteError.value = t('wizard.houseRules.other.errors.delete')
    return
  }

  otherRules.value = otherRules.value.filter(r => r.id !== rule.id)
  deletingId.value = null
}
</script>

<template>
  <div class="wizard-step">
    <h1 class="wizard-step__title">
      {{ t('wizard.houseRules.title') }}
    </h1>
    <p class="wizard-step__subtitle">
      {{ t('wizard.houseRules.subtitle') }}
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
      <div class="fixed-rules">
        <div
          v-for="type in FIXED_TYPES"
          :key="type"
          class="fixed-rule"
        >
          <h2 class="fixed-rule__title">
            {{ t(`wizard.houseRules.types.${type}`) }}
          </h2>

          <div class="fixed-rule__toggle">
            <button
              type="button"
              class="fixed-rule__toggle-button"
              :class="{ 'fixed-rule__toggle-button--active': fixedSections[type].allowed === true }"
              @click="fixedSections[type].allowed = true"
            >
              {{ t('wizard.houseRules.allowedLabel') }}
            </button>
            <button
              type="button"
              class="fixed-rule__toggle-button"
              :class="{ 'fixed-rule__toggle-button--active': fixedSections[type].allowed === false }"
              @click="fixedSections[type].allowed = false"
            >
              {{ t('wizard.houseRules.notAllowedLabel') }}
            </button>
          </div>

          <div class="wizard-form__field">
            <label class="wizard-form__label">{{ t('wizard.houseRules.noteLabel') }}</label>
            <input
              v-model="fixedSections[type].note"
              type="text"
              :placeholder="t('wizard.houseRules.notePlaceholder')"
              class="wizard-form__input"
            >
          </div>

          <p
            v-if="fixedSections[type].error"
            class="fixed-rule__error"
          >
            {{ fixedSections[type].error }}
          </p>
          <p
            v-if="fixedSections[type].isSaved"
            class="fixed-rule__saved"
          >
            {{ t('wizard.houseRules.saved') }}
          </p>

          <button
            type="button"
            class="fixed-rule__save"
            :disabled="fixedSections[type].isSaving"
            @click="saveFixedSection(type)"
          >
            {{ fixedSections[type].isSaving ? t('auth.common.loading') : t('wizard.houseRules.save') }}
          </button>
        </div>
      </div>

      <h2 class="other-rules__title">
        {{ t('wizard.houseRules.other.title') }}
      </h2>

      <form
        class="other-rules-add"
        @submit.prevent="addOtherRule"
      >
        <div class="wizard-form__field">
          <label
            class="wizard-form__label"
            for="other-rule-new"
          >{{ t('wizard.houseRules.other.add.label') }}</label>
          <input
            id="other-rule-new"
            v-model="newOtherDescription"
            type="text"
            :placeholder="t('wizard.houseRules.other.add.placeholder')"
            class="wizard-form__input"
          >
        </div>
        <button
          type="submit"
          class="other-rules-add__button"
          :disabled="isAdding || !newOtherDescription.trim()"
        >
          {{ isAdding ? t('auth.common.loading') : t('wizard.houseRules.other.add.button') }}
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
        v-if="sortedOtherRules.length === 0"
        class="other-rules-empty"
      >
        {{ t('wizard.houseRules.other.empty') }}
      </p>

      <ul
        v-else
        class="other-rules-list"
      >
        <li
          v-for="(rule, index) in sortedOtherRules"
          :key="rule.id"
          class="house-rule-card"
        >
          <div class="house-rule-card__reorder">
            <button
              type="button"
              class="house-rule-card__reorder-button"
              :disabled="index === 0 || isReordering"
              :aria-label="t('wizard.houseRules.other.moveUp')"
              @click="moveUp(rule)"
            >
              ↑
            </button>
            <button
              type="button"
              class="house-rule-card__reorder-button"
              :disabled="index === sortedOtherRules.length - 1 || isReordering"
              :aria-label="t('wizard.houseRules.other.moveDown')"
              @click="moveDown(rule)"
            >
              ↓
            </button>
          </div>

          <input
            v-model="rule.description"
            type="text"
            class="house-rule-card__input"
          >

          <p
            v-if="otherFieldErrors[rule.id]"
            class="house-rule-card__error"
          >
            {{ otherFieldErrors[rule.id] }}
          </p>
          <p
            v-if="otherSavedId === rule.id"
            class="house-rule-card__saved"
          >
            {{ t('wizard.houseRules.other.saved') }}
          </p>

          <div class="house-rule-card__actions">
            <button
              type="button"
              class="house-rule-card__save"
              :disabled="otherSavingId === rule.id"
              @click="saveOtherRule(rule)"
            >
              {{ otherSavingId === rule.id ? t('auth.common.loading') : t('wizard.houseRules.other.save') }}
            </button>
            <button
              type="button"
              class="house-rule-card__delete"
              @click="askDelete(rule.id)"
            >
              {{ t('wizard.houseRules.other.delete') }}
            </button>
          </div>

          <div
            v-if="deletingId === rule.id"
            class="house-rule-card__confirm"
          >
            <p class="house-rule-card__confirm-title">
              {{ t('wizard.houseRules.other.deleteConfirm.title') }}
            </p>
            <p
              v-if="deleteError"
              class="house-rule-card__confirm-error"
            >
              {{ deleteError }}
            </p>
            <div class="house-rule-card__confirm-actions">
              <button
                type="button"
                class="house-rule-card__confirm-cancel"
                :disabled="isDeleting"
                @click="cancelDelete"
              >
                {{ t('wizard.houseRules.other.deleteConfirm.cancel') }}
              </button>
              <button
                type="button"
                class="house-rule-card__confirm-submit"
                :disabled="isDeleting"
                @click="confirmDelete(rule)"
              >
                {{ isDeleting ? t('auth.common.loading') : t('wizard.houseRules.other.deleteConfirm.confirm') }}
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
  "house-rule-card__" ricalcano "optional-card__" di OptionalsStep.vue.
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

.fixed-rules {
  @apply mt-6 grid gap-5 sm:grid-cols-3;
}

.fixed-rule {
  @apply space-y-3 rounded-md border p-3;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
}

.fixed-rule__title {
  @apply text-sm font-semibold;
  color: var(--color-text);
}

.fixed-rule__toggle {
  @apply flex gap-2;
}

.fixed-rule__toggle-button {
  @apply flex-1 rounded-md border px-2 py-1.5 text-sm font-medium;
  border-color: #d1d5db;
  color: var(--color-text);
}

.fixed-rule__toggle-button--active {
  border-color: var(--color-primary);
  background-color: var(--color-primary);
  color: white;
}

.fixed-rule__error {
  @apply text-xs text-red-600;
}

.fixed-rule__saved {
  @apply text-xs;
  color: #047857;
}

.fixed-rule__save {
  @apply w-full rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50;
  background-color: var(--color-primary);
}

.other-rules__title {
  @apply mt-8 text-lg font-semibold;
  color: var(--color-text);
}

.other-rules-add {
  @apply mt-3 flex flex-wrap items-end gap-3;
}

.other-rules-add .wizard-form__field {
  @apply min-w-[240px] flex-1;
}

.other-rules-add__button {
  @apply rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50;
  background-color: var(--color-primary);
}

.other-rules-empty {
  @apply mt-6 text-sm;
  color: var(--color-muted);
}

.other-rules-list {
  @apply mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3;
}

.house-rule-card {
  @apply space-y-2 rounded-md border p-3;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
}

.house-rule-card__reorder {
  @apply flex justify-end gap-1;
}

.house-rule-card__reorder-button {
  @apply rounded-md border px-2 py-1 text-sm disabled:opacity-30;
  border-color: #d1d5db;
  color: var(--color-text);
}

.house-rule-card__input {
  @apply w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2;
  border-color: #d1d5db;
  --tw-ring-color: var(--color-primary);
}

.house-rule-card__error {
  @apply text-xs text-red-600;
}

.house-rule-card__saved {
  @apply text-xs;
  color: #047857;
}

.house-rule-card__actions {
  @apply flex items-center justify-between gap-2 pt-1;
}

.house-rule-card__save {
  @apply rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50;
  background-color: var(--color-primary);
}

.house-rule-card__delete {
  @apply text-sm font-medium text-red-600 underline underline-offset-2;
}

.house-rule-card__confirm {
  @apply space-y-2 rounded-md p-3 text-sm;
  background-color: #fef2f2;
}

.house-rule-card__confirm-title {
  @apply font-medium text-red-800;
}

.house-rule-card__confirm-error {
  @apply font-medium text-red-700;
}

.house-rule-card__confirm-actions {
  @apply flex gap-3;
}

.house-rule-card__confirm-cancel {
  @apply rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50;
  border-color: #d1d5db;
  color: var(--color-text);
}

.house-rule-card__confirm-submit {
  @apply rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50;
}
</style>
