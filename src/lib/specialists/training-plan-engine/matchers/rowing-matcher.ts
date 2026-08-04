import type { ActiviteitVoorMatching, PlanSessieVoorMatching, SportMatcher } from '../workout-matcher-types'

// ── Rowing Matcher — referentie-implementatie ────────────────────────────
// Bron: docs/workout-completion-platform-adr-v1.md, Fase 1 (Rowing als
// kleinste/meest overzichtelijke databron, Concept2 alleen — geen
// Strava/Garmin-varianten in deze eerste stap).
//
// EERLIJKE BEPERKING, bewust: training_plan_sessions heeft geen doel-
// afstand-veld — alleen duration + load_target (zie decision-contract-
// v1.md §4, ongewijzigd). Een geplande sessie legt dus geen streef-
// aantal meters vast. "Meters" uit het ADR-diagram (§3) kan in Fase 1
// daarom NIET tegen een geplande waarde getoetst worden — er is
// simpelweg niets om tegen te vergelijken. Bewust weggelaten in plaats
// van tegen een verzonnen aanname aan te toetsen. Duur blijft het enige
// score-signaal totdat de Training Plan Engine ooit een meters-target
// zou krijgen (geen onderdeel van dit ontwerp).
//
// Ambiguïteit tussen meerdere geplande sessies op dezelfde dag bestaat
// niet (unique(plan_id, date), v2.4.259) — deze matcher hoeft dus geen
// keuze te maken TUSSEN kandidaten, alleen te beoordelen of DE ene
// ondubbelzinnige kandidaat aannemelijk is.

const DUUR_TOLERANTIE_PCT = 30 // eerste schatting — zie AUTO_MATCH_DREMPEL-comment in workout-matcher.ts

function berekenConfidence(activiteit: ActiviteitVoorMatching, planSessie: PlanSessieVoorMatching) {
  if (!planSessie.durationMinutes || planSessie.durationMinutes <= 0) {
    // Geen geplande duur om tegen te toetsen. Datum+sport+status kloppen
    // al (dat is al gefilterd door de Core) — gematigd vertrouwen i.p.v.
    // 0 (zou een terechte match onnodig blokkeren) of 1 (schijnzekerheid).
    return { confidence: 0.6, reden: 'geplande sessie had geen duur-target — alleen datum+sport gebruikt' }
  }

  const afwijkingPct = Math.abs(activiteit.durationMinutes - planSessie.durationMinutes) / planSessie.durationMinutes * 100

  if (afwijkingPct <= DUUR_TOLERANTIE_PCT) {
    // Lineair van 1.0 (exacte match) naar 0.75 (nét binnen tolerantie)
    const confidence = 1 - (afwijkingPct / DUUR_TOLERANTIE_PCT) * 0.25
    return {
      confidence,
      reden: `duur ${activiteit.durationMinutes} min vs. gepland ${planSessie.durationMinutes} min (Δ${afwijkingPct.toFixed(0)}%) — binnen tolerantie`,
    }
  }

  // Buiten tolerantie: nog steeds enig vertrouwen (datum+sport kloppen),
  // maar laag genoeg om onder AUTO_MATCH_DREMPEL te blijven bij een
  // duidelijk andere sessie (bijv. een 5-min test i.p.v. een geplande
  // 60-min duurtraining).
  const confidence = Math.max(0.2, 0.5 - (afwijkingPct - DUUR_TOLERANTIE_PCT) / 200)
  return {
    confidence,
    reden: `duur ${activiteit.durationMinutes} min vs. gepland ${planSessie.durationMinutes} min (Δ${afwijkingPct.toFixed(0)}%) — buiten tolerantie`,
  }
}

export const rowingMatcher: SportMatcher = {
  sport: 'rowing',
  berekenConfidence,
}
