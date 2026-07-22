<script setup lang="ts">
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// US-2007 — mappa di sola visualizzazione nel mini-sito pubblico, mostrata
// solo quando la proprietà ha lat/lng salvate (US-2006). A differenza di
// WizardLocationMapField.client.vue qui non c'è nessuna interazione che
// modifica la posizione: nessun marker trascinabile, nessun listener di
// click. Suffisso ".client.vue": Leaflet richiede window/document, mai
// renderizzato server-side.

// Stesso fix richiesto in ogni file che crea un marker Leaflet: i percorsi
// delle icone di default si rompono sotto un bundler e vanno reimpostati a
// mano (vedi lo stesso commento in WizardLocationMapField.client.vue).
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const PIN_ZOOM = 15

const props = defineProps<{ latitude: number, longitude: number }>()

const mapContainer = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null

// Dentro una pagina SSR-aware (il mini-sito usa useAsyncData, non onMounted),
// questo componente ".client" può montare/rimontare mentre il v-if del
// genitore si stabilizza in fase di idratazione: onMounted può quindi
// scattare prima che il ref sul template sia effettivamente legato al DOM.
// Un watch sul ref stesso, invece di inizializzare la mappa direttamente in
// onMounted, garantisce che l'inizializzazione avvenga appena l'elemento è
// davvero disponibile, indipendentemente da questo timing.
watch(mapContainer, (el) => {
  if (!el || map) return

  const coords: [number, number] = [props.latitude, props.longitude]
  map = L.map(el).setView(coords, PIN_ZOOM)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map)

  L.marker(coords).addTo(map)
}, { immediate: true })

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div
    ref="mapContainer"
    class="minisite-map"
  />
</template>

<style scoped>
.minisite-map {
  @apply mt-4 w-full border;
  height: 280px;
  border-color: var(--color-border, #d1d5db);
  border-radius: var(--radius-base, 8px);
}
</style>
