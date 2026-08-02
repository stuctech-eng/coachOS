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
  if (cardioBelast) redenen.push('cardio al belast')
  if (coreVermoeid) redenen.push('core vermoeid')
  if (bovenlichaamVermoeid) redenen.push('bovenlichaam vermoeid')
  if (benenVermoeid) redenen.push('benen vermoeid')

  return { reden: `lichaam al belast — ${redenen.join(', ')}` }
}
