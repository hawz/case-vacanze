<script setup lang="ts">
// EPIC 20 — Home page (US-2002). Pagina pubblica, layout "default" (già
// quello di default per questa rotta). Dati SSR-aware via useAsyncData
// (stessa scelta già fatta per il mini-sito in US-1504): la home è la prima
// pagina che un visitatore o un crawler vede, va renderizzata lato server
// fin dal primo caricamento, non popolata dopo l'idratazione.
//
// Vetrina proprietà: solo dati reali già pubblicati sulla piattaforma
// (nessuna foto stock esterna). Con una sola proprietà pubblicata oggi, la
// sezione resta comunque intenzionale (vedi home/Showcase.vue) e si nasconde
// del tutto se non c'è nessuna proprietà pubblicata, invece di mostrare una
// vetrina vuota.
interface ShowcaseProperty {
  slug: string
  name: string
  city: string | null
  province: string | null
  shortDescription: string | null
  coverUrl: string | null
}

const { t } = useI18n()
const supabase = useSupabaseClient()
const requestUrl = useRequestURL()

const { data: showcaseProperties } = await useAsyncData<ShowcaseProperty[]>('home-showcase', async () => {
  const { data } = await supabase
    .from('properties')
    .select('slug, name, city, province, short_description, photos(url, is_cover)')
    .eq('status', 'PUBLISHED')
    .order('created_at', { ascending: false })
    .limit(8)

  return (data ?? []).map((property) => {
    const photos = property.photos ?? []
    const cover = photos.find(photo => photo.is_cover) ?? photos[0]
    return {
      slug: property.slug,
      name: property.name,
      city: property.city,
      province: property.province,
      shortDescription: property.short_description,
      coverUrl: cover?.url ?? null,
    }
  })
})

const properties = computed(() => showcaseProperties.value ?? [])
const heroPhotos = computed(() => properties.value.map(p => p.coverUrl).filter((url): url is string => !!url).slice(0, 3))

// US-2003: immagine dedicata per l'anteprima di condivisione, invece della
// copertina di una proprietà pubblicata a caso (US-2002 iniziale) — la home
// rappresenta la piattaforma, non una singola casa, e non deve dipendere da
// quali proprietà sono pubblicate in un dato momento. Asset statico in
// public/images/, nessuna generazione lato server.
const ogImageUrl = computed(() => `${requestUrl.origin}/images/og-home.png`)

useSeoMeta({
  title: () => t('home.title'),
  description: () => t('home.meta.description'),
  ogTitle: () => t('home.title'),
  ogDescription: () => t('home.meta.description'),
  ogImage: () => ogImageUrl.value,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogUrl: () => requestUrl.origin,
  ogType: 'website',
  ogSiteName: 'Portale Case Vacanze',
  twitterCard: 'summary_large_image',
  twitterTitle: () => t('home.title'),
  twitterDescription: () => t('home.meta.description'),
  twitterImage: () => ogImageUrl.value,
})
</script>

<template>
  <div>
    <HomeHero :photos="heroPhotos" />
    <HomeValueProps />
    <HomeFeatures />
    <HomeShowcase
      v-if="properties.length > 0"
      :properties="properties"
    />
    <HomeCta />
  </div>
</template>
