import type { ActiviteitVoorMatching, PlanSessieVoorMatching, SportMatcher } from '../workout-matcher-types'

// ── Cycling Matcher — Fase 2 ──────────────────────────────────────────────
// Bron: docs/workout-completion-platform-adr-v1.md, Fase 2.
// Zelfde structuur als Rowing/Running Matcher — bewust geen nieuwe
// aanpak verzonnen voor exact hetzelfde probleem.
//
// EERLIJKE BEPERKING, GEVERIFIEERD VOOR CYCLING (niet zomaar
// overgenomen van Rowing/Running): core.ts insert in
// training_plan_sessions gebruikt voor alle sporten dezelfde kolommen
// (duration, load_target) — geen vermogen/afstand-target, ook niet
// specifiek voor Cycling. Duur blijft dus ook hier het enige
// score-signaal.
//
// Zelfde ambiguïteit-garantie: unique(plan_id, date) (v2.4.259).
//
// Nog NIET aangesloten op een ingest-route (Fase 3, apart) — alleen
// bereikbaar via het debug-dashboard (sport-keuze).

const DUUR_TOLERANTIE_PCT = 30 // zelfde eerste schatting als Rowing/Running — zie AUTO_MATCH_DREMPEL-comment in workout-matcher.ts

function berekenConfidence(activiteit: ActiviteitVoorMatching, planSessie: PlanSessieVoorMatching) {
  if (!planSessie.durationMinutes || planSessie.durationMinutes <= 0) {
    return { confidence: 0.6, reden: 'geplande sessie had geen duur-target — alleen datum+sport gebruikt' }
  }

  const afwijkingPct = Math.abs(activiteit.durationMinutes - planSessie.durationMinutes) / planSessie.durationMinutes * 100

  if (afwijkingPct <= DUUR_TOLERANTIE_PCT) {
    const confidence = 1 - (afwijkingPct / DUUR_TOLERANTIE_PCT) * 0.25
    return {
      confidence,
      reden: `duur ${activiteit.durationMinutes} min vs. gepland ${planSessie.durationMinutes} min (Δ${afwijkingPct.toFixed(0)}%) — binnen tolerantie`,
    }
  }

  const confidence = Math.max(0.2, 0.5 - (afwijkingPct - DUUR_TOLERANTIE_PCT) / 200)
  return {
    confidence,
    reden: `duur ${activiteit.durationMinutes} min vs. gepland ${planSessie.durationMinutes} min (Δ${afwijkingPct.toFixed(0)}%) — buiten tolerantie`,
  }
}

export const cyclingMatcher: SportMatcher = {
  sport: 'cycling',
  berekenConfidence,
}
