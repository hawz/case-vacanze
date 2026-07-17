<script setup lang="ts">
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// US-2006: mappa cliccabile per impostare lat/lng nello step "Informazioni
// generali" (GeneralInfoStep.vue), invece di doverle conoscere/cercare a
// memoria. Suffisso ".client.vue": Leaflet richiede window/document, quindi
// il componente non deve mai provare a renderizzare lato server.

// Leaflet risolve le icone di default con percorsi relativi al proprio
// pacchetto, che si rompono sotto un bundler (Vite riscrive gli URL degli
// asset): vanno reimpostati a mano prima di creare qualsiasi marker,
// altrimenti compare un'icona rotta.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

// Vista di default quando non c'è ancora nessuna posizione nota (nessuna
// coordinata salvata, nessun indirizzo geocodificabile): centro
// approssimativo della Sardegna, coerente con l'area geografica del
// progetto (decisione con Albe, US-2006).
const SARDINIA_CENTER: [number, number] = [40.1209, 9.0129]
const SARDINIA_ZOOM = 8
const PIN_ZOOM = 15

const props = defineProps<{ latitude: string, longitude: string }>()
const emit = defineEmits<{
  'update:latitude': [value: string]
  'update:longitude': [value: string]
}>()

const mapContainer = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null
let marker: L.Marker | null = null

// Evita che l'aggiornamento emesso da un click/trascinamento sulla mappa
// stessa faccia scattare il watch sotto e ricentri/rizoommi la vista: la
// posizione è già corretta localmente, il giro prop-down è solo per
// sincronizzare i campi testuali nel componente padre.
let suppressNextSync = false

function currentCoords(): [number, number] | null {
  if (props.latitude.trim() === '' || props.longitude.trim() === '') return null
  const lat = Number(props.latitude)
  const lng = Number(props.longitude)
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  return [lat, lng]
}

function setMarker(coords: [number, number]) {
  if (!map) return
  if (marker) {
    marker.setLatLng(coords)
  }
  else {
    marker = L.marker(coords, { draggable: true }).addTo(map)
    marker.on('dragend', () => {
      const pos = marker!.getLatLng()
      emitCoords(pos.lat, pos.lng)
    })
  }
}

function emitCoords(lat: number, lng: number) {
  suppressNextSync = true
  emit('update:latitude', lat.toFixed(6))
  emit('update:longitude', lng.toFixed(6))
}

onMounted(() => {
  if (!mapContainer.value) return

  const initial = currentCoords()
  map = L.map(mapContainer.value).setView(initial ?? SARDINIA_CENTER, initial ? PIN_ZOOM : SARDINIA_ZOOM)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map)

  if (initial) {
    setMarker(initial)
  }

  map.on('click', (event: L.LeafletMouseEvent) => {
    setMarker([event.latlng.lat, event.latlng.lng])
    emitCoords(event.latlng.lat, event.latlng.lng)
  })
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
  marker = null
})

// Sincronizza il marker quando lat/lng cambiano dall'esterno (campi testuali
// modificati a mano, o geocoding dell'indirizzo): senza questo watch la
// mappa resterebbe ferma sulla vista iniziale finché l'utente non ci clicca.
watch(() => [props.latitude, props.longitude], () => {
  if (suppressNextSync) {
    suppressNextSync = false
    return
  }
  const coords = currentCoords()
  if (!coords || !map) return
  setMarker(coords)
  map.setView(coords, Math.max(map.getZoom(), PIN_ZOOM))
})
</script>

<template>
  <div
    ref="mapContainer"
    class="wizard-map"
  />
</template>

<style scoped>
.wizard-map {
  @apply w-full rounded-md border;
  height: 320px;
  border-color: #d1d5db;
}
</style>
