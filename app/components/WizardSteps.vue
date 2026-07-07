<script setup lang="ts">
import { IMPLEMENTED_STEPS, WIZARD_STEPS, type WizardStep } from '~/stores/wizard'

// Barra di navigazione del wizard, condivisa da tutti gli step (Epic 3-11).
// Solo gli step in IMPLEMENTED_STEPS sono link cliccabili; gli altri sono
// mostrati (per dare il quadro d'insieme delle 9 sezioni) ma disabilitati
// con un badge "Prossimamente", finché non costruiamo le rispettive epiche.
const props = defineProps<{
  propertyId: string
  currentStep: WizardStep
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const wizardStore = useWizardStore()

function isImplemented(step: WizardStep) {
  return IMPLEMENTED_STEPS.includes(step)
}

function stepHref(step: WizardStep) {
  return localePath(`/app/properties/${props.propertyId}/edit/${step}`)
}
</script>

<template>
  <nav
    class="wizard-steps"
    :aria-label="t('wizard.nav.label')"
  >
    <ol class="wizard-steps__list">
      <li
        v-for="step in WIZARD_STEPS"
        :key="step"
        class="wizard-steps__item"
      >
        <NuxtLink
          v-if="isImplemented(step)"
          :to="stepHref(step)"
          class="wizard-steps__link"
          :class="{ 'wizard-steps__link--current': step === currentStep }"
        >
          <span
            v-if="wizardStore.isComplete(step)"
            class="wizard-steps__check"
            aria-hidden="true"
          >✓</span>
          {{ t(`wizard.steps.${step}`) }}
        </NuxtLink>
        <span
          v-else
          class="wizard-steps__link wizard-steps__link--disabled"
        >
          {{ t(`wizard.steps.${step}`) }}
          <span class="wizard-steps__soon">{{ t('wizard.nav.comingSoon') }}</span>
        </span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.wizard-steps {
  @apply -mx-4 overflow-x-auto px-4 pb-2;
}

.wizard-steps__list {
  @apply flex gap-2 whitespace-nowrap;
}

.wizard-steps__item {
  @apply flex-none;
}

.wizard-steps__link {
  @apply inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium;
  border-color: #d1d5db;
  color: var(--color-text);
}

.wizard-steps__link--current {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.wizard-steps__link--disabled {
  @apply cursor-not-allowed opacity-50;
}

.wizard-steps__check {
  color: var(--color-primary);
}

.wizard-steps__soon {
  @apply text-xs;
  color: var(--color-muted);
}
</style>
