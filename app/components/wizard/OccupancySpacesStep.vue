<script setup lang="ts">
import { z } from 'zod'

// EPIC 5 — Wizard: Occupazione & spazi (US-501). Upsert su singola riga
// (tabella occupancy, PK = property_id), nessun endpoint server necessario:
// niente secret coinvolti, si passa diretto da useSupabaseClient() come per
// i campi semplici di GeneralInfoStep.vue.
const props = defineProps<{ propertyId: string }>()

const { t } = useI18n()
const localePath = useLocalePath()
const supabase = useSupabaseClient()
const wizardStore = useWizardStore()

const isLoading = ref(true)
const loadError = ref('')

const maxGuests = ref('')
const bedrooms = ref('0')
const bathrooms = ref('0')
const beds = ref('0')
const singleBeds = ref('0')
const doubleBeds = ref('0')

async function loadOccupancy() {
  isLoading.value = true
  loadError.value = ''

  const { data, error } = await supabase
    .from('occupancy')
    .select('max_guests, bedrooms, bathrooms, beds, single_beds, double_beds')
    .eq('property_id', props.propertyId)
    .maybeSingle()

  isLoading.value = false

  if (error) {
    loadError.value = t('wizard.occupancySpaces.errors.load')
    return
  }

  if (data) {
    maxGuests.value = String(data.max_guests)
    bedrooms.value = String(data.bedrooms)
    bathrooms.value = String(data.bathrooms)
    beds.value = String(data.beds)
    singleBeds.value = String(data.single_beds)
    doubleBeds.value = String(data.double_beds)
  }
}

onMounted(loadOccupancy)

// Avviso soft (non blocca il salvataggio, AC US-501): aiuta la coerenza tra
// il totale letti e la somma di letti singoli/matrimoniali.
const bedsMismatch = computed(() => {
  const single = Number(singleBeds.value) || 0
  const double = Number(doubleBeds.value) || 0
  const total = Number(beds.value) || 0
  return single + double !== total
})

const schema = z.object({
  maxGuests: z.coerce.number().int().positive(),
  bedrooms: z.coerce.number().int().nonnegative(),
  bathrooms: z.coerce.number().int().nonnegative(),
  beds: z.coerce.number().int().nonnegative(),
  singleBeds: z.coerce.number().int().nonnegative(),
  doubleBeds: z.coerce.number().int().nonnegative(),
})

const fieldErrors = ref<Partial<Record<keyof z.infer<typeof schema>, string>>>({})
const formError = ref('')
const isSaving = ref(false)
const isSaved = ref(false)

async function onSubmit() {
  formError.value = ''
  isSaved.value = false
  fieldErrors.value = {}

  const result = schema.safeParse({
    maxGuests: maxGuests.value,
    bedrooms: bedrooms.value,
    bathrooms: bathrooms.value,
    beds: beds.value,
    singleBeds: singleBeds.value,
    doubleBeds: doubleBeds.value,
  })

  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof z.infer<typeof schema>
      fieldErrors.value[key] = key === 'maxGuests'
        ? t('wizard.occupancySpaces.validation.maxGuestsInvalid')
        : t('wizard.occupancySpaces.validation.countInvalid')
    }
    return
  }

  isSaving.value = true
  const { error } = await supabase
    .from('occupancy')
    .upsert({
      property_id: props.propertyId,
      max_guests: result.data.maxGuests,
      bedrooms: result.data.bedrooms,
      bathrooms: result.data.bathrooms,
      beds: result.data.beds,
      single_beds: result.data.singleBeds,
      double_beds: result.data.doubleBeds,
    })
  isSaving.value = false

  if (error) {
    formError.value = error.message
    return
  }

  wizardStore.markComplete('occupancy-spaces')
  isSaved.value = true
}
</script>

<template>
  <p
    v-if="isLoading"
    class="wizard-step__loading"
  >
    {{ t('auth.common.loading') }}
  </p>

  <form
    v-else
    class="wizard-form"
    novalidate
    @submit.prevent="onSubmit"
  >
    <h1 class="wizard-step__title">
      {{ t('wizard.occupancySpaces.title') }}
    </h1>
    <p class="wizard-step__subtitle">
      {{ t('wizard.occupancySpaces.subtitle') }}
    </p>

    <p
      v-if="loadError"
      class="wizard-form__alert"
      role="alert"
    >
      {{ loadError }}
    </p>

    <div class="wizard-form__field">
      <label
        class="wizard-form__label"
        for="os-max-guests"
      >{{ t('wizard.occupancySpaces.fields.maxGuestsLabel')
      }}</label>
      <input
        id="os-max-guests"
        v-model="maxGuests"
        type="number"
        min="1"
        step="1"
        class="wizard-form__input"
        :class="{ 'wizard-form__input--invalid': fieldErrors.maxGuests }"
      >
      <p
        v-if="fieldErrors.maxGuests"
        class="wizard-form__field-error"
      >
        {{ fieldErrors.maxGuests }}
      </p>
    </div>

    <div class="wizard-form__row">
      <div class="wizard-form__field">
        <label
          class="wizard-form__label"
          for="os-bedrooms"
        >{{ t('wizard.occupancySpaces.fields.bedroomsLabel')
        }}</label>
        <input
          id="os-bedrooms"
          v-model="bedrooms"
          type="number"
          min="0"
          step="1"
          class="wizard-form__input"
          :class="{ 'wizard-form__input--invalid': fieldErrors.bedrooms }"
        >
        <p
          v-if="fieldErrors.bedrooms"
          class="wizard-form__field-error"
        >
          {{ fieldErrors.bedrooms }}
        </p>
      </div>
      <div class="wizard-form__field">
        <label
          class="wizard-form__label"
          for="os-bathrooms"
        >{{ t('wizard.occupancySpaces.fields.bathroomsLabel')
        }}</label>
        <input
          id="os-bathrooms"
          v-model="bathrooms"
          type="number"
          min="0"
          step="1"
          class="wizard-form__input"
          :class="{ 'wizard-form__input--invalid': fieldErrors.bathrooms }"
        >
        <p
          v-if="fieldErrors.bathrooms"
          class="wizard-form__field-error"
        >
          {{ fieldErrors.bathrooms }}
        </p>
      </div>
    </div>

    <div class="wizard-form__row">
      <div class="wizard-form__field">
        <label
          class="wizard-form__label"
          for="os-beds"
        >{{ t('wizard.occupancySpaces.fields.bedsLabel') }}</label>
        <input
          id="os-beds"
          v-model="beds"
          type="number"
          min="0"
          step="1"
          class="wizard-form__input"
          :class="{ 'wizard-form__input--invalid': fieldErrors.beds }"
        >
        <p
          v-if="fieldErrors.beds"
          class="wizard-form__field-error"
        >
          {{ fieldErrors.beds }}
        </p>
      </div>
      <div class="wizard-form__field">
        <label
          class="wizard-form__label"
          for="os-single-beds"
        >{{ t('wizard.occupancySpaces.fields.singleBedsLabel')
        }}</label>
        <input
          id="os-single-beds"
          v-model="singleBeds"
          type="number"
          min="0"
          step="1"
          class="wizard-form__input"
          :class="{ 'wizard-form__input--invalid': fieldErrors.singleBeds }"
        >
        <p
          v-if="fieldErrors.singleBeds"
          class="wizard-form__field-error"
        >
          {{ fieldErrors.singleBeds }}
        </p>
      </div>
      <div class="wizard-form__field">
        <label
          class="wizard-form__label"
          for="os-double-beds"
        >{{ t('wizard.occupancySpaces.fields.doubleBedsLabel')
        }}</label>
        <input
          id="os-double-beds"
          v-model="doubleBeds"
          type="number"
          min="0"
          step="1"
          class="wizard-form__input"
          :class="{ 'wizard-form__input--invalid': fieldErrors.doubleBeds }"
        >
        <p
          v-if="fieldErrors.doubleBeds"
          class="wizard-form__field-error"
        >
          {{ fieldErrors.doubleBeds }}
        </p>
      </div>
    </div>

    <p
      v-if="bedsMismatch"
      class="wizard-form__hint wizard-form__hint--warning"
    >
      {{ t('wizard.occupancySpaces.bedsMismatchWarning') }}
    </p>

    <p
      v-if="formError"
      class="wizard-form__alert"
      role="alert"
    >
      {{ formError }}
    </p>

    <p
      v-if="isSaved"
      class="wizard-form__message"
    >
      {{ t('wizard.occupancySpaces.saved') }}
    </p>

    <div class="wizard-form__footer">
      <NuxtLink
        :to="localePath('/app/properties')"
        class="wizard-form__back"
      >
        {{ t('properties.editStub.backLink') }}
      </NuxtLink>
      <button
        type="submit"
        class="wizard-form__submit"
        :disabled="isSaving"
      >
        {{ isSaving ? t('auth.common.loading') : t('wizard.occupancySpaces.submit') }}
      </button>
    </div>
  </form>
</template>

<style scoped>
/*
  Stesse classi condivise "wizard-step__" e "wizard-form__" di GeneralInfoStep.vue
  (i Vue scoped style non attraversano i file, vanno duplicate per componente).
*/
.wizard-step__loading {
  @apply mt-6 text-sm;
  color: var(--color-muted);
}

.wizard-step__title {
  @apply mt-6 text-2xl font-bold;
  color: var(--color-text);
}

.wizard-step__subtitle {
  @apply mt-1 text-sm;
  color: var(--color-muted);
}

.wizard-form {
  @apply mt-2 space-y-5;
}

.wizard-form__row {
  @apply grid gap-5 sm:grid-cols-3;
}

.wizard-form__field {
  @apply space-y-1;
}

.wizard-form__label {
  @apply block text-sm font-medium;
  color: var(--color-text);
}

.wizard-form__input {
  @apply w-full rounded-md border px-3 py-2 text-base focus:outline-none focus:ring-2;
  border-color: #d1d5db;
  --tw-ring-color: var(--color-primary);
}

.wizard-form__input--invalid {
  @apply border-red-500;
}

.wizard-form__hint {
  @apply text-xs;
  color: var(--color-muted);
}

.wizard-form__hint--warning {
  @apply rounded-md px-3 py-2 text-sm;
  background-color: #fffbeb;
  color: #b45309;
}

.wizard-form__field-error {
  @apply text-sm text-red-600;
}

.wizard-form__alert {
  @apply rounded-md bg-red-50 px-3 py-2 text-sm text-red-700;
}

.wizard-form__message {
  @apply rounded-md px-3 py-2 text-sm;
  background-color: #ecfdf5;
  color: #047857;
}

.wizard-form__footer {
  @apply flex items-center justify-between gap-4 pt-2;
}

.wizard-form__back {
  @apply text-sm font-medium underline underline-offset-2;
  color: var(--color-primary);
}

.wizard-form__submit {
  @apply rounded-md px-4 py-2 font-medium text-white transition-opacity disabled:opacity-50;
  background-color: var(--color-primary);
}
</style>
