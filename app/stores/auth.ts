// Stato di autenticazione lato client.
// L'utente Supabase (sessione, token) è già gestito dal modulo @nuxtjs/supabase
// tramite useSupabaseUser()/useSupabaseClient(); questo store aggiunge sopra
// il profilo applicativo (nome, ruolo owner/admin) letto dalla tabella `profiles`.
export const useAuthStore = defineStore('auth', () => {
  const profile = ref<{
    id: string
    firstName: string | null
    lastName: string | null
    role: 'OWNER' | 'ADMIN'
  } | null>(null)

  const isAdmin = computed(() => profile.value?.role === 'ADMIN')

  function setProfile(value: typeof profile.value) {
    profile.value = value
  }

  function clear() {
    profile.value = null
  }

  return { profile, isAdmin, setProfile, clear }
})
