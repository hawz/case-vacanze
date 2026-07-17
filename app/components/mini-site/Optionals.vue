<script setup lang="ts">
// EPIC 15 — Mini-sito pubblico: elenco optional (parte di US-1501).
interface Optional {
  id: string
  name: string
  description: string | null
  price: number | null
  unit: string | null
}

defineProps<{ optionals: Optional[] }>()

const { t, locale } = useI18n()

// Niente numberFormats configurato in nuxt.config.ts (come per d()/datetimeFormats,
// vedi AvailabilityRequestsList.vue): si formatta a mano con Intl.
function formatPrice(price: number) {
  return new Intl.NumberFormat(locale.value, { style: 'currency', currency: 'EUR' }).format(price)
}
</script>

<template>
  <section
    v-if="optionals.length > 0"
    class="minisite-section"
  >
    <h2 class="minisite-section__title">
      {{ t('minisite.optionals.title') }}
    </h2>
    <ul class="minisite-optionals">
      <li
        v-for="optional in optionals"
        :key="optional.id"
        class="minisite-optional"
      >
        <div class="minisite-optional__header">
          <span class="minisite-optional__name">{{ optional.name }}</span>
          <span class="minisite-optional__price">
            {{ optional.price != null ? formatPrice(optional.price) : t('minisite.optionals.included') }}
            <template v-if="optional.price != null && optional.unit"> · {{ optional.unit }}</template>
          </span>
        </div>
        <p
          v-if="optional.description"
          class="minisite-optional__description"
        >
          {{ optional.description }}
        </p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.minisite-section {
  @apply mt-8;
}

.minisite-section__title {
  @apply text-lg font-semibold;
  color: var(--color-text);
}

.minisite-optionals {
  @apply mt-3 space-y-3;
}

.minisite-optional {
  @apply rounded-md border p-3;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
}

.minisite-optional__header {
  @apply flex flex-wrap items-baseline justify-between gap-2;
}

.minisite-optional__name {
  @apply font-medium;
  color: var(--color-text);
}

.minisite-optional__price {
  @apply text-sm font-medium;
  color: var(--color-primary);
}

.minisite-optional__description {
  @apply mt-1 text-sm;
  color: var(--color-muted);
}
</style>
