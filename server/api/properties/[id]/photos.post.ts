// EPIC 4 — Upload foto (US-401). Riceve un singolo file multipart per
// richiesta (il client ne invia una sequenza, una per file selezionato),
// lo carica su Cloudinary e salva la riga in public.photos. Le credenziali
// Cloudinary restano solo qui lato server (vedi server/utils/cloudinary.ts);
// il client non parla mai direttamente con Cloudinary.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024 // 8MB

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Non autenticato.' })
  }

  const propertyId = getRouterParam(event, 'id')
  if (!propertyId) {
    throw createError({ statusCode: 400, statusMessage: 'ID proprietà mancante.' })
  }

  const parts = await readMultipartFormData(event)
  const filePart = parts?.find(p => p.name === 'file')

  if (!filePart || !filePart.data?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Nessun file ricevuto.' })
  }

  if (filePart.type && !ALLOWED_MIME_TYPES.includes(filePart.type)) {
    throw createError({ statusCode: 400, statusMessage: 'Formato non supportato. Usa JPEG, PNG o WEBP.' })
  }

  if (filePart.data.length > MAX_FILE_SIZE_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'File troppo grande (massimo 8MB).' })
  }

  const supabase = await serverSupabaseClient(event)

  // Verifica di accesso alla proprietà PRIMA di caricare su Cloudinary, per
  // non sprecare upload su richieste non autorizzate. La select passa dalla
  // stessa sessione utente del client, quindi è comunque soggetta alla RLS
  // "properties_owner_read_own": se non è owner/admin, semplicemente non
  // troverà la riga.
  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .single()

  if (propertyError || !property) {
    throw createError({ statusCode: 404, statusMessage: 'Proprietà non trovata o non accessibile.' })
  }

  const cloudinary = getCloudinary()

  const uploadResult = await new Promise<{ secure_url: string, public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `properties/${propertyId}` },
      (error, result) => {
        if (error || !result) reject(error ?? new Error('Upload Cloudinary fallito.'))
        else resolve(result)
      },
    )
    stream.end(filePart.data)
  })

  const { data: lastPhoto } = await supabase
    .from('photos')
    .select('sort_order')
    .eq('property_id', propertyId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextSortOrder = (lastPhoto?.sort_order ?? -1) + 1

  const { data: photo, error: insertError } = await supabase
    .from('photos')
    .insert({
      property_id: propertyId,
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      category: 'OTHER',
      sort_order: nextSortOrder,
    })
    .select('id, url, alt_text, category, sort_order, is_cover')
    .single()

  if (insertError || !photo) {
    // L'upload su Cloudinary è comunque riuscito: proviamo a ripulirlo per
    // non lasciare un asset orfano se il salvataggio in DB fallisce
    // (es. l'utente non è più owner nel frattempo, RLS blocca l'insert).
    await deleteCloudinaryAsset(uploadResult.public_id).catch(() => {})
    throw createError({ statusCode: 500, statusMessage: insertError?.message ?? 'Salvataggio della foto fallito.' })
  }

  return photo
})
