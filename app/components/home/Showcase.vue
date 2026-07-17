<script setup lang="ts">
// EPIC 20 — Home page (US-2002). Vetrina delle proprietà pubblicate reali.
// Griglia pensata per funzionare sia con una sola proprietà (oggi) sia con
// molte: niente stato vuoto qui, la sezione intera viene nascosta dal
// chiamante (app/pages/index.vue) se non c'è nessuna proprietà pubblicata,
// invece di mostrare una vetrina visibilmente vuota o rotta.
interface ShowcaseProperty {
  slug: string
  name: string
  city: string | null
  province: string | null
  shortDescription: string | null
  coverUrl: string | null
}

defineProps<{ properties: ShowcaseProperty[] }>()

const { t } = useI18n()
const localePath = useLocalePath()

function locationLine(property: ShowcaseProperty) {
  return [property.city, property.province].filter(Boolean).join(', ')
}
</script>

<template>
  <section class="showcase">
    <div class="showcase__header">
      <h2 class="showcase__title">
        {{ t('home.showcase.title') }}
      </h2>
      <p class="showcase__subtitle">
        {{ t('home.showcase.subtitle') }}
      </p>
    </div>

    <div class="showcase__grid">
      <NuxtLink
        v-for="property in properties"
        :key="property.slug"
        :to="localePath(`/${property.slug}`)"
        class="showcase-card"
      >
        <div class="showcase-card__image-wrap">
          <img
            v-if="property.coverUrl"
            :src="property.coverUrl"
            :alt="property.name"
            class="showcase-card__image"
          >
          <div
            v-else
            class="showcase-card__image-placeholder"
            aria-hidden="true"
          />
        </div>
        <div class="showcase-card__body">
          <span class="showcase-card__name">{{ property.name }}</span>
          <span
            v-if="locationLine(property)"
            class="showcase-card__location"
          >{{ locationLine(property) }}</span>
          <span class="showcase-card__link">{{ t('home.showcase.viewLink') }} →</span>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.showcase {
  @apply mx-auto max-w-6xl px-4 py-16;
}

.showcase__header {
  @apply mx-auto max-w-2xl text-center;
}

.showcase__title {
  @apply text-3xl font-bold;
  color: var(--color-text);
}

.showcase__subtitle {
  @apply mt-3 text-base leading-relaxed;
  color: var(--color-muted);
}

.showcase__grid {
  @apply mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-3;
}

.showcase-card {
  @apply block overflow-hidden rounded-2xl border shadow-sm transition-transform hover:-translate-y-0.5;
  border-color: #e5e7eb;
  background-color: var(--color-surface);
}

.showcase-card__image-wrap {
  @apply aspect-[4/3] w-full;
}

.showcase-card__image {
  @apply h-full w-full object-cover;
}

.showcase-card__image-placeholder {
  @apply h-full w-full;
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 15%, transparent), color-mix(in srgb, var(--color-accent) 15%, transparent));
}

.showcase-card__body {
  @apply flex flex-col gap-1 p-4;
}

.showcase-card__name {
  @apply font-semibold;
  color: var(--color-text);
}

.showcase-card__location {
  @apply text-sm;
  color: var(--color-muted);
}

.showcase-card__link {
  @apply mt-2 text-sm font-medium;
  color: var(--color-primary);
}
</style>
