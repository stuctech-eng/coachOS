import type { UniversalWorkout, WorkoutBlock } from './types'

// ── CoachOS Workout Platform — Validation Engine ─────────────────────────
// Bron: Universal Workout Builder Master Architecture v1.0. Fase 1, stap 3.
// Controleert automatisch: bestaat warming-up/cooling-down, past binnen
// beschikbare tijd, past binnen herstel, geen lege/inconsistente workout.
// 100% deterministisch — geen AI, geen sportlogica (geen FTP/pace-kennis
// hier, alleen structurele/tijd/veiligheidschecks op het generieke
// UniversalWorkout-object).
//
// Bewust een kleine, concrete input-set voor de veiligheidscontext
// (beschikbareTijd/maxIntensiteit) — niet meteen de volledige Coach
// Policy/Recovery/Fatigue-koppeling. Die volgt als latere integratiestap
// zodra er een concrete aanroeper is die deze context al heeft.

export interface ValidationContext {
  /** Als gegeven: checkt of de workout binnen deze tijd past (seconden) */
  beschikbareTijd_sec?: number
  /** Van CoachPolicy — 'low' blokkeert hoge-intensiteit trainingType's
   * (interval/sprint/tempo), matcht "veilige belasting" uit de visie */
  maxIntensiteit?: 'low' | 'moderate' | 'high'
}

export interface ValidationResult {
  geldig: boolean
  problemen: string[]
  waarschuwingen: string[]
}

/** Werkelijke totale duur van een blok, rekening houdend met repeat +
 * rust_na_repeat_sec — een interval-blok met duration_sec=540 en
 * repeat=5 duurt in werkelijkheid niet 540s maar 540*5 + rust*4. */
function werkelijkeBlokDuur(blok: WorkoutBlock): number {
  if (!blok.repeat || blok.repeat <= 1) return blok.duration_sec
  const rust = blok.rust_na_repeat_sec || 0
  return blok.duration_sec * blok.repeat + rust * (blok.repeat - 1)
}

export function berekenWerkelijkeTotaleDuur(workout: UniversalWorkout): number {
  const alleBlokken = [
    ...workout.warmup, ...workout.mainBlocks, ...workout.recoveryBlocks,
    ...workout.cooldown, ...(workout.mobility || []),
  ]
  return alleBlokken.reduce((som, blok) => som + werkelijkeBlokDuur(blok), 0)
}

const HOGE_INTENSITEIT_TYPES = ['interval', 'sprint', 'tempo']

export function valideerWorkout(workout: UniversalWorkout, context?: ValidationContext): ValidationResult {
  const problemen: string[] = []
  const waarschuwingen: string[] = []

  // Structurele checks — "bestaat warming-up", "bestaat cooling-down"
  if (workout.warmup.length === 0) problemen.push('Geen warming-up aanwezig.')
  if (workout.cooldown.length === 0) problemen.push('Geen cooling-down aanwezig.')
  if (workout.mainBlocks.length === 0) problemen.push('Geen hoofdblok(ken) aanwezig — lege workout.')

  // Consistentie: elk blok moet een positieve duur hebben
  const alleBlokken = [...workout.warmup, ...workout.mainBlocks, ...workout.recoveryBlocks, ...workout.cooldown, ...(workout.mobility || [])]
  for (const blok of alleBlokken) {
    if (blok.duration_sec <= 0) problemen.push(`Blok "${blok.type}" heeft een ongeldige duur (${blok.duration_sec}s).`)
    if (blok.repeat !== undefined && blok.repeat < 1) problemen.push(`Blok "${blok.type}" heeft een ongeldig aantal herhalingen (${blok.repeat}).`)
  }

  const werkelijkeTotaleDuur = berekenWerkelijkeTotaleDuur(workout)

  // "past binnen beschikbare tijd"
  if (context?.beschikbareTijd_sec !== undefined) {
    if (werkelijkeTotaleDuur > context.beschikbareTijd_sec) {
      problemen.push(`Workout duurt ${Math.round(werkelijkeTotaleDuur / 60)} min, maar er is maar ${Math.round(context.beschikbareTijd_sec / 60)} min beschikbaar.`)
    } else if (werkelijkeTotaleDuur < context.beschikbareTijd_sec * 0.5) {
      // Geen harde fout — een korte workout binnen ruime tijd is geen
      // veiligheidsprobleem, wel vermeldenswaardig
      waarschuwingen.push(`Workout (${Math.round(werkelijkeTotaleDuur / 60)} min) gebruikt minder dan de helft van de beschikbare ${Math.round(context.beschikbareTijd_sec / 60)} min.`)
    }
  }

  // "veilige belasting" — past binnen herstel (CoachPolicy-signaal)
  if (context?.maxIntensiteit === 'low' && HOGE_INTENSITEIT_TYPES.includes(workout.trainingType)) {
    problemen.push(`Trainingstype "${workout.trainingType}" is een hoge-intensiteit-sessie, maar CoachPolicy staat vandaag alleen lage intensiteit toe.`)
  }
  if (context?.maxIntensiteit === 'moderate' && workout.trainingType === 'sprint') {
    waarschuwingen.push('Sprint-sessie gepland terwijl CoachPolicy vandaag "moderate" als maximum aangeeft — overweeg een minder intensieve variant.')
  }

  // Sanity-check op mesocyclus vs. moeilijkheidsgraad — geen harde fout,
  // wel een waarschuwing (herstel-mesocyclus met een gevorderd-niveau
  // sessie is ongebruikelijk, geen automatische blokkade)
  if (workout.mesocycle === 'herstel' && workout.difficulty === 'gevorderd') {
    waarschuwingen.push('Gevorderd niveau gecombineerd met een hersteldweek — controleer of dit klopt.')
  }

  return { geldig: problemen.length === 0, problemen, waarschuwingen }
}
