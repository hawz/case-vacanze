// EPIC 4 — Eliminazione foto (US-404). Passa da un endpoint server (anziché
// da una delete diretta via supabase-js lato client, come per le proprietà)
// perché deve anche ripulire l'asset reale su Cloudinary, operazione che
// richiede le credenziali server-only (vedi server/utils/cloudinary.ts).
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Non autenticato.' })
  }

  const photoId = getRouterParam(event, 'photoId')
  if (!photoId) {
    throw createError({ statusCode: 400, statusMessage: 'ID foto mancante.' })
  }

  const supabase = await serverSupabaseClient(event)

  // La select passa dalla sessione dell'utente corrente: se non è owner/admin
  // della proprietà a cui appartiene la foto, la RLS "photos_public_read" la
  // nasconde comunque (a meno che la proprietà non sia pubblicata, ma qui non
  // ci interessa leggerla per mostrarla, solo per recuperare il public_id).
  const { data: photo, error: fetchError } = await supabase
    .from('photos')
    .select('public_id')
    .eq('id', photoId)
    .single()

  if (fetchError || !photo) {
    throw createError({ statusCode: 404, statusMessage: 'Foto non trovata o non accessibile.' })
  }

  const { error: deleteError } = await supabase
    .from('photos')
    .delete()
    .eq('id', photoId)

  if (deleteError) {
    throw createError({ statusCode: 500, statusMessage: deleteError.message })
  }

  if (photo.public_id) {
    // Best-effort: la riga in DB (fonte di verità per il mini-sito) è già
    // stata rimossa; un eventuale fallimento qui (es. asset già cancellato
    // manualmente) non deve far fallire la richiesta per l'utente.
    await deleteCloudinaryAsset(photo.public_id).catch(() => {})
  }

  return { success: true }
})
