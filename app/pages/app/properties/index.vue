<script setup lang="ts">
import { z } from 'zod'

// EPIC 2 — Dashboard proprietario: elenco (US-201), creazione (US-202)
// ed eliminazione (US-203) delle proprietà dell'owner. La query non filtra
// esplicitamente per owner_id: la policy RLS "properties_owner_read_own"
// garantisce comunque che ognuno veda solo le proprie (o tutte, se admin).
const { t } = useI18n()
const localePath = useLocalePath()
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const propertyStore = usePropertyStore()
const wizardStore = useWizardStore()

definePageMeta({ layout: 'app' })

const isLoading = ref(true)
const loadError = ref('')

async function loadProperties() {
  isLoading.value = true
  loadError.value = ''

  const { data, error } = await supabase
    .from('properties')
    .select('id, slug, name, status')
    .order('created_at', { ascending: false })

  isLoading.value = false

  if (error) {
    loadError.value = t('properties.loadError')
    return
  }

  propertyStore.setProperties(data ?? [])
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

onMounted(() => {
  loadProperties()
  loadNewRequestCounts()
})

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
      .select('id, slug, name, status')
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

// --- Eliminazione (US-203): conferma inline per riga.
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
      class="properties-list__grid"
    >
      <li
        v-for="property in propertyStore.properties"
        :key="property.id"
        class="property-card"
      >
        <div class="property-card__info">
          <span class="property-card__name">{{ property.name }}</span>
          <span
            class="property-card__status"
            :class="statusModifier(property.status)"
          >
            {{ statusLabel(property.status) }}
          </span>
        </div>

        <div class="property-card__actions">
          <NuxtLink
            :to="localePath(`/app/properties/${property.id}/edit`)"
            class="property-card__link"
          >
            {{ t('properties.actions.edit') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath(`/app/properties/${property.id}/calendar`)"
            class="property-card__link"
          >
            {{ t('properties.actions.calendar') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath(`/app/properties/${property.id}/announcements`)"
            class="property-card__link"
          >
            {{ t('properties.actions.announcements') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath(`/app/properties/${property.id}/requests`)"
            class="property-card__link"
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
            class="property-card__delete"
            @click="askDelete(property.id)"
          >
            {{ t('properties.actions.delete') }}
          </button>
        </div>

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
  </section>
</template>

<style scoped>
.properties-list {
  @apply mx-auto max-w-3xl px-4 py-12;
}

.properties-list__header {
  @apply flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between;
}

.properties-list__title {
  @apply text-2xl font-bold;
  color: var(--color-text);
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

.properties-list__grid {
  @apply mt-8 space-y-4;
}

.property-card {
  @apply rounded-md border p-4;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
}

.property-card__info {
  @apply flex flex-wrap items-center gap-2;
}

.property-card__name {
  @apply font-medium;
  color: var(--color-text);
}

.property-card__status {
  @apply inline-block rounded-full px-2 py-0.5 text-xs font-medium;
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

.property-card__actions {
  @apply mt-3 flex gap-4 text-sm;
}

.property-card__link {
  @apply font-medium underline underline-offset-2;
  color: var(--color-primary);
}

.property-card__requests-badge {
  @apply ml-1 rounded-full px-1.5 py-0.5 text-xs font-semibold no-underline;
  background-color: #fee2e2;
  color: #991b1b;
}

.property-card__delete {
  @apply font-medium text-red-600 underline underline-offset-2;
}

.property-card__confirm {
  @apply mt-3 space-y-2 rounded-md p-3 text-sm;
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
  @apply flex gap-3;
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
