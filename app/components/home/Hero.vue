<script setup lang="ts">
// EPIC 20 — Home page (US-2002). Hero: headline + CTA + collage fotografico
// dalle proprietà pubblicate reali (passate dal chiamante, già filtrate/
// limitate). Nessuna foto stock esterna: solo contenuto reale già presente
// sulla piattaforma, con fallback grafico (nessuna foto disponibile) che
// funziona altrettanto bene con 0, 1 o più immagini.
defineProps<{ photos: string[] }>()

const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <section class="home-hero">
    <div class="home-hero__text">
      <span class="home-hero__eyebrow">{{ t('home.hero.eyebrow') }}</span>
      <h1 class="home-hero__title">
        {{ t('home.hero.title') }}
      </h1>
      <p class="home-hero__subtitle">
        {{ t('home.hero.subtitle') }}
      </p>
      <div class="home-hero__actions">
        <NuxtLink
          :to="localePath('/app/register')"
          class="home-hero__cta-primary"
        >
          {{ t('home.hero.ctaPrimary') }}
        </NuxtLink>
        <NuxtLink
          :to="localePath('/app/login')"
          class="home-hero__cta-secondary"
        >
          {{ t('home.hero.ctaSecondary') }}
        </NuxtLink>
      </div>
    </div>

    <div class="home-hero__visual">
      <div
        v-if="photos.length > 0"
        class="home-hero__collage"
        :class="`home-hero__collage--${Math.min(photos.length, 3)}`"
      >
        <img
          v-for="(photo, index) in photos.slice(0, 3)"
          :key="photo"
          :src="photo"
          :alt="t('home.hero.imageAlt')"
          class="home-hero__photo"
          :class="`home-hero__photo--${index}`"
        >
      </div>
      <div
        v-else
        class="home-hero__placeholder"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.2"
          class="home-hero__placeholder-icon"
        >
          <path d="M4 11.5L12 4l8 7.5" />
          <path d="M6 10v9a1 1 0 001 1h10a1 1 0 001-1v-9" />
          <path d="M10 20v-6h4v6" />
        </svg>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-hero {
  @apply mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16;
}

.home-hero__eyebrow {
  @apply inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide;
  background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
}

.home-hero__title {
  @apply mt-4 text-4xl font-bold leading-tight sm:text-5xl;
  color: var(--color-text);
}

.home-hero__subtitle {
  @apply mt-5 max-w-lg text-base leading-relaxed sm:text-lg;
  color: var(--color-muted);
}

.home-hero__actions {
  @apply mt-8 flex flex-wrap gap-3;
}

.home-hero__cta-primary {
  @apply rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02];
  background-color: var(--color-primary);
}

.home-hero__cta-secondary {
  @apply rounded-full border px-6 py-3 text-sm font-semibold transition-colors;
  border-color: #d1d5db;
  color: var(--color-text);
}

.home-hero__visual {
  @apply relative;
}

.home-hero__collage {
  @apply relative aspect-[4/3] w-full;
}

.home-hero__photo {
  @apply absolute rounded-2xl object-cover shadow-lg;
}

/* Un solo scatto: un'unica card grande, centrata. */
.home-hero__collage--1 .home-hero__photo--0 {
  @apply inset-0 h-full w-full;
}

/* Due scatti: due card affiancate e leggermente sfalsate. */
.home-hero__collage--2 .home-hero__photo--0 {
  @apply left-0 top-4 h-[85%] w-[62%];
}

.home-hero__collage--2 .home-hero__photo--1 {
  @apply bottom-4 right-0 h-[70%] w-[48%];
}

/* Tre scatti: composizione a scaletta, come una vetrina. */
.home-hero__collage--3 .home-hero__photo--0 {
  @apply left-0 top-6 h-[75%] w-[58%];
}

.home-hero__collage--3 .home-hero__photo--1 {
  @apply bottom-6 right-0 h-[55%] w-[42%];
}

.home-hero__collage--3 .home-hero__photo--2 {
  @apply right-[8%] top-0 h-[40%] w-[32%];
}

.home-hero__placeholder {
  @apply flex aspect-[4/3] w-full items-center justify-center rounded-2xl;
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 15%, transparent), color-mix(in srgb, var(--color-accent) 15%, transparent));
}

.home-hero__placeholder-icon {
  @apply h-24 w-24;
  color: var(--color-primary);
  opacity: 0.5;
}
</style>
