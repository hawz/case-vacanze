<script setup lang="ts">
import { z } from 'zod'

// US-105: gestione profilo personale (first_name, last_name, phone — tutti
// opzionali). Legge/scrive direttamente public.profiles: RLS "profiles_update_own"
// garantisce che l'owner modifichi solo la propria riga; il campo `role` non è
// mai esposto in questo form (né leggibile né scrivibile da qui).
const { t } = useI18n()
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const authStore = useAuthStore()

definePageMeta({ layout: 'app' })

const schema = z.object({
  firstName: z.string().trim().max(100).optional().or(z.literal('')),
  lastName: z.string().trim().max(100).optional().or(z.literal('')),
  phone: z.string().trim().regex(/^[0-9+()\-\s]{6,20}$/).optional().or(z.literal('')),
})

const firstName = ref('')
const lastName = ref('')
const phone = ref('')
const fieldErrors = ref<{ firstName?: string, lastName?: string, phone?: string }>({})
const formError = ref('')
const isLoading = ref(true)
const isSubmitting = ref(false)
const isSaved = ref(false)

async function loadProfile() {
  if (!user.value) return

  const { data, error } = await supabase
    .from('profiles')
    .select('first_name, last_name, phone')
    .eq('id', user.value.id)
    .single()

  if (!error && data) {
    firstName.value = data.first_name ?? ''
    lastName.value = data.last_name ?? ''
    phone.value = data.phone ?? ''
  }
  isLoading.value = false
}

onMounted(loadProfile)

function validate() {
  fieldErrors.value = {}
  const result = schema.safeParse({ firstName: firstName.value, lastName: lastName.value, phone: phone.value })
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0]
      if (key === 'firstName') fieldErrors.value.firstName = t('profile.validation.tooLong')
      if (key === 'lastName') fieldErrors.value.lastName = t('profile.validation.tooLong')
      if (key === 'phone') fieldErrors.value.phone = t('profile.validation.phoneInvalid')
    }
  }
  return result.success
}

async function onSubmit() {
  formError.value = ''
  isSaved.value = false
  if (!validate() || !user.value) return

  isSubmitting.value = true
  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: firstName.value.trim() || null,
      last_name: lastName.value.trim() || null,
      phone: phone.value.trim() || null,
    })
    .eq('id', user.value.id)
  isSubmitting.value = false

  if (error) {
    formError.value = error.message
    return
  }

  authStore.setProfile({
    id: user.value.id,
    firstName: firstName.value.trim() || null,
    lastName: lastName.value.trim() || null,
    role: authStore.profile?.role ?? 'OWNER',
  })
  isSaved.value = true
}
</script>

<template>
  <section class="profile-form">
    <h1 class="profile-form__title">
      {{ t('profile.title') }}
    </h1>
    <p class="profile-form__subtitle">
      {{ t('profile.subtitle') }}
    </p>

    <form
      v-if="!isLoading"
      class="profile-form__form"
      novalidate
      @submit.prevent="onSubmit"
    >
      <div class="profile-form__field">
        <label
          class="profile-form__label"
          for="profile-first-name"
        >{{ t('profile.fields.firstNameLabel') }}</label>
        <input
          id="profile-first-name"
          v-model="firstName"
          type="text"
          autocomplete="given-name"
          class="profile-form__input"
          :class="{ 'profile-form__input--invalid': fieldErrors.firstName }"
        >
        <p
          v-if="fieldErrors.firstName"
          class="profile-form__field-error"
        >
          {{ fieldErrors.firstName }}
        </p>
      </div>

      <div class="profile-form__field">
        <label
          class="profile-form__label"
          for="profile-last-name"
        >{{ t('profile.fields.lastNameLabel') }}</label>
        <input
          id="profile-last-name"
          v-model="lastName"
          type="text"
          autocomplete="family-name"
          class="profile-form__input"
          :class="{ 'profile-form__input--invalid': fieldErrors.lastName }"
        >
        <p
          v-if="fieldErrors.lastName"
          class="profile-form__field-error"
        >
          {{ fieldErrors.lastName }}
        </p>
      </div>

      <div class="profile-form__field">
        <label
          class="profile-form__label"
          for="profile-phone"
        >{{ t('profile.fields.phoneLabel') }}</label>
        <input
          id="profile-phone"
          v-model="phone"
          type="tel"
          autocomplete="tel"
          class="profile-form__input"
          :class="{ 'profile-form__input--invalid': fieldErrors.phone }"
        >
        <p
          v-if="fieldErrors.phone"
          class="profile-form__field-error"
        >
          {{ fieldErrors.phone }}
        </p>
      </div>

      <p
        v-if="formError"
        class="profile-form__alert"
        role="alert"
      >
        {{ formError }}
      </p>

      <p
        v-if="isSaved"
        class="profile-form__message"
      >
        {{ t('profile.saved') }}
      </p>

      <button
        type="submit"
        class="profile-form__submit"
        :disabled="isSubmitting"
      >
        {{ isSubmitting ? t('auth.common.loading') : t('profile.submit') }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.profile-form {
  @apply mx-auto max-w-sm px-4 py-12;
}

.profile-form__title {
  @apply text-2xl font-bold;
  color: var(--color-text);
}

.profile-form__subtitle {
  @apply mt-1 text-sm;
  color: var(--color-muted);
}

.profile-form__form {
  @apply mt-8 space-y-5;
}

.profile-form__field {
  @apply space-y-1;
}

.profile-form__label {
  @apply block text-sm font-medium;
  color: var(--color-text);
}

.profile-form__input {
  @apply w-full rounded-md border px-3 py-2 text-base focus:outline-none focus:ring-2;
  border-color: #d1d5db;
  --tw-ring-color: var(--color-primary);
}

.profile-form__input--invalid {
  @apply border-red-500;
}

.profile-form__field-error {
  @apply text-sm text-red-600;
}

.profile-form__alert {
  @apply rounded-md bg-red-50 px-3 py-2 text-sm text-red-700;
}

.profile-form__message {
  @apply rounded-md px-3 py-2 text-sm;
  background-color: #ecfdf5;
  color: #047857;
}

.profile-form__submit {
  @apply w-full rounded-md px-4 py-2 font-medium text-white transition-opacity disabled:opacity-50;
  background-color: var(--color-primary);
}
</style>
