import { v2 as cloudinary } from 'cloudinary'

// Configura il client Cloudinary una sola volta, leggendo le credenziali
// da runtimeConfig (mai esposte al client, l'upload passa sempre da un
// endpoint server, vedi server/api/test-upload.post.ts).
export function getCloudinary() {
  const config = useRuntimeConfig()
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
  })
  return cloudinary
}
