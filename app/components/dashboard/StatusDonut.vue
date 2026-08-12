<script setup lang="ts">
// EPIC 22/US-2203 — donut "Proprietà per stato", CSS puro (conic-gradient),
// stesse 3 categorie della barra KPI/dell'elenco proprietà. Il colore del
// segmento "Sospese" è un grigio neutro dedicato (non il rosso semantico
// usato per il badge di stato): qui è un'aggregazione statistica, non un
// avviso — scelta già validata nel mockup approvato (docs/epic-22-mockup.html).
const props = defineProps<{ published: number, draft: number, suspended: number }>()

const { t } = useI18n()

const total = computed(() => props.published + props.draft + props.suspended)

const gradient = computed(() => {
  if (total.value === 0) return 'none'
  const publishedPct = (props.published / total.value) * 100
  const draftPct = (props.draft / total.value) * 100
  return `conic-gradient(var(--color-primary) 0 ${publishedPct}%, var(--color-accent) ${publishedPct}% ${publishedPct + draftPct}%, #cbd5c9 ${publishedPct + draftPct}% 100%)`
})
</script>

<template>
  <div class="dashboard-card">
    <div class="dashboard-card__title">
      {{ t('properties.dashboard.charts.statusTitle') }}
    </div>

    <p
      v-if="total === 0"
      class="dashboard-card__empty"
    >
      {{ t('properties.dashboard.charts.statusEmpty') }}
    </p>

    <template v-else>
      <div
        class="status-donut"
        :style="{ background: gradient }"
      />
      <ul class="status-donut__legend">
        <li>
          <span
            class="status-donut__dot"
            style="background-color: var(--color-primary);"
          />
          {{ t('properties.status.published') }} — {{ published }}
        </li>
        <li>
          <span
            class="status-donut__dot"
            style="background-color: var(--color-accent);"
          />
          {{ t('properties.status.draft') }} — {{ draft }}
        </li>
        <li>
          <span
            class="status-donut__dot"
            style="background-color: #cbd5c9;"
          />
          {{ t('properties.status.suspended') }} — {{ suspended }}
        </li>
      </ul>
    </template>
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
  @apply mb-3 text-sm font-semibold;
  color: var(--color-text);
}

.dashboard-card__empty {
  @apply py-6 text-center text-sm;
  color: var(--color-muted);
}

.status-donut {
  @apply relative mx-auto rounded-full;
  width: 108px;
  height: 108px;
}

.status-donut::after {
  content: '';
  @apply absolute rounded-full;
  width: 62px;
  height: 62px;
  top: 23px;
  left: 23px;
  background-color: var(--color-surface);
}

.status-donut__legend {
  @apply mt-3 flex flex-col gap-1.5 text-xs;
  color: var(--color-text);
}

.status-donut__dot {
  @apply mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle;
}
</style>
