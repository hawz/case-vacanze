<script setup lang="ts">
import { WIZARD_STEPS, type WizardStep } from '~/stores/wizard'

// Guscio di routing tra gli step del wizard: mostra la barra di navigazione
// (WizardSteps.vue) e delega il contenuto vero e proprio al componente
// dedicato dello step corrente (uno per file sotto app/components/wizard/,
// es. WizardGeneralInfoStep.vue). Aggiungere un nuovo step in futuro
// significa: creare il componente, aggiungere un ramo v-else-if qui sotto,
// e aggiungerlo a IMPLEMENTED_STEPS in stores/wizard.ts — senza toccare gli
// step già esistenti.
const { t } = useI18n()
const route = useRoute()

definePageMeta({ layout: 'app' })

const propertyId = route.params.id as string
const stepParam = route.params.step as string
const isKnownStep = (WIZARD_STEPS as readonly string[]).includes(stepParam)
const currentStep = stepParam as WizardStep
</script>

<template>
  <section class="wizard-page">
    <WizardSteps
      v-if="isKnownStep"
      :property-id="propertyId"
      :current-step="currentStep"
    />

    <h1
      v-if="!isKnownStep"
      class="wizard-page__title"
    >
      {{ t('properties.editStub.notFoundTitle') }}
    </h1>

    <WizardGeneralInfoStep
      v-else-if="currentStep === 'general-info'"
      :property-id="propertyId"
    />

    <WizardPhotosStep
      v-else-if="currentStep === 'photos'"
      :property-id="propertyId"
    />

    <WizardOccupancySpacesStep
      v-else-if="currentStep === 'occupancy-spaces'"
      :property-id="propertyId"
    />

    <WizardOptionalsStep
      v-else-if="currentStep === 'optionals'"
      :property-id="propertyId"
    />

    <WizardHouseRulesStep
      v-else-if="currentStep === 'house-rules'"
      :property-id="propertyId"
    />

    <WizardAreaGuideStep
      v-else-if="currentStep === 'area-guide'"
      :property-id="propertyId"
    />

    <WizardOtaLinksStep
      v-else-if="currentStep === 'ota-links'"
      :property-id="propertyId"
    />

    <WizardThemeStep
      v-else-if="currentStep === 'theme'"
      :property-id="propertyId"
    />

    <WizardPublishStep
      v-else-if="currentStep === 'publish'"
      :property-id="propertyId"
    />

    <div
      v-else
      class="wizard-page__soon"
    >
      <p class="wizard-page__soon-text">
        {{ t('wizard.nav.comingSoonMessage') }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.wizard-page {
  @apply mx-auto max-w-2xl px-4 py-8;
}

.wizard-page__title {
  @apply mt-6 text-2xl font-bold;
  color: var(--color-text);
}

.wizard-page__soon {
  @apply mt-6 rounded-md border border-dashed p-8 text-center;
  border-color: #d1d5db;
}

.wizard-page__soon-text {
  color: var(--color-muted);
}
</style>
