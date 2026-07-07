<script setup lang="ts">
// /app/properties/[id]/edit senza step esplicito: per ora rimanda sempre a
// 'general-info' (unico step implementato, vedi IMPLEMENTED_STEPS in
// stores/wizard.ts). Quando esisteranno più step si potrà scegliere qui il
// primo non ancora completato invece del semplice hard-code.
const route = useRoute()
const localePath = useLocalePath()

definePageMeta({ layout: 'app' })

await navigateTo(localePath(`/app/properties/${route.params.id}/edit/general-info`))
</script>

<template>
  <div />
</template>
