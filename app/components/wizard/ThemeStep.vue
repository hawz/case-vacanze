<script setup lang="ts">
// EPIC 10 — Wizard: Tema del mini-sito (US-1001). Griglia di temi da
// `config/themes.ts` (già scaffoldato con 3 temi: default/sunset/ocean),
// con anteprima statica delle palette colori — l'AC lascia esplicitamente
// aperta la scelta tra anteprima live e statica ("se tecnicamente
// fattibile"), e un'anteprima live non è comunque possibile finché il
// mini-sito pubblico (EPIC 15/US-1002) non esiste. Aggiornamento di
// `properties.theme_id` con "Salva" esplicito, come tutti gli altri step
// (nessun auto-save al click sulla card).
import { themes } from '~~/config/themes'

const props = defineProps<{ propertyId: string }>()

const { t } = useI18n()
const supabase = useSupabaseClient()
const wizardStore = useWizardStore()

const isLoading = ref(true)
const loadError = ref('')

const selectedThemeId = ref('default')
const formError = ref('')
const isSaving = ref(false)
const isSaved = ref(false)

async function loadTheme() {
  isLoading.value = true
  loadError.value = ''

  const { data, error } = await supabase
    .from('properties')
    .select('theme_id')
    .eq('id', props.propertyId)
    .single()

  isLoading.value = false

  if (error || !data) {
    loadError.value = t('wizard.theme.errors.load')
    return
  }

  selectedThemeId.value = data.theme_id
}

onMounted(loadTheme)

async function saveTheme() {
  formError.value = ''
  isSaving.value = true

  const { error } = await supabase
    .from('properties')
    .update({ theme_id: selectedThemeId.value })
    .eq('id', props.propertyId)

  isSaving.value = false

  if (error) {
    formError.value = t('wizard.theme.errors.save')
    return
  }

  wizardStore.markComplete('theme')
  isSaved.value = true
}
</script>

<template>
  <div class="wizard-step">
    <h1 class="wizard-step__title">
      {{ t('wizard.theme.title') }}
    </h1>
    <p class="wizard-step__subtitle">
      {{ t('wizard.theme.subtitle') }}
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
      <ul class="themes-grid">
        <li
          v-for="theme in themes"
          :key="theme.id"
          class="theme-card"
          :class="{ 'theme-card--selected': selectedThemeId === theme.id }"
        >
          <button
            type="button"
            class="theme-card__button"
            @click="selectedThemeId = theme.id"
          >
            <span
              class="theme-card__swatches"
              :style="{ backgroundColor: theme.colors.background }"
            >
              <span
                class="theme-card__swatch"
                :style="{ backgroundColor: theme.colors.primary }"
              />
              <span
                class="theme-card__swatch"
                :style="{ backgroundColor: theme.colors.accent }"
              />
              <span
                class="theme-card__swatch"
                :style="{ backgroundColor: theme.colors.surface }"
              />
              <span
                class="theme-card__swatch"
                :style="{ backgroundColor: theme.colors.text }"
              />
            </span>
            <span class="theme-card__label">{{ theme.label }}</span>
            <span
              v-if="selectedThemeId === theme.id"
              class="theme-card__badge"
            >
              {{ t('wizard.theme.selectedBadge') }}
            </span>
            <span
              v-else
              class="theme-card__select"
            >
              {{ t('wizard.theme.select') }}
            </span>
          </button>
        </li>
      </ul>

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
        {{ t('wizard.theme.saved') }}
      </p>

      <button
        type="button"
        class="theme-save"
        :disabled="isSaving"
        @click="saveTheme"
      >
        {{ isSaving ? t('auth.common.loading') : t('wizard.theme.save') }}
      </button>
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

.wizard-form__message {
  @apply mt-4 rounded-md px-3 py-2 text-sm;
  background-color: #ecfdf5;
  color: #047857;
}

.themes-grid {
  @apply mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3;
}

.theme-card {
  @apply rounded-md border-2;
  border-color: #e5e7eb;
}

.theme-card--selected {
  border-color: var(--color-primary);
}

.theme-card__button {
  @apply flex w-full flex-col items-start gap-3 rounded-md p-3 text-left;
  background-color: var(--color-surface);
}

.theme-card__swatches {
  @apply flex w-full items-center gap-2 rounded-md border p-3;
  border-color: #e5e7eb;
}

.theme-card__swatch {
  @apply h-8 w-8 rounded-full border;
  border-color: rgb(0 0 0 / 10%);
}

.theme-card__label {
  @apply font-medium;
  color: var(--color-text);
}

.theme-card__badge {
  @apply rounded-full px-2 py-0.5 text-xs font-medium;
  background-color: #d1fae5;
  color: #047857;
}

.theme-card__select {
  @apply text-xs font-medium underline underline-offset-2;
  color: var(--color-primary);
}

.theme-save {
  @apply mt-6 rounded-md px-4 py-2 font-medium text-white transition-opacity disabled:opacity-50;
  background-color: var(--color-primary);
}
</style>
