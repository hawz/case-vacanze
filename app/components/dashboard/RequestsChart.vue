<script setup lang="ts">
// EPIC 22/US-2203 — grafico a barre "Richieste di disponibilità" (ultimi 6
// mesi), CSS puro (altezza proporzionale al conteggio massimo), nessuna
// libreria grafici esterna. Puramente presentazionale: il raggruppamento
// per mese avviene lato chiamante (app/pages/app/properties/index.vue).
export interface RequestsChartMonth {
  label: string
  count: number
  isCurrent: boolean
}

const props = defineProps<{ months: RequestsChartMonth[] }>()

const { t } = useI18n()

const maxCount = computed(() => Math.max(...props.months.map(m => m.count), 1))
const hasData = computed(() => props.months.some(m => m.count > 0))

function barHeight(count: number) {
  // Altezza minima visibile (4px) anche per 0, così la colonna resta
  // leggibile invece di sparire del tutto.
  return `${Math.max((count / maxCount.value) * 100, count > 0 ? 6 : 2)}%`
}
</script>

<template>
  <div class="dashboard-card">
    <div class="dashboard-card__title">
      {{ t('properties.dashboard.charts.requestsTitle') }}
      <small>{{ t('properties.dashboard.charts.requestsSubtitle') }}</small>
    </div>

    <p
      v-if="!hasData"
      class="dashboard-card__empty"
    >
      {{ t('properties.dashboard.charts.requestsEmpty') }}
    </p>

    <div
      v-else
      class="requests-chart"
    >
      <div
        v-for="month in months"
        :key="month.label"
        class="requests-chart__col"
      >
        <span class="requests-chart__count">{{ month.count }}</span>
        <div
          class="requests-chart__bar"
          :class="{ 'requests-chart__bar--current': month.isCurrent }"
          :style="{ height: barHeight(month.count) }"
        />
        <span class="requests-chart__label">{{ month.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-card {
  @apply border p-4;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
  border-radius: 10px;
}

.dashboard-card__title {
  @apply mb-3 flex items-baseline gap-2 text-sm font-semibold;
  color: var(--color-text);
}

.dashboard-card__title small {
  @apply text-xs font-medium;
  color: var(--color-muted);
}

.dashboard-card__empty {
  @apply py-6 text-center text-sm;
  color: var(--color-muted);
}

.requests-chart {
  @apply flex items-end gap-2;
  height: 110px;
  padding-top: 8px;
}

.requests-chart__col {
  @apply flex flex-1 flex-col items-center justify-end gap-1.5;
  height: 100%;
}

.requests-chart__count {
  @apply text-xs font-semibold;
  color: var(--color-text);
}

.requests-chart__bar {
  @apply w-full max-w-[26px];
  background-color: var(--color-primary);
  border-radius: 5px 5px 0 0;
}

.requests-chart__bar--current {
  background-color: var(--color-accent);
}

.requests-chart__label {
  @apply text-[10.5px];
  color: var(--color-muted);
}
</style>
