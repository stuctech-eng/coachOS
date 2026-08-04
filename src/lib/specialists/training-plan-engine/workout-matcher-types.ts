// ── Workout Matching Service — gedeeld type-contract ─────────────────────
// Bron: docs/workout-completion-platform-adr-v1.md, Fase 1.
//
// Zelfde patroon als TrainingPlanSportAdapter (zie ./types.ts): de Core
// is volledig sport-agnostisch, elke specialist levert een eigen
// SportMatcher-implementatie. Geen enkele sportnaam-check hoort in de
// Core zelf.
//
// Verhouding tot ADR-007 (Single Workout Mutation Principle, v2.4.265):
// dit is GEEN workout-inhoud-mutatie (geen duur/intensiteit/herhalingen
// aanpassen — dat blijft exclusief bij de Adaptation Engine). Dit is een
// PLANNING-beslissing (welke status heeft een sessie), zelfde categorie
// als de al-bestaande missed_session/injury_protection/goal_change-
// triggers in adjuster-core.ts, die ook ongewijzigd database-mutaties
// blijven onder ADR-007.

export interface ActiviteitVoorMatching {
  /** activity_sessions.id — de net geïmporteerde activiteit */
  id: string
  userId: string
  /** Moet overeenkomen met TrainingPlanSportAdapter.sport / training_plan_sessions.sport */
  sport: string
  /** yyyy-mm-dd */
  date: string
  durationMinutes: number
  /** Ruwe metrics zoals opgeslagen in activity_sessions.metrics — sport-matchers mogen hierin lezen (bijv. distance) */
  metrics: Record<string, unknown> | null
}

export interface PlanSessieVoorMatching {
  id: string
  planId: string
  date: string
  type: string
  durationMinutes: number
  loadTarget: number | null
}

export interface MatchUitkomst {
  /** 0.0 – 1.0. Geen schijnprecisie: bij twijfel liever een gematigd getal dan een verzonnen exacte waarde. */
  confidence: number
  /** Mens-leesbare onderbouwing — wordt opgeslagen in training_plan_sessions.match_reden bij een automatische koppeling */
  reden: string
}

export interface SportMatcher {
  /** Moet gelijk zijn aan de sport waarvoor de Core deze matcher aanroept — de Core valideert dit */
  sport: string
  berekenConfidence(activiteit: ActiviteitVoorMatching, planSessie: PlanSessieVoorMatching): MatchUitkomst
}
