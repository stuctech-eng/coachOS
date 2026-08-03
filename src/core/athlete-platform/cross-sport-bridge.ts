import type { UniversalAthleteState } from './types'
import type { AdaptationSignals } from '@/core/workout-builder/adaptation'

// ── Universal Athlete Platform ↔ Workout Platform — Cross-Sport Bridge ──
// Bron: overleg 2 augustus 2026, exact het centrale voorbeeld uit de
// Master Vision zelf:
//   "Vandaag 90 min roeien → morgen opent de gebruiker Running.
//    Running leest niet 'gisteren geroeid', maar leest de Universal
//    Athlete State (Cardio hoog/Core vermoeid/Upper Body vermoeid) en
//    kiest daarom een rustige duurloop — niet omdat er geroeid is,
//    maar omdat het lichaam al belast is."
//
// Deze module IS die vertaalstap. Hergebruikt bewust de al-bestaande,
// getestte Adaptation Engine-mechaniek (pasDownscaleToe, via het
// lichaamAlBelast-signaal) — geen nieuwe downscale-logica verzonnen.
//
// KERNREGEL: puur signaal-aflevering, geen beslissing. Deze functie
// bepaalt OF het lichaam al belast is (en waarom) — wat de aanroeper
// daarmee doet (wel/niet toepassen) blijft aan de aanroeper (Today
// Engine/specialist-route), zelfde Observer-grens als de rest van het
// Universal Athlete Platform.

const BELASTE_NIVEAUS = ['hoog', 'zeer_hoog']

/** Leest de Universal Athlete State en bepaalt of "lichaam al belast"
 * van toepassing is. Kijkt naar cardiovasculaire belasting + spier-
 * vermoeidheid (core/bovenlichaam/benen) — bewust NIET naar mechanische
 * impact (dat is sport-specifiek, bijv. hardlopen belast gewrichten
 * anders dan roeien, en dat verschil hoort een latere, preciezere
 * verfijning te zijn, niet deze eerste, brede versie).
 *
 * v2.4.243-FIX: gevonden bij het testen van de Running→Rowing-richting
 * (de andere kant van het al-werkende Rowing→Running-voorbeeld) —
 * been_vermoeidheid werd NERGENS gecheckt, ondanks dat het commentaar
 * hierboven het al noemde. Running's belasting zit primair in de benen
 * (zie running-impact-adapter.ts) — zonder deze check zou het signaal
 * voor Running-sessies zo goed als nooit afgaan. */
export function bepaalKruisSportSignaal(state: UniversalAthleteState): AdaptationSignals['lichaamAlBelast'] | null {
  const cardioBelast = BELASTE_NIVEAUS.includes(state.cardiovasculair.aerobic_load.niveau)
  const coreVermoeid = BELASTE_NIVEAUS.includes(state.spieren.core_vermoeidheid.niveau)
  const bovenlichaamVermoeid = BELASTE_NIVEAUS.includes(state.spieren.bovenlichaam_vermoeidheid.niveau)
  const benenVermoeid = BELASTE_NIVEAUS.includes(state.spieren.been_vermoeidheid.niveau)

  if (!cardioBelast && !coreVermoeid && !bovenlichaamVermoeid && !benenVermoeid) return null

  const redenen: string[] = []
  const bronSporten: string[] = []
  if (cardioBelast) { redenen.push('cardio al belast'); if (state.cardiovasculair.aerobic_load.laatste_bron_sport) bronSporten.push(state.cardiovasculair.aerobic_load.laatste_bron_sport) }
  if (coreVermoeid) { redenen.push('core vermoeid'); if (state.spieren.core_vermoeidheid.laatste_bron_sport) bronSporten.push(state.spieren.core_vermoeidheid.laatste_bron_sport) }
  if (bovenlichaamVermoeid) { redenen.push('bovenlichaam vermoeid'); if (state.spieren.bovenlichaam_vermoeidheid.laatste_bron_sport) bronSporten.push(state.spieren.bovenlichaam_vermoeidheid.laatste_bron_sport) }
  if (benenVermoeid) { redenen.push('benen vermoeid'); if (state.spieren.been_vermoeidheid.laatste_bron_sport) bronSporten.push(state.spieren.been_vermoeidheid.laatste_bron_sport) }

  // v2.4.247: bepaal de meest voorkomende bronsport onder de belaste
  // dimensies (bijv. als cardio/core/bovenlichaam allemaal 'rowing'
  // als bron hebben, is 'rowing' overduidelijk de oorzaak) — puur voor
  // transparantie in de UI, geen invloed op de beslissing zelf
  let bronSport: string | undefined
  if (bronSporten.length > 0) {
    const tellingen = new Map<string, number>()
    for (const s of bronSporten) tellingen.set(s, (tellingen.get(s) ?? 0) + 1)
    bronSport = [...tellingen.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }

  return { reden: `lichaam al belast — ${redenen.join(', ')}`, bronSport }
}
