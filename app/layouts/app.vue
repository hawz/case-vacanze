<script setup lang="ts">
// Layout dell'area autenticata (/app/**, escluso login/register/forgot-password/confirm
// che restano su 'default'). Aggiunge l'header con identità utente e logout (US-106),
// mancante nel layout pubblico.
const { t } = useI18n()
const localePath = useLocalePath()
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const authStore = useAuthStore()

const displayName = computed(() => {
  const first = authStore.profile?.firstName ?? ''
  const last = authStore.profile?.lastName ?? ''
  const fullName = `${first} ${last}`.trim()
  return fullName || user.value?.email || ''
})

const isLoggingOut = ref(false)

async function onLogout() {
  isLoggingOut.value = true
  await supabase.auth.signOut()
  authStore.clear()
  isLoggingOut.value = false
  await navigateTo(localePath('/app/login'))
}
</script>

<template>
  <div class="app-shell">
    <header class="app-shell__header">
      <NuxtLink
        :to="localePath('/app/properties')"
        class="app-shell__logo"
      >
        Portale Case Vacanze
      </NuxtLink>

      <div class="app-shell__user">
        <NuxtLink
          :to="localePath('/app/profile')"
          class="app-shell__user-name"
        >
          {{ displayName }}
        </NuxtLink>
        <button
          type="button"
          class="app-shell__logout"
          :disabled="isLoggingOut"
          @click="onLogout"
        >
          {{ t('nav.logout') }}
        </button>
      </div>
    </header>

    <main class="app-shell__content">
      <slot />
    </main>

    <footer class="app-shell__footer">
      <p class="app-shell__footer-text">
        &copy; {{ new Date().getFullYear() }} Portale Case Vacanze
      </p>
    </footer>
  </div>
</template>

<style scoped>
/*
  Stesso blocco BEM "app-shell" del layout 'default' (scoped, quindi nessun
  conflitto), con l'aggiunta di "app-shell__user"/"app-shell__user-name"/
  "app-shell__logout" per l'identità utente e il logout.
*/
.app-shell {
  @apply flex min-h-screen flex-col;
}

.app-shell__header {
  @apply flex items-center justify-between px-4 py-3 shadow-sm;
  background-color: var(--color-surface, #ffffff);
}

.app-shell__logo {
  @apply text-lg font-semibold;
  color: var(--color-primary, #0f766e);
}

.app-shell__user {
  @apply flex items-center gap-3 text-sm;
}

.app-shell__user-name {
  @apply font-medium underline-offset-2 hover:underline;
  color: var(--color-text);
}

.app-shell__logout {
  @apply rounded-md border px-3 py-1.5 text-sm font-medium transition-opacity disabled:opacity-50;
  border-color: #d1d5db;
  color: var(--color-text);
}

.app-shell__content {
  @apply flex-1;
}

.app-shell__footer {
  @apply px-4 py-6 text-center text-sm;
  color: var(--color-muted, #6b7280);
}
</style>
