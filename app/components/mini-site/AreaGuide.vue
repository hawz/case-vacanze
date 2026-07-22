<script setup lang="ts">
// EPIC 15 — Mini-sito pubblico: guida alla zona + punti di interesse
// (parte di US-1501).
type PoiCategory = 'RESTAURANT' | 'BEACH' | 'ATTRACTION' | 'SHOP' | 'TRANSPORT' | 'OTHER'

interface PointOfInterest {
  id: string
  name: string
  category: PoiCategory
  distance: string | null
  description: string | null
  external_url: string | null
}

const props = defineProps<{ content: string | null, pois: PointOfInterest[] }>()

const { t } = useI18n()

function categoryLabel(category: string) {
  return t(`minisite.areaGuide.categories.${category}`)
}

const hasContent = computed(() => !!props.content?.trim() || props.pois.length > 0)
</script>

<template>
  <section
    v-if="hasContent"
    class="minisite-section"
  >
    <h2 class="minisite-section__title">
      {{ t('minisite.areaGuide.title') }}
    </h2>

    <p
      v-if="content"
      class="minisite-area-guide__content"
    >
      {{ content }}
    </p>

    <template v-if="pois.length > 0">
      <h3 class="minisite-area-guide__pois-title">
        {{ t('minisite.areaGuide.poisTitle') }}
      </h3>
      <ul class="minisite-pois">
        <li
          v-for="poi in pois"
          :key="poi.id"
          class="minisite-poi"
        >
          <div class="minisite-poi__header">
            <span class="minisite-poi__name">{{ poi.name }}</span>
            <span class="minisite-poi__category">{{ categoryLabel(poi.category) }}</span>
          </div>
          <p
            v-if="poi.distance"
            class="minisite-poi__distance"
          >
            {{ poi.distance }}
          </p>
          <p
            v-if="poi.description"
            class="minisite-poi__description"
          >
            {{ poi.description }}
          </p>
          <a
            v-if="poi.external_url"
            :href="poi.external_url"
            target="_blank"
            rel="noopener noreferrer"
            class="minisite-poi__link"
          >
            {{ poi.external_url }}
          </a>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.minisite-section {
  @apply mt-8;
}

.minisite-section__title {
  @apply text-lg;
  font-family: var(--font-family-display);
  font-weight: var(--font-display-weight, 700);
  color: var(--color-text);
}

.minisite-area-guide__content {
  @apply mt-3 whitespace-pre-line text-sm;
  color: var(--color-text);
}

.minisite-area-guide__pois-title {
  @apply mt-5 text-sm font-semibold;
  color: var(--color-text);
}

.minisite-pois {
  @apply mt-3 grid gap-3 sm:grid-cols-2;
}

.minisite-poi {
  @apply border p-3;
  border-color: var(--color-border, #e5e7eb);
  background-color: var(--color-surface);
  border-radius: var(--radius-base, 8px);
}

.minisite-poi__header {
  @apply flex flex-wrap items-baseline justify-between gap-2;
}

.minisite-poi__name {
  @apply font-medium;
  color: var(--color-text);
}

.minisite-poi__category {
  @apply text-xs;
  color: var(--color-muted);
}

.minisite-poi__distance {
  @apply mt-1 text-xs;
  color: var(--color-muted);
}

.minisite-poi__description {
  @apply mt-1 text-sm;
  color: var(--color-text);
}

.minisite-poi__link {
  @apply mt-1 block truncate text-sm underline underline-offset-2;
  color: var(--color-primary);
}
</style>
