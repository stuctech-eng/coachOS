import type { UniversalWorkout, WorkoutBlock, WorkoutTarget } from './types'

// ── CoachOS Workout Platform — Adaptation Engine ─────────────────────────
// Bron: Universal Workout Builder Master Architecture v1.0. Fase 1, stap 4.
// Past een AL GEBOUWDE workout automatisch aan — draait NA de Builder,
// VÓÓR de Validation Engine (een aangepaste workout moet alsnog gevalideerd
// worden, deze laag garandeert niet zelf de veiligheid).
//
// Bewust EXACT de twee voorbeelden uit de Master Vision, niet meer:
//   slechte slaap → kortere warming-up → minder intervallen → lagere intensiteit
//   extra beschikbare tijd → extra duurblok → langere cooling-down → mobiliteit
// Verdere triggers (blessure/weer/etc.) volgen als latere, losse stappen.
//
// 100% deterministisch — geen AI. Elke wijziging wordt vastgelegd in
// workout.adaptations (transparantie — "waarom ziet mijn training er zo
// uit", zelfde principe als REASON_CODE_UITLEG in de Training Plan Engine).

export interface AdaptationSignals {
  /** Matcht exact het Master Vision-voorbeeld: slechte slaap → korter/lichter */
  slechteSlaap?: boolean
  /** Positief = meer tijd dan oorspronkelijk gepland (seconden), negatief
   * = minder tijd. 0/undefined = geen aanpassing. */
  extraBeschikbareTijd_sec?: number
}

function kopieerWorkout(workout: UniversalWorkout): UniversalWorkout {
  // Diepe kopie — de Adaptation Engine mag het origineel nooit muteren,
  // zodat de aanroeper altijd nog de ongewijzigde versie heeft
  return JSON.parse(JSON.stringify(workout)) as UniversalWorkout
}

function verlaagZoneTargets(targets: WorkoutTarget[]): WorkoutTarget[] {
  return targets.map(t => t.type === 'zone' && t.zone_nummer && t.zone_nummer > 1
    ? { ...t, zone_nummer: t.zone_nummer - 1 }
    : t)
}

function pasSlechteSlaapToe(workout: UniversalWorkout): string[] {
  const toelichtingen: string[] = []

  // 1. Kortere warming-up (-30%, ondergrens 3 min)
  if (workout.warmup.length > 0) {
    const oud = workout.warmup[0].duration_sec
    workout.warmup[0].duration_sec = Math.max(180, Math.round(oud * 0.7))
    if (workout.warmup[0].duration_sec !== oud) toelichtingen.push('Kortere warming-up (slecht geslapen — lichaam heeft minder opbouwtijd nodig bij een lagere intensiteit).')
  }

  // 2. Minder intervallen (repeat verminderen, ondergrens 2) + 3. lagere intensiteit
  for (const blok of workout.mainBlocks) {
    if (blok.repeat && blok.repeat > 2) {
      const oudAantal = blok.repeat
      blok.repeat = Math.max(2, blok.repeat - 1)
      if (blok.repeat !== oudAantal) toelichtingen.push(`Aantal herhalingen verlaagd van ${oudAantal} naar ${blok.repeat} — minder belasting bij onvoldoende herstel.`)
    }
    const oudeTargets = JSON.stringify(blok.targets)
    blok.targets = verlaagZoneTargets(blok.targets)
    if (JSON.stringify(blok.targets) !== oudeTargets) toelichtingen.push('Intensiteit één zone lager gezet.')
  }

  return toelichtingen
}

function pasBeschikbareTijdToe(workout: UniversalWorkout, extraTijd_sec: number): string[] {
  const toelichtingen: string[] = []

  if (extraTijd_sec > 0) {
    // 1. Extra duurblok (hoofdblok verlengen, max 50% van de extra tijd —
    //    de rest gaat naar cooldown/mobiliteit, niet alles in het hoofdblok)
    if (workout.mainBlocks.length > 0) {
      const extraHoofdblok = Math.round(extraTijd_sec * 0.5)
      workout.mainBlocks[0].duration_sec += extraHoofdblok
      toelichtingen.push(`Hoofdblok verlengd met ${Math.round(extraHoofdblok / 60)} min — meer tijd beschikbaar dan gepland.`)
    }
    // 2. Langere cooling-down (max 30% van de extra tijd)
    if (workout.cooldown.length > 0) {
      const extraCooldown = Math.round(extraTijd_sec * 0.3)
      workout.cooldown[0].duration_sec += extraCooldown
      toelichtingen.push(`Cooling-down verlengd met ${Math.round(extraCooldown / 60)} min.`)
    }
    // 3. Mobiliteit toevoegen (resterende ~20%, alleen als er nog geen mobility-blok is)
    const restTijd = extraTijd_sec - Math.round(extraTijd_sec * 0.5) - Math.round(extraTijd_sec * 0.3)
    if (restTijd >= 120 && (!workout.mobility || workout.mobility.length === 0)) {
      const mobiliteitBlok: WorkoutBlock = {
        id: `mob-${Date.now()}`, type: 'mobiliteit', duration_sec: restTijd,
        targets: [], instruction: 'Losse mobiliteitsoefeningen — heupen, schouders, rug.',
      }
      workout.mobility = [mobiliteitBlok]
      toelichtingen.push(`Mobiliteitsblok van ${Math.round(restTijd / 60)} min toegevoegd met de resterende extra tijd.`)
    }
  } else if (extraTijd_sec < 0) {
    // Minder tijd dan gepland — verkort het hoofdblok proportioneel,
    // nooit onder een praktische ondergrens van 5 minuten
    const tekort = Math.abs(extraTijd_sec)
    if (workout.mainBlocks.length > 0) {
      const oud = workout.mainBlocks[0].duration_sec
      workout.mainBlocks[0].duration_sec = Math.max(300, oud - tekort)
      const daadwerkelijkeVerkorting = oud - workout.mainBlocks[0].duration_sec
      if (daadwerkelijkeVerkorting > 0) toelichtingen.push(`Hoofdblok verkort met ${Math.round(daadwerkelijkeVerkorting / 60)} min — minder tijd beschikbaar dan gepland.`)
    }
  }

  return toelichtingen
}

export function pasWorkoutAan(origineel: UniversalWorkout, signalen: AdaptationSignals): UniversalWorkout {
  const workout = kopieerWorkout(origineel)
  const nieuweAanpassingen: string[] = []

  if (signalen.slechteSlaap) {
    nieuweAanpassingen.push(...pasSlechteSlaapToe(workout))
  }
  if (signalen.extraBeschikbareTijd_sec) {
    nieuweAanpassingen.push(...pasBeschikbareTijdToe(workout, signalen.extraBeschikbareTijd_sec))
  }

  workout.adaptations = [...workout.adaptations, ...nieuweAanpassingen]
  return workout
}
