// Endpoint temporaneo di verifica upload — usato da app/pages/test-upload.vue.
// Riceve un file multipart e lo carica su Cloudinary, in una cartella
// "test-uploads" separata da quella che useremo poi per le foto vere.
export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)
  const filePart = parts?.find(p => p.name === 'file')

  if (!filePart) {
    throw createError({ statusCode: 400, statusMessage: 'Nessun file ricevuto (campo "file" mancante).' })
  }

  const cloudinary = getCloudinary()

  const result = await new Promise<{ secure_url: string, public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'test-uploads' },
      (error, uploadResult) => {
        if (error || !uploadResult) reject(error ?? new Error('Upload fallito'))
        else resolve(uploadResult)
      },
    )
    stream.end(filePart.data)
  })

  return { url: result.secure_url, publicId: result.public_id }
})
