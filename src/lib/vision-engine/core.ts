import sharp from 'sharp'
import type { VisionParser, VisionParseResult } from './types'

// ── Vision Engine Core ───────────────────────────────────────────────────
// Bron: overleg 20 juli 2026. Exact het comprimeren/AI-call/parse-patroon
// dat al bewezen werkte in garmin-vision/route.ts (v2.4.x) — hier
// generiek gemaakt zodat elke parser (Garmin Health, Garmin Performance,
// later evt. andere bronnen) 'm hergebruikt in plaats van dupliceert.

export async function verwerkScreenshot<T>(parser: VisionParser<T>, imageBuffer: Buffer): Promise<VisionParseResult<T>> {
  // Comprimeer vóór de Vision-call — bespaart tokens, sneller
  const compressedBuffer = await sharp(imageBuffer)
    .resize({ width: 800, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer()
  const base64 = compressedBuffer.toString('base64')

  const visionRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            { type: 'text', text: parser.prompt },
          ],
        },
      ],
    }),
  })

  if (!visionRes.ok) {
    const errText = await visionRes.text()
    console.error(`[vision-engine/${parser.naam}] Anthropic error:`, errText)
    throw new Error('AI kon de afbeelding niet verwerken.')
  }

  const visionData = await visionRes.json()
  const rawText: string = visionData.content?.[0]?.text ?? ''

  let rawJson: Record<string, unknown>
  try {
    const cleaned = rawText.replace(/```json|```/g, '').trim()
    rawJson = JSON.parse(cleaned)
  } catch {
    throw new Error('Kon de afbeelding niet verwerken. Probeer een scherpere screenshot.')
  }

  const parsed = parser.normalize(rawJson)
  const { flags, confidence } = parser.validate(parsed)

  return { parsed, raw_response: rawJson, confidence, flags }
}
