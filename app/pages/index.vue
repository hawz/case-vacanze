<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <section class="home-hero">
    <h1 class="home-hero__title">
      {{ t('home.title') }}
    </h1>
    <p class="home-hero__subtitle">
      {{ t('home.subtitle') }}
    </p>
  </section>
</template>

<style scoped>
.home-hero {
  @apply mx-auto max-w-2xl px-4 py-16 text-center;
}

.home-hero__title {
  @apply text-3xl font-bold sm:text-4xl;
  color: var(--color-primary, #0f766e);
}

.home-hero__subtitle {
  @apply mt-4 text-base;
  color: var(--color-muted, #6b7280);
}
</style>
