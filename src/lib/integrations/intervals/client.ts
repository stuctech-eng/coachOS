// ── Intervals.icu — API-client ──────────────────────────────────────────
// v2.4.337. Fase 12 (Mapping) van het master plan "Intervals.icu →
// CoachOS Data Bridge v1.0", vastgesteld 21 augustus 2026.
//
// Alle communicatie met Intervals.icu — geëxtraheerd uit de eerdere
// testroute (api/debug/intervals-icu-test), zodat de mapper/dry-run-
// route en toekomstige productiecode dezelfde, ene implementatie
// hergebruiken (§6/§7 van het master plan: server-side, geen dubbele
// client-logica).

const INTERVALS_BASE_URL = 'https://intervals.icu/api/v1'

export interface IntervalsConfig {
  apiKey: string
  athleteId: string
}

export function haalIntervalsConfig(): IntervalsConfig | null {
  const apiKey = process.env.INTERVALS_ICU_API_KEY
  const athleteId = process.env.INTERVALS_ICU_ATHLETE_ID
  if (!apiKey || !athleteId) return null
  return { apiKey, athleteId }
}

function authHeaderVoor(apiKey: string): string {
  return 'Basic ' + Buffer.from(`API_KEY:${apiKey}`).toString('base64')
}

export async function haalIntervalsActiviteiten(config: IntervalsConfig, oudsteDatum: string, nieuwsteDatum: string) {
  const res = await fetch(
    `${INTERVALS_BASE_URL}/athlete/${config.athleteId}/activities?oldest=${oudsteDatum}&newest=${nieuwsteDatum}`,
    { headers: { Authorization: authHeaderVoor(config.apiKey) } }
  )
  if (!res.ok) throw new Error(`Intervals.icu-activiteiten ophalen mislukt: HTTP ${res.status}`)
  return res.json()
}
