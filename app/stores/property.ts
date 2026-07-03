// Elenco delle property dell'owner corrente, usato dalla dashboard
// /app/properties e dalle sezioni operative (calendario, richieste, ecc.).
export const usePropertyStore = defineStore('property', () => {
  const properties = ref<Array<{ id: string, slug: string, name: string, status: string }>>([])
  const isLoading = ref(false)

  function setProperties(value: typeof properties.value) {
    properties.value = value
  }

  return { properties, isLoading, setProperties }
})
