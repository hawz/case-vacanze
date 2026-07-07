<script setup lang="ts">
import { z } from 'zod'

// EPIC 3 — Wizard: Informazioni generali (US-301), estratto come componente
// autonomo così ogni step del wizard vive nel proprio file sotto
// app/components/wizard/ invece di far crescere la pagina condivisa
// (app/pages/app/properties/[id]/edit/[step].vue), che resta solo un guscio
// di routing/navigazione tra step (vedi WizardSteps.vue).
const props = defineProps<{ propertyId: string }>()

const { t } = useI18n()
const localePath = useLocalePath()
const supabase = useSupabaseClient()
const propertyStore = usePropertyStore()
const wizardStore = useWizardStore()

// --- Tipo di proprietà: select con opzioni predefinite + "Altro" libero
// (US-301 lasciava aperta la scelta tra testo libero e select; il campo DB
// resta comunque testo libero, quindi salviamo l'etichetta risolta).
const PROPERTY_TYPE_CODES = ['apartment', 'villa', 'house', 'trullo'] as const
type PropertyTypeCode = typeof PROPERTY_TYPE_CODES[number]

function propertyTypeLabel(code: PropertyTypeCode) {
  return t(`wizard.generalInfo.propertyTypeOptions.${code}`)
}

const propertyTypeCode = ref<PropertyTypeCode | 'other' | ''>('')
const propertyTypeOther = ref('')

function resolvePropertyType(): string | null {
  if (propertyTypeCode.value === '') return null
  if (propertyTypeCode.value === 'other') return propertyTypeOther.value.trim() || null
  return propertyTypeLabel(propertyTypeCode.value)
}

const isLoading = ref(true)
const notFound = ref(false)

const name = ref('')
const slug = ref('')
const addressLine = ref('')
const city = ref('')
const province = ref('')
const latitude = ref('')
const longitude = ref('')
const shortDescription = ref('')
const longDescription = ref('')
const checkInTime = ref('')
const checkOutTime = ref('')

const fieldErrors = ref<{ name?: string, slug?: string, latitude?: string, longitude?: string }>({})
const formError = ref('')
const isSaving = ref(false)
const isSaved = ref(false)

async function loadProperty() {
  const { data, error } = await supabase
    .from('properties')
    .select('name, slug, property_type, address_line, city, province, latitude, longitude, short_description, long_description, check_in_time, check_out_time')
    .eq('id', props.propertyId)
    .single()

  isLoading.value = false

  if (error || !data) {
    notFound.value = true
    return
  }

  name.value = data.name ?? ''
  slug.value = data.slug ?? ''
  addressLine.value = data.address_line ?? ''
  city.value = data.city ?? ''
  province.value = data.province ?? ''
  latitude.value = data.latitude != null ? String(data.latitude) : ''
  longitude.value = data.longitude != null ? String(data.longitude) : ''
  shortDescription.value = data.short_description ?? ''
  longDescription.value = data.long_description ?? ''
  checkInTime.value = data.check_in_time ?? ''
  checkOutTime.value = data.check_out_time ?? ''

  const storedType = data.property_type ?? ''
  if (!storedType) {
    propertyTypeCode.value = ''
  }
  else {
    const match = PROPERTY_TYPE_CODES.find(code => propertyTypeLabel(code) === storedType)
    if (match) {
      propertyTypeCode.value = match
    }
    else {
      propertyTypeCode.value = 'other'
      propertyTypeOther.value = storedType
    }
  }
}

onMounted(loadProperty)

const schema = z.object({
  name: z.string().trim().min(1).max(150),
  slug: z.string().trim().min(1).max(150).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
})

function parseOptionalCoordinate(value: string, min: number, max: number): { ok: boolean, value: number | null } {
  const trimmed = value.trim()
  if (!trimmed) return { ok: true, value: null }
  const num = Number(trimmed)
  if (Number.isNaN(num) || num < min || num > max) return { ok: false, value: null }
  return { ok: true, value: num }
}

async function onSubmit() {
  formError.value = ''
  isSaved.value = false
  fieldErrors.value = {}

  const result = schema.safeParse({ name: name.value, slug: slug.value })
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0]
      if (key === 'name') fieldErrors.value.name = t('wizard.generalInfo.validation.nameRequired')
      if (key === 'slug') fieldErrors.value.slug = t('wizard.generalInfo.validation.slugInvalid')
    }
  }

  const lat = parseOptionalCoordinate(latitude.value, -90, 90)
  if (!lat.ok) fieldErrors.value.latitude = t('wizard.generalInfo.validation.latitudeInvalid')

  const lng = parseOptionalCoordinate(longitude.value, -180, 180)
  if (!lng.ok) fieldErrors.value.longitude = t('wizard.generalInfo.validation.longitudeInvalid')

  if (!result.success || !lat.ok || !lng.ok) return

  isSaving.value = true
  const { error } = await supabase
    .from('properties')
    .update({
      name: result.data.name,
      slug: result.data.slug,
      property_type: resolvePropertyType(),
      address_line: addressLine.value.trim() || null,
      city: city.value.trim() || null,
      province: province.value.trim() || null,
      latitude: lat.value,
      longitude: lng.value,
      short_description: shortDescription.value.trim() || null,
      long_description: longDescription.value.trim() || null,
      check_in_time: checkInTime.value.trim() || null,
      check_out_time: checkOutTime.value.trim() || null,
    })
    .eq('id', props.propertyId)
  isSaving.value = false

  if (error) {
    if (error.code === '23505') {
      fieldErrors.value.slug = t('wizard.generalInfo.errors.slugTaken')
    }
    else {
      formError.value = error.message
    }
    return
  }

  wizardStore.markComplete('general-info')
  propertyStore.setProperties(
    propertyStore.properties.map(p => p.id === props.propertyId ? { ...p, name: result.data.name, slug: result.data.slug } : p),
  )
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

  <h1
    v-else-if="notFound"
    class="wizard-step__title"
  >
    {{ t('properties.editStub.notFoundTitle') }}
  </h1>

  <form
    v-else
    class="wizard-form"
    novalidate
    @submit.prevent="onSubmit"
  >
    <h1 class="wizard-step__title">
      {{ t('wizard.generalInfo.title') }}
    </h1>
    <p class="wizard-step__subtitle">
      {{ t('wizard.generalInfo.subtitle') }}
    </p>

    <div class="wizard-form__field">
      <label
        class="wizard-form__label"
        for="gi-name"
      >{{ t('wizard.generalInfo.fields.nameLabel') }}</label>
      <input
        id="gi-name"
        v-model="name"
        type="text"
        class="wizard-form__input"
        :class="{ 'wizard-form__input--invalid': fieldErrors.name }"
      >
      <p
        v-if="fieldErrors.name"
        class="wizard-form__field-error"
      >
        {{ fieldErrors.name }}
      </p>
    </div>

    <div class="wizard-form__field">
      <label
        class="wizard-form__label"
        for="gi-slug"
      >{{ t('wizard.generalInfo.fields.slugLabel') }}</label>
      <input
        id="gi-slug"
        v-model="slug"
        type="text"
        class="wizard-form__input"
        :class="{ 'wizard-form__input--invalid': fieldErrors.slug }"
      >
      <p class="wizard-form__hint">
        {{ t('wizard.generalInfo.fields.slugHint') }}
      </p>
      <p
        v-if="fieldErrors.slug"
        class="wizard-form__field-error"
      >
        {{ fieldErrors.slug }}
      </p>
    </div>

    <div class="wizard-form__field">
      <label
        class="wizard-form__label"
        for="gi-property-type"
      >{{ t('wizard.generalInfo.fields.propertyTypeLabel') }}</label>
      <select
        id="gi-property-type"
        v-model="propertyTypeCode"
        class="wizard-form__input"
      >
        <option value="">
          {{ t('wizard.generalInfo.propertyTypePlaceholder') }}
        </option>
        <option
          v-for="code in PROPERTY_TYPE_CODES"
          :key="code"
          :value="code"
        >
          {{ propertyTypeLabel(code) }}
        </option>
        <option value="other">
          {{ t('wizard.generalInfo.propertyTypeOptions.other') }}
        </option>
      </select>
      <input
        v-if="propertyTypeCode === 'other'"
        v-model="propertyTypeOther"
        type="text"
        class="wizard-form__input wizard-form__input--follow-up"
        :placeholder="t('wizard.generalInfo.fields.propertyTypeOtherPlaceholder')"
      >
    </div>

    <div class="wizard-form__row">
      <div class="wizard-form__field">
        <label
          class="wizard-form__label"
          for="gi-address"
        >{{ t('wizard.generalInfo.fields.addressLabel') }}</label>
        <input
          id="gi-address"
          v-model="addressLine"
          type="text"
          class="wizard-form__input"
        >
      </div>
      <div class="wizard-form__field">
        <label
          class="wizard-form__label"
          for="gi-city"
        >{{ t('wizard.generalInfo.fields.cityLabel') }}</label>
        <input
          id="gi-city"
          v-model="city"
          type="text"
          class="wizard-form__input"
        >
      </div>
      <div class="wizard-form__field">
        <label
          class="wizard-form__label"
          for="gi-province"
        >{{ t('wizard.generalInfo.fields.provinceLabel') }}</label>
        <input
          id="gi-province"
          v-model="province"
          type="text"
          class="wizard-form__input"
        >
      </div>
    </div>

    <div class="wizard-form__row">
      <div class="wizard-form__field">
        <label
          class="wizard-form__label"
          for="gi-latitude"
        >{{ t('wizard.generalInfo.fields.latitudeLabel') }}</label>
        <input
          id="gi-latitude"
          v-model="latitude"
          type="text"
          inputmode="decimal"
          class="wizard-form__input"
          :class="{ 'wizard-form__input--invalid': fieldErrors.latitude }"
        >
        <p
          v-if="fieldErrors.latitude"
          class="wizard-form__field-error"
        >
          {{ fieldErrors.latitude }}
        </p>
      </div>
      <div class="wizard-form__field">
        <label
          class="wizard-form__label"
          for="gi-longitude"
        >{{ t('wizard.generalInfo.fields.longitudeLabel') }}</label>
        <input
          id="gi-longitude"
          v-model="longitude"
          type="text"
          inputmode="decimal"
          class="wizard-form__input"
          :class="{ 'wizard-form__input--invalid': fieldErrors.longitude }"
        >
        <p
          v-if="fieldErrors.longitude"
          class="wizard-form__field-error"
        >
          {{ fieldErrors.longitude }}
        </p>
      </div>
    </div>

    <div class="wizard-form__field">
      <label
        class="wizard-form__label"
        for="gi-short-description"
      >{{ t('wizard.generalInfo.fields.shortDescriptionLabel') }}</label>
      <textarea
        id="gi-short-description"
        v-model="shortDescription"
        rows="2"
        class="wizard-form__textarea"
      />
    </div>

    <div class="wizard-form__field">
      <label
        class="wizard-form__label"
        for="gi-long-description"
      >{{ t('wizard.generalInfo.fields.longDescriptionLabel') }}</label>
      <textarea
        id="gi-long-description"
        v-model="longDescription"
        rows="6"
        class="wizard-form__textarea"
      />
    </div>

    <div class="wizard-form__row">
      <div class="wizard-form__field">
        <label
          class="wizard-form__label"
          for="gi-checkin"
        >{{ t('wizard.generalInfo.fields.checkInLabel') }}</label>
        <input
          id="gi-checkin"
          v-model="checkInTime"
          type="text"
          :placeholder="t('wizard.generalInfo.fields.checkInPlaceholder')"
          class="wizard-form__input"
        >
      </div>
      <div class="wizard-form__field">
        <label
          class="wizard-form__label"
          for="gi-checkout"
        >{{ t('wizard.generalInfo.fields.checkOutLabel') }}</label>
        <input
          id="gi-checkout"
          v-model="checkOutTime"
          type="text"
          :placeholder="t('wizard.generalInfo.fields.checkOutPlaceholder')"
          class="wizard-form__input"
        >
      </div>
    </div>

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
      {{ t('wizard.generalInfo.saved') }}
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
        {{ isSaving ? t('auth.common.loading') : t('wizard.generalInfo.submit') }}
      </button>
    </div>
  </form>
</template>

<style scoped>
/*
  Classi condivise da tutti gli step del wizard: "wizard-step__*" per i
  titoli/stati comuni (loading, titolo, sottotitolo) e "wizard-form__*" per i
  campi. Ogni futuro step (PhotosStep.vue, OccupancyStep.vue, ...) può
  riusare lo stesso set di classi per coerenza visiva, senza duplicare CSS
  strutturale diverso da step a step.
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

.wizard-form__input,
.wizard-form__textarea {
  @apply w-full rounded-md border px-3 py-2 text-base focus:outline-none focus:ring-2;
  border-color: #d1d5db;
  --tw-ring-color: var(--color-primary);
}

.wizard-form__input--follow-up {
  @apply mt-2;
}

.wizard-form__input--invalid,
.wizard-form__textarea--invalid {
  @apply border-red-500;
}

.wizard-form__hint {
  @apply text-xs;
  color: var(--color-muted);
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
