// Genera uno slug URL-friendly da un nome libero (es. "Villa Sul Mare" -> "villa-sul-mare").
// Usato alla creazione di una proprietà (US-202); lo slug potrà poi essere
// modificato manualmente nello step "general-info" del wizard (US-301).
// In app/utils/ Nuxt lo auto-importa, nessun import esplicito richiesto.
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '') // rimuove i segni diacritici (e' -> e, a` -> a, ...)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Piccolo suffisso casuale da appendere in caso di collisione sullo slug
// (constraint unique su properties.slug) — evitiamo un tentativo infinito
// chiedendo di nuovo il nome all'owner in questa fase iniziale.
export function randomSlugSuffix(): string {
  return Math.random().toString(36).slice(2, 6)
}
