<script setup lang="ts">
// US-2013 — pulsante "torna su" globale, incluso una volta in ciascuno dei
// due layout (default.vue, app.vue): copre così l'intero sito senza doverlo
// aggiungere pagina per pagina. A differenza del calendario (US-2012), qui
// non c'è nessuna logica specifica per pagina da duplicare — il
// comportamento è identico ovunque.
const SCROLL_THRESHOLD = 400

const { t } = useI18n()

const isVisible = ref(false)
let ticking = false

function updateVisibility() {
  isVisible.value = window.scrollY > SCROLL_THRESHOLD
  ticking = false
}

// requestAnimationFrame come throttle leggero sull'evento scroll (che può
// scattare decine di volte al secondo) invece di una libreria di debounce:
// l'unica cosa da fare ad ogni frame è confrontare scrollY con la soglia.
function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(updateVisibility)
}

function scrollToTop() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <button
    v-if="isVisible"
    type="button"
    class="back-to-top"
    :aria-label="t('nav.backToTop')"
    @click="scrollToTop"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    ><path d="M12 19V5M5 12l7-7 7 7" /></svg>
  </button>
</template>

<style scoped>
.back-to-top {
  @apply fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-opacity sm:bottom-6 sm:right-6;
  background-color: var(--color-primary, #0f766e);
  color: #ffffff;
}

.back-to-top:hover {
  opacity: 0.9;
}

.back-to-top svg {
  @apply h-5 w-5;
}

@media (prefers-reduced-motion: reduce) {
  .back-to-top {
    transition: none;
  }
}
</style>
