<script setup lang="ts">
// EPIC 22/US-2204 — feed "Attività recente": nuove richieste, richieste
// accettate, foto caricate (raggruppate per proprietà+giorno), proprietà
// sospese. Puramente presentazionale: gli eventi arrivano già combinati e
// ordinati dal chiamante (app/pages/app/properties/index.vue), che possiede
// le query su più tabelle.
export type ActivityEventType = 'new-request' | 'accepted' | 'photos' | 'suspended'

export interface ActivityEvent {
  type: ActivityEventType
  timestamp: string
  propertyName: string
  photosCount?: number
}

defineProps<{ events: ActivityEvent[] }>()

const { t, locale } = useI18n()

const DOT_COLOR: Record<ActivityEventType, string> = {
  'new-request': 'var(--color-accent)',
  'accepted': 'var(--color-primary)',
  'photos': 'var(--color-muted)',
  'suspended': '#b91c1c',
}

// Il nome della proprietà va in grassetto dentro la frase (AC esplicita),
// ma senza ricorrere a v-html: si interpola un segnaposto univoco e si
// spezza la stringa tradotta attorno ad esso, per poterlo avvolgere in un
// <strong> nel template.
const NAME_TOKEN = '%NAME%'

function eventParts(event: ActivityEvent): { before: string, after: string } {
  let raw: string
  if (event.type === 'new-request') raw = t('properties.dashboard.feed.newRequest', { name: NAME_TOKEN })
  else if (event.type === 'accepted') raw = t('properties.dashboard.feed.accepted', { name: NAME_TOKEN })
  else if (event.type === 'suspended') raw = t('properties.dashboard.feed.suspended', { name: NAME_TOKEN })
  else {
    const count = event.photosCount ?? 1
    raw = count === 1
      ? t('properties.dashboard.feed.photosOne', { name: NAME_TOKEN })
      : t('properties.dashboard.feed.photosMany', { name: NAME_TOKEN, count })
  }
  const [before, after] = raw.split(NAME_TOKEN)
  return { before, after: after ?? '' }
}
</script>

<template>
  <div class="dashboard-card">
    <div class="dashboard-card__title">
      {{ t('properties.dashboard.feed.title') }}
    </div>

    <p
      v-if="events.length === 0"
      class="dashboard-card__empty"
    >
      {{ t('properties.dashboard.feed.empty') }}
    </p>

    <ul
      v-else
      class="activity-feed"
    >
      <li
        v-for="(event, index) in events"
        :key="index"
        class="activity-feed__item"
      >
        <span
          class="activity-feed__dot"
          :style="{ backgroundColor: DOT_COLOR[event.type] }"
        />
        <span class="activity-feed__text">
          {{ eventParts(event).before }}<strong>{{ event.propertyName }}</strong>{{ eventParts(event).after }}
          <br>
          <span class="activity-feed__time">{{ formatRelativeTime(event.timestamp, locale) }}</span>
        </span>
      </li>
    </ul>
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
  @apply mb-1 text-sm font-semibold;
  color: var(--color-text);
}

.dashboard-card__empty {
  @apply py-6 text-center text-sm;
  color: var(--color-muted);
}

.activity-feed__item {
  @apply flex gap-2.5 border-b py-2.5 text-sm last:border-b-0;
  border-color: #e5e7eb;
  color: var(--color-text);
}

.activity-feed__dot {
  @apply mt-1.5 h-2 w-2 shrink-0 rounded-full;
}

.activity-feed__time {
  @apply text-xs;
  color: var(--color-muted);
}
</style>
