import type { SupabaseClient } from '@supabase/supabase-js'

// ── Coach Call Writer ──────────────────────────────────────────────────────
// Bron: v2.4.288 (Coach Decision Engine, Fase 1). Schema en aanmaak-
// patroon 1-op-1 hergebruikt van de bestaande logica in
// api/coach-calls/route.ts (Strava-pad) — geen nieuw schema verzonnen,
// alleen de aanmaak zelf herbruikbaar gemaakt voor de Decision Engine.
//
// v2.4.290 (Bibliotheek-migratie): uitgebreid met `trainingResultId`
// als alternatief voor `activiteitId` — `coach_call_items` bediende al
// twee brontypes via twee wederzijds-nullable kolommen
// (`activity_session_id` voor Strava/Garmin/Concept2,
// `training_result_id` voor bibliotheek-trainingen, zie README-sectie
// "Coach Call Systeem"). Deze functie ondersteunt nu beide, met de
// al-bestaande waarschuwing uit het README zelf toegepast: minstens één
// van de twee moet gevuld zijn, nooit allebei tegelijk voor hetzelfde
// item.
//
// Nieuw t.o.v. het bestaande schema: `deviation_reason` op
// `coach_call_items` (zie supabase/coach_decision_engine.sql) — de
// bestaande vier aanmaakplekken vulden dit nooit, want zij hadden geen
// "waarom"-classificatie (alleen drempel/onvoorwaardelijk). De Decision
// Engine heeft dat wél (zie coach-decision-engine.ts) en bewaart het —
// puur additief, breekt niets aan hoe bestaande items gerenderd worden.

export interface CoachCallItemInput {
  /** Precies één van de twee moet gevuld zijn — nooit beide, nooit geen van beide. */
  activiteitId?: string
  trainingResultId?: string
  sportNaam: string
  afstandM: number | null
  duurMin: number | null
  redenType: string
  reden: string
}

/** Maakt een coach_call_item aan, en de coach_call zelf als die nog niet
 * bestaat voor deze datum — zelfde "zoek bestaande call voor deze datum,
 * voeg toe of maak aan, heropen indien nodig"-patroon als
 * coach-calls/route.ts. */
export async function schrijfCoachCallItem(
  supabase: SupabaseClient,
  userId: string,
  datum: string,
  item: CoachCallItemInput,
): Promise<void> {
  if (!item.activiteitId && !item.trainingResultId) {
    // Applicatie-validatie zoals het README zelf voorschrijft bij een
    // nieuwe Coach Call-bron — nooit stilzwijgend een item zonder
    // referentie aanmaken.
    console.error('[coach-call-writer] Noch activiteitId noch trainingResultId meegegeven — geweigerd')
    return
  }
  if (item.activiteitId && item.trainingResultId) {
    console.error('[coach-call-writer] Zowel activiteitId als trainingResultId meegegeven — geweigerd, moet er precies één zijn')
    return
  }

  const { data: bestaand } = await supabase
    .from('coach_calls')
    .select('id, status')
    .eq('user_id', userId).eq('date', datum)
    .maybeSingle()

  let coachCallId: string
  if (bestaand) {
    coachCallId = bestaand.id
    if (bestaand.status === 'completed' || bestaand.status === 'expired') {
      await supabase.from('coach_calls')
        .update({ status: 'pending', completed_at: null })
        .eq('id', bestaand.id)
    }
  } else {
    const { data: nieuw } = await supabase
      .from('coach_calls')
      .insert({ user_id: userId, date: datum, status: 'pending' })
      .select('id').single()
    if (!nieuw) return
    coachCallId = nieuw.id
  }

  const idempotencyQuery = item.activiteitId
    ? supabase.from('coach_call_items').select('id').eq('coach_call_id', coachCallId).eq('activity_session_id', item.activiteitId)
    : supabase.from('coach_call_items').select('id').eq('coach_call_id', coachCallId).eq('training_result_id', item.trainingResultId)
  const { data: bestaandItem } = await idempotencyQuery.maybeSingle()
  if (bestaandItem) return

  await supabase.from('coach_call_items').insert({
    coach_call_id: coachCallId,
    activity_session_id: item.activiteitId || null,
    training_result_id: item.trainingResultId || null,
    sport_type: item.sportNaam,
    distance_m: item.afstandM,
    duration_min: item.duurMin,
    status: 'pending',
    deviation_reason: item.reden,
  })
}
