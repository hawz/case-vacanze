<script setup lang="ts">
// EPIC 4 — Wizard: Foto (US-401/402/403/404). Come general-info, vive come
// componente autonomo (vedi convenzione salvata in memoria dopo l'EPIC 3):
// riceve solo propertyId e possiede tutta la logica dello step.
//
// Le stesse costanti di validazione lato client esistono anche nell'endpoint
// server (server/api/properties/[id]/photos.post.ts) come ultima linea di
// difesa: qui servono solo a dare un errore immediato senza attendere la
// risposta di rete.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024 // 8MB

interface Photo {
  id: string
  url: string
  alt_text: string | null
  category: string
  sort_order: number
  is_cover: boolean
}

const props = defineProps<{ propertyId: string }>()

const { t } = useI18n()
const supabase = useSupabaseClient()
const wizardStore = useWizardStore()

const CATEGORIES = ['EXTERIOR', 'BEDROOM', 'BATHROOM', 'KITCHEN', 'VIEW', 'OTHER'] as const

function categoryLabel(category: string) {
  return t(`wizard.photos.categories.${category}`)
}

const photos = ref<Photo[]>([])
const sortedPhotos = computed(() => [...photos.value].sort((a, b) => a.sort_order - b.sort_order))

const isLoading = ref(true)
const loadError = ref('')

async function loadPhotos() {
  isLoading.value = true
  loadError.value = ''

  const { data, error } = await supabase
    .from('photos')
    .select('id, url, alt_text, category, sort_order, is_cover')
    .eq('property_id', props.propertyId)
    .order('sort_order', { ascending: true })

  isLoading.value = false

  if (error) {
    loadError.value = t('wizard.photos.errors.load')
    return
  }

  photos.value = data ?? []
  if (photos.value.length > 0) wizardStore.markComplete('photos')
}

onMounted(loadPhotos)

// --- Upload (US-401) ---
interface QueueItem { id: string, name: string, status: 'uploading' | 'error', errorMessage?: string }
const uploadQueue = ref<QueueItem[]>([])
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function triggerFileDialog() {
  fileInput.value?.click()
}

function onFileInputChange(event: Event) {
  const target = event.target as HTMLInputElement
  handleFiles(target.files)
  target.value = ''
}

function onDrop(event: DragEvent) {
  isDragging.value = false
  handleFiles(event.dataTransfer?.files ?? null)
}

async function handleFiles(fileList: FileList | null) {
  if (!fileList || fileList.length === 0) return
  // Caricamento sequenziale (non in parallelo): evita che due upload
  // concorrenti calcolino lo stesso sort_order "successivo" lato server.
  for (const file of Array.from(fileList)) {
    await uploadFile(file)
  }
}

async function uploadFile(file: File) {
  const queueId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const queueItem: QueueItem = { id: queueId, name: file.name, status: 'uploading' }
  uploadQueue.value.push(queueItem)

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    queueItem.status = 'error'
    queueItem.errorMessage = t('wizard.photos.errors.formatInvalid')
    return
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    queueItem.status = 'error'
    queueItem.errorMessage = t('wizard.photos.errors.tooLarge')
    return
  }

  const formData = new FormData()
  formData.append('file', file)

  try {
    const photo = await $fetch<Photo>(`/api/properties/${props.propertyId}/photos`, {
      method: 'POST',
      body: formData,
    })
    photos.value.push(photo)
    wizardStore.markComplete('photos')
    uploadQueue.value = uploadQueue.value.filter(item => item.id !== queueId)
  }
  catch {
    queueItem.status = 'error'
    queueItem.errorMessage = t('wizard.photos.errors.uploadFailed')
  }
}

function dismissQueueItem(id: string) {
  uploadQueue.value = uploadQueue.value.filter(item => item.id !== id)
}

// --- Categoria e testo alternativo (US-402) ---
const savingDetailsId = ref<string | null>(null)
const savedDetailsId = ref<string | null>(null)
const detailsError = ref('')

async function saveDetails(photo: Photo) {
  savingDetailsId.value = photo.id
  detailsError.value = ''

  const { error } = await supabase
    .from('photos')
    .update({ category: photo.category, alt_text: photo.alt_text?.trim() || null })
    .eq('id', photo.id)

  savingDetailsId.value = null

  if (error) {
    detailsError.value = t('wizard.photos.errors.saveDetails')
    return
  }

  savedDetailsId.value = photo.id
  setTimeout(() => {
    if (savedDetailsId.value === photo.id) savedDetailsId.value = null
  }, 2000)
}

// --- Riordino (US-403) ---
const isReordering = ref(false)

async function swapSortOrder(a: Photo, b: Photo) {
  isReordering.value = true
  const aOrder = a.sort_order
  const bOrder = b.sort_order

  await Promise.all([
    supabase.from('photos').update({ sort_order: bOrder }).eq('id', a.id),
    supabase.from('photos').update({ sort_order: aOrder }).eq('id', b.id),
  ])

  a.sort_order = bOrder
  b.sort_order = aOrder
  isReordering.value = false
}

function moveUp(photo: Photo) {
  const idx = sortedPhotos.value.findIndex(p => p.id === photo.id)
  if (idx <= 0) return
  swapSortOrder(photo, sortedPhotos.value[idx - 1])
}

function moveDown(photo: Photo) {
  const idx = sortedPhotos.value.findIndex(p => p.id === photo.id)
  if (idx === -1 || idx >= sortedPhotos.value.length - 1) return
  swapSortOrder(photo, sortedPhotos.value[idx + 1])
}

// --- Copertina (US-403) ---
const isSavingCover = ref(false)

async function setCover(photo: Photo) {
  if (photo.is_cover) return
  isSavingCover.value = true

  await supabase.from('photos').update({ is_cover: false }).eq('property_id', props.propertyId).neq('id', photo.id)
  await supabase.from('photos').update({ is_cover: true }).eq('id', photo.id)

  for (const p of photos.value) {
    p.is_cover = p.id === photo.id
  }
  isSavingCover.value = false
}

// --- Eliminazione (US-404) ---
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

async function confirmDelete(photo: Photo) {
  isDeleting.value = true
  deleteError.value = ''

  try {
    await $fetch(`/api/properties/${props.propertyId}/photos/${photo.id}`, { method: 'DELETE' })
    photos.value = photos.value.filter(p => p.id !== photo.id)
    deletingId.value = null
  }
  catch {
    deleteError.value = t('wizard.photos.errors.delete')
  }

  isDeleting.value = false
}
</script>

<template>
  <div class="wizard-step">
    <h1 class="wizard-step__title">
      {{ t('wizard.photos.title') }}
    </h1>
    <p class="wizard-step__subtitle">
      {{ t('wizard.photos.subtitle') }}
    </p>

    <div
      class="photos-dropzone"
      :class="{ 'photos-dropzone--active': isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
    >
      <p class="photos-dropzone__text">
        {{ t('wizard.photos.dropzone.text') }}
      </p>
      <button
        type="button"
        class="photos-dropzone__button"
        @click="triggerFileDialog"
      >
        {{ t('wizard.photos.dropzone.browseButton') }}
      </button>
      <p class="photos-dropzone__hint">
        {{ t('wizard.photos.dropzone.hint') }}
      </p>
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        class="photos-dropzone__input"
        @change="onFileInputChange"
      >
    </div>

    <ul
      v-if="uploadQueue.length > 0"
      class="photos-queue"
    >
      <li
        v-for="item in uploadQueue"
        :key="item.id"
        class="photos-queue__item"
        :class="{ 'photos-queue__item--error': item.status === 'error' }"
      >
        <span class="photos-queue__name">{{ item.name }}</span>
        <span v-if="item.status === 'uploading'">{{ t('wizard.photos.queue.uploading') }}</span>
        <template v-else>
          <span class="photos-queue__error">{{ item.errorMessage }}</span>
          <button
            type="button"
            class="photos-queue__dismiss"
            @click="dismissQueueItem(item.id)"
          >
            {{ t('wizard.photos.queue.dismiss') }}
          </button>
        </template>
      </li>
    </ul>

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
      v-else-if="sortedPhotos.length === 0"
      class="photos-empty"
    >
      {{ t('wizard.photos.empty') }}
    </p>

    <ul
      v-else
      class="photos-grid"
    >
      <li
        v-for="(photo, index) in sortedPhotos"
        :key="photo.id"
        class="photo-card"
      >
        <img
          :src="photo.url"
          :alt="photo.alt_text ?? ''"
          class="photo-card__image"
        >

        <div class="photo-card__cover-row">
          <span
            v-if="photo.is_cover"
            class="photo-card__cover-badge"
          >
            {{ t('wizard.photos.coverBadge') }}
          </span>
          <button
            v-else
            type="button"
            class="photo-card__cover-button"
            :disabled="isSavingCover"
            @click="setCover(photo)"
          >
            {{ t('wizard.photos.setCover') }}
          </button>

          <div class="photo-card__reorder">
            <button
              type="button"
              class="photo-card__reorder-button"
              :disabled="index === 0 || isReordering"
              :aria-label="t('wizard.photos.moveUp')"
              @click="moveUp(photo)"
            >
              ↑
            </button>
            <button
              type="button"
              class="photo-card__reorder-button"
              :disabled="index === sortedPhotos.length - 1 || isReordering"
              :aria-label="t('wizard.photos.moveDown')"
              @click="moveDown(photo)"
            >
              ↓
            </button>
          </div>
        </div>

        <div class="photo-card__field">
          <label class="photo-card__label">{{ t('wizard.photos.fields.categoryLabel') }}</label>
          <select
            v-model="photo.category"
            class="photo-card__input"
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

        <div class="photo-card__field">
          <label class="photo-card__label">{{ t('wizard.photos.fields.altTextLabel') }}</label>
          <input
            v-model="photo.alt_text"
            type="text"
            class="photo-card__input"
          >
        </div>

        <p
          v-if="savedDetailsId === photo.id"
          class="photo-card__saved"
        >
          {{ t('wizard.photos.detailsSaved') }}
        </p>

        <div class="photo-card__actions">
          <button
            type="button"
            class="photo-card__save"
            :disabled="savingDetailsId === photo.id"
            @click="saveDetails(photo)"
          >
            {{ savingDetailsId === photo.id ? t('auth.common.loading') : t('wizard.photos.saveDetails') }}
          </button>
          <button
            type="button"
            class="photo-card__delete"
            @click="askDelete(photo.id)"
          >
            {{ t('wizard.photos.delete') }}
          </button>
        </div>

        <div
          v-if="deletingId === photo.id"
          class="photo-card__confirm"
        >
          <p class="photo-card__confirm-title">
            {{ t('wizard.photos.deleteConfirm.title') }}
          </p>
          <p
            v-if="deleteError"
            class="photo-card__confirm-error"
          >
            {{ deleteError }}
          </p>
          <div class="photo-card__confirm-actions">
            <button
              type="button"
              class="photo-card__confirm-cancel"
              :disabled="isDeleting"
              @click="cancelDelete"
            >
              {{ t('wizard.photos.deleteConfirm.cancel') }}
            </button>
            <button
              type="button"
              class="photo-card__confirm-submit"
              :disabled="isDeleting"
              @click="confirmDelete(photo)"
            >
              {{ isDeleting ? t('auth.common.loading') : t('wizard.photos.deleteConfirm.confirm') }}
            </button>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* Titolo/sottotitolo/loading condivisi con gli altri step (stessa
   convenzione di classi introdotta in GeneralInfoStep.vue). */
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

.wizard-form__alert {
  @apply mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700;
}

.photos-dropzone {
  @apply relative mt-6 rounded-md border border-dashed p-8 text-center;
  border-color: #d1d5db;
}

.photos-dropzone--active {
  border-color: var(--color-primary);
  background-color: #f0fdfa;
}

.photos-dropzone__text {
  color: var(--color-text);
}

.photos-dropzone__button {
  @apply mt-3 rounded-md px-4 py-2 text-sm font-medium text-white;
  background-color: var(--color-primary);
}

.photos-dropzone__hint {
  @apply mt-2 text-xs;
  color: var(--color-muted);
}

.photos-dropzone__input {
  @apply absolute inset-0 h-full w-full cursor-pointer opacity-0;
}

.photos-queue {
  @apply mt-4 space-y-2;
}

.photos-queue__item {
  @apply flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm;
  border-color: #d1d5db;
}

.photos-queue__item--error {
  border-color: #fecaca;
  background-color: #fef2f2;
}

.photos-queue__name {
  @apply font-medium;
  color: var(--color-text);
}

.photos-queue__error {
  @apply text-red-700;
}

.photos-queue__dismiss {
  @apply ml-auto text-sm font-medium underline underline-offset-2;
  color: var(--color-primary);
}

.photos-empty {
  @apply mt-8 text-sm;
  color: var(--color-muted);
}

.photos-grid {
  @apply mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3;
}

.photo-card {
  @apply space-y-2 rounded-md border p-3;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
}

.photo-card__image {
  @apply aspect-video w-full rounded-md object-cover;
}

.photo-card__cover-row {
  @apply flex items-center justify-between gap-2;
}

.photo-card__cover-badge {
  @apply rounded-full px-2 py-0.5 text-xs font-medium;
  background-color: #d1fae5;
  color: #047857;
}

.photo-card__cover-button {
  @apply text-xs font-medium underline underline-offset-2 disabled:opacity-50;
  color: var(--color-primary);
}

.photo-card__reorder {
  @apply flex gap-1;
}

.photo-card__reorder-button {
  @apply rounded-md border px-2 py-1 text-sm disabled:opacity-30;
  border-color: #d1d5db;
  color: var(--color-text);
}

.photo-card__field {
  @apply space-y-1;
}

.photo-card__label {
  @apply block text-xs font-medium;
  color: var(--color-text);
}

.photo-card__input {
  @apply w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2;
  border-color: #d1d5db;
  --tw-ring-color: var(--color-primary);
}

.photo-card__saved {
  @apply text-xs;
  color: #047857;
}

.photo-card__actions {
  @apply flex items-center justify-between gap-2 pt-1;
}

.photo-card__save {
  @apply rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50;
  background-color: var(--color-primary);
}

.photo-card__delete {
  @apply text-sm font-medium text-red-600 underline underline-offset-2;
}

.photo-card__confirm {
  @apply space-y-2 rounded-md p-3 text-sm;
  background-color: #fef2f2;
}

.photo-card__confirm-title {
  @apply font-medium text-red-800;
}

.photo-card__confirm-error {
  @apply font-medium text-red-700;
}

.photo-card__confirm-actions {
  @apply flex gap-3;
}

.photo-card__confirm-cancel {
  @apply rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50;
  border-color: #d1d5db;
  color: var(--color-text);
}

.photo-card__confirm-submit {
  @apply rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50;
}
</style>
