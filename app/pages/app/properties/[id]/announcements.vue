<script setup lang="ts">
// EPIC 13 — Backoffice: Comunicazioni. Stessa struttura di calendar.vue:
// shell sottile, tutta la logica in AnnouncementsList.vue.
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

definePageMeta({ layout: 'app' })

const propertyId = route.params.id as string
</script>

<template>
  <section class="announcements-page">
    <h1 class="announcements-page__title">
      {{ t('announcements.title') }}
    </h1>
    <p class="announcements-page__subtitle">
      {{ t('announcements.subtitle') }}
    </p>

    <AnnouncementsList :property-id="propertyId" />

    <NuxtLink
      :to="localePath('/app/properties')"
      class="announcements-page__back"
    >
      {{ t('announcements.backLink') }}
    </NuxtLink>
  </section>
</template>

<style scoped>
.announcements-page {
  @apply mx-auto max-w-3xl px-4 py-8;
}

.announcements-page__title {
  @apply mt-6 text-2xl font-bold;
  color: var(--color-text);
}

.announcements-page__subtitle {
  @apply mt-1 text-sm;
  color: var(--color-muted);
}

.announcements-page__back {
  @apply mt-8 inline-block text-sm font-medium underline underline-offset-2;
  color: var(--color-primary);
}
</style>
