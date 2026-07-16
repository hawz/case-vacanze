<script setup lang="ts">
// EPIC 17 — Amministrazione (US-1702). Elenco di tutti i profili (la
// policy "profiles_select_own_or_admin" include già "or public.is_admin()")
// con azione "Promuovi ad Admin", protetta dalla policy
// "profiles_admin_update_any" già in schema.sql.
//
// Solo promozione in questa V1 (Owner -> Admin), non retrocessione: l'AC di
// US-1702 la lascia esplicitamente facoltativa/rimandabile.
//
// Niente email in elenco (decisione con Albe): auth.users non è esposto via
// RLS/PostgREST, mostrare l'email avrebbe richiesto un endpoint server con
// SUPABASE_SECRET_KEY (mai usata finora in questo progetto) e
// supabase.auth.admin.listUsers(). Per ora si identifica l'utente da nome/
// cognome (se compilati) o dal suo ID.
interface AdminUser {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  role: 'OWNER' | 'ADMIN'
}

const { t } = useI18n()
const localePath = useLocalePath()
const supabase = useSupabaseClient()

definePageMeta({ layout: 'app', middleware: 'admin' })

const users = ref<AdminUser[]>([])
const isLoading = ref(true)
const loadError = ref('')

async function loadUsers() {
  isLoading.value = true
  loadError.value = ''

  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, phone, role')
    .order('created_at', { ascending: false })

  isLoading.value = false

  if (error) {
    loadError.value = t('admin.users.errors.load')
    return
  }

  users.value = data ?? []
}

onMounted(loadUsers)

function displayName(user: AdminUser) {
  const full = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
  return full || t('admin.users.unnamed')
}

function roleLabel(role: string) {
  return t(`admin.users.roles.${role}`)
}

// --- Promozione (US-1702) ---
const confirmingId = ref<string | null>(null)
const promotingId = ref<string | null>(null)
const promoteError = ref<Record<string, string>>({})
const promotedId = ref<string | null>(null)

function askPromote(id: string) {
  confirmingId.value = id
  promoteError.value = { ...promoteError.value, [id]: '' }
}

function cancelPromote() {
  confirmingId.value = null
}

async function confirmPromote(user: AdminUser) {
  promotingId.value = user.id
  const { error } = await supabase
    .from('profiles')
    .update({ role: 'ADMIN' })
    .eq('id', user.id)
  promotingId.value = null

  if (error) {
    promoteError.value = { ...promoteError.value, [user.id]: t('admin.users.errors.promote') }
    return
  }

  user.role = 'ADMIN'
  confirmingId.value = null
  promotedId.value = user.id
  setTimeout(() => {
    if (promotedId.value === user.id) promotedId.value = null
  }, 2500)
}
</script>

<template>
  <section class="admin-page">
    <div class="admin-page__header">
      <div>
        <h1 class="admin-page__title">
          {{ t('admin.users.title') }}
        </h1>
        <p class="admin-page__subtitle">
          {{ t('admin.users.subtitle') }}
        </p>
      </div>
      <NuxtLink
        :to="localePath('/app/admin/properties')"
        class="admin-page__nav-link"
      >
        {{ t('admin.users.propertiesLink') }}
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
      {{ t('admin.users.loading') }}
    </p>

    <p
      v-else-if="users.length === 0"
      class="admin-page__empty"
    >
      {{ t('admin.users.empty') }}
    </p>

    <ul
      v-else
      class="admin-users"
    >
      <li
        v-for="user in users"
        :key="user.id"
        class="admin-user-card"
      >
        <div class="admin-user-card__info">
          <span class="admin-user-card__name">{{ displayName(user) }}</span>
          <span class="admin-user-card__id">{{ t('admin.users.idLabel') }}: {{ user.id }}</span>
          <span
            v-if="user.phone"
            class="admin-user-card__phone"
          >{{ t('admin.users.phoneLabel') }}: {{ user.phone }}</span>
          <span
            class="admin-user-card__role"
            :class="{ 'admin-user-card__role--admin': user.role === 'ADMIN' }"
          >
            {{ roleLabel(user.role) }}
          </span>
        </div>

        <div
          v-if="user.role === 'OWNER'"
          class="admin-user-card__actions"
        >
          <p
            v-if="promotedId === user.id"
            class="admin-user-card__promoted"
          >
            {{ t('admin.users.promoted') }}
          </p>
          <button
            v-if="confirmingId !== user.id"
            type="button"
            class="admin-user-card__action"
            @click="askPromote(user.id)"
          >
            {{ t('admin.users.promote.button') }}
          </button>
          <div
            v-else
            class="admin-user-card__confirm"
          >
            <p class="admin-user-card__confirm-title">
              {{ t('admin.users.promote.confirmTitle') }}
            </p>
            <p class="admin-user-card__confirm-message">
              {{ t('admin.users.promote.confirmMessage') }}
            </p>
            <p
              v-if="promoteError[user.id]"
              class="admin-user-card__error"
            >
              {{ promoteError[user.id] }}
            </p>
            <div class="admin-user-card__confirm-actions">
              <button
                type="button"
                class="admin-user-card__action admin-user-card__action--secondary"
                :disabled="promotingId === user.id"
                @click="cancelPromote"
              >
                {{ t('admin.users.promote.cancel') }}
              </button>
              <button
                type="button"
                class="admin-user-card__action"
                :disabled="promotingId === user.id"
                @click="confirmPromote(user)"
              >
                {{ promotingId === user.id ? t('admin.users.loading') : t('admin.users.promote.confirm') }}
              </button>
            </div>
          </div>
        </div>
      </li>
    </ul>
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

.admin-users {
  @apply mt-6 space-y-3;
}

.admin-user-card {
  @apply rounded-md border p-4;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
}

.admin-user-card__info {
  @apply flex flex-wrap items-center gap-3 text-sm;
}

.admin-user-card__name {
  @apply font-medium;
  color: var(--color-text);
}

.admin-user-card__id {
  @apply font-mono text-xs;
  color: var(--color-muted);
}

.admin-user-card__phone {
  color: var(--color-muted);
}

.admin-user-card__role {
  @apply rounded-full px-2 py-0.5 text-xs font-medium;
  background-color: #e5e7eb;
  color: var(--color-text);
}

.admin-user-card__role--admin {
  background-color: #d1fae5;
  color: #047857;
}

.admin-user-card__actions {
  @apply mt-3;
}

.admin-user-card__action {
  @apply rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50;
  background-color: var(--color-primary);
}

.admin-user-card__action--secondary {
  @apply border;
  border-color: #d1d5db;
  background-color: transparent;
  color: var(--color-text);
}

.admin-user-card__promoted {
  @apply mb-2 text-sm;
  color: #047857;
}

.admin-user-card__confirm {
  @apply space-y-2 rounded-md p-3 text-sm;
  background-color: #fffbeb;
}

.admin-user-card__confirm-title {
  @apply font-medium;
  color: var(--color-text);
}

.admin-user-card__confirm-message {
  color: var(--color-muted);
}

.admin-user-card__error {
  @apply text-sm text-red-600;
}

.admin-user-card__confirm-actions {
  @apply flex flex-wrap gap-2;
}
</style>
