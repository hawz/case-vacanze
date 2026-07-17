<script setup lang="ts">
// EPIC 20 — Home page (US-2002). Banner finale di invito alla registrazione.
const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <section class="home-cta">
    <div class="home-cta__box">
      <h2 class="home-cta__title">
        {{ t('home.cta.title') }}
      </h2>
      <p class="home-cta__subtitle">
        {{ t('home.cta.subtitle') }}
      </p>
      <NuxtLink
        :to="localePath('/app/register')"
        class="home-cta__button"
      >
        {{ t('home.cta.button') }}
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.home-cta {
  @apply px-4 py-16;
}

.home-cta__box {
  @apply mx-auto max-w-3xl rounded-3xl px-6 py-14 text-center;
  background-color: var(--color-primary);
}

.home-cta__title {
  @apply text-2xl font-bold text-white sm:text-3xl;
}

.home-cta__subtitle {
  @apply mx-auto mt-3 max-w-xl text-sm text-white sm:text-base;
  opacity: 0.9;
}

.home-cta__button {
  @apply mt-8 inline-block rounded-full px-7 py-3 text-sm font-semibold shadow-sm transition-transform hover:scale-[1.02];
  background-color: white;
  color: var(--color-primary);
}
</style>
