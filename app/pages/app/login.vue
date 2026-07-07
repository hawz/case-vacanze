<script setup lang="ts">
import { z } from 'zod'

const { t } = useI18n()
const localePath = useLocalePath()
const supabase = useSupabaseClient()
const redirectCookie = useSupabaseCookieRedirect()

definePageMeta({ layout: 'default' })

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
})

const email = ref('')
const password = ref('')
const fieldErrors = ref<{ email?: string, password?: string }>({})
const formError = ref('')
const isSubmitting = ref(false)

// Messaggi noti di Supabase Auth tradotti; qualsiasi altro errore
// viene mostrato "as-is" (in inglese) piuttosto che nascosto.
const knownErrors: Record<string, string> = {
  'Invalid login credentials': t('auth.errors.invalidCredentials'),
  'Email not confirmed': t('auth.errors.emailNotConfirmed'),
}

function validate() {
  fieldErrors.value = {}
  const result = schema.safeParse({ email: email.value, password: password.value })
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0]
      if (key === 'email') fieldErrors.value.email = t('auth.validation.emailInvalid')
      if (key === 'password') fieldErrors.value.password = t('auth.validation.passwordMin')
    }
  }
  return result.success
}

async function onSubmit() {
  formError.value = ''
  if (!validate()) return

  isSubmitting.value = true
  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })
  isSubmitting.value = false

  if (error) {
    formError.value = knownErrors[error.message] ?? error.message
    return
  }

  // Se l'utente era stato rimbalzato qui da una pagina protetta,
  // saveRedirectToCookie (nuxt.config.ts) ce l'ha salvata: lo riportiamo lì,
  // altrimenti va alla dashboard di default (non ancora costruita).
  const target = redirectCookie.pluck() ?? '/app/properties'
  await navigateTo(target)
}
</script>

<template>
  <section class="auth-form">
    <h1 class="auth-form__title">
      {{ t('auth.login.title') }}
    </h1>
    <p class="auth-form__subtitle">
      {{ t('auth.login.subtitle') }}
    </p>

    <form
      class="auth-form__form"
      novalidate
      @submit.prevent="onSubmit"
    >
      <div class="auth-form__field">
        <label
          class="auth-form__label"
          for="login-email"
        >{{ t('auth.fields.emailLabel') }}</label>
        <input
          id="login-email"
          v-model="email"
          type="email"
          autocomplete="email"
          class="auth-form__input"
          :class="{ 'auth-form__input--invalid': fieldErrors.email }"
        >
        <p
          v-if="fieldErrors.email"
          class="auth-form__field-error"
        >
          {{ fieldErrors.email }}
        </p>
      </div>

      <div class="auth-form__field">
        <label
          class="auth-form__label"
          for="login-password"
        >{{ t('auth.fields.passwordLabel') }}</label>
        <input
          id="login-password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          class="auth-form__input"
          :class="{ 'auth-form__input--invalid': fieldErrors.password }"
        >
        <p
          v-if="fieldErrors.password"
          class="auth-form__field-error"
        >
          {{ fieldErrors.password }}
        </p>
      </div>

      <p
        v-if="formError"
        class="auth-form__alert"
        role="alert"
      >
        {{ formError }}
      </p>

      <button
        type="submit"
        class="auth-form__submit"
        :disabled="isSubmitting"
      >
        {{ isSubmitting ? t('auth.common.loading') : t('auth.login.submit') }}
      </button>
    </form>

    <div class="auth-form__footer">
      <NuxtLink
        :to="localePath('/app/forgot-password')"
        class="auth-form__link"
      >
        {{ t('auth.login.forgotPasswordLink') }}
      </NuxtLink>
      <p class="auth-form__footer-text">
        {{ t('auth.login.noAccount') }}
        <NuxtLink
          :to="localePath('/app/register')"
          class="auth-form__link"
        >
          {{ t('auth.login.registerLink') }}
        </NuxtLink>
      </p>
    </div>
  </section>
</template>

<style scoped>
/*
  Blocco "auth-form" in BEM, riusato (con lo stesso set di classi) in
  login/register/forgot-password/confirm per coerenza visiva, seguendo
  la stessa convenzione già usata per "test-panel" nelle pagine di verifica.
*/
.auth-form {
  @apply mx-auto max-w-sm px-4 py-12;
}

.auth-form__title {
  @apply text-2xl font-bold;
  color: var(--color-text);
}

.auth-form__subtitle {
  @apply mt-1 text-sm;
  color: var(--color-muted);
}

.auth-form__form {
  @apply mt-8 space-y-5;
}

.auth-form__field {
  @apply space-y-1;
}

.auth-form__label {
  @apply block text-sm font-medium;
  color: var(--color-text);
}

.auth-form__input {
  @apply w-full rounded-md border px-3 py-2 text-base focus:outline-none focus:ring-2;
  border-color: #d1d5db;
  --tw-ring-color: var(--color-primary);
}

.auth-form__input--invalid {
  @apply border-red-500;
}

.auth-form__field-error {
  @apply text-sm text-red-600;
}

.auth-form__alert {
  @apply rounded-md bg-red-50 px-3 py-2 text-sm text-red-700;
}

.auth-form__submit {
  @apply w-full rounded-md px-4 py-2 font-medium text-white transition-opacity disabled:opacity-50;
  background-color: var(--color-primary);
}

.auth-form__footer {
  @apply mt-6 space-y-2 text-sm;
}

.auth-form__footer-text {
  color: var(--color-muted);
}

.auth-form__link {
  @apply font-medium underline underline-offset-2;
  color: var(--color-primary);
}
</style>
