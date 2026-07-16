<script setup lang="ts">
// EPIC 12 — Backoffice: Calendario disponibilità (US-1201/1202). Prima
// funzionalità fuori dal wizard: nessun WIZARD_STEPS/markComplete coinvolto,
// vive nella propria pagina (app/pages/app/properties/[id]/calendar.vue).
//
// Vista mensile costruita a mano (nessuna libreria date aggiunta: il
// progetto non ne aveva già una, e la sola cosa che serve è evidenziare i
// giorni bloccati su una griglia — niente di abbastanza complesso da
// giustificare una dipendenza in più). Le date sono confrontate come
// stringhe ISO 'YYYY-MM-DD': l'ordinamento lessicografico coincide con
// quello cronologico, quindi non serve parsare a Date per i confronti.
interface BlockedDate {
  id: string
  start_date: string
  end_date: string
  reason: string | null
}

const props = defineProps<{ propertyId: string }>()

const { t, locale } = useI18n()
const supabase = useSupabaseClient()

const blockedDates = ref<BlockedDate[]>([])
const sortedBlockedDates = computed(() => [...blockedDates.value].sort((a, b) => b.start_date.localeCompare(a.start_date)))

const isLoading = ref(true)
const loadError = ref('')

async function loadBlockedDates() {
  isLoading.value = true
  loadError.value = ''

  const { data, error } = await supabase
    .from('blocked_dates')
    .select('id, start_date, end_date, reason')
    .eq('property_id', props.propertyId)
    .order('start_date', { ascending: true })

  isLoading.value = false

  if (error) {
    loadError.value = t('calendar.errors.load')
    return
  }

  blockedDates.value = data ?? []
}

onMounted(loadBlockedDates)

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd
}

// --- Vista mensile (sola evidenziazione, US-1201) ---
const today = new Date()
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth())

function toIsoDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const monthLabel = computed(() => new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(new Date(viewYear.value, viewMonth.value, 1)))

const weekdayLabels = computed(() => {
  // Settimana che parte da lunedì: 2024-01-01 era un lunedì, comodo punto di
  // riferimento per generare le etichette senza dipendere dall'anno corrente.
  const reference = new Date(2024, 0, 1)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(reference)
    d.setDate(reference.getDate() + i)
    return new Intl.DateTimeFormat(locale.value, { weekday: 'short' }).format(d)
  })
})

const calendarWeeks = computed(() => {
  const firstOfMonth = new Date(viewYear.value, viewMonth.value, 1)
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7 // Lunedì = 0
  const gridStart = new Date(viewYear.value, viewMonth.value, 1 - firstWeekday)

  const weeks = []
  const cursor = new Date(gridStart)
  for (let week = 0; week < 6; week++) {
    const days = []
    for (let day = 0; day < 7; day++) {
      const iso = toIsoDate(cursor)
      days.push({
        day: cursor.getDate(),
        iso,
        inMonth: cursor.getMonth() === viewMonth.value,
        blocked: blockedDates.value.some(b => b.start_date <= iso && iso <= b.end_date),
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(days)
  }
  return weeks
})

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value -= 1
  }
  else {
    viewMonth.value -= 1
  }
}

function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value += 1
  }
  else {
    viewMonth.value += 1
  }
}

// --- Aggiunta blocco (US-1201) ---
const newStartDate = ref('')
const newEndDate = ref('')
const newReason = ref('')
const addError = ref('')
const isAdding = ref(false)

const newRangeOverlaps = computed(() => {
  if (!newStartDate.value || !newEndDate.value || newEndDate.value < newStartDate.value) return false
  return blockedDates.value.some(b => rangesOverlap(newStartDate.value, newEndDate.value, b.start_date, b.end_date))
})

async function addBlockedDate() {
  addError.value = ''

  if (!newStartDate.value || !newEndDate.value) {
    addError.value = t('calendar.validation.datesRequired')
    return
  }
  if (newEndDate.value < newStartDate.value) {
    addError.value = t('calendar.validation.endBeforeStart')
    return
  }

  isAdding.value = true

  const { data, error } = await supabase
    .from('blocked_dates')
    .insert({
      property_id: props.propertyId,
      start_date: newStartDate.value,
      end_date: newEndDate.value,
      reason: newReason.value.trim() || null,
    })
    .select('id, start_date, end_date, reason')
    .single()

  isAdding.value = false

  if (error || !data) {
    addError.value = t('calendar.errors.add')
    return
  }

  blockedDates.value.push(data)
  newStartDate.value = ''
  newEndDate.value = ''
  newReason.value = ''
}

// --- Modifica (US-1202) ---
const fieldErrors = ref<Record<string, string>>({})
const savingId = ref<string | null>(null)
const savedId = ref<string | null>(null)

async function saveBlockedDate(block: BlockedDate) {
  fieldErrors.value = { ...fieldErrors.value, [block.id]: '' }

  if (!block.start_date || !block.end_date) {
    fieldErrors.value = { ...fieldErrors.value, [block.id]: t('calendar.validation.datesRequired') }
    return
  }
  if (block.end_date < block.start_date) {
    fieldErrors.value = { ...fieldErrors.value, [block.id]: t('calendar.validation.endBeforeStart') }
    return
  }

  savingId.value = block.id
  const { error } = await supabase
    .from('blocked_dates')
    .update({ start_date: block.start_date, end_date: block.end_date, reason: block.reason?.trim() || null })
    .eq('id', block.id)
  savingId.value = null

  if (error) {
    fieldErrors.value = { ...fieldErrors.value, [block.id]: t('calendar.errors.save') }
    return
  }

  savedId.value = block.id
  setTimeout(() => {
    if (savedId.value === block.id) savedId.value = null
  }, 2000)
}

// --- Eliminazione (US-1202) ---
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

async function confirmDelete(block: BlockedDate) {
  isDeleting.value = true
  deleteError.value = ''

  const { error } = await supabase.from('blocked_dates').delete().eq('id', block.id)

  isDeleting.value = false

  if (error) {
    deleteError.value = t('calendar.errors.delete')
    return
  }

  blockedDates.value = blockedDates.value.filter(b => b.id !== block.id)
  deletingId.value = null
}
</script>

<template>
  <div class="calendar-widget">
    <p
      v-if="loadError"
      class="calendar-form__alert"
      role="alert"
    >
      {{ loadError }}
    </p>

    <p
      v-else-if="isLoading"
      class="calendar-widget__loading"
    >
      {{ t('calendar.loading') }}
    </p>

    <template v-else>
      <div class="month-view">
        <div class="month-view__header">
          <button
            type="button"
            class="month-view__nav"
            :aria-label="t('calendar.prevMonth')"
            @click="prevMonth"
          >
            ←
          </button>
          <span class="month-view__label">{{ monthLabel }}</span>
          <button
            type="button"
            class="month-view__nav"
            :aria-label="t('calendar.nextMonth')"
            @click="nextMonth"
          >
            →
          </button>
        </div>

        <div class="month-view__weekdays">
          <span
            v-for="label in weekdayLabels"
            :key="label"
            class="month-view__weekday"
          >
            {{ label }}
          </span>
        </div>

        <div
          v-for="(week, index) in calendarWeeks"
          :key="index"
          class="month-view__week"
        >
          <span
            v-for="cell in week"
            :key="cell.iso"
            class="month-view__day"
            :class="{ 'month-view__day--outside': !cell.inMonth, 'month-view__day--blocked': cell.blocked }"
          >
            {{ cell.day }}
          </span>
        </div>
      </div>

      <form
        class="calendar-add"
        @submit.prevent="addBlockedDate"
      >
        <h2 class="calendar-add__title">
          {{ t('calendar.add.title') }}
        </h2>
        <div class="calendar-add__row">
          <div class="calendar-form__field">
            <label
              class="calendar-form__label"
              for="block-start"
            >{{ t('calendar.add.startDateLabel') }}</label>
            <input
              id="block-start"
              v-model="newStartDate"
              type="date"
              class="calendar-form__input"
            >
          </div>
          <div class="calendar-form__field">
            <label
              class="calendar-form__label"
              for="block-end"
            >{{ t('calendar.add.endDateLabel') }}</label>
            <input
              id="block-end"
              v-model="newEndDate"
              type="date"
              class="calendar-form__input"
            >
          </div>
        </div>
        <div class="calendar-form__field">
          <label
            class="calendar-form__label"
            for="block-reason"
          >{{ t('calendar.add.reasonLabel') }}</label>
          <input
            id="block-reason"
            v-model="newReason"
            type="text"
            :placeholder="t('calendar.add.reasonPlaceholder')"
            class="calendar-form__input"
          >
        </div>

        <p
          v-if="newRangeOverlaps"
          class="calendar-warning"
        >
          {{ t('calendar.overlapWarning') }}
        </p>

        <p
          v-if="addError"
          class="calendar-form__alert"
          role="alert"
        >
          {{ addError }}
        </p>

        <button
          type="submit"
          class="calendar-add__button"
          :disabled="isAdding"
        >
          {{ isAdding ? t('calendar.loading') : t('calendar.add.button') }}
        </button>
      </form>

      <h2 class="blocked-list__title">
        {{ t('calendar.list.title') }}
      </h2>

      <p
        v-if="sortedBlockedDates.length === 0"
        class="blocked-list__empty"
      >
        {{ t('calendar.list.empty') }}
      </p>

      <ul
        v-else
        class="blocked-list"
      >
        <li
          v-for="block in sortedBlockedDates"
          :key="block.id"
          class="blocked-card"
        >
          <div class="blocked-card__row">
            <div class="blocked-card__field">
              <label class="blocked-card__label">{{ t('calendar.add.startDateLabel') }}</label>
              <input
                v-model="block.start_date"
                type="date"
                class="blocked-card__input"
              >
            </div>
            <div class="blocked-card__field">
              <label class="blocked-card__label">{{ t('calendar.add.endDateLabel') }}</label>
              <input
                v-model="block.end_date"
                type="date"
                class="blocked-card__input"
              >
            </div>
          </div>
          <div class="blocked-card__field">
            <label class="blocked-card__label">{{ t('calendar.add.reasonLabel') }}</label>
            <input
              v-model="block.reason"
              type="text"
              class="blocked-card__input"
            >
          </div>

          <p
            v-if="fieldErrors[block.id]"
            class="blocked-card__error"
          >
            {{ fieldErrors[block.id] }}
          </p>
          <p
            v-if="savedId === block.id"
            class="blocked-card__saved"
          >
            {{ t('calendar.saved') }}
          </p>

          <div class="blocked-card__actions">
            <button
              type="button"
              class="blocked-card__save"
              :disabled="savingId === block.id"
              @click="saveBlockedDate(block)"
            >
              {{ savingId === block.id ? t('calendar.loading') : t('calendar.save') }}
            </button>
            <button
              type="button"
              class="blocked-card__delete"
              @click="askDelete(block.id)"
            >
              {{ t('calendar.delete') }}
            </button>
          </div>

          <div
            v-if="deletingId === block.id"
            class="blocked-card__confirm"
          >
            <p class="blocked-card__confirm-title">
              {{ t('calendar.deleteConfirm.title') }}
            </p>
            <p
              v-if="deleteError"
              class="blocked-card__confirm-error"
            >
              {{ deleteError }}
            </p>
            <div class="blocked-card__confirm-actions">
              <button
                type="button"
                class="blocked-card__confirm-cancel"
                :disabled="isDeleting"
                @click="cancelDelete"
              >
                {{ t('calendar.deleteConfirm.cancel') }}
              </button>
              <button
                type="button"
                class="blocked-card__confirm-submit"
                :disabled="isDeleting"
                @click="confirmDelete(block)"
              >
                {{ isDeleting ? t('calendar.loading') : t('calendar.deleteConfirm.confirm') }}
              </button>
            </div>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.calendar-widget__loading {
  @apply mt-6 text-sm;
  color: var(--color-muted);
}

.calendar-form__alert {
  @apply mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700;
}

.calendar-form__field {
  @apply space-y-1;
}

.calendar-form__label {
  @apply block text-sm font-medium;
  color: var(--color-text);
}

.calendar-form__input {
  @apply w-full rounded-md border px-3 py-2 text-base focus:outline-none focus:ring-2;
  border-color: #d1d5db;
  --tw-ring-color: var(--color-primary);
}

.month-view {
  @apply mt-6 rounded-md border p-4;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
}

.month-view__header {
  @apply flex items-center justify-between;
}

.month-view__label {
  @apply text-sm font-semibold capitalize;
  color: var(--color-text);
}

.month-view__nav {
  @apply rounded-md border px-2 py-1 text-sm;
  border-color: #d1d5db;
  color: var(--color-text);
}

.month-view__weekdays {
  @apply mt-3 grid grid-cols-7 text-center text-xs font-medium;
  color: var(--color-muted);
}

.month-view__week {
  @apply grid grid-cols-7 text-center;
}

.month-view__day {
  @apply flex aspect-square items-center justify-center rounded-md text-sm;
  color: var(--color-text);
}

.month-view__day--outside {
  color: var(--color-muted);
  opacity: 0.4;
}

.month-view__day--blocked {
  background-color: #fee2e2;
  color: #991b1b;
  font-weight: 600;
}

.calendar-add {
  @apply mt-6 space-y-3 rounded-md border p-4;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
}

.calendar-add__title {
  @apply text-sm font-semibold;
  color: var(--color-text);
}

.calendar-add__row {
  @apply grid gap-3 sm:grid-cols-2;
}

.calendar-add__button {
  @apply rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50;
  background-color: var(--color-primary);
}

.calendar-warning {
  @apply rounded-md px-3 py-2 text-sm;
  background-color: #fffbeb;
  color: #b45309;
}

.blocked-list__title {
  @apply mt-8 text-lg font-semibold;
  color: var(--color-text);
}

.blocked-list__empty {
  @apply mt-3 text-sm;
  color: var(--color-muted);
}

.blocked-list {
  @apply mt-3 grid gap-5 sm:grid-cols-2;
}

.blocked-card {
  @apply space-y-2 rounded-md border p-3;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
}

.blocked-card__row {
  @apply grid gap-3 sm:grid-cols-2;
}

.blocked-card__field {
  @apply space-y-1;
}

.blocked-card__label {
  @apply block text-xs font-medium;
  color: var(--color-text);
}

.blocked-card__input {
  @apply w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2;
  border-color: #d1d5db;
  --tw-ring-color: var(--color-primary);
}

.blocked-card__error {
  @apply text-xs text-red-600;
}

.blocked-card__saved {
  @apply text-xs;
  color: #047857;
}

.blocked-card__actions {
  @apply flex items-center justify-between gap-2 pt-1;
}

.blocked-card__save {
  @apply rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50;
  background-color: var(--color-primary);
}

.blocked-card__delete {
  @apply text-sm font-medium text-red-600 underline underline-offset-2;
}

.blocked-card__confirm {
  @apply space-y-2 rounded-md p-3 text-sm;
  background-color: #fef2f2;
}

.blocked-card__confirm-title {
  @apply font-medium text-red-800;
}

.blocked-card__confirm-error {
  @apply font-medium text-red-700;
}

.blocked-card__confirm-actions {
  @apply flex flex-wrap gap-3;
}

.blocked-card__confirm-cancel {
  @apply rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50;
  border-color: #d1d5db;
  color: var(--color-text);
}

.blocked-card__confirm-submit {
  @apply rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50;
}
</style>
