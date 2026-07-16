import { haalCyclingData } from './cycling-data'

// ── Specialist Lifecycle Engine ─────────────────────────────────────────
// Bewust GEEN opgeslagen status-veld in de database — de levenscyclus is
// businesslogica, geen data. Alles hieronder is herberekend uit
// specialist_profiles.active + activity_sessions, elke keer opnieuw.
//
// DISCOVERABLE → SUGGESTED → ACTIVE → DORMANT → RETURNING → (terug naar ACTIVE)
//
// Op dit moment cycling-specifiek (roept haalCyclingData aan) — bij een
// volgende specialist wordt dit patroon hergebruikt met een eigen
// data-fetcher, dezelfde toestandslogica.

export type LifecycleState = 'DISCOVERABLE' | 'SUGGESTED' | 'ACTIVE' | 'DORMANT' | 'RETURNING'

export interface LifecycleResult {
  state: LifecycleState
  aantal_activiteiten_30d: number
  laatste_activiteit_datum: string | null
  dagen_sinds_laatste_activiteit: number | null
  // Alleen gevuld bij RETURNING — de vorige actieve periode, voor
  // persoonlijkere context in het Coach Layer-advies ("je vorige
  // trainingsblok eindigde in maart")
  vorige_actieve_periode: { start: string; eind: string } | null
}

const PATROON_DREMPEL = 3           // activiteiten binnen PATROON_PERIODE_DAGEN → SUGGESTED
const PATROON_PERIODE_DAGEN = 30
const DORMANT_DAGEN = 60            // geen activiteit in X dagen → DORMANT
const RETURNING_VENSTER_DAGEN = 14  // hoe lang na hervatting nog "RETURNING" i.p.v. gewoon "ACTIVE"
const HISTORIE_DAGEN = 730          // hoe ver terugkijken voor een eventuele vorige periode (2 jaar)

export async function bepaalCyclingLifecycle(userId: string, isActief: boolean): Promise<LifecycleResult> {
  const data = await haalCyclingData(userId, HISTORIE_DAGEN)
  const activiteiten = [...data.activiteiten].sort((a, b) => a.date.localeCompare(b.date)) // oud → nieuw

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
    // Zoek de meest recente "grote gap" (>= DORMANT_DAGEN) in de
    // geschiedenis — als de huidige activiteit-cluster daar net na
    // begon (binnen RETURNING_VENSTER_DAGEN), is dit een terugkeer,
    // geen doorlopende actieve periode.
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
