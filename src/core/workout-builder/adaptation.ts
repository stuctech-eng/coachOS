import type { UniversalWorkout, WorkoutBlock, WorkoutTarget } from './types'

// ── CoachOS Workout Platform — Adaptation Engine ─────────────────────────
// Bron: Universal Workout Builder Master Architecture v1.0, Fase 1 stap 4
// (v2.4.227), uitgebreid v2.4.241 (kruis-sport), en v2.4.265: ADR-007 —
// "Single Workout Mutation Principle" (overleg 4 augustus 2026).
//
// ADR-007: Binnen CoachOS mag slechts één component de uiteindelijke
// workout wijzigen — deze Adaptation Engine. Alle overige componenten
// (Daily Adjustment Layer, Universal Athlete Platform, toekomstige
// weer-/slaap-/blessure-signalen) leveren UITSLUITEND signalen aan, in
// het gedeelde AdaptationSignal-contract hieronder. Dit voorkomt het
// gevonden risico: twee onafhankelijke lagen die elk zelfstandig de
// workout verkleinden, met een cumulatief, niet meer uitlegbaar effect.
//
// 100% deterministisch — geen AI. Elke wijziging wordt vastgelegd in
// workout.adaptations (transparantie).

/** Uniform contract — elke bron (fatigue/cross_sport/sleep/weather/...)
 * levert exact dit object aan, nooit een eigen ad-hoc vorm. Nieuwe
 * bronnen (Strength, Nutrition, Recovery) spreken hierdoor automatisch
 * hetzelfde protocol, zonder de Adaptation Engine zelf aan te passen. */
export interface AdaptationSignal {
  // v2.4.314: 'vacation' toegevoegd — Coach Decision Integrity-
  // bouwopdracht, 11 augustus 2026. Loopt door dezelfde keten als de
  // bestaande bronnen, geen aparte behandeling nodig in pasWorkoutAan()
  // zelf (die kent alleen severity/reden, geen sport- of bron-specifieke
  // logica — vandaar dat dit een kleine, veilige toevoeging is).
  source: 'fatigue' | 'cross_sport' | 'sleep' | 'weather' | 'vacation'
  severity: 'low' | 'medium' | 'high'
  /** 0-100 — hoe zeker is de bron van dit signaal */
  confidence: number
  /** Mens-leesbare toelichting, voor de "waarom is mijn training zo"-transparantie */
  reden: string
  /** Bronspecifieke extra context (bijv. { bronSport: 'rowing' } bij cross_sport) — de Adaptation Engine leest dit zelf niet, puur voor UI-doeleinden */
  metadata?: Record<string, unknown>
}

export interface AdaptationSignals {
  /** v2.4.265: ÉÉN gecombineerde lijst i.p.v. losse booleans per bron —
   * de Adaptation Engine bepaalt zelf het zwaarste signaal en past de
   * downscale-mechaniek precies ÉÉN keer toe, ongeacht hoeveel bronnen
   * tegelijk iets melden. Voorkomt dubbele/opeenstapelende aanpassingen. */
  signalen?: AdaptationSignal[]
  /** Positief = meer tijd dan oorspronkelijk gepland (seconden), negatief
   * = minder tijd. 0/undefined = geen aanpassing. Blijft een apart
   * mechanisme — dit is geen "belasting"-signaal maar een tijd-
   * beschikbaarheid-wijziging, andersoortig dan de downscale hierboven. */
  extraBeschikbareTijd_sec?: number
}

const SEVERITY_RANG: Record<AdaptationSignal['severity'], number> = { low: 1, medium: 2, high: 3 }

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

/** v2.4.241: was pasSlechteSlaapToe(), v2.4.265: neemt nu een lijst van
 * ALLE bijdragende signalen (voor een gecombineerde reden-tekst), maar
 * past de downscale zelf maar ÉÉN keer toe — dat is de kern van
 * ADR-007. De MAGNITUDE van de downscale blijft ongewijzigd t.o.v. de
 * al-geteste versie (geen nieuwe wiskunde), alleen het AANTAL keer dat
 * 'ie kan afgaan is nu gegarandeerd hooguit 1. */
function pasDownscaleToe(workout: UniversalWorkout, signalen: AdaptationSignal[]): string[] {
  const toelichtingen: string[] = []
  // v2.4.265: gesorteerd op severity (hoogste eerst) — de belangrijkste
  // reden staat zo vooraan in de toelichting, gebruikt SEVERITY_RANG
  const gesorteerdeSignalen = [...signalen].sort((a, b) => SEVERITY_RANG[b.severity] - SEVERITY_RANG[a.severity])
  const redenTekst = gesorteerdeSignalen.map(s => s.reden).join('; ')

  // 1. Kortere warming-up (-30%, ondergrens 3 min)
  if (workout.warmup.length > 0) {
    const oud = workout.warmup[0].duration_sec
    workout.warmup[0].duration_sec = Math.max(180, Math.round(oud * 0.7))
    if (workout.warmup[0].duration_sec !== oud) toelichtingen.push(`Kortere warming-up (${redenTekst} — lichaam heeft minder opbouwtijd nodig bij een lagere intensiteit).`)
  }

  // 2. Minder intervallen (repeat verminderen, ondergrens 2) + 3. lagere intensiteit
  for (const blok of workout.mainBlocks) {
    if (blok.repeat && blok.repeat > 2) {
      const oudAantal = blok.repeat
      blok.repeat = Math.max(2, blok.repeat - 1)
      if (blok.repeat !== oudAantal) toelichtingen.push(`Aantal herhalingen verlaagd van ${oudAantal} naar ${blok.repeat} — minder belasting (${redenTekst}).`)
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

  // v2.4.265 (ADR-007 — Single Workout Mutation Principle): ongeacht
  // hoeveel signalen er binnenkomen (fatigue + cross_sport + sleep +
  // weather, allemaal tegelijk mogelijk), wordt de downscale-mechaniek
  // hooguit ÉÉN keer aangeroepen. Dat is het hele punt van deze
  // refactor — vóór v2.4.265 kon elk signaal onafhankelijk zijn eigen
  // -30%/-1 herhaling/-1 zone toepassen, wat cumulatief kon opstapelen
  // tot een niet meer uitlegbare, veel te lichte training.
  if (signalen.signalen && signalen.signalen.length > 0) {
    nieuweAanpassingen.push(...pasDownscaleToe(workout, signalen.signalen))
  }
  if (signalen.extraBeschikbareTijd_sec) {
    nieuweAanpassingen.push(...pasBeschikbareTijdToe(workout, signalen.extraBeschikbareTijd_sec))
  }

  workout.adaptations = [...workout.adaptations, ...nieuweAanpassingen]
  return workout
}

// ── totaalDuurVanWorkout() — Coach Decision Integrity, v2.4.314 ────────
// Bron: bouwopdracht 11 augustus 2026. KRITIEK: workout.duration_sec
// (het topniveau-veld) wordt door pasWorkoutAan() hierboven NOOIT
// herberekend — alleen losse blok-duration_sec-waarden veranderen (zie
// pasDownscaleToe/pasBeschikbareTijdToe). Na een aanpassing is
// workout.duration_sec dus VEROUDERD. Deze functie is de enige
// betrouwbare bron voor de daadwerkelijke, aangepaste totaalduur —
// altijd vers gesommeerd uit de blokken zelf, nooit uit het
// topniveau-veld gelezen. Puur, geen state, geen mutatie.
function effectieveBlokDuur(blok: WorkoutBlock): number {
  // Een blok met repeat=5 en rust_na_repeat_sec=30 duurt in totaal:
  // 5× de bloklengte + 4× de rust ertussen (rust NA elke herhaling
  // behalve de laatste — vandaar repeat-1, niet repeat).
  if (blok.repeat && blok.repeat > 1) {
    const rustTotaal = (blok.rust_na_repeat_sec || 0) * (blok.repeat - 1)
    return blok.duration_sec * blok.repeat + rustTotaal
  }
  return blok.duration_sec
}

export function totaalDuurVanWorkout(workout: UniversalWorkout): number {
  const alleBlokken: WorkoutBlock[] = [
    ...workout.warmup,
    ...workout.mainBlocks,
    ...workout.recoveryBlocks,
    ...workout.cooldown,
    ...(workout.mobility || []),
  ]
  const totaalSec = alleBlokken.reduce((som, blok) => som + effectieveBlokDuur(blok), 0)
  return Math.round(totaalSec / 60) // minuten, consistent met training_plan_sessions.duration
}
