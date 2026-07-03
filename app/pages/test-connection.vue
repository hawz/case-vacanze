<script setup lang="ts">
// Pagina temporanea di verifica end-to-end della connessione Supabase.
// Da cancellare (insieme alla voce in nuxt.config.ts > supabase.redirectOptions.exclude)
// una volta confermato che tutto funziona.

const supabase = useSupabaseClient()
const user = useSupabaseUser()

const connectionStatus = ref<'checking' | 'ok' | 'error'>('checking')
const connectionError = ref('')

const email = ref('')
const password = ref('')
const authMessage = ref('')

const profile = ref<Record<string, unknown> | null>(null)
const properties = ref<Array<Record<string, unknown>>>([])
const propertyMessage = ref('')

async function checkConnection() {
  connectionStatus.value = 'checking'
  const { error } = await supabase.from('properties').select('id').limit(1)
  if (error) {
    connectionStatus.value = 'error'
    connectionError.value = error.message
  }
  else {
    connectionStatus.value = 'ok'
  }
}

async function signUp() {
  authMessage.value = 'Registrazione in corso...'
  const { error } = await supabase.auth.signUp({ email: email.value, password: password.value })
  authMessage.value = error ? `Errore: ${error.message}` : 'Registrato. Controlla la mail per confermare, poi fai login qui sotto.'
}

async function signIn() {
  authMessage.value = 'Login in corso...'
  const { error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
  authMessage.value = error ? `Errore: ${error.message}` : 'Login riuscito.'
  if (!error) await loadProfile()
}

async function signOut() {
  await supabase.auth.signOut()
  profile.value = null
  properties.value = []
  authMessage.value = 'Disconnesso.'
}

async function loadProfile() {
  if (!user.value) return
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.value.id).single()
  if (error) authMessage.value = `Profilo non trovato: ${error.message} (controlla che il trigger on_auth_user_created sia stato creato)`
  else profile.value = data
}

async function createTestProperty() {
  if (!user.value) return
  propertyMessage.value = 'Creo una proprietà di prova...'
  const slug = `test-${Date.now()}`
  const { error } = await supabase.from('properties').insert({
    owner_id: user.value.id,
    slug,
    name: 'Casa di prova',
    status: 'DRAFT',
  })
  propertyMessage.value = error ? `Errore: ${error.message}` : `Creata con slug ${slug}.`
  await loadProperties()
}

async function loadProperties() {
  if (!user.value) return
  const { data, error } = await supabase.from('properties').select('*').eq('owner_id', user.value.id)
  if (!error) properties.value = data ?? []
}

onMounted(checkConnection)
watch(user, (value) => {
  if (value) {
    loadProfile()
    loadProperties()
  }
})
</script>

<template>
  <section class="test-panel">
    <h1 class="test-panel__title">
      Verifica connessione Supabase
    </h1>

    <div class="test-panel__block">
      <h2 class="test-panel__subtitle">
        1. Connessione al database
      </h2>
      <p v-if="connectionStatus === 'checking'">
        Verifica in corso...
      </p>
      <p v-else-if="connectionStatus === 'ok'" class="test-panel__ok">
        ✅ Connessione OK, la tabella "properties" risponde.
      </p>
      <p v-else class="test-panel__error">
        ❌ Errore: {{ connectionError }}
      </p>
    </div>

    <div class="test-panel__block">
      <h2 class="test-panel__subtitle">
        2. Autenticazione
      </h2>
      <p v-if="user">
        Loggato come <strong>{{ user.email }}</strong> (id: {{ user.id }})
      </p>
      <template v-else>
        <input v-model="email" type="email" placeholder="email di prova" class="test-panel__input">
        <input v-model="password" type="password" placeholder="password (min 6 caratteri)" class="test-panel__input">
        <button class="test-panel__button" @click="signUp">
          Registrati
        </button>
        <button class="test-panel__button" @click="signIn">
          Login
        </button>
      </template>
      <button v-if="user" class="test-panel__button" @click="signOut">
        Logout
      </button>
      <p v-if="authMessage">
        {{ authMessage }}
      </p>
    </div>

    <div v-if="user" class="test-panel__block">
      <h2 class="test-panel__subtitle">
        3. Profilo (creato dal trigger alla registrazione)
      </h2>
      <pre v-if="profile">{{ profile }}</pre>
      <p v-else>
        Nessun profilo trovato — verifica il trigger "on_auth_user_created" in supabase/schema.sql.
      </p>
    </div>

    <div v-if="user" class="test-panel__block">
      <h2 class="test-panel__subtitle">
        4. Scrittura (crea una property di prova)
      </h2>
      <button class="test-panel__button" @click="createTestProperty">
        Crea property di prova
      </button>
      <p v-if="propertyMessage">
        {{ propertyMessage }}
      </p>
      <ul>
        <li v-for="p in properties" :key="String(p.id)">
          {{ p.name }} — {{ p.slug }} ({{ p.status }})
        </li>
      </ul>
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

.test-panel__subtitle {
  @apply text-lg font-semibold;
}

.test-panel__input {
  @apply mr-2 rounded border px-2 py-1;
}

.test-panel__button {
  @apply mr-2 rounded bg-slate-800 px-3 py-1 text-white;
}

.test-panel__ok {
  @apply text-green-700;
}

.test-panel__error {
  @apply text-red-700;
}
</style>
