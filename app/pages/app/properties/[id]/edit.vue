<script setup lang="ts">
// Stub temporaneo: destinazione dopo la creazione di una proprietà (US-202).
// Il wizard vero (general-info, photos, ...) è Epic 3+; questa pagina evita
// solo un 404 nel frattempo, mostrando nome/stato letti direttamente dalla
// riga (RLS "properties_owner_read_own" ne garantisce l'accesso solo a
// owner/admin).
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const supabase = useSupabaseClient()

definePageMeta({ layout: 'app' })

const isLoading = ref(true)
const notFound = ref(false)
const propertyName = ref('')

onMounted(async () => {
  const id = route.params.id as string

  const { data, error } = await supabase
    .from('properties')
    .select('name')
    .eq('id', id)
    .single()

  isLoading.value = false

  if (error || !data) {
    notFound.value = true
    return
  }

  propertyName.value = data.name
})
</script>

<template>
  <section class="property-edit-stub">
    <template v-if="isLoading">
      <p class="property-edit-stub__loading">
        {{ t('auth.common.loading') }}
      </p>
    </template>

    <template v-else-if="notFound">
      <h1 class="property-edit-stub__title">
        {{ t('properties.editStub.notFoundTitle') }}
      </h1>
    </template>

    <template v-else>
      <h1 class="property-edit-stub__title">
        {{ propertyName }}
      </h1>
      <p class="property-edit-stub__message">
        {{ t('properties.editStub.message') }}
      </p>
    </template>

    <NuxtLink
      :to="localePath('/app/properties')"
      class="property-edit-stub__back"
    >
      {{ t('properties.editStub.backLink') }}
    </NuxtLink>
  </section>
</template>

<style scoped>
.property-edit-stub {
  @apply mx-auto max-w-2xl px-4 py-12;
}

.property-edit-stub__loading {
  @apply text-sm;
  color: var(--color-muted);
}

.property-edit-stub__title {
  @apply text-2xl font-bold;
  color: var(--color-text);
}

.property-edit-stub__message {
  @apply mt-2 text-sm;
  color: var(--color-muted);
}

.property-edit-stub__back {
  @apply mt-6 inline-block font-medium underline underline-offset-2;
  color: var(--color-primary);
}
</style>
