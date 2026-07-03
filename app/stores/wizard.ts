// Stato del wizard multi-step di creazione/modifica property
// (/app/properties/[id]/edit/[step]). Centralizza i dati in bozza e lo stato
// di completezza per step, così il salvataggio parziale e la validazione
// finale per la pubblicazione vivono in un solo posto.
export const WIZARD_STEPS = [
  'general-info',
  'photos',
  'occupancy-spaces',
  'optionals',
  'house-rules',
  'area-guide',
  'ota-links',
  'theme',
  'publish',
] as const

export type WizardStep = typeof WIZARD_STEPS[number]

export const useWizardStore = defineStore('wizard', () => {
  const propertyId = ref<string | null>(null)
  const completedSteps = ref<Set<WizardStep>>(new Set())

  function markComplete(step: WizardStep) {
    completedSteps.value.add(step)
  }

  function isComplete(step: WizardStep) {
    return completedSteps.value.has(step)
  }

  function reset() {
    propertyId.value = null
    completedSteps.value = new Set()
  }

  return { propertyId, completedSteps, markComplete, isComplete, reset }
})
