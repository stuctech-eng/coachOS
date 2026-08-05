import type { ActiviteitVoorMatching, PlanSessieVoorMatching, SportMatcher } from '../workout-matcher-types'

// ── Running Matcher — Fase 2 ──────────────────────────────────────────────
// Bron: docs/workout-completion-platform-adr-v1.md, Fase 2.
// Zelfde structuur als de Rowing Matcher (referentie-implementatie,
// Fase 1) — bewust geen nieuwe aanpak verzonnen voor exact hetzelfde
// probleem.
//
// EERLIJKE BEPERKING, zelfde als bij Rowing: training_plan_sessions
// heeft ook voor Running geen doel-afstand-veld (alleen duration +
// load_target, decision-contract-v1.md §4) — geverifieerd, niet
// aangenomen. Afstand ("km") kan dus ook hier niet tegen een geplande
// waarde getoetst worden. Duur blijft het enige score-signaal.
//
// Zelfde ambiguïteit-garantie als Rowing: unique(plan_id, date)
// (v2.4.259) betekent maximaal 1 geplande sessie per dag — geen keuze
// tussen kandidaten nodig, alleen beoordelen of dé kandidaat aannemelijk is.
//
// Nog NIET aangesloten op een ingest-route (dat is Fase 3, apart) —
// deze matcher is in deze stap alleen bereikbaar via het generieke
// debug-dashboard (/debug/workout-matching, sport-keuze).

const DUUR_TOLERANTIE_PCT = 30 // zelfde eerste schatting als Rowing — zie AUTO_MATCH_DREMPEL-comment in workout-matcher.ts

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

export const runningMatcher: SportMatcher = {
  sport: 'running',
  berekenConfidence,
}
