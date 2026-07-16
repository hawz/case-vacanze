<script setup lang="ts">
// EPIC 13 — Backoffice: Comunicazioni (US-1301/1302). Solo lato owner:
// US-1303 (visualizzazione sul mini-sito) è bloccata da EPIC 15, non ancora
// esistente — vedi nota in docs/backlog.md. Stesso principio di
// BlockedDatesCalendar.vue: componente fuori da app/components/wizard/,
// nessun WIZARD_STEPS/markComplete coinvolto.
//
// visible_from/visible_to sono `timestamptz`, ma <input type="datetime-local">
// lavora in ora locale senza timezone — toDatetimeLocalValue/
// fromDatetimeLocalValue fanno la conversione nei due sensi assumendo che
// l'owner imposti la finestra di visibilità nel proprio fuso orario locale.
const TYPES = ['INFO', 'WARNING', 'URGENT'] as const
type AnnouncementType = typeof TYPES[number]

interface Announcement {
  id: string
  title: string
  body: string
  type: AnnouncementType
  visible_from: string | null
  visible_to: string | null
  created_at: string
}

const props = defineProps<{ propertyId: string }>()

const { t } = useI18n()
const supabase = useSupabaseClient()

function typeLabel(type: string) {
  return t(`announcements.types.${type}`)
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const announcements = ref<Announcement[]>([])
const isLoading = ref(true)
const loadError = ref('')
// visible_from/visible_to tenuti come stringhe datetime-local separate da
// Announcement.visible_from/visible_to (timestamptz ISO o null), stesso
// principio di priceInputs in OptionalsStep.vue.
const editVisibleFrom = ref<Record<string, string>>({})
const editVisibleTo = ref<Record<string, string>>({})

async function loadAnnouncements() {
  isLoading.value = true
  loadError.value = ''

  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, type, visible_from, visible_to, created_at')
    .eq('property_id', props.propertyId)
    .order('created_at', { ascending: false })

  isLoading.value = false

  if (error) {
    loadError.value = t('announcements.errors.load')
    return
  }

  announcements.value = data ?? []
  for (const announcement of announcements.value) {
    editVisibleFrom.value[announcement.id] = toDatetimeLocalValue(announcement.visible_from)
    editVisibleTo.value[announcement.id] = toDatetimeLocalValue(announcement.visible_to)
  }
}

onMounted(loadAnnouncements)

// --- Creazione (US-1301) ---
const newTitle = ref('')
const newBody = ref('')
const newType = ref<AnnouncementType>('INFO')
const newVisibleFrom = ref('')
const newVisibleTo = ref('')
const addError = ref('')
const isAdding = ref(false)

async function addAnnouncement() {
  addError.value = ''

  if (!newTitle.value.trim()) {
    addError.value = t('announcements.validation.titleRequired')
    return
  }
  if (!newBody.value.trim()) {
    addError.value = t('announcements.validation.bodyRequired')
    return
  }
  if (newVisibleFrom.value && newVisibleTo.value && newVisibleTo.value < newVisibleFrom.value) {
    addError.value = t('announcements.validation.visibleToBeforeFrom')
    return
  }

  isAdding.value = true

  const { data, error } = await supabase
    .from('announcements')
    .insert({
      property_id: props.propertyId,
      title: newTitle.value.trim(),
      body: newBody.value.trim(),
      type: newType.value,
      visible_from: fromDatetimeLocalValue(newVisibleFrom.value),
      visible_to: fromDatetimeLocalValue(newVisibleTo.value),
    })
    .select('id, title, body, type, visible_from, visible_to, created_at')
    .single()

  isAdding.value = false

  if (error || !data) {
    addError.value = t('announcements.errors.add')
    return
  }

  announcements.value.unshift(data)
  editVisibleFrom.value[data.id] = toDatetimeLocalValue(data.visible_from)
  editVisibleTo.value[data.id] = toDatetimeLocalValue(data.visible_to)
  newTitle.value = ''
  newBody.value = ''
  newType.value = 'INFO'
  newVisibleFrom.value = ''
  newVisibleTo.value = ''
}

// --- Modifica (US-1302) ---
const fieldErrors = ref<Record<string, string>>({})
const savingId = ref<string | null>(null)
const savedId = ref<string | null>(null)

async function saveAnnouncement(announcement: Announcement) {
  fieldErrors.value = { ...fieldErrors.value, [announcement.id]: '' }

  const title = announcement.title.trim()
  const body = announcement.body.trim()
  const visibleFromRaw = editVisibleFrom.value[announcement.id] ?? ''
  const visibleToRaw = editVisibleTo.value[announcement.id] ?? ''

  if (!title) {
    fieldErrors.value = { ...fieldErrors.value, [announcement.id]: t('announcements.validation.titleRequired') }
    return
  }
  if (!body) {
    fieldErrors.value = { ...fieldErrors.value, [announcement.id]: t('announcements.validation.bodyRequired') }
    return
  }
  if (visibleFromRaw && visibleToRaw && visibleToRaw < visibleFromRaw) {
    fieldErrors.value = { ...fieldErrors.value, [announcement.id]: t('announcements.validation.visibleToBeforeFrom') }
    return
  }

  savingId.value = announcement.id
  const { error } = await supabase
    .from('announcements')
    .update({
      title,
      body,
      type: announcement.type,
      visible_from: fromDatetimeLocalValue(visibleFromRaw),
      visible_to: fromDatetimeLocalValue(visibleToRaw),
    })
    .eq('id', announcement.id)
  savingId.value = null

  if (error) {
    fieldErrors.value = { ...fieldErrors.value, [announcement.id]: t('announcements.errors.save') }
    return
  }

  announcement.title = title
  announcement.body = body
  savedId.value = announcement.id
  setTimeout(() => {
    if (savedId.value === announcement.id) savedId.value = null
  }, 2000)
}

// --- Eliminazione (US-1302) ---
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

async function confirmDelete(announcement: Announcement) {
  isDeleting.value = true
  deleteError.value = ''

  const { error } = await supabase.from('announcements').delete().eq('id', announcement.id)

  isDeleting.value = false

  if (error) {
    deleteError.value = t('announcements.errors.delete')
    return
  }

  announcements.value = announcements.value.filter(a => a.id !== announcement.id)
  deletingId.value = null
}
</script>

<template>
  <div class="announcements-widget">
    <form
      class="announcements-add"
      @submit.prevent="addAnnouncement"
    >
      <h2 class="announcements-add__title">
        {{ t('announcements.add.title') }}
      </h2>

      <div class="announcements-form__field">
        <label
          class="announcements-form__label"
          for="announcement-new-title"
        >{{ t('announcements.add.titleLabel') }}</label>
        <input
          id="announcement-new-title"
          v-model="newTitle"
          type="text"
          class="announcements-form__input"
        >
      </div>

      <div class="announcements-form__field">
        <label
          class="announcements-form__label"
          for="announcement-new-body"
        >{{ t('announcements.add.bodyLabel') }}</label>
        <textarea
          id="announcement-new-body"
          v-model="newBody"
          rows="3"
          class="announcements-form__input"
        />
      </div>

      <div class="announcements-form__field">
        <label
          class="announcements-form__label"
          for="announcement-new-type"
        >{{ t('announcements.add.typeLabel') }}</label>
        <select
          id="announcement-new-type"
          v-model="newType"
          class="announcements-form__input"
        >
          <option
            v-for="type in TYPES"
            :key="type"
            :value="type"
          >
            {{ typeLabel(type) }}
          </option>
        </select>
      </div>

      <div class="announcements-add__row">
        <div class="announcements-form__field">
          <label
            class="announcements-form__label"
            for="announcement-new-visible-from"
          >{{ t('announcements.add.visibleFromLabel') }}</label>
          <input
            id="announcement-new-visible-from"
            v-model="newVisibleFrom"
            type="datetime-local"
            class="announcements-form__input"
          >
        </div>
        <div class="announcements-form__field">
          <label
            class="announcements-form__label"
            for="announcement-new-visible-to"
          >{{ t('announcements.add.visibleToLabel') }}</label>
          <input
            id="announcement-new-visible-to"
            v-model="newVisibleTo"
            type="datetime-local"
            class="announcements-form__input"
          >
        </div>
      </div>

      <p
        v-if="addError"
        class="announcements-form__alert"
        role="alert"
      >
        {{ addError }}
      </p>

      <button
        type="submit"
        class="announcements-add__button"
        :disabled="isAdding"
      >
        {{ isAdding ? t('announcements.loading') : t('announcements.add.button') }}
      </button>
    </form>

    <h2 class="announcements-list__title">
      {{ t('announcements.list.title') }}
    </h2>

    <p
      v-if="loadError"
      class="announcements-form__alert"
      role="alert"
    >
      {{ loadError }}
    </p>

    <p
      v-else-if="isLoading"
      class="announcements-widget__loading"
    >
      {{ t('announcements.loading') }}
    </p>

    <p
      v-else-if="announcements.length === 0"
      class="announcements-list__empty"
    >
      {{ t('announcements.list.empty') }}
    </p>

    <ul
      v-else
      class="announcements-list"
    >
      <li
        v-for="announcement in announcements"
        :key="announcement.id"
        class="announcement-card"
      >
        <div class="announcements-form__field">
          <label class="announcement-card__label">{{ t('announcements.fields.titleLabel') }}</label>
          <input
            v-model="announcement.title"
            type="text"
            class="announcement-card__input"
          >
        </div>

        <div class="announcements-form__field">
          <label class="announcement-card__label">{{ t('announcements.fields.bodyLabel') }}</label>
          <textarea
            v-model="announcement.body"
            rows="3"
            class="announcement-card__input"
          />
        </div>

        <div class="announcements-form__field">
          <label class="announcement-card__label">{{ t('announcements.fields.typeLabel') }}</label>
          <select
            v-model="announcement.type"
            class="announcement-card__input"
          >
            <option
              v-for="type in TYPES"
              :key="type"
              :value="type"
            >
              {{ typeLabel(type) }}
            </option>
          </select>
        </div>

        <div class="announcement-card__row">
          <div class="announcements-form__field">
            <label class="announcement-card__label">{{ t('announcements.fields.visibleFromLabel') }}</label>
            <input
              v-model="editVisibleFrom[announcement.id]"
              type="datetime-local"
              class="announcement-card__input"
            >
          </div>
          <div class="announcements-form__field">
            <label class="announcement-card__label">{{ t('announcements.fields.visibleToLabel') }}</label>
            <input
              v-model="editVisibleTo[announcement.id]"
              type="datetime-local"
              class="announcement-card__input"
            >
          </div>
        </div>

        <p
          v-if="fieldErrors[announcement.id]"
          class="announcement-card__error"
        >
          {{ fieldErrors[announcement.id] }}
        </p>
        <p
          v-if="savedId === announcement.id"
          class="announcement-card__saved"
        >
          {{ t('announcements.saved') }}
        </p>

        <div class="announcement-card__actions">
          <button
            type="button"
            class="announcement-card__save"
            :disabled="savingId === announcement.id"
            @click="saveAnnouncement(announcement)"
          >
            {{ savingId === announcement.id ? t('announcements.loading') : t('announcements.save') }}
          </button>
          <button
            type="button"
            class="announcement-card__delete"
            @click="askDelete(announcement.id)"
          >
            {{ t('announcements.delete') }}
          </button>
        </div>

        <div
          v-if="deletingId === announcement.id"
          class="announcement-card__confirm"
        >
          <p class="announcement-card__confirm-title">
            {{ t('announcements.deleteConfirm.title') }}
          </p>
          <p
            v-if="deleteError"
            class="announcement-card__confirm-error"
          >
            {{ deleteError }}
          </p>
          <div class="announcement-card__confirm-actions">
            <button
              type="button"
              class="announcement-card__confirm-cancel"
              :disabled="isDeleting"
              @click="cancelDelete"
            >
              {{ t('announcements.deleteConfirm.cancel') }}
            </button>
            <button
              type="button"
              class="announcement-card__confirm-submit"
              :disabled="isDeleting"
              @click="confirmDelete(announcement)"
            >
              {{ isDeleting ? t('announcements.loading') : t('announcements.deleteConfirm.confirm') }}
            </button>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.announcements-widget__loading {
  @apply mt-6 text-sm;
  color: var(--color-muted);
}

.announcements-form__field {
  @apply space-y-1;
}

.announcements-form__label {
  @apply block text-sm font-medium;
  color: var(--color-text);
}

.announcements-form__input {
  @apply w-full rounded-md border px-3 py-2 text-base focus:outline-none focus:ring-2;
  border-color: #d1d5db;
  --tw-ring-color: var(--color-primary);
}

.announcements-form__alert {
  @apply rounded-md bg-red-50 px-3 py-2 text-sm text-red-700;
}

.announcements-add {
  @apply mt-6 space-y-3 rounded-md border p-4;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
}

.announcements-add__title {
  @apply text-sm font-semibold;
  color: var(--color-text);
}

.announcements-add__row {
  @apply grid gap-3 sm:grid-cols-2;
}

.announcements-add__button {
  @apply rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50;
  background-color: var(--color-primary);
}

.announcements-list__title {
  @apply mt-8 text-lg font-semibold;
  color: var(--color-text);
}

.announcements-list__empty {
  @apply mt-3 text-sm;
  color: var(--color-muted);
}

.announcements-list {
  @apply mt-3 grid gap-5 sm:grid-cols-2;
}

.announcement-card {
  @apply space-y-2 rounded-md border p-3;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
}

.announcement-card__row {
  @apply grid gap-3 sm:grid-cols-2;
}

.announcement-card__label {
  @apply block text-xs font-medium;
  color: var(--color-text);
}

.announcement-card__input {
  @apply w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2;
  border-color: #d1d5db;
  --tw-ring-color: var(--color-primary);
}

.announcement-card__error {
  @apply text-xs text-red-600;
}

.announcement-card__saved {
  @apply text-xs;
  color: #047857;
}

.announcement-card__actions {
  @apply flex items-center justify-between gap-2 pt-1;
}

.announcement-card__save {
  @apply rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50;
  background-color: var(--color-primary);
}

.announcement-card__delete {
  @apply text-sm font-medium text-red-600 underline underline-offset-2;
}

.announcement-card__confirm {
  @apply space-y-2 rounded-md p-3 text-sm;
  background-color: #fef2f2;
}

.announcement-card__confirm-title {
  @apply font-medium text-red-800;
}

.announcement-card__confirm-error {
  @apply font-medium text-red-700;
}

.announcement-card__confirm-actions {
  @apply flex gap-3;
}

.announcement-card__confirm-cancel {
  @apply rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50;
  border-color: #d1d5db;
  color: var(--color-text);
}

.announcement-card__confirm-submit {
  @apply rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50;
}
</style>
