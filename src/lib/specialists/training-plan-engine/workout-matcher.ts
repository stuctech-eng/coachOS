import { createAdminClient } from '@/lib/supabase'
import type { ActiviteitVoorMatching, SportMatcher } from './workout-matcher-types'

// ── Workout Matching Service — Core ──────────────────────────────────────
// Bron: docs/workout-completion-platform-adr-v1.md, Fase 1.
// Referentie-implementatie: Rowing/Concept2 (zie matchers/rowing-matcher.ts,
// aangeroepen vanuit api/specialists/rowing/concept2/sync/route.ts).
//
// VERANTWOORDELIJKHEID (ADR §2) — doet ALLEEN:
//   - een geïmporteerde activiteit koppelen aan een geplande sessie
//   - confidence bepalen (via de sport-specifieke matcher)
//   - completed_activity_id vullen, status wijzigen
// Doet NOOIT:
//   - importeren/dedupliceren (dat blijft bij Activity Import — de
//     ingest-routes zelf, ongewijzigd)
//   - prestaties analyseren (dat blijft bij Performance Platform)
//   - workout-inhoud wijzigen (duur/intensiteit/herhalingen — dat blijft
//     exclusief bij de Adaptation Engine, ADR-007)
//
// Wordt aangeroepen door elke ingest-route NA een succesvolle insert in
// activity_sessions. Bewust altijd in een try/catch bij de aanroeper —
// een fout hier mag de import zelf nooit laten falen (zelfde patroon als
// de bestaande Universal Athlete State-koppeling in concept2/sync).

// Drempelwaarde voor automatische koppeling — EERSTE SCHATTING, bewust
// als losse constante. Zie ADR §4/§6: de exacte drempel is bewust NIET
// in het ontwerp vastgelegd (vergt praktijkervaring, geen documentkeuze
// vooraf) — makkelijk hier aan te passen zonder de matcher-logica zelf
// te wijzigen.
export const AUTO_MATCH_DREMPEL = 0.7

export interface WorkoutMatchResultaat {
  gematcht: boolean
  planSessieId: string | null
  confidence: number | null
  reden: string
}

export async function matchActiviteitAanPlan(
  activiteit: ActiviteitVoorMatching,
  matcher: SportMatcher,
): Promise<WorkoutMatchResultaat> {
  if (matcher.sport !== activiteit.sport) {
    // Programmeerfout, geen runtime-situatie — een matcher wordt altijd
    // expliciet per sport aangeroepen door de betreffende ingest-route.
    throw new Error(`[workout-matcher] Matcher voor '${matcher.sport}' aangeroepen met een '${activiteit.sport}'-activiteit`)
  }

  const supabase = createAdminClient()

  // Alleen het actieve plan van deze gebruiker voor deze sport — zelfde
  // query-vorm als overal elders in de Training Plan Engine (bijv.
  // api/specialists/rowing/training-plan/route.ts)
  const { data: plan } = await supabase
    .from('training_plans')
    .select('id')
    .eq('athlete_id', activiteit.userId)
    .eq('sport', activiteit.sport)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!plan) {
    return { gematcht: false, planSessieId: null, confidence: null, reden: 'geen actief trainingsplan voor deze sport' }
  }

  // Kandidaat-sessie: zelfde datum, nog niet gekoppeld. De
  // unique(plan_id, date)-constraint (fix_duplicate_sessions.sql,
  // v2.4.259) garandeert hier maximaal 1 rij — geen ambiguïteit tussen
  // meerdere geplande sessies op één dag om op te lossen.
  const { data: planSessie } = await supabase
    .from('training_plan_sessions')
    .select('id, plan_id, date, type, duration, load_target')
    .eq('plan_id', plan.id)
    .eq('date', activiteit.date)
    .in('status', ['scheduled', 'planned'])
    .is('completed_activity_id', null)
    .maybeSingle()

  if (!planSessie) {
    return { gematcht: false, planSessieId: null, confidence: null, reden: 'geen geplande sessie op deze datum — spontane training, geen match verwacht' }
  }

  const { confidence, reden } = matcher.berekenConfidence(activiteit, {
    id: planSessie.id,
    planId: planSessie.plan_id,
    date: planSessie.date,
    type: planSessie.type,
    durationMinutes: planSessie.duration,
    loadTarget: planSessie.load_target,
  })

  if (confidence >= AUTO_MATCH_DREMPEL) {
    await supabase
      .from('training_plan_sessions')
      .update({
        status: 'completed',
        completed_activity_id: activiteit.id,
        match_confidence: confidence,
        match_reden: reden,
      })
      .eq('id', planSessie.id)

    return { gematcht: true, planSessieId: planSessie.id, confidence, reden }
  }

  // Onder de drempel: bewust GEEN koppeling — geen gok, geen
  // schijnprecisie. Er is in Fase 1 nog geen UI om een lage-confidence-
  // kandidaat aan de gebruiker voor te leggen (ADR §6, bewust buiten
  // Fase 1 gehouden) — alleen gelogd, voor latere diagnose/Fase 4.
  console.log(`[workout-matcher] Lage confidence (${confidence.toFixed(2)}) voor sessie ${planSessie.id} — geen automatische koppeling. Reden: ${reden}`)
  return { gematcht: false, planSessieId: planSessie.id, confidence, reden }
}
