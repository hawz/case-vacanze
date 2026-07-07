import { v2 as cloudinary } from 'cloudinary'

// Configura il client Cloudinary una sola volta, leggendo le credenziali
// da runtimeConfig (mai esposte al client, l'upload passa sempre da un
// endpoint server, vedi server/api/properties/[id]/photos.post.ts).
export function getCloudinary() {
  const config = useRuntimeConfig()
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
  })
  return cloudinary
}

// Elimina l'asset reale su Cloudinary (US-404), a partire dal public_id
// salvato in public.photos alla creazione. Best-effort: chi chiama decide
// se propagare o solo loggare un eventuale fallimento (es. asset già
// rimosso manualmente), la riga in DB è comunque la fonte di verità per
// cosa è visibile sul mini-sito.
export async function deleteCloudinaryAsset(publicId: string) {
  const client = getCloudinary()
  return client.uploader.destroy(publicId)
}
