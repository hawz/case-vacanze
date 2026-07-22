<script setup lang="ts">
// EPIC 15 — Mini-sito pubblico: link ai portali OTA (US-1503). "Icona
// riconoscibile" interpretata come badge colorato + nome piattaforma,
// invece di loghi Airbnb/Booking veri e propri: niente libreria icone nel
// progetto, ed usare i loghi ufficiali di terzi solleverebbe questioni di
// licenza/marchio non valutate qui.
interface OtaLink {
  id: string
  platform: 'AIRBNB' | 'BOOKING' | 'OTHER'
  url: string
  label: string | null
}

defineProps<{ links: OtaLink[] }>()

const { t } = useI18n()

function platformLabel(platform: string) {
  return t(`minisite.otaLinks.platforms.${platform}`)
}
</script>

<template>
  <section
    v-if="links.length > 0"
    class="minisite-section"
  >
    <h2 class="minisite-section__title">
      {{ t('minisite.otaLinks.title') }}
    </h2>
    <div class="minisite-ota-links">
      <a
        v-for="link in links"
        :key="link.id"
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
        class="minisite-ota-link"
        :class="`minisite-ota-link--${link.platform.toLowerCase()}`"
      >
        {{ link.label || platformLabel(link.platform) }}
      </a>
    </div>
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

.minisite-ota-links {
  @apply mt-3 flex flex-wrap gap-3;
}

.minisite-ota-link {
  @apply px-4 py-2 text-sm font-medium text-white;
  background-color: var(--color-primary);
  border-radius: var(--radius-pill, 8px);
}

.minisite-ota-link--airbnb {
  background-color: #ff385c;
}

.minisite-ota-link--booking {
  background-color: #003580;
}

.minisite-ota-link--other {
  /*
    Non "muted" su testo bianco: con alcuni temi (es. Notte di Castelsardo)
    il grigio muted è troppo chiaro per garantire contrasto AA con testo
    bianco. Riusa la coppia primary/onPrimary, già verificata ≥4.5:1 per
    ogni tema (vedi config/themes.ts).
  */
  background-color: var(--color-primary);
  color: var(--color-on-primary, #fff);
}
</style>
