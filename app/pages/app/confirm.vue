<script setup lang="ts">
import { z } from 'zod'

// Pagina di callback unica per due flussi Supabase Auth diversi:
// 1) conferma email dopo la registrazione -> arriva con sessione attiva,
//    mostriamo un messaggio e reindirizziamo alla dashboard.
// 2) recovery (link di "password dimenticata") -> Supabase aggiunge
//    ?type=recovery all'URL: mostriamo qui il form per la nuova password,
//    invece di introdurre una rotta /app/reset-password non richiesta.
// In entrambi i casi il modulo @nuxtjs/supabase scambia già in automatico
// il "code" nell'URL per una sessione (client Supabase con detectSessionInUrl).

const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const supabase = useSupabaseClient()
const user = useSupabaseUser()

definePageMeta({ layout: 'default' })

const isRecovery = route.query.type === 'recovery'
const linkError = typeof route.query.error_description === 'string' ? route.query.error_description : ''

type Status = 'verifying' | 'success' | 'error' | 'recovery-form' | 'recovery-done'
const status = ref<Status>(linkError ? 'error' : isRecovery ? 'verifying' : 'verifying')

const schema = z.object({ password: z.string().min(6), confirmPassword: z.string() })
  .refine(data => data.password === data.confirmPassword, { path: ['confirmPassword'] })

const password = ref('')
const confirmPassword = ref('')
const fieldErrors = ref<{ password?: string, confirmPassword?: string }>({})
const formError = ref('')
const isSubmitting = ref(false)

function validate() {
  fieldErrors.value = {}
  const result = schema.safeParse({ password: password.value, confirmPassword: confirmPassword.value })
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0]
      if (key === 'password') fieldErrors.value.password = t('auth.validation.passwordMin')
      if (key === 'confirmPassword') fieldErrors.value.confirmPassword = t('auth.validation.passwordsMismatch')
    }
  }
  return result.success
}

async function onSubmitNewPassword() {
  formError.value = ''
  if (!validate()) return

  isSubmitting.value = true
  const { error } = await supabase.auth.updateUser({ password: password.value })
  isSubmitting.value = false

  if (error) {
    formError.value = error.message
    return
  }

  status.value = 'recovery-done'
}

// Il client Supabase scambia il code nell'URL in modo asincrono all'avvio:
// aspettiamo che la sessione compaia (o un breve timeout di sicurezza)
// prima di decidere se mostrare successo/errore.
watch(user, (value) => {
  if (!value) return
  status.value = isRecovery ? 'recovery-form' : 'success'
  if (!isRecovery) {
    setTimeout(() => navigateTo(localePath('/app/properties')), 2000)
  }
}, { immediate: true })

onMounted(() => {
  setTimeout(() => {
    if (status.value === 'verifying') status.value = 'error'
  }, 5000)
})
</script>

<template>
  <section class="auth-form">
    <template v-if="status === 'verifying'">
      <h1 class="auth-form__title">
        {{ t('auth.confirm.verifyingTitle') }}
      </h1>
      <p class="auth-form__subtitle">
        {{ t('auth.confirm.verifyingSubtitle') }}
      </p>
    </template>

    <template v-else-if="status === 'success'">
      <h1 class="auth-form__title">
        {{ t('auth.confirm.successTitle') }}
      </h1>
      <p class="auth-form__message">
        {{ t('auth.confirm.successMessage') }}
      </p>
    </template>

    <template v-else-if="status === 'error'">
      <h1 class="auth-form__title">
        {{ t('auth.confirm.errorTitle') }}
      </h1>
      <p
        class="auth-form__alert"
        role="alert"
      >
        {{ linkError || t('auth.confirm.errorMessage') }}
      </p>
      <div class="auth-form__footer">
        <NuxtLink
          :to="localePath('/app/login')"
          class="auth-form__link"
        >
          {{ t('auth.confirm.backToLogin') }}
        </NuxtLink>
      </div>
    </template>

    <template v-else-if="status === 'recovery-form'">
      <h1 class="auth-form__title">
        {{ t('auth.confirm.resetTitle') }}
      </h1>
      <p class="auth-form__subtitle">
        {{ t('auth.confirm.resetSubtitle') }}
      </p>

      <form
        class="auth-form__form"
        novalidate
        @submit.prevent="onSubmitNewPassword"
      >
        <div class="auth-form__field">
          <label
            class="auth-form__label"
            for="confirm-password"
          >{{ t('auth.fields.newPasswordLabel') }}</label>
          <input
            id="confirm-password"
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
            for="confirm-password-repeat"
          >{{ t('auth.fields.confirmPasswordLabel') }}</label>
          <input
            id="confirm-password-repeat"
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
          {{ isSubmitting ? t('auth.common.loading') : t('auth.confirm.resetSubmit') }}
        </button>
      </form>
    </template>

    <template v-else-if="status === 'recovery-done'">
      <h1 class="auth-form__title">
        {{ t('auth.confirm.resetSuccessTitle') }}
      </h1>
      <p class="auth-form__message">
        {{ t('auth.confirm.resetSuccessMessage') }}
      </p>
      <div class="auth-form__footer">
        <NuxtLink
          :to="localePath('/app/properties')"
          class="auth-form__link"
        >
          {{ t('auth.confirm.continueLink') }}
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

.auth-form__link {
  @apply font-medium underline underline-offset-2;
  color: var(--color-primary);
}
</style>
