// Tiene sincronizzato lo store `auth` (profilo applicativo: nome, ruolo)
// con la sessione Supabase. useSupabaseUser()/useSupabaseClient() gestiscono
// già l'utente auth.users e il token; qui carichiamo il corrispondente
// public.profiles (creato dal trigger handle_new_user, vedi supabase/schema.sql)
// così header, pagina profilo e futuri controlli su isAdmin hanno subito il dato.
export default defineNuxtPlugin(() => {
  const user = useSupabaseUser()
  const supabase = useSupabaseClient()
  const authStore = useAuthStore()

  watch(
    user,
    async (value) => {
      if (!value) {
        authStore.clear()
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role')
        .eq('id', value.id)
        .single()

      // In caso di errore (rete, RLS, riga non ancora creata dal trigger)
      // non blocchiamo la navigazione: l'header userà semplicemente un
      // fallback (email) finché il profilo non sarà disponibile.
      if (error || !data) return

      authStore.setProfile({
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        role: data.role,
      })
    },
    { immediate: true },
  )
})
