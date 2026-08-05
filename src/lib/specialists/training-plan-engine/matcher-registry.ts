import type { SportMatcher } from './workout-matcher-types'
import { rowingMatcher } from './matchers/rowing-matcher'
import { runningMatcher } from './matchers/running-matcher'
import { cyclingMatcher } from './matchers/cycling-matcher'

// ── Sport Matcher Registry ────────────────────────────────────────────────
// Bron: docs/workout-completion-platform-adr-v1.md.
//
// v2.4.273 (Fase 3): geëxtraheerd uit /debug/workout-matching's route.ts,
// waar dit tot nu toe lokaal stond. Nu ook nodig in productie-ingest-
// routes (Strava, en straks Garmin/handmatig) — één registry, niet twee
// kopieën die uit elkaar kunnen groeien (architectuurregel "dubbele
// utilities vermijden"). Nieuwe matchers toevoegen raakt alleen dit
// bestand, niet de routes die het gebruiken.
//
// Strength staat hier bewust NIET in — geen Training Plan Engine, dus
// geen training_plan_sessions om tegen te matchen. Zie README-roadmap.
export const SPORT_MATCHERS: Record<string, SportMatcher> = {
  rowing: rowingMatcher,
  running: runningMatcher,
  cycling: cyclingMatcher,
}
