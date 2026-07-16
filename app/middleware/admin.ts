// EPIC 17 — Amministrazione. Guardia di rotta per /app/admin/**: interroga
// direttamente il profilo dell'utente corrente (non authStore.profile) per
// evitare una race condition con app/plugins/auth-profile.client.ts, che
// popola lo store in modo asincrono e potrebbe non aver ancora finito
// quando il middleware gira, specialmente su un accesso diretto/refresh.
// Il redirect al login per utenti non autenticati resta compito del
// middleware globale di @nuxtjs/supabase (redirectOptions in nuxt.config.ts);
// qui si presume già autenticato e si controlla solo il ruolo.
export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser()
  if (!user.value) return

  const supabase = useSupabaseClient()
  const localePath = useLocalePath()

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.value.id)
    .single()

  if (data?.role !== 'ADMIN') {
    return navigateTo(localePath('/app/properties'))
  }
})
