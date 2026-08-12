<script setup lang="ts">
// EPIC 22/US-2202 — barra di 4 KPI in cima alla dashboard proprietario
// (proposta A+, approvata da Albe il 2026-08-12). Puramente presentazionale:
// i dati sono calcolati in app/pages/app/properties/index.vue, che possiede
// tutte le query.
export interface DashboardKpiNextArrival {
  date: string
  propertyName: string
}

defineProps<{
  publishedCount: number
  totalCount: number
  newRequestsCount: number
  draftCount: number
  nextArrival: DashboardKpiNextArrival | null
}>()

const { t, locale } = useI18n()

function formatShortDate(isoDate: string) {
  return new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }).format(new Date(isoDate))
}
</script>

<template>
  <div class="dashboard-kpi-bar">
    <div class="dashboard-kpi">
      <span class="dashboard-kpi__label">{{ t('properties.dashboard.kpi.published') }}</span>
      <span class="dashboard-kpi__value">{{ publishedCount }}</span>
      <span class="dashboard-kpi__delta dashboard-kpi__delta--positive">
        {{ t('properties.dashboard.kpi.publishedDelta', { total: totalCount }) }}
      </span>
    </div>

    <div class="dashboard-kpi">
      <span class="dashboard-kpi__label">{{ t('properties.dashboard.kpi.newRequests') }}</span>
      <span class="dashboard-kpi__value">{{ newRequestsCount }}</span>
      <span
        class="dashboard-kpi__delta"
        :class="newRequestsCount > 0 ? 'dashboard-kpi__delta--warn' : ''"
      >
        {{ newRequestsCount > 0 ? t('properties.dashboard.kpi.newRequestsDeltaPending') : t('properties.dashboard.kpi.newRequestsDeltaNone') }}
      </span>
    </div>

    <div class="dashboard-kpi">
      <span class="dashboard-kpi__label">{{ t('properties.dashboard.kpi.drafts') }}</span>
      <span class="dashboard-kpi__value">{{ draftCount }}</span>
      <span class="dashboard-kpi__delta">{{ t('properties.dashboard.kpi.draftsDelta') }}</span>
    </div>

    <div class="dashboard-kpi">
      <span class="dashboard-kpi__label">{{ t('properties.dashboard.kpi.nextArrival') }}</span>
      <span
        v-if="nextArrival"
        class="dashboard-kpi__value dashboard-kpi__value--small"
      >{{ formatShortDate(nextArrival.date) }}</span>
      <span
        v-else
        class="dashboard-kpi__value dashboard-kpi__value--small"
      >{{ t('properties.dashboard.kpi.nextArrivalNone') }}</span>
      <span
        v-if="nextArrival"
        class="dashboard-kpi__delta"
      >{{ nextArrival.propertyName }}</span>
    </div>
  </div>
</template>

<style scoped>
.dashboard-kpi-bar {
  @apply grid grid-cols-2 gap-3 sm:grid-cols-4;
}

.dashboard-kpi {
  /* 10px come le altre card della dashboard (RequestsChart/StatusDonut/
     ActivityFeed/elenco proprietà), non il rounded-md/6px usato altrove nel
     backoffice — coerenza con il mockup approvato (docs/epic-22-mockup.html). */
  @apply flex flex-col gap-1 border p-4;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
  border-radius: 10px;
}

.dashboard-kpi__label {
  @apply text-xs font-semibold uppercase tracking-wide;
  color: var(--color-muted);
}

.dashboard-kpi__value {
  @apply text-2xl font-bold;
  color: var(--color-text);
}

.dashboard-kpi__value--small {
  @apply text-lg;
}

.dashboard-kpi__delta {
  @apply text-xs font-medium;
  color: var(--color-muted);
}

.dashboard-kpi__delta--positive {
  color: #1f7a4d;
}

.dashboard-kpi__delta--warn {
  color: #b45309;
}
</style>
