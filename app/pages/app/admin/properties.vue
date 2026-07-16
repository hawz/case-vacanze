<script setup lang="ts">
// EPIC 17 — Amministrazione (US-1701 + US-1703). Vista trasversale su tutte
// le proprietà, non filtrata per owner (la policy "properties_owner_read_own"
// include già "or public.is_admin()"). Sospensione/riattivazione via update
// diretto: "profiles_admin_update_any"/le policy owner_write delle
// proprietà coprono già l'admin, nessun endpoint server necessario. Il CHECK
// "suspension_reason_required_when_suspended" in schema.sql rende comunque
// impossibile salvare uno stato SUSPENDED senza motivo, anche a prescindere
// dalla validazione qui sotto.
//
// Nessuna colonna che tracci lo stato precedente alla sospensione: la
// riattivazione chiede esplicitamente all'admin se riportare la proprietà a
// PUBLISHED o DRAFT, invece di provare a "ricordare" automaticamente uno
// stato non memorizzato da nessuna parte.
interface AdminProperty {
  id: string
  slug: string
  name: string
  status: 'DRAFT' | 'PUBLISHED' | 'SUSPENDED'
  suspension_reason: string | null
  profiles: { first_name: string | null, last_name: string | null } | null
}

const { t } = useI18n()
const localePath = useLocalePath()
const supabase = useSupabaseClient()

definePageMeta({ layout: 'app', middleware: 'admin' })

const properties = ref<AdminProperty[]>([])
const isLoading = ref(true)
const loadError = ref('')

async function loadProperties() {
  isLoading.value = true
  loadError.value = ''

  const { data, error } = await supabase
    .from('properties')
    .select('id, slug, name, status, suspension_reason, profiles(first_name, last_name)')
    .order('created_at', { ascending: false })

  isLoading.value = false

  if (error) {
    loadError.value = t('admin.properties.errors.load')
    return
  }

  properties.value = data ?? []
}

onMounted(loadProperties)

function ownerLabel(property: AdminProperty) {
  const first = property.profiles?.first_name ?? ''
  const last = property.profiles?.last_name ?? ''
  const full = `${first} ${last}`.trim()
  return full || t('admin.properties.unknownOwner')
}

function statusLabel(status: string) {
  if (status === 'PUBLISHED') return t('properties.status.published')
  if (status === 'SUSPENDED') return t('properties.status.suspended')
  return t('properties.status.draft')
}

// --- Sospensione (US-1703) ---
const suspendingId = ref<string | null>(null)
const suspensionReasonDraft = ref('')
const suspendError = ref('')
const isSaving = ref(false)

function askSuspend(id: string) {
  suspendingId.value = id
  suspensionReasonDraft.value = ''
  suspendError.value = ''
}

function cancelSuspend() {
  suspendingId.value = null
  suspendError.value = ''
}

async function confirmSuspend(property: AdminProperty) {
  if (!suspensionReasonDraft.value.trim()) {
    suspendError.value = t('admin.properties.suspend.reasonRequired')
    return
  }

  isSaving.value = true
  const { error } = await supabase
    .from('properties')
    .update({ status: 'SUSPENDED', suspension_reason: suspensionReasonDraft.value.trim() })
    .eq('id', property.id)
  isSaving.value = false

  if (error) {
    suspendError.value = t('admin.properties.errors.suspend')
    return
  }

  property.status = 'SUSPENDED'
  property.suspension_reason = suspensionReasonDraft.value.trim()
  suspendingId.value = null
}

// --- Riattivazione (US-1703) ---
async function reactivate(property: AdminProperty, target: 'PUBLISHED' | 'DRAFT') {
  isSaving.value = true
  const { error } = await supabase
    .from('properties')
    .update({ status: target, suspension_reason: null })
    .eq('id', property.id)
  isSaving.value = false

  if (error) {
    loadError.value = t('admin.properties.errors.reactivate')
    return
  }

  property.status = target
  property.suspension_reason = null
}
</script>

<template>
  <section class="admin-page">
    <div class="admin-page__header">
      <div>
        <h1 class="admin-page__title">
          {{ t('admin.properties.title') }}
        </h1>
        <p class="admin-page__subtitle">
          {{ t('admin.properties.subtitle') }}
        </p>
      </div>
      <NuxtLink
        :to="localePath('/app/admin/users')"
        class="admin-page__nav-link"
      >
        {{ t('admin.properties.usersLink') }}
      </NuxtLink>
    </div>

    <p
      v-if="loadError"
      class="admin-page__alert"
      role="alert"
    >
      {{ loadError }}
    </p>

    <p
      v-else-if="isLoading"
      class="admin-page__loading"
    >
      {{ t('admin.properties.loading') }}
    </p>

    <p
      v-else-if="properties.length === 0"
      class="admin-page__empty"
    >
      {{ t('admin.properties.empty') }}
    </p>

    <ul
      v-else
      class="admin-properties"
    >
      <li
        v-for="property in properties"
        :key="property.id"
        class="admin-property-card"
      >
        <div class="admin-property-card__info">
          <span class="admin-property-card__name">{{ property.name }}</span>
          <span class="admin-property-card__owner">{{ t('admin.properties.ownerLabel') }}: {{ ownerLabel(property) }}</span>
          <span
            class="admin-property-card__status"
            :class="`admin-property-card__status--${property.status.toLowerCase()}`"
          >
            {{ statusLabel(property.status) }}
          </span>
          <p
            v-if="property.status === 'SUSPENDED' && property.suspension_reason"
            class="admin-property-card__reason"
          >
            <strong>{{ t('admin.properties.suspensionReasonLabel') }}:</strong> {{ property.suspension_reason }}
          </p>
        </div>

        <div class="admin-property-card__actions">
          <template v-if="property.status === 'SUSPENDED'">
            <button
              type="button"
              class="admin-property-card__action"
              :disabled="isSaving"
              @click="reactivate(property, 'PUBLISHED')"
            >
              {{ t('admin.properties.reactivate.toPublished') }}
            </button>
            <button
              type="button"
              class="admin-property-card__action admin-property-card__action--secondary"
              :disabled="isSaving"
              @click="reactivate(property, 'DRAFT')"
            >
              {{ t('admin.properties.reactivate.toDraft') }}
            </button>
          </template>
          <button
            v-else
            type="button"
            class="admin-property-card__action admin-property-card__action--danger"
            @click="askSuspend(property.id)"
          >
            {{ t('admin.properties.suspend.button') }}
          </button>
        </div>

        <div
          v-if="suspendingId === property.id"
          class="admin-property-card__suspend-form"
        >
          <label
            class="admin-property-card__label"
            :for="`suspend-reason-${property.id}`"
          >{{ t('admin.properties.suspend.reasonLabel') }}</label>
          <textarea
            :id="`suspend-reason-${property.id}`"
            v-model="suspensionReasonDraft"
            rows="2"
            :placeholder="t('admin.properties.suspend.reasonPlaceholder')"
            class="admin-property-card__textarea"
          />
          <p
            v-if="suspendError"
            class="admin-property-card__error"
          >
            {{ suspendError }}
          </p>
          <div class="admin-property-card__suspend-actions">
            <button
              type="button"
              class="admin-property-card__action admin-property-card__action--secondary"
              :disabled="isSaving"
              @click="cancelSuspend"
            >
              {{ t('admin.properties.suspend.cancel') }}
            </button>
            <button
              type="button"
              class="admin-property-card__action admin-property-card__action--danger"
              :disabled="isSaving"
              @click="confirmSuspend(property)"
            >
              {{ t('admin.properties.suspend.confirm') }}
            </button>
          </div>
        </div>
      </li>
    </ul>

    <NuxtLink
      :to="localePath('/app/properties')"
      class="admin-page__back"
    >
      {{ t('admin.properties.backToDashboard') }}
    </NuxtLink>
  </section>
</template>

<style scoped>
.admin-page {
  @apply mx-auto max-w-4xl px-4 py-8;
}

.admin-page__header {
  @apply flex flex-wrap items-start justify-between gap-4;
}

.admin-page__title {
  @apply text-2xl font-bold;
  color: var(--color-text);
}

.admin-page__subtitle {
  @apply mt-1 text-sm;
  color: var(--color-muted);
}

.admin-page__nav-link {
  @apply text-sm font-medium underline underline-offset-2;
  color: var(--color-primary);
}

.admin-page__alert {
  @apply mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700;
}

.admin-page__loading {
  @apply mt-6 text-sm;
  color: var(--color-muted);
}

.admin-page__empty {
  @apply mt-6 text-sm;
  color: var(--color-muted);
}

.admin-properties {
  @apply mt-6 space-y-3;
}

.admin-property-card {
  @apply rounded-md border p-4;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
}

.admin-property-card__info {
  @apply flex flex-wrap items-center gap-3;
}

.admin-property-card__name {
  @apply font-medium;
  color: var(--color-text);
}

.admin-property-card__owner {
  @apply text-sm;
  color: var(--color-muted);
}

.admin-property-card__status {
  @apply rounded-full px-2 py-0.5 text-xs font-medium;
  background-color: #e5e7eb;
  color: var(--color-text);
}

.admin-property-card__status--published {
  background-color: #d1fae5;
  color: #047857;
}

.admin-property-card__status--suspended {
  background-color: #fee2e2;
  color: #991b1b;
}

.admin-property-card__reason {
  @apply mt-2 w-full text-sm;
  color: var(--color-text);
}

.admin-property-card__actions {
  @apply mt-3 flex flex-wrap gap-2;
}

.admin-property-card__action {
  @apply rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50;
  background-color: var(--color-primary);
}

.admin-property-card__action--secondary {
  @apply border;
  border-color: #d1d5db;
  background-color: transparent;
  color: var(--color-text);
}

.admin-property-card__action--danger {
  @apply text-white;
  background-color: #dc2626;
}

.admin-property-card__suspend-form {
  @apply mt-3 space-y-2 rounded-md p-3;
  background-color: #fef2f2;
}

.admin-property-card__label {
  @apply block text-sm font-medium;
  color: var(--color-text);
}

.admin-property-card__textarea {
  @apply w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2;
  border-color: #d1d5db;
  --tw-ring-color: var(--color-primary);
}

.admin-property-card__error {
  @apply text-sm text-red-600;
}

.admin-property-card__suspend-actions {
  @apply flex flex-wrap gap-2;
}

.admin-page__back {
  @apply mt-8 inline-block text-sm font-medium underline underline-offset-2;
  color: var(--color-primary);
}
</style>
