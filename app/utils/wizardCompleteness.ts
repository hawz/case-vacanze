// EPIC 22/US-2205 — completezza del wizard (9 step) per ogni proprietà nella
// dashboard, non solo per quella aperta al momento nel wizard.
//
// `wizardStore.completedSteps` (app/stores/wizard.ts) non basta: esiste solo
// per la proprietà che si sta modificando in quel momento, non per tutte
// quelle elencate in dashboard — quindi qui si ricalcola la completezza
// direttamente dai dati salvati, senza passare dallo store.
//
// Approssimazione consapevole: nel wizard vero, gli step "a lista libera"
// senza requisito minimo (optionals, house-rules, area-guide, ota-links —
// vedi backlog EPIC 6-9) si marcano completi già alla prima apertura riuscita
// dello step, anche con lista vuota. Da qui (senza dati su "quali step ha
// aperto l'owner") non è possibile distinguere "mai aperto" da "aperto ma
// lasciato vuoto di proposito": si considera completo solo se c'è almeno una
// riga salvata. Il numero può quindi risultare leggermente più basso di
// quello che l'owner vedrebbe riaprendo il wizard — accettato come
// approssimazione ragionevole per una vista d'insieme, non un requisito di
// pubblicazione (quello resta la checklist di PublishStep.vue/US-1101).
export interface WizardCompletenessInput {
  addressLine: string | null
  shortDescription: string | null
  longDescription: string | null
  occupancyMaxGuests: number | null
  photosCount: number
  optionalsCount: number
  houseRulesCount: number
  otaLinksCount: number
  areaGuideContent: string | null
  status: string
}

export const WIZARD_STEP_COUNT = 9

export function computeWizardCompleteness(input: WizardCompletenessInput): number {
  const hasDescription = Boolean(input.shortDescription?.trim() || input.longDescription?.trim())

  const stepsComplete = [
    // general-info: nome/slug esistono sempre (colonne NOT NULL), quindi il
    // segnale utile per "step compilato per davvero" è indirizzo + descrizione.
    Boolean(input.addressLine?.trim()) && hasDescription,
    // photos
    input.photosCount > 0,
    // occupancy-spaces
    Boolean(input.occupancyMaxGuests && input.occupancyMaxGuests > 0),
    // optionals
    input.optionalsCount > 0,
    // house-rules
    input.houseRulesCount > 0,
    // area-guide (basta il testo guida; i POI sono un di più, non richiesti)
    Boolean(input.areaGuideContent?.trim()),
    // ota-links
    input.otaLinksCount > 0,
    // theme: ha sempre un default valido (properties.theme_id NOT NULL con
    // default), quindi è sempre considerato completo per questa metrica.
    true,
    // publish: è stata pubblicata almeno una volta (anche se ora sospesa)
    input.status !== 'DRAFT',
  ]

  return stepsComplete.filter(Boolean).length
}
