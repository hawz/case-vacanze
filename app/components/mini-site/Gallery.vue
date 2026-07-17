<script setup lang="ts">
// EPIC 15 — Mini-sito pubblico: galleria foto (US-1501) + EPIC 20/US-2004:
// lightbox a schermo intero. Componente puramente presentazionale: riceve
// le foto già ordinate per sort_order dal chiamante (app/pages/[slug].vue),
// non fa query proprie.
//
// Il layout esistente (copertina grande + griglia sotto) resta invariato —
// il lightbox è un livello aggiuntivo sopra, non una riprogettazione.
// Navigazione circolare (dall'ultima foto si torna alla prima e viceversa):
// più semplice che disabilitare le frecce ai due estremi, e comune in altri
// lightbox. L'ordine di navigazione è lo stesso ordine visivo mostrato a
// schermo (copertina, poi le miniature della griglia in ordine).
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
      v-if="rest.length > 0"
      class="minisite-gallery__grid"
    >
      <button
        v-for="(photo, index) in rest"
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
      </button>
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
.minisite-gallery__cover-button {
  @apply block w-full;
}

.minisite-gallery__cover {
  @apply aspect-video w-full rounded-md object-cover;
}

.minisite-gallery__grid {
  @apply mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4;
}

.minisite-gallery__thumb-button {
  @apply block;
}

.minisite-gallery__thumb {
  @apply aspect-square w-full rounded-md object-cover;
}

.minisite-lightbox {
  @apply fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4;
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
