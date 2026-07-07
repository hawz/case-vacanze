<script setup lang="ts">
import { z } from 'zod'

const { t } = useI18n()
const localePath = useLocalePath()
const supabase = useSupabaseClient()

definePageMeta({ layout: 'default' })

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  path: ['confirmPassword'],
})

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const fieldErrors = ref<{ email?: string, password?: string, confirmPassword?: string }>({})
const formError = ref('')
const isSubmitting = ref(false)
// Una volta inviata la registrazione mostriamo solo il messaggio "controlla la mail"
// (il trigger on_auth_user_created crea già il profilo OWNER lato database).
const isSubmitted = ref(false)

const knownErrors: Record<string, string> = {
  'User already registered': t('auth.errors.userAlreadyRegistered'),
}

function validate() {
  fieldErrors.value = {}
  const result = schema.safeParse({ email: email.value, password: password.value, confirmPassword: confirmPassword.value })
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0]
      if (key === 'email') fieldErrors.value.email = t('auth.validation.emailInvalid')
      if (key === 'password') fieldErrors.value.password = t('auth.validation.passwordMin')
      if (key === 'confirmPassword') fieldErrors.value.confirmPassword = t('auth.validation.passwordsMismatch')
    }
  }
  return result.success
}

async function onSubmit() {
  formError.value = ''
  if (!validate()) return

  isSubmitting.value = true
  const { data, error } = await supabase.auth.signUp({
    email: email.value,
    password: password.value,
    options: {
      // Dopo il click sul link di conferma nella mail, Supabase riporta
      // l'utente qui: /app/confirm gestisce sia questo caso sia il recovery.
      emailRedirectTo: `${window.location.origin}${localePath('/app/confirm')}`,
    },
  })
  isSubmitting.value = false

  if (error) {
    formError.value = knownErrors[error.message] ?? error.message
    return
  }

  // Se la conferma email è disattivata nel progetto Supabase, signUp
  // restituisce già una sessione attiva: in quel caso si può entrare subito.
  if (data.session) {
    await navigateTo(localePath('/app/properties'))
    return
  }

  isSubmitted.value = true
}
</script>

<template>
  <section class="auth-form">
    <template v-if="!isSubmitted">
      <h1 class="auth-form__title">
        {{ t('auth.register.title') }}
      </h1>
      <p class="auth-form__subtitle">
        {{ t('auth.register.subtitle') }}
      </p>

      <form
        class="auth-form__form"
        novalidate
        @submit.prevent="onSubmit"
      >
        <div class="auth-form__field">
          <label
            class="auth-form__label"
            for="register-email"
          >{{ t('auth.fields.emailLabel') }}</label>
          <input
            id="register-email"
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
            for="register-password"
          >{{ t('auth.fields.passwordLabel') }}</label>
          <input
            id="register-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
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

        <div class="auth-form__field">
          <label
            class="auth-form__label"
            for="register-confirm-password"
          >{{ t('auth.fields.confirmPasswordLabel') }}</label>
          <input
            id="register-confirm-password"
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            class="auth-form__input"
            :class="{ 'auth-form__input--invalid': fieldErrors.confirmPassword }"
          >
          <p
            v-if="fieldErrors.confirmPassword"
            class="auth-form__field-error"
          >
            {{ fieldErrors.confirmPassword }}
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
          {{ isSubmitting ? t('auth.common.loading') : t('auth.register.submit') }}
        </button>
      </form>

      <div class="auth-form__footer">
        <p class="auth-form__footer-text">
          {{ t('auth.register.hasAccount') }}
          <NuxtLink
            :to="localePath('/app/login')"
            class="auth-form__link"
          >
            {{ t('auth.register.loginLink') }}
          </NuxtLink>
        </p>
      </div>
    </template>

    <template v-else>
      <h1 class="auth-form__title">
        {{ t('auth.register.successTitle') }}
      </h1>
      <p class="auth-form__message">
        {{ t('auth.register.successMessage', { email }) }}
      </p>
      <div class="auth-form__footer">
        <NuxtLink
          :to="localePath('/app/login')"
          class="auth-form__link"
        >
          {{ t('auth.register.loginLink') }}
        </NuxtLink>
      </div>
    </template>
  </section>
</template>

<style scoped>
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

.auth-form__message {
  @apply mt-4 rounded-md px-3 py-2 text-sm;
  background-color: #ecfdf5;
  color: #047857;
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
