<script setup lang="ts">
import { z } from 'zod'

const { t } = useI18n()
const localePath = useLocalePath()
const supabase = useSupabaseClient()

definePageMeta({ layout: 'default' })

const schema = z.object({ email: z.string().trim().email() })

const email = ref('')
const fieldError = ref('')
const formError = ref('')
const isSubmitting = ref(false)
const isSubmitted = ref(false)

function validate() {
  fieldError.value = ''
  const result = schema.safeParse({ email: email.value })
  if (!result.success) fieldError.value = t('auth.validation.emailInvalid')
  return result.success
}

async function onSubmit() {
  formError.value = ''
  if (!validate()) return

  isSubmitting.value = true
  const { error } = await supabase.auth.resetPasswordForEmail(email.value, {
    // /app/confirm riconosce il flusso di recovery (type=recovery nell'URL
    // che Supabase genera) e mostra lì il form per la nuova password.
    redirectTo: `${window.location.origin}${localePath('/app/confirm')}`,
  })
  isSubmitting.value = false

  if (error) {
    formError.value = error.message
    return
  }

  // Per non rivelare se un'email è registrata o meno, mostriamo lo stesso
  // messaggio di successo indipendentemente dall'esito reale della richiesta.
  isSubmitted.value = true
}
</script>

<template>
  <section class="auth-form">
    <template v-if="!isSubmitted">
      <h1 class="auth-form__title">
        {{ t('auth.forgotPassword.title') }}
      </h1>
      <p class="auth-form__subtitle">
        {{ t('auth.forgotPassword.subtitle') }}
      </p>

      <form
        class="auth-form__form"
        novalidate
        @submit.prevent="onSubmit"
      >
        <div class="auth-form__field">
          <label
            class="auth-form__label"
            for="forgot-email"
          >{{ t('auth.fields.emailLabel') }}</label>
          <input
            id="forgot-email"
            v-model="email"
            type="email"
            autocomplete="email"
            class="auth-form__input"
            :class="{ 'auth-form__input--invalid': fieldError }"
          >
          <p
            v-if="fieldError"
            class="auth-form__field-error"
          >
            {{ fieldError }}
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
          {{ isSubmitting ? t('auth.common.loading') : t('auth.forgotPassword.submit') }}
        </button>
      </form>
    </template>

    <template v-else>
      <h1 class="auth-form__title">
        {{ t('auth.forgotPassword.successTitle') }}
      </h1>
      <p class="auth-form__message">
        {{ t('auth.forgotPassword.successMessage', { email }) }}
      </p>
    </template>

    <div class="auth-form__footer">
      <NuxtLink
        :to="localePath('/app/login')"
        class="auth-form__link"
      >
        {{ t('auth.forgotPassword.backToLogin') }}
      </NuxtLink>
    </div>
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

.auth-form__link {
  @apply font-medium underline underline-offset-2;
  color: var(--color-primary);
}
</style>
