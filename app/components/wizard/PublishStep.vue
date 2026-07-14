<script setup lang="ts">
// EPIC 11 — Wizard: Pubblicazione (solo US-1101). US-1102 (anteprima del
// mini-sito) è bloccata: dipende dal mini-sito pubblico (EPIC 15), che non
// esiste ancora — vedi docs/backlog.md.
//
// Stato SUSPENDED è di sola lettura qui: la riattivazione è compito
// dell'admin (US-1703, EPIC 17), non dell'owner da questo step.
type PropertyStatus = 'DRAFT' | 'PUBLISHED' | 'SUSPENDED'

interface Requirement {
  key: string
  label: string
  satisfied: boolean
  step: string
}

const props = defineProps<{ propertyId: string }>()

const { t } = useI18n()
const localePath = useLocalePath()
const supabase = useSupabaseClient()
const wizardStore = useWizardStore()

const isLoading = ref(true)
const loadError = ref('')

const status = ref<PropertyStatus>('DRAFT')
const suspensionReason = ref<string | null>(null)
const requirements = ref<Requirement[]>([])

const allSatisfied = computed(() => requirements.value.every(r => r.satisfied))

async function loadStatus() {
  isLoading.value = true
  loadError.value = ''

  const [propertyResult, occupancyResult, photosResult] = await Promise.all([
    supabase
      .from('properties')
      .select('name, slug, address_line, short_description, long_description, status, suspension_reason')
      .eq('id', props.propertyId)
      .single(),
    supabase
      .from('occupancy')
      .select('max_guests')
      .eq('property_id', props.propertyId)
      .maybeSingle(),
    supabase
      .from('photos')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', props.propertyId),
  ])

  isLoading.value = false

  if (propertyResult.error || !propertyResult.data) {
    loadError.value = t('wizard.publish.errors.load')
    return
  }

  const property = propertyResult.data
  status.value = property.status
  suspensionReason.value = property.suspension_reason

  requirements.value = [
    { key: 'name', label: t('wizard.publish.requirements.name'), satisfied: !!property.name?.trim(), step: 'general-info' },
    { key: 'slug', label: t('wizard.publish.requirements.slug'), satisfied: !!property.slug?.trim(), step: 'general-info' },
    { key: 'address', label: t('wizard.publish.requirements.address'), satisfied: !!property.address_line?.trim(), step: 'general-info' },
    {
      key: 'description',
      label: t('wizard.publish.requirements.description'),
      satisfied: !!property.short_description?.trim() || !!property.long_description?.trim(),
      step: 'general-info',
    },
    {
      key: 'maxGuests',
      label: t('wizard.publish.requirements.maxGuests'),
      satisfied: (occupancyResult.data?.max_guests ?? 0) > 0,
      step: 'occupancy-spaces',
    },
    { key: 'photos', label: t('wizard.publish.requirements.photos'), satisfied: (photosResult.count ?? 0) > 0, step: 'photos' },
  ]

  if (status.value === 'PUBLISHED') wizardStore.markComplete('publish')
}

onMounted(loadStatus)

const formError = ref('')
const isPublishing = ref(false)
const isUnpublishing = ref(false)
const publishedJustNow = ref(false)
const unpublishedJustNow = ref(false)

async function publish() {
  formError.value = ''
  isPublishing.value = true

  const { error } = await supabase
    .from('properties')
    .update({ status: 'PUBLISHED' })
    .eq('id', props.propertyId)

  isPublishing.value = false

  if (error) {
    formError.value = t('wizard.publish.errors.publish')
    return
  }

  status.value = 'PUBLISHED'
  wizardStore.markComplete('publish')
  publishedJustNow.value = true
}

async function unpublish() {
  formError.value = ''
  isUnpublishing.value = true

  const { error } = await supabase
    .from('properties')
    .update({ status: 'DRAFT' })
    .eq('id', props.propertyId)

  isUnpublishing.value = false

  if (error) {
    formError.value = t('wizard.publish.errors.unpublish')
    return
  }

  status.value = 'DRAFT'
  unpublishedJustNow.value = true
}
</script>

<template>
  <div class="wizard-step">
    <h1 class="wizard-step__title">
      {{ t('wizard.publish.title') }}
    </h1>
    <p class="wizard-step__subtitle">
      {{ t('wizard.publish.subtitle') }}
    </p>

    <p
      v-if="loadError"
      class="wizard-form__alert"
      role="alert"
    >
      {{ loadError }}
    </p>

    <p
      v-else-if="isLoading"
      class="wizard-step__loading"
    >
      {{ t('auth.common.loading') }}
    </p>

    <template v-else>
      <p class="publish-status">
        {{ t('wizard.publish.status.label') }}:
        <strong>{{ t(`wizard.publish.status.${status}`) }}</strong>
      </p>

      <div
        v-if="status === 'SUSPENDED'"
        class="publish-suspended"
      >
        <p>{{ t('wizard.publish.suspended.message') }}</p>
        <p v-if="suspensionReason">
          <strong>{{ t('wizard.publish.suspended.reasonLabel') }}:</strong> {{ suspensionReason }}
        </p>
        <p class="publish-suspended__note">
          {{ t('wizard.publish.suspended.note') }}
        </p>
      </div>

      <template v-else>
        <h2 class="requirements__title">
          {{ t('wizard.publish.requirements.title') }}
        </h2>
        <ul class="requirements-list">
          <li
            v-for="requirement in requirements"
            :key="requirement.key"
            class="requirement"
            :class="{ 'requirement--satisfied': requirement.satisfied }"
          >
            <span class="requirement__icon">{{ requirement.satisfied ? '✓' : '✗' }}</span>
            <span class="requirement__label">{{ requirement.label }}</span>
            <NuxtLink
              v-if="!requirement.satisfied"
              :to="localePath(`/app/properties/${propertyId}/edit/${requirement.step}`)"
              class="requirement__link"
            >
              {{ t('wizard.publish.requirements.goToStep') }}
            </NuxtLink>
          </li>
        </ul>

        <p
          v-if="formError"
          class="wizard-form__alert"
          role="alert"
        >
          {{ formError }}
        </p>

        <template v-if="status === 'PUBLISHED'">
          <p class="publish-message">
            {{ t('wizard.publish.publishedMessage') }}
          </p>
          <p
            v-if="unpublishedJustNow"
            class="publish-message"
          >
            {{ t('wizard.publish.unpublishedMessage') }}
          </p>
          <button
            type="button"
            class="publish-button publish-button--secondary"
            :disabled="isUnpublishing"
            @click="unpublish"
          >
            {{ isUnpublishing ? t('auth.common.loading') : t('wizard.publish.unpublish') }}
          </button>
        </template>

        <template v-else>
          <p
            v-if="!allSatisfied"
            class="publish-warning"
          >
            {{ t('wizard.publish.missingRequirementsWarning') }}
          </p>
          <p
            v-if="publishedJustNow"
            class="publish-message"
          >
            {{ t('wizard.publish.publishedMessage') }}
          </p>
          <button
            type="button"
            class="publish-button"
            :disabled="!allSatisfied || isPublishing"
            @click="publish"
          >
            {{ isPublishing ? t('auth.common.loading') : t('wizard.publish.publish') }}
          </button>
        </template>
      </template>
    </template>
  </div>
</template>

<style scoped>
/*
  Titolo/sottotitolo/loading condivisi con gli altri step (stessa
  convenzione introdotta in GeneralInfoStep.vue).
*/
.wizard-step__title {
  @apply mt-6 text-2xl font-bold;
  color: var(--color-text);
}

.wizard-step__subtitle {
  @apply mt-1 text-sm;
  color: var(--color-muted);
}

.wizard-step__loading {
  @apply mt-6 text-sm;
  color: var(--color-muted);
}

.wizard-form__alert {
  @apply mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700;
}

.publish-status {
  @apply mt-6 text-sm;
  color: var(--color-text);
}

.publish-suspended {
  @apply mt-4 space-y-2 rounded-md p-4 text-sm;
  background-color: #fef2f2;
  color: #7f1d1d;
}

.publish-suspended__note {
  @apply text-xs;
  color: #991b1b;
}

.requirements__title {
  @apply mt-6 text-lg font-semibold;
  color: var(--color-text);
}

.requirements-list {
  @apply mt-3 space-y-2;
}

.requirement {
  @apply flex items-center gap-3 rounded-md border p-3 text-sm;
  border-color: #e5e7eb;
}

.requirement--satisfied {
  border-color: #d1fae5;
  background-color: #ecfdf5;
}

.requirement__icon {
  @apply font-bold;
  color: #dc2626;
}

.requirement--satisfied .requirement__icon {
  color: #047857;
}

.requirement__label {
  @apply flex-1;
  color: var(--color-text);
}

.requirement__link {
  @apply text-sm font-medium underline underline-offset-2;
  color: var(--color-primary);
}

.publish-warning {
  @apply mt-4 rounded-md px-3 py-2 text-sm;
  background-color: #fffbeb;
  color: #b45309;
}

.publish-message {
  @apply mt-4 rounded-md px-3 py-2 text-sm;
  background-color: #ecfdf5;
  color: #047857;
}

.publish-button {
  @apply mt-4 rounded-md px-4 py-2 font-medium text-white transition-opacity disabled:opacity-50;
  background-color: var(--color-primary);
}

.publish-button--secondary {
  @apply border;
  border-color: #d1d5db;
  background-color: transparent;
  color: var(--color-text);
}
</style>
