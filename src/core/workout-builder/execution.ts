import type { UniversalWorkout, WorkoutBlock } from './types'

// ── CoachOS Workout Platform — Execution Engine ──────────────────────────
// Bron: Universal Workout Builder Master Architecture v1.0. Fase 1, stap 5b.
// "Iedere workout krijgt uitvoeringsinformatie: volgorde, rustmomenten,
// timer, automatische intervallen, audio cues, countdown, pauzes, notities."
// 100% deterministisch, afgeleid uit de workout-structuur zelf — geen
// AI, geen sportlogica.

const BLOK_LABEL: Record<string, string> = {
  warmup: 'Warming-up', hoofdblok: 'Hoofdblok', interval: 'Intervallen',
  herstel: 'Herstel', techniek: 'Techniekblok', cadans: 'Cadansblok',
  mobiliteit: 'Mobiliteit', cooldown: 'Cooling-down',
}

function formatDuur(sec: number): string {
  const min = Math.round(sec / 60)
  return min >= 1 ? `${min} min` : `${sec} sec`
}

/** Genereert een leesbare volgorde-omschrijving van alle blokken. */
function genereerVolgorde(workout: UniversalWorkout): string[] {
  const alleBlokken: WorkoutBlock[] = [
    ...workout.warmup, ...workout.mainBlocks, ...workout.recoveryBlocks,
    ...workout.cooldown, ...(workout.mobility || []),
  ]
  return alleBlokken.map(blok => {
    const label = BLOK_LABEL[blok.type] || blok.type
    if (blok.repeat && blok.repeat > 1) {
      return `${label}: ${blok.repeat}× ${formatDuur(blok.duration_sec)}${blok.rust_na_repeat_sec ? ` (${formatDuur(blok.rust_na_repeat_sec)} rust ertussen)` : ''}`
    }
    return `${label}: ${formatDuur(blok.duration_sec)}`
  })
}

/** Countdown/audio-cue-momenten — alleen relevant bij herhaalde
 * (interval-achtige) blokken, waar automatische overgangen zinvol zijn. */
function genereerAudioCues(workout: UniversalWorkout): string[] {
  const cues: string[] = []
  for (const blok of workout.mainBlocks) {
    if (blok.repeat && blok.repeat > 1) {
      cues.push(`Countdown bij de laatste 10 seconden van elke herhaling.`)
      cues.push(`Audio-signaal bij start en einde van elke rustperiode.`)
      break // één keer noemen is genoeg, ook bij meerdere interval-blokken
    }
  }
  if (workout.warmup.length > 0) cues.push('Signaal bij overgang van warming-up naar hoofdblok.')
  if (workout.cooldown.length > 0) cues.push('Signaal bij start van de cooling-down.')
  return cues
}

export function genereerUitvoeringsHints(workout: UniversalWorkout): string[] {
  const hints: string[] = []
  hints.push(...genereerVolgorde(workout))
  hints.push(...genereerAudioCues(workout))
  return hints
}
