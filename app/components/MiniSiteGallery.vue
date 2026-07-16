<script setup lang="ts">
// EPIC 15 — Mini-sito pubblico: galleria foto (parte di US-1501).
// Componente puramente presentazionale: riceve le foto già ordinate per
// sort_order dal chiamante (app/pages/[slug].vue), non fa query proprie.
interface Photo {
  id: string
  url: string
  alt_text: string | null
  is_cover: boolean
}

const props = defineProps<{ photos: Photo[] }>()

const cover = computed(() => props.photos.find(p => p.is_cover) ?? props.photos[0] ?? null)
const rest = computed(() => props.photos.filter(p => p.id !== cover.value?.id))
</script>

<template>
  <div
    v-if="cover"
    class="minisite-gallery"
  >
    <img
      :src="cover.url"
      :alt="cover.alt_text ?? ''"
      class="minisite-gallery__cover"
    >
    <div
      v-if="rest.length > 0"
      class="minisite-gallery__grid"
    >
      <img
        v-for="photo in rest"
        :key="photo.id"
        :src="photo.url"
        :alt="photo.alt_text ?? ''"
        class="minisite-gallery__thumb"
      >
    </div>
  </div>
</template>

<style scoped>
.minisite-gallery__cover {
  @apply aspect-video w-full rounded-md object-cover;
}

.minisite-gallery__grid {
  @apply mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4;
}

.minisite-gallery__thumb {
  @apply aspect-square w-full rounded-md object-cover;
}
</style>
