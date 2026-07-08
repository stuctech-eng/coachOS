// ─── Gedeelde TCX-parser ────────────────────────────────────────────────────
// v2.4.35: verplaatst van server-side-only (garmin-activity-tcx/route.ts)
// naar deze isomorfe module, zodat de browser het TCX-bestand zelf kan
// parsen. Reden: lange activiteiten genereren TCX-bestanden die de
// Vercel serverless-function payload-limiet (4,5 MB) overschrijden bij
// upload — 413 FUNCTION_PAYLOAD_TOO_LARGE. Parsen in de browser omzeilt
// dit volledig: alleen het kleine, samengevatte resultaat (een paar KB)
// gaat naar de server, nooit het volledige XML-bestand.

import { XMLParser } from 'fast-xml-parser'

export interface TcxParsed {
  garmin_sport: string | null
  duration_min: number | null
  distance_m: number | null
  calories: number | null
  avg_hr: number | null
  max_hr: number | null
  avg_cadence: number | null
  avg_watts: number | null
  has_gps: boolean
  creator_device: string | null
  start_date: string | null
}

export const ACTIVITEIT_OPTIES = ['Hardlopen', 'Fietsen (buiten)', 'Indoor Fietsen', 'Wandelen', 'Roeien', 'Krachttraining', 'Kettlebell', 'Anders']

// Sportherkenning — gebaseerd op onderzoek van 5 echte Garmin TCX-exports
// (zie changelog v2.4.25): Running=100% betrouwbaar, Biking=buiten én
// indoor (Zwift genereert nep-GPS), Other=geen onderscheid mogelijk.
export function bepaalKeuzeNodig(garminSport: string | null): boolean {
  return garminSport !== 'Running'
}

export function suggereerType(garminSport: string | null, hasGps: boolean): string {
  if (garminSport === 'Running') return 'Hardlopen'
  if (garminSport === 'Biking') return hasGps ? 'Fietsen (buiten)' : 'Indoor Fietsen'
  return hasGps ? 'Wandelen' : 'Roeien'
}

export function parseTcx(xmlText: string): TcxParsed {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
  const doc = parser.parse(xmlText)

  const tcd = doc.TrainingCenterDatabase
  const activityRaw = tcd?.Activities?.Activity
  const activity = Array.isArray(activityRaw) ? activityRaw[0] : activityRaw

  const garminSport: string | null = activity?.['@_Sport'] ?? null
  const startDate: string | null = activity?.Id ?? null
  const creatorDevice: string | null = activity?.Creator?.Name ?? null

  const lapsRaw = activity?.Lap
  const laps = Array.isArray(lapsRaw) ? lapsRaw : lapsRaw ? [lapsRaw] : []

  let totaalTijdSec = 0
  let totaalAfstand = 0
  let totaalCalorieen = 0
  let maxHr = 0
  const avgHrPerLap: number[] = []

  for (const lap of laps) {
    totaalTijdSec += parseFloat(lap.TotalTimeSeconds || '0')
    totaalAfstand += parseFloat(lap.DistanceMeters || '0')
    totaalCalorieen += parseInt(lap.Calories || '0', 10)
    const lapAvgHr = lap.AverageHeartRateBpm?.Value
    const lapMaxHr = lap.MaximumHeartRateBpm?.Value
    if (lapAvgHr) avgHrPerLap.push(parseInt(lapAvgHr, 10))
    if (lapMaxHr) maxHr = Math.max(maxHr, parseInt(lapMaxHr, 10))
  }

  // Trackpoints doorlopen voor GPS-check, cadans en watts. Namespace-
  // prefix (ns3:) blijft behouden op onderliggende veldnamen — gevonden
  // door tegen echte bestanden te testen (zie v2.4.25).
  let hasGps = false
  const cadenceValues: number[] = []
  const wattsValues: number[] = []

  for (const lap of laps) {
    const trackRaw = lap.Track
    const tracks = Array.isArray(trackRaw) ? trackRaw : trackRaw ? [trackRaw] : []
    for (const track of tracks) {
      const tpRaw = track.Trackpoint
      const trackpoints = Array.isArray(tpRaw) ? tpRaw : tpRaw ? [tpRaw] : []
      for (const tp of trackpoints) {
        if (tp.Position?.LatitudeDegrees !== undefined) hasGps = true
        const tpx = tp.Extensions?.['ns3:TPX']
        const cad = tp.Cadence ?? tpx?.['ns3:RunCadence']
        const watts = tpx?.['ns3:Watts']
        if (cad && parseInt(cad, 10) > 0) cadenceValues.push(parseInt(cad, 10))
        if (watts && parseFloat(watts) > 0) wattsValues.push(parseFloat(watts))
      }
    }
  }

  const gemiddelde = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

  return {
    garmin_sport: garminSport,
    duration_min: totaalTijdSec > 0 ? Math.round(totaalTijdSec / 60) : null,
    distance_m: totaalAfstand > 0 ? Math.round(totaalAfstand) : null,
    calories: totaalCalorieen > 0 ? totaalCalorieen : null,
    avg_hr: gemiddelde(avgHrPerLap),
    max_hr: maxHr > 0 ? maxHr : null,
    avg_cadence: gemiddelde(cadenceValues),
    avg_watts: gemiddelde(wattsValues),
    has_gps: hasGps,
    creator_device: creatorDevice,
    start_date: startDate,
  }
}
