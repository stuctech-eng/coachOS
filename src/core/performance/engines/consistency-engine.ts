import { getWekelijkseActiviteitPatroon, type WeekActiviteit } from '../data/performance-data-adapter'
import type { PerformanceContext } from '../core/types'
import type { EngineResult } from '../core/engine-result'
import { berekenConfidence } from './confidence-engine'

// ── Consistency Engine ────────────────────────────────────────────────
// Bron: overleg 21 juli 2026, Fase 1B. "Niet: hoe goed ben je. Maar:
// hoe consequent train je." VOLLEDIG DETERMINISTISCH, geen AI.
//
// Kijkt naar de laatste 8 weken: hoeveel weken hadden minstens één
// activiteit, wat is de huidige streak, wat was de langste onderbreking.

export interface ConsistencyValue {
  percentage: number // 0-100 — % van de weken met minstens 1 activiteit
  huidigeStreakWeken: number // opeenvolgende weken met activiteit, tot en met de huidige week
  langsteOnderbrekingWeken: number // langste aaneengesloten reeks weken ZONDER activiteit
  aantalWekenBekeken: number
}

const AANTAL_WEKEN = 8

function berekenConsistencyMetriek(weken: WeekActiviteit[]): ConsistencyValue {
  const actieveWeken = weken.filter(w => w.aantalActiviteiten > 0).length
  const percentage = weken.length > 0 ? Math.round((actieveWeken / weken.length) * 100) : 0

  // Huidige streak: vanaf de LAATSTE week terugtellend, zolang er
  // activiteit was
  let huidigeStreakWeken = 0
  for (let i = weken.length - 1; i >= 0; i--) {
    if (weken[i].aantalActiviteiten > 0) huidigeStreakWeken++
    else break
  }

  // Langste onderbreking: langste aaneengesloten reeks weken zonder
  // activiteit, ergens in de bekeken periode
  let langsteOnderbrekingWeken = 0
  let huidigeOnderbreking = 0
  for (const week of weken) {
    if (week.aantalActiviteiten === 0) {
      huidigeOnderbreking++
      langsteOnderbrekingWeken = Math.max(langsteOnderbrekingWeken, huidigeOnderbreking)
    } else {
      huidigeOnderbreking = 0
    }
  }

  return { percentage, huidigeStreakWeken, langsteOnderbrekingWeken, aantalWekenBekeken: weken.length }
}

export async function berekenConsistency(context: PerformanceContext): Promise<EngineResult<ConsistencyValue>> {
  const weken = await getWekelijkseActiviteitPatroon(context.userId, AANTAL_WEKEN)
  const value = berekenConsistencyMetriek(weken)

  return {
    engine: 'Consistency',
    timestamp: new Date().toISOString(),
    value,
    confidence: berekenConfidence(context),
    metadata: {
      dataPointsUsed: weken.length,
      calculationVersion: `consistency-engine.ts v1 (${AANTAL_WEKEN} weken)`,
    },
  }
}
