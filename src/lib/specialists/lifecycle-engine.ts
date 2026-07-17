import { haalCyclingData } from './cycling-data'
import { haalRunningData } from './running-data'

// ── Specialist Lifecycle Engine ─────────────────────────────────────────
// Bewust GEEN opgeslagen status-veld in de database — de levenscyclus is
// businesslogica, geen data. Alles hieronder is herberekend uit
// specialist_profiles.active + activity_sessions, elke keer opnieuw.
//
// DISCOVERABLE → SUGGESTED → ACTIVE → DORMANT → RETURNING → (terug naar ACTIVE)
//
// v2.4.83: geherstructureerd naar een generieke kernfunctie
// (berekenLifecycle) + dunne per-sport-wrappers, in plaats van
// gedupliceerde logica per sport. Toepassing van de "generieke
// rekenbibliotheek, sport-specifieke implementatie"-aanscherping uit
// specialist-api.md (v2.4.72) — precies het scenario dat toen werd
// voorspeld, nu voor het eerst concreet.

export type LifecycleState = 'DISCOVERABLE' | 'SUGGESTED' | 'ACTIVE' | 'DORMANT' | 'RETURNING'

export interface LifecycleResult {
  state: LifecycleState
  aantal_activiteiten_30d: number
  laatste_activiteit_datum: string | null
  dagen_sinds_laatste_activiteit: number | null
  vorige_actieve_periode: { start: string; eind: string } | null
}

const PATROON_DREMPEL = 3
const PATROON_PERIODE_DAGEN = 30
const DORMANT_DAGEN = 60
const RETURNING_VENSTER_DAGEN = 14
const HISTORIE_DAGEN = 730

interface ActiviteitMetDatum {
  date: string
}

interface DataMetActiviteiten {
  activiteiten: ActiviteitMetDatum[]
}

// ── Generieke kern — sport-onafhankelijk ────────────────────────────────
async function berekenLifecycle(
  haalData: (userId: string, periodDays: number) => Promise<DataMetActiviteiten>,
  userId: string,
  isActief: boolean
): Promise<LifecycleResult> {
  const data = await haalData(userId, HISTORIE_DAGEN)
  const activiteiten = [...data.activiteiten].sort((a, b) => a.date.localeCompare(b.date))

  const nu = new Date()
  const dertigDagenGeleden = new Date(nu.getTime() - PATROON_PERIODE_DAGEN * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const aantalRecent = activiteiten.filter(a => a.date >= dertigDagenGeleden).length

  const laatsteActiviteit = activiteiten.length > 0 ? activiteiten[activiteiten.length - 1] : null
  const laatsteDatum = laatsteActiviteit?.date ?? null
  const dagenSindsLaatste = laatsteDatum
    ? Math.floor((nu.getTime() - new Date(laatsteDatum).getTime()) / (24 * 60 * 60 * 1000))
    : null

  let vorigePeriode: { start: string; eind: string } | null = null
  let state: LifecycleState

  if (!isActief) {
    state = aantalRecent >= PATROON_DREMPEL ? 'SUGGESTED' : 'DISCOVERABLE'
  } else if (dagenSindsLaatste === null || dagenSindsLaatste >= DORMANT_DAGEN) {
    state = 'DORMANT'
  } else {
    let eersteActiviteitNaGap: string | null = null
    for (let i = activiteiten.length - 1; i > 0; i--) {
      const gapDagen = Math.floor(
        (new Date(activiteiten[i].date).getTime() - new Date(activiteiten[i - 1].date).getTime()) / (24 * 60 * 60 * 1000)
      )
      if (gapDagen >= DORMANT_DAGEN) {
        eersteActiviteitNaGap = activiteiten[i].date
        vorigePeriode = { start: activiteiten[0].date, eind: activiteiten[i - 1].date }
        break
      }
    }

    if (eersteActiviteitNaGap) {
      const dagenSindsHervatting = Math.floor((nu.getTime() - new Date(eersteActiviteitNaGap).getTime()) / (24 * 60 * 60 * 1000))
      state = dagenSindsHervatting <= RETURNING_VENSTER_DAGEN ? 'RETURNING' : 'ACTIVE'
    } else {
      state = 'ACTIVE'
    }
  }

  return {
    state,
    aantal_activiteiten_30d: aantalRecent,
    laatste_activiteit_datum: laatsteDatum,
    dagen_sinds_laatste_activiteit: dagenSindsLaatste,
    vorige_actieve_periode: vorigePeriode,
  }
}

// ── Dunne, sport-specifieke wrappers ────────────────────────────────────
export async function bepaalCyclingLifecycle(userId: string, isActief: boolean): Promise<LifecycleResult> {
  return berekenLifecycle(haalCyclingData, userId, isActief)
}

export async function bepaalRunningLifecycle(userId: string, isActief: boolean): Promise<LifecycleResult> {
  return berekenLifecycle(haalRunningData, userId, isActief)
}
