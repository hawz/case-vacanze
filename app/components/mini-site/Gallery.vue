<script setup lang="ts">
// EPIC 15 — Mini-sito pubblico: galleria foto (US-1501) + EPIC 20/US-2004:
// lightbox a schermo intero. Componente puramente presentazionale: riceve
// le foto già ordinate per sort_order dal chiamante (app/pages/[slug].vue),
// non fa query proprie.
//
// EPIC 21/US-2102: layout "chiuso" ridisegnato a mosaico (copertina grande +
// griglia 2x2 di anteprime, overlay "+N foto" sull'ultima se ce ne sono di
// più) al posto della foto a piena larghezza seguita da una griglia che si
// allungava in verticale — pensato per lasciare più spazio, sopra la piega,
// alle informazioni chiave (US-2101). Il lightbox sotto resta identico
// (stesso ordine di navigazione, stesse foto raggiungibili tutte tramite le
// frecce anche se il mosaico ne mostra al massimo 5): non è stato toccato,
// solo la presentazione "chiusa" cambia.
interface Photo {
  id: string
  url: string
  alt_text: string | null
  is_cover: boolean
}

const props = defineProps<{ photos: Photo[] }>()

const { t } = useI18n()

const cover = computed(() => props.photos.find(p => p.is_cover) ?? props.photos[0] ?? null)
const rest = computed(() => props.photos.filter(p => p.id !== cover.value?.id))
const orderedPhotos = computed(() => (cover.value ? [cover.value, ...rest.value] : []))

// Al massimo 4 anteprime nel mosaico, indipendentemente da quante foto
// restano: le altre si vedono comunque, ma solo aprendo il lightbox (frecce
// avanti/indietro), non tutte in griglia nella pagina chiusa.
const gridPhotos = computed(() => rest.value.slice(0, 4))
const remainingCount = computed(() => Math.max(rest.value.length - 4, 0))

const lightboxIndex = ref<number | null>(null)
const activePhoto = computed(() => (lightboxIndex.value !== null ? orderedPhotos.value[lightboxIndex.value] : null))

function openLightbox(index: number) {
  lightboxIndex.value = index
  document.body.style.overflow = 'hidden'
}

function closeLightbox() {
  lightboxIndex.value = null
  document.body.style.overflow = ''
}

function showPrevious() {
  if (lightboxIndex.value === null) return
  const total = orderedPhotos.value.length
  lightboxIndex.value = (lightboxIndex.value - 1 + total) % total
}

function showNext() {
  if (lightboxIndex.value === null) return
  lightboxIndex.value = (lightboxIndex.value + 1) % orderedPhotos.value.length
}

function onKeydown(event: KeyboardEvent) {
  if (lightboxIndex.value === null) return
  if (event.key === 'Escape') closeLightbox()
  else if (event.key === 'ArrowLeft') showPrevious()
  else if (event.key === 'ArrowRight') showNext()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  // Nel caso il componente venga smontato mentre il lightbox è aperto
  // (navigazione via slug diverso), non lasciare lo scroll del body bloccato.
  document.body.style.overflow = ''
})
</script>

<template>
  <div
    v-if="cover"
    class="minisite-gallery"
  >
    <div
      class="minisite-gallery__mosaic"
      :class="{ 'minisite-gallery__mosaic--solo': gridPhotos.length === 0 }"
    >
      <button
        type="button"
        class="minisite-gallery__cover-button"
        :aria-label="t('minisite.gallery.openLabel', { n: 1 })"
        @click="openLightbox(0)"
      >
        <img
          :src="cover.url"
          :alt="cover.alt_text ?? ''"
          class="minisite-gallery__cover"
        >
      </button>

      <div
        v-if="gridPhotos.length > 0"
        class="minisite-gallery__grid"
      >
        <button
          v-for="(photo, index) in gridPhotos"
          :key="photo.id"
          type="button"
          class="minisite-gallery__thumb-button"
          :aria-label="t('minisite.gallery.openLabel', { n: index + 2 })"
          @click="openLightbox(index + 1)"
        >
          <img
            :src="photo.url"
            :alt="photo.alt_text ?? ''"
            class="minisite-gallery__thumb"
          >
          <span
            v-if="index === gridPhotos.length - 1 && remainingCount > 0"
            class="minisite-gallery__more"
          >
            {{ t('minisite.gallery.morePhotos', { n: remainingCount }) }}
          </span>
        </button>
      </div>
    </div>

    <div
      v-if="activePhoto"
      class="minisite-lightbox"
      role="dialog"
      aria-modal="true"
      @click.self="closeLightbox"
    >
      <button
        type="button"
        class="minisite-lightbox__close"
        :aria-label="t('minisite.gallery.close')"
        @click="closeLightbox"
      >
        ✕
      </button>

      <button
        v-if="orderedPhotos.length > 1"
        type="button"
        class="minisite-lightbox__nav minisite-lightbox__nav--prev"
        :aria-label="t('minisite.gallery.previous')"
        @click="showPrevious"
      >
        ‹
      </button>

      <img
        :src="activePhoto.url"
        :alt="activePhoto.alt_text ?? ''"
        class="minisite-lightbox__image"
      >

      <button
        v-if="orderedPhotos.length > 1"
        type="button"
        class="minisite-lightbox__nav minisite-lightbox__nav--next"
        :aria-label="t('minisite.gallery.next')"
        @click="showNext"
      >
        ›
      </button>

      <p
        v-if="orderedPhotos.length > 1"
        class="minisite-lightbox__counter"
      >
        {{ (lightboxIndex ?? 0) + 1 }} / {{ orderedPhotos.length }}
      </p>
    </div>
  </div>
</template>

<style scoped>
/*
  Mosaico: copertina grande (3/5 dello spazio) + griglia 2x2 di anteprime
  (2/5), altezza fissa — invece della foto a piena larghezza seguita da una
  griglia che si allungava in verticale. Con una sola foto (nessuna riga in
  gridPhotos), --solo toglie la griglia e lascia la copertina da sola,
  proporzionata come prima (aspect-video).
*/
.minisite-gallery {
  margin-top: 1rem;
}

.minisite-gallery__mosaic {
  @apply grid gap-2;
  grid-template-columns: 3fr 2fr;
  height: 320px;
}

.minisite-gallery__mosaic--solo {
  grid-template-columns: 1fr;
  height: auto;
}

.minisite-gallery__cover-button {
  @apply block h-full w-full;
}

.minisite-gallery__cover {
  @apply h-full w-full object-cover;
  border-radius: var(--radius-base, 8px);
}

.minisite-gallery__mosaic--solo .minisite-gallery__cover {
  @apply aspect-video;
}

.minisite-gallery__grid {
  @apply grid grid-cols-2 grid-rows-2 gap-2;
}

.minisite-gallery__thumb-button {
  @apply relative block h-full w-full overflow-hidden;
  border-radius: var(--radius-base, 8px);
}

.minisite-gallery__thumb {
  @apply h-full w-full object-cover;
}

.minisite-gallery__more {
  @apply absolute inset-0 flex items-center justify-center text-sm font-semibold text-white;
  background-color: rgb(0 0 0 / 46%);
}

@media (max-width: 640px) {
  .minisite-gallery__mosaic {
    grid-template-columns: 1fr;
    height: auto;
  }

  .minisite-gallery__cover {
    @apply aspect-video;
  }

  .minisite-gallery__grid {
    height: 160px;
  }
}

.minisite-lightbox {
  /*
    z-index esplicito, non l'utility z-50 (=50): i controlli di Leaflet
    (MiniSiteLocationMap.client.vue, US-2007) usano z-index fino a 1000
    (.leaflet-control-container) per restare sopra le proprie tile, quindi
    50 non basta a coprirli — il lightbox restava sotto la mappa invece che
    sopra. 9999 sta comodamente sopra qualunque z-index interno di Leaflet.
  */
  @apply fixed inset-0 flex items-center justify-center bg-black/90 p-4;
  z-index: 9999;
}

.minisite-lightbox__image {
  @apply max-h-[85vh] max-w-[85vw] rounded-md object-contain;
}

.minisite-lightbox__close {
  @apply absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-lg text-white;
  background-color: rgb(255 255 255 / 15%);
}

.minisite-lightbox__nav {
  @apply absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-2xl text-white;
  background-color: rgb(255 255 255 / 15%);
}

.minisite-lightbox__nav--prev {
  @apply left-2 sm:left-6;
}

.minisite-lightbox__nav--next {
  @apply right-2 sm:right-6;
}

.minisite-lightbox__counter {
  @apply absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-sm text-white;
  background-color: rgb(255 255 255 / 15%);
}
</style>
