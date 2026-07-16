<script setup lang="ts">
// EPIC 14 — Backoffice: Gestione richieste di disponibilità. Stessa
// struttura di calendar.vue/announcements.vue: shell sottile, logica in
// AvailabilityRequestsList.vue.
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

definePageMeta({ layout: 'app' })

const propertyId = route.params.id as string
</script>

<template>
  <section class="requests-page">
    <h1 class="requests-page__title">
      {{ t('requests.title') }}
    </h1>
    <p class="requests-page__subtitle">
      {{ t('requests.subtitle') }}
    </p>

    <AvailabilityRequestsList :property-id="propertyId" />

    <NuxtLink
      :to="localePath('/app/properties')"
      class="requests-page__back"
    >
      {{ t('requests.backLink') }}
    </NuxtLink>
  </section>
</template>

<style scoped>
.requests-page {
  @apply mx-auto max-w-3xl px-4 py-8;
}

.requests-page__title {
  @apply mt-6 text-2xl font-bold;
  color: var(--color-text);
}

.requests-page__subtitle {
  @apply mt-1 text-sm;
  color: var(--color-muted);
}

.requests-page__back {
  @apply mt-8 inline-block text-sm font-medium underline underline-offset-2;
  color: var(--color-primary);
}
</style>
