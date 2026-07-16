<script setup lang="ts">
// EPIC 15 — Mini-sito pubblico: annunci attivi (US-1303). Il filtro per
// finestra di visibilità (visible_from/visible_to vs now()) è già stato
// applicato dal chiamante (app/pages/[slug].vue): qui solo la resa visiva,
// differenziata per type come richiesto dall'AC.
interface Announcement {
  id: string
  title: string
  body: string
  type: 'INFO' | 'WARNING' | 'URGENT'
}

defineProps<{ announcements: Announcement[] }>()

const { t } = useI18n()
</script>

<template>
  <section
    v-if="announcements.length > 0"
    class="minisite-section"
  >
    <h2 class="minisite-section__title">
      {{ t('minisite.announcements.title') }}
    </h2>
    <ul class="minisite-announcements">
      <li
        v-for="announcement in announcements"
        :key="announcement.id"
        class="minisite-announcement"
        :class="`minisite-announcement--${announcement.type.toLowerCase()}`"
      >
        <p class="minisite-announcement__title">
          {{ announcement.title }}
        </p>
        <p class="minisite-announcement__body">
          {{ announcement.body }}
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

.minisite-announcements {
  @apply mt-3 space-y-3;
}

.minisite-announcement {
  @apply rounded-md border-l-4 p-3;
  border-color: #9ca3af;
  background-color: var(--color-surface);
}

.minisite-announcement--warning {
  border-color: #f59e0b;
  background-color: #fffbeb;
}

.minisite-announcement--urgent {
  border-color: #dc2626;
  background-color: #fef2f2;
}

.minisite-announcement__title {
  @apply font-medium;
  color: var(--color-text);
}

.minisite-announcement__body {
  @apply mt-1 text-sm;
  color: var(--color-muted);
}
</style>
