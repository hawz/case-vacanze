<script setup lang="ts">
// EPIC 20 — Home page (US-2002). Sezione "perché siamo diversi": il punto
// centrale richiesto da Albe è che qui il controllo resta al proprietario,
// a differenza dei gestionali pensati per agenzie/mandatari.
const { t } = useI18n()

const ITEMS = ['control', 'ownSite', 'noLockIn'] as const
</script>

<template>
  <section class="value-props">
    <div class="value-props__header">
      <h2 class="value-props__title">
        {{ t('home.valueProps.title') }}
      </h2>
      <p class="value-props__subtitle">
        {{ t('home.valueProps.subtitle') }}
      </p>
    </div>

    <div class="value-props__grid">
      <div
        v-for="item in ITEMS"
        :key="item"
        class="value-props__card"
      >
        <span class="value-props__mark" />
        <h3 class="value-props__card-title">
          {{ t(`home.valueProps.${item}.title`) }}
        </h3>
        <p class="value-props__card-description">
          {{ t(`home.valueProps.${item}.description`) }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.value-props {
  @apply mx-auto max-w-6xl px-4 py-16;
}

.value-props__header {
  @apply mx-auto max-w-2xl text-center;
}

.value-props__title {
  @apply text-3xl font-bold;
  color: var(--color-text);
}

.value-props__subtitle {
  @apply mt-3 text-base leading-relaxed;
  color: var(--color-muted);
}

.value-props__grid {
  @apply mt-12 grid gap-6 sm:grid-cols-3;
}

.value-props__card {
  @apply rounded-2xl border p-6;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
}

.value-props__mark {
  @apply block h-10 w-10 rounded-full;
  background-color: var(--color-primary);
}

.value-props__card-title {
  @apply mt-4 text-lg font-semibold;
  color: var(--color-text);
}

.value-props__card-description {
  @apply mt-2 text-sm leading-relaxed;
  color: var(--color-muted);
}
</style>
