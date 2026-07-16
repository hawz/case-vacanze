<script setup lang="ts">
// EPIC 18 — Localizzazione interfaccia (US-1801). Selettore lingua
// riusabile, inserito sia nel layout "default" (area pubblica: home,
// mini-sito, form di richiesta disponibilità, pagine auth) sia nel layout
// "app" (backoffice). switchLocalePath() genera l'URL della stessa identica
// rotta nell'altra lingua (solo il prefisso /en cambia, i segmenti restano
// in inglese per scelta di progetto già presa — vedi CLAUDE.md), quindi
// cambiare lingua non fa mai perdere la pagina su cui ci si trova.
const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const availableLocales = computed(() => (locales.value ?? []).filter(l => typeof l === 'object'))
</script>

<template>
  <div class="language-switcher">
    <NuxtLink
      v-for="l in availableLocales"
      :key="l.code"
      :to="switchLocalePath(l.code)"
      class="language-switcher__link"
      :class="{ 'language-switcher__link--active': l.code === locale }"
      :aria-label="l.name"
    >
      {{ l.code.toUpperCase() }}
    </NuxtLink>
  </div>
</template>

<style scoped>
.language-switcher {
  @apply flex items-center gap-1 text-sm;
}

.language-switcher__link {
  @apply rounded-md border border-transparent px-2 py-1 font-medium;
  color: var(--color-muted);
}

.language-switcher__link--active {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
</style>
