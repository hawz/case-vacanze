<script setup lang="ts">
import { z } from 'zod'

// EPIC 16 — Richiesta di disponibilità dal mini-sito (US-1601). Insert
// pubblico diretto via useSupabaseClient(): la RLS
// "availability_requests_public_insert" permette già l'inserimento anonimo
// solo se la proprietà è PUBLISHED, nessun endpoint server necessario.
//
// Protezione anti-spam: campo honeypot ("hp_company", tenuto fuori
// dallo schermo via CSS, non display:none — alcuni bot ignorano i campi con
// display:none). Un utente reale non lo vede né lo compila mai; se arriva
// valorizzato, la richiesta si tratta come spam e si finge un invio
// riuscito senza scrivere nulla, per non dare segnali utili a chi lo
// automatizza. Scelta al posto del rate limiting perché non richiede
// infrastruttura aggiuntiva (nessun contatore da persistere in un contesto
// serverless) — coerente con "niente overengineering" (CLAUDE.md).
const props = defineProps<{ propertyId: string, maxGuests: number | null }>()

const { t } = useI18n()
const supabase = useSupabaseClient()

const guestName = ref('')
const email = ref('')
const phone = ref('')
const checkIn = ref('')
const checkOut = ref('')
const guestsCount = ref('')
const message = ref('')
const honeypot = ref('')

const fieldErrors = ref<Record<string, string>>({})
const formError = ref('')
const isSubmitting = ref(false)
const isSubmitted = ref(false)

const exceedsMaxGuests = computed(() => {
  const n = Number(guestsCount.value)
  return props.maxGuests != null && n > 0 && n > props.maxGuests
})

const schema = z.object({
  guestName: z.string().trim().min(1),
  email: z.string().trim().email(),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  guestsCount: z.coerce.number().int().positive(),
})

function resetForm() {
  guestName.value = ''
  email.value = ''
  phone.value = ''
  checkIn.value = ''
  checkOut.value = ''
  guestsCount.value = ''
  message.value = ''
}

async function onSubmit() {
  formError.value = ''
  fieldErrors.value = {}

  if (honeypot.value) {
    isSubmitted.value = true
    resetForm()
    return
  }

  const result = schema.safeParse({
    guestName: guestName.value,
    email: email.value,
    checkIn: checkIn.value,
    checkOut: checkOut.value,
    guestsCount: guestsCount.value,
  })

  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0]
      if (key === 'guestName') fieldErrors.value.guestName = t('minisite.availabilityForm.validation.guestNameRequired')
      if (key === 'email') fieldErrors.value.email = t('minisite.availabilityForm.validation.emailInvalid')
      if (key === 'checkIn' || key === 'checkOut') fieldErrors.value[key] = t('minisite.availabilityForm.validation.datesRequired')
      if (key === 'guestsCount') fieldErrors.value.guestsCount = t('minisite.availabilityForm.validation.guestsCountInvalid')
    }
    return
  }

  if (result.data.checkOut <= result.data.checkIn) {
    fieldErrors.value.checkOut = t('minisite.availabilityForm.validation.checkOutBeforeCheckIn')
    return
  }

  isSubmitting.value = true
  const { error } = await supabase.from('availability_requests').insert({
    property_id: props.propertyId,
    guest_name: result.data.guestName,
    email: result.data.email,
    phone: phone.value.trim() || null,
    check_in: result.data.checkIn,
    check_out: result.data.checkOut,
    guests_count: result.data.guestsCount,
    message: message.value.trim() || null,
  })
  isSubmitting.value = false

  if (error) {
    formError.value = t('minisite.availabilityForm.errors.submit')
    return
  }

  isSubmitted.value = true
  resetForm()
}
</script>

<template>
  <section class="minisite-section">
    <h2 class="minisite-section__title">
      {{ t('minisite.availabilityForm.title') }}
    </h2>
    <p class="availability-form__subtitle">
      {{ t('minisite.availabilityForm.subtitle') }}
    </p>

    <p
      v-if="isSubmitted"
      class="availability-form__submitted"
    >
      <strong>{{ t('minisite.availabilityForm.submitted.title') }}</strong>
      {{ t('minisite.availabilityForm.submitted.message') }}
    </p>

    <form
      v-else
      class="availability-form"
      novalidate
      @submit.prevent="onSubmit"
    >
      <div class="availability-form__field">
        <label
          class="availability-form__label"
          for="avail-guest-name"
        >{{ t('minisite.availabilityForm.fields.guestNameLabel') }}</label>
        <input
          id="avail-guest-name"
          v-model="guestName"
          type="text"
          class="availability-form__input"
        >
        <p
          v-if="fieldErrors.guestName"
          class="availability-form__error"
        >
          {{ fieldErrors.guestName }}
        </p>
      </div>

      <div class="availability-form__row">
        <div class="availability-form__field">
          <label
            class="availability-form__label"
            for="avail-email"
          >{{ t('minisite.availabilityForm.fields.emailLabel') }}</label>
          <input
            id="avail-email"
            v-model="email"
            type="email"
            class="availability-form__input"
          >
          <p
            v-if="fieldErrors.email"
            class="availability-form__error"
          >
            {{ fieldErrors.email }}
          </p>
        </div>
        <div class="availability-form__field">
          <label
            class="availability-form__label"
            for="avail-phone"
          >{{ t('minisite.availabilityForm.fields.phoneLabel') }}</label>
          <input
            id="avail-phone"
            v-model="phone"
            type="tel"
            class="availability-form__input"
          >
        </div>
      </div>

      <div class="availability-form__row">
        <div class="availability-form__field">
          <label
            class="availability-form__label"
            for="avail-checkin"
          >{{ t('minisite.availabilityForm.fields.checkInLabel') }}</label>
          <input
            id="avail-checkin"
            v-model="checkIn"
            type="date"
            class="availability-form__input"
          >
          <p
            v-if="fieldErrors.checkIn"
            class="availability-form__error"
          >
            {{ fieldErrors.checkIn }}
          </p>
        </div>
        <div class="availability-form__field">
          <label
            class="availability-form__label"
            for="avail-checkout"
          >{{ t('minisite.availabilityForm.fields.checkOutLabel') }}</label>
          <input
            id="avail-checkout"
            v-model="checkOut"
            type="date"
            class="availability-form__input"
          >
          <p
            v-if="fieldErrors.checkOut"
            class="availability-form__error"
          >
            {{ fieldErrors.checkOut }}
          </p>
        </div>
      </div>

      <div class="availability-form__field">
        <label
          class="availability-form__label"
          for="avail-guests"
        >{{ t('minisite.availabilityForm.fields.guestsCountLabel') }}</label>
        <input
          id="avail-guests"
          v-model="guestsCount"
          type="number"
          min="1"
          step="1"
          class="availability-form__input"
        >
        <p
          v-if="fieldErrors.guestsCount"
          class="availability-form__error"
        >
          {{ fieldErrors.guestsCount }}
        </p>
        <p
          v-else-if="exceedsMaxGuests"
          class="availability-form__warning"
        >
          {{ t('minisite.availabilityForm.guestsExceedWarning', { max: maxGuests }) }}
        </p>
      </div>

      <div class="availability-form__field">
        <label
          class="availability-form__label"
          for="avail-message"
        >{{ t('minisite.availabilityForm.fields.messageLabel') }}</label>
        <textarea
          id="avail-message"
          v-model="message"
          rows="3"
          class="availability-form__input"
        />
      </div>

      <!-- Honeypot: invisibile e non raggiungibile da tastiera per un utente
           reale, ma presente nel markup per i bot che compilano ogni campo. -->
      <div
        class="availability-form__honeypot"
        aria-hidden="true"
      >
        <label for="avail-hp-company">Company</label>
        <input
          id="avail-hp-company"
          v-model="honeypot"
          type="text"
          name="hp_company"
          autocomplete="off"
          tabindex="-1"
        >
      </div>

      <p
        v-if="formError"
        class="availability-form__alert"
        role="alert"
      >
        {{ formError }}
      </p>

      <button
        type="submit"
        class="availability-form__submit"
        :disabled="isSubmitting"
      >
        {{ isSubmitting ? t('minisite.loading') : t('minisite.availabilityForm.submit') }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.minisite-section {
  @apply mt-8;
}

.minisite-section__title {
  @apply text-lg font-semibold;
  color: var(--color-text);
}

.availability-form__subtitle {
  @apply mt-1 text-sm;
  color: var(--color-muted);
}

.availability-form {
  @apply mt-3 space-y-3 rounded-md border p-4;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
}

.availability-form__row {
  @apply grid gap-3 sm:grid-cols-2;
}

.availability-form__field {
  @apply space-y-1;
}

.availability-form__label {
  @apply block text-sm font-medium;
  color: var(--color-text);
}

.availability-form__input {
  @apply w-full rounded-md border px-3 py-2 text-base focus:outline-none focus:ring-2;
  border-color: #d1d5db;
  --tw-ring-color: var(--color-primary);
}

.availability-form__error {
  @apply text-xs text-red-600;
}

.availability-form__warning {
  @apply text-xs;
  color: #b45309;
}

.availability-form__honeypot {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.availability-form__alert {
  @apply rounded-md bg-red-50 px-3 py-2 text-sm text-red-700;
}

.availability-form__submit {
  @apply rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50;
  background-color: var(--color-primary);
}

.availability-form__submitted {
  @apply mt-3 space-y-1 rounded-md px-3 py-2 text-sm;
  background-color: #ecfdf5;
  color: #047857;
}
</style>
