import { GoogleGenAI } from '@google/genai'

let _client: GoogleGenAI | null = null

function client(): GoogleGenAI {
  if (!_client) {
    const key = process.env.GOOGLE_API_KEY
    if (!key) throw new Error('Missing GOOGLE_API_KEY')
    _client = new GoogleGenAI({ apiKey: key })
  }
  return _client
}

// Returns raw PNG buffer.
// Model: imagen-4.0-generate-001 — Imagen 4, Google's best image generation model.
export async function generateImage(prompt: string): Promise<Buffer> {
  const response = await client().models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt,
    config: {
      numberOfImages: 1,
      aspectRatio:    '1:1',
    },
  })

  const b64 = response.generatedImages?.[0]?.image?.imageBytes
  if (!b64) throw new Error('Gemini returned no image bytes')
  return Buffer.from(b64, 'base64')
}
