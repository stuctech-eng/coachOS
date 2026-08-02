import type { SupabaseClient } from '@supabase/supabase-js'
import type { UniversalAthleteState, UniverseleWaarde } from './types'

// ── CoachOS Universal Athlete Platform — Opslag ──────────────────────────
// Bron: overleg 2 augustus 2026. Eén rij per gebruiker (JSONB), zie
// supabase/universal_athlete_state.sql.

const LEGE_WAARDE: UniverseleWaarde = { niveau: 'gemiddeld', confidence: 'LOW', confidence_score: 0, toelichting: 'Nog geen data' }

/** Een volledig lege staat — voor een gebruiker die nog nooit een
 * sessie heeft gehad die de Universal Impact Engine heeft verwerkt.
 * Alle 8 categorieën, elk veld op LEGE_WAARDE. */
export function legeAthleteState(userId: string): UniversalAthleteState {
  return {
    user_id: userId, laatst_bijgewerkt: new Date().toISOString(),
    cardiovasculair: { aerobic_load: LEGE_WAARDE, anaerobic_load: LEGE_WAARDE, vo2_adaptatie: LEGE_WAARDE, cardio_vermoeidheid: LEGE_WAARDE },
    spieren: { been_vermoeidheid: LEGE_WAARDE, core_vermoeidheid: LEGE_WAARDE, bovenlichaam_vermoeidheid: LEGE_WAARDE, onderrug_vermoeidheid: LEGE_WAARDE, grip_vermoeidheid: LEGE_WAARDE },
    mechanisch: { gewricht_impact: LEGE_WAARDE, pees_belasting: LEGE_WAARDE, bot_stress: LEGE_WAARDE, spierschade: LEGE_WAARDE },
    neurologisch: { neuromusculaire_vermoeidheid: LEGE_WAARDE, coordinatie: LEGE_WAARDE, motorische_controle: LEGE_WAARDE, explosiviteit: LEGE_WAARDE },
    herstel: { herstel: LEGE_WAARDE, slaap_tekort: LEGE_WAARDE, hrv_trend: LEGE_WAARDE, rust_hartslag: LEGE_WAARDE, body_battery: LEGE_WAARDE, herstel_capaciteit: LEGE_WAARDE },
    mentaal: { stress: LEGE_WAARDE, motivatie: LEGE_WAARDE, focus: LEGE_WAARDE, cognitieve_vermoeidheid: LEGE_WAARDE },
    training: { acute_belasting: LEGE_WAARDE, chronische_belasting: LEGE_WAARDE, acwr: LEGE_WAARDE, consistentie: LEGE_WAARDE, trainingsmonotonie: LEGE_WAARDE, trainingsspanning: LEGE_WAARDE },
    omgeving: { hitte_adaptatie: LEGE_WAARDE, koude_adaptatie: LEGE_WAARDE, hoogte_adaptatie: LEGE_WAARDE, hydratatie_status: LEGE_WAARDE, energie_beschikbaarheid: LEGE_WAARDE },
  }
}

export async function haalAthleteState(supabase: SupabaseClient, userId: string): Promise<UniversalAthleteState> {
  const { data } = await supabase.from('universal_athlete_state').select('state').eq('user_id', userId).maybeSingle()
  return (data?.state as UniversalAthleteState) || legeAthleteState(userId)
}

export async function slaAthleteStateOp(supabase: SupabaseClient, userId: string, state: UniversalAthleteState): Promise<void> {
  const { error } = await supabase.from('universal_athlete_state').upsert({
    user_id: userId, state, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) {
    console.error('[athlete-platform/storage] Opslaan mislukt:', error)
    throw error
  }
}
