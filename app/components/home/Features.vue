<script setup lang="ts">
// EPIC 20 — Home page (US-2002). Griglia delle funzionalità della
// piattaforma. Icone SVG minimali disegnate a mano (nessuna libreria icone
// nel progetto, coerente con la scelta già fatta per i portali OTA nel
// mini-sito): geometrie semplici (rect/circle/line), non un set curato
// professionalmente, ma coerenti tra loro.
const { t } = useI18n()

const FEATURES = ['wizard', 'photos', 'calendar', 'requests', 'otaLinks', 'themes', 'announcements', 'languages'] as const
</script>

<template>
  <section class="features">
    <div class="features__header">
      <h2 class="features__title">
        {{ t('home.features.title') }}
      </h2>
      <p class="features__subtitle">
        {{ t('home.features.subtitle') }}
      </p>
    </div>

    <div class="features__grid">
      <div
        v-for="feature in FEATURES"
        :key="feature"
        class="features__card"
      >
        <span class="features__icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <template v-if="feature === 'wizard'">
              <circle
                cx="5"
                cy="6"
                r="1.6"
              /><line
                x1="10"
                y1="6"
                x2="19"
                y2="6"
              />
              <circle
                cx="5"
                cy="12"
                r="1.6"
              /><line
                x1="10"
                y1="12"
                x2="19"
                y2="12"
              />
              <circle
                cx="5"
                cy="18"
                r="1.6"
              /><line
                x1="10"
                y1="18"
                x2="19"
                y2="18"
              />
            </template>
            <template v-else-if="feature === 'photos'">
              <rect
                x="3"
                y="7"
                width="18"
                height="13"
                rx="2"
              />
              <path d="M8 7l1.4-2.3h5.2L16 7" />
              <circle
                cx="12"
                cy="13.5"
                r="3.3"
              />
            </template>
            <template v-else-if="feature === 'calendar'">
              <rect
                x="3"
                y="5"
                width="18"
                height="16"
                rx="2"
              />
              <line
                x1="3"
                y1="10"
                x2="21"
                y2="10"
              />
              <line
                x1="8"
                y1="3"
                x2="8"
                y2="7"
              />
              <line
                x1="16"
                y1="3"
                x2="16"
                y2="7"
              />
            </template>
            <template v-else-if="feature === 'requests'">
              <rect
                x="3"
                y="6"
                width="18"
                height="13"
                rx="2"
              />
              <polyline points="3.5,7 12,14 20.5,7" />
            </template>
            <template v-else-if="feature === 'otaLinks'">
              <ellipse
                cx="9"
                cy="9"
                rx="4"
                ry="2.8"
                transform="rotate(-45 9 9)"
              />
              <ellipse
                cx="15"
                cy="15"
                rx="4"
                ry="2.8"
                transform="rotate(-45 15 15)"
              />
            </template>
            <template v-else-if="feature === 'themes'">
              <circle
                cx="8.5"
                cy="9.5"
                r="4"
                fill="currentColor"
                fill-opacity="0.12"
              />
              <circle
                cx="15.5"
                cy="9.5"
                r="4"
                fill="currentColor"
                fill-opacity="0.12"
              />
              <circle
                cx="12"
                cy="15.5"
                r="4"
                fill="currentColor"
                fill-opacity="0.12"
              />
            </template>
            <template v-else-if="feature === 'announcements'">
              <path d="M12 3.5a4.5 4.5 0 00-4.5 4.5v2.5l-2 4.5h13l-2-4.5V8A4.5 4.5 0 0012 3.5z" />
              <path d="M9.7 18.5a2.3 2.3 0 004.6 0" />
            </template>
            <template v-else-if="feature === 'languages'">
              <circle
                cx="12"
                cy="12"
                r="8.5"
              />
              <ellipse
                cx="12"
                cy="12"
                rx="3.6"
                ry="8.5"
              />
              <line
                x1="3.5"
                y1="12"
                x2="20.5"
                y2="12"
              />
            </template>
          </svg>
        </span>
        <h3 class="features__card-title">
          {{ t(`home.features.${feature}.title`) }}
        </h3>
        <p class="features__card-description">
          {{ t(`home.features.${feature}.description`) }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.features {
  @apply px-4 py-16;
  background-color: var(--color-surface);
}

.features__header {
  @apply mx-auto max-w-2xl text-center;
}

.features__title {
  @apply text-3xl font-bold;
  color: var(--color-text);
}

.features__subtitle {
  @apply mt-3 text-base leading-relaxed;
  color: var(--color-muted);
}

.features__grid {
  @apply mx-auto mt-12 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4;
}

.features__card {
  @apply rounded-2xl p-5;
  background-color: var(--color-background);
}

.features__icon {
  @apply flex h-11 w-11 items-center justify-center rounded-xl;
  background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
}

.features__icon svg {
  @apply h-6 w-6;
}

.features__card-title {
  @apply mt-4 font-semibold;
  color: var(--color-text);
}

.features__card-description {
  @apply mt-1.5 text-sm leading-relaxed;
  color: var(--color-muted);
}
</style>
