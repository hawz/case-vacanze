<script setup lang="ts">
// EPIC 12 — Backoffice: Calendario disponibilità. Prima pagina fuori dal
// wizard (niente edit/[step].vue, niente WIZARD_STEPS): shell sottile che
// delega tutta la logica a BlockedDatesCalendar.vue, stesso principio delle
// pagine del wizard.
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

definePageMeta({ layout: 'app' })

const propertyId = route.params.id as string
</script>

<template>
  <section class="calendar-page">
    <h1 class="calendar-page__title">
      {{ t('calendar.title') }}
    </h1>
    <p class="calendar-page__subtitle">
      {{ t('calendar.subtitle') }}
    </p>

    <BlockedDatesCalendar :property-id="propertyId" />

    <NuxtLink
      :to="localePath('/app/properties')"
      class="calendar-page__back"
    >
      {{ t('calendar.backLink') }}
    </NuxtLink>
  </section>
</template>

<style scoped>
.calendar-page {
  @apply mx-auto max-w-3xl px-4 py-8;
}

.calendar-page__title {
  @apply mt-6 text-2xl font-bold;
  color: var(--color-text);
}

.calendar-page__subtitle {
  @apply mt-1 text-sm;
  color: var(--color-muted);
}

.calendar-page__back {
  @apply mt-8 inline-block text-sm font-medium underline underline-offset-2;
  color: var(--color-primary);
}
</style>
