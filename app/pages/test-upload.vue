<script setup lang="ts">
// Pagina temporanea di verifica upload foto su Cloudinary.
// Da cancellare (insieme alla voce in nuxt.config.ts > supabase.redirectOptions.exclude
// e a server/api/test-upload.post.ts) una volta confermato che tutto funziona.

const file = ref<File | null>(null)
const status = ref<'idle' | 'uploading' | 'ok' | 'error'>('idle')
const resultUrl = ref('')
const errorMessage = ref('')

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  file.value = target.files?.[0] ?? null
}

async function upload() {
  if (!file.value) return
  status.value = 'uploading'
  errorMessage.value = ''

  const formData = new FormData()
  formData.append('file', file.value)

  try {
    const response = await $fetch<{ url: string, publicId: string }>('/api/test-upload', {
      method: 'POST',
      body: formData,
    })
    resultUrl.value = response.url
    status.value = 'ok'
  }
  catch (error) {
    status.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : 'Errore sconosciuto'
  }
}
</script>

<template>
  <section class="test-panel">
    <h1 class="test-panel__title">
      Verifica upload Cloudinary
    </h1>

    <div class="test-panel__block">
      <input type="file" accept="image/*" @change="onFileChange">
      <button class="test-panel__button" :disabled="!file || status === 'uploading'" @click="upload">
        Carica foto di prova
      </button>
    </div>

    <div v-if="status === 'uploading'" class="test-panel__block">
      <p>Caricamento in corso...</p>
    </div>

    <div v-else-if="status === 'ok'" class="test-panel__block">
      <p class="test-panel__ok">
        ✅ Upload riuscito.
      </p>
      <img :src="resultUrl" alt="Foto di prova caricata" class="test-panel__preview">
      <p class="test-panel__url">
        {{ resultUrl }}
      </p>
    </div>

    <div v-else-if="status === 'error'" class="test-panel__block">
      <p class="test-panel__error">
        ❌ Errore: {{ errorMessage }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.test-panel {
  @apply mx-auto max-w-xl space-y-8 px-4 py-12;
}

.test-panel__title {
  @apply text-2xl font-bold;
}

.test-panel__block {
  @apply space-y-2 border-t pt-4;
}

.test-panel__button {
  @apply ml-2 rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-40;
}

.test-panel__ok {
  @apply text-green-700;
}

.test-panel__error {
  @apply text-red-700;
}

.test-panel__preview {
  @apply max-w-xs rounded border;
}

.test-panel__url {
  @apply break-all text-sm text-slate-600;
}
</style>
