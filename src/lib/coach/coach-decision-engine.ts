import type { SupabaseClient } from '@supabase/supabase-js'

// ── Coach Decision Engine — Fase 1 ────────────────────────────────────────
// Bron: docs/guardian-mode-coach-call-trigger-v1.md (v1.2), Final
// Architecture Update (gebruiker, 5 augustus 2026).
//
// Verantwoordelijkheid, precies afgebakend (architectuurregel,
// letterlijk overgenomen): "Coach Calls mogen nergens meer rechtstreeks
// worden aangemaakt door import-routes of trainingsroutes. Alle bronnen
// registreren uitsluitend data. Daarna draait één centrale Coach
// Decision Engine die bepaalt of een Coach Call nodig is."
//
// Doet: bepaalt op basis van TodayPlan-vergelijking of een
// binnengekomen activiteit een coachwaardige gebeurtenis is.
// Doet NOOIT: het gesprek voeren, de Coach Call zelf aanmaken (dat is
// coach-call-writer.ts, een aparte stap), confidence berekenen (dat
// blijft bij de Workout Matching Service).
//
// FASE 1-SCOPE, BEWUST BEPERKT (zie v1.2 §"Consequentie voor de
// vergelijkingsfunctie"): dekt alleen de vergelijking "was er een
// geplande sessie voor DEZE sport op DEZE datum" — rustdag-toch-
// getraind en extra/onaangekondigde training. NOG NIET gedekt, bewust:
// andere sport dan gepland (cross-sport-vergelijking), Recovery/HRV,
// blessureprotocol-naleving, cumulatieve belasting (meerdere sessies/
// dag, herhaald overslaan). Die vergen bredere signaalbronnen die deze
// analyse nog niet heeft geverifieerd — apart uit te breiden, niet nu
// aangenomen dat het al werkt.
//
// Bewust een eigen, directe databasequery i.p.v. bepaalTodayPlan()
// (today-engine.ts) hergebruiken — die laatste vergt een
// cookieHeader/baseUrl (request-context, voor interne API-aanroepen)
// en is dus niet bruikbaar vanuit een achtergrondproces zoals Concept2-
// resultaatverwerking. Dezelfde onderliggende tabel
// (training_plan_sessions) wordt hier rechtstreeks bevraagd, geen
// duplicatie van businesslogica — alleen van de simpele lookup.

export interface CoachCallBehoefte {
  nodig: boolean
  reden: string
  type: 'komt_overeen_met_planning' | 'geen_actief_plan' | 'extra_training' | 'ondanks_annulering'
}

export async function evalueerCoachCallBehoefte(
  supabase: SupabaseClient,
  userId: string,
  sport: string,
  datum: string,
): Promise<CoachCallBehoefte> {
  const { data: plan } = await supabase
    .from('training_plans')
    .select('id')
    .eq('athlete_id', userId).eq('sport', sport).eq('status', 'active')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()

  if (!plan) {
    // Geen actief plan voor deze sport — geen basis om "afwijking" tegen
    // te toetsen. Bewust GEEN Coach Call: dit zou voor iedere sport
    // zonder Training Plan Engine (Strength/Kettlebell/etc., of Rowing/
    // Running/Cycling zonder actief plan) altijd "extra training"
    // betekenen, wat de bedoeling niet is.
    return { nodig: false, reden: 'geen actief trainingsplan voor deze sport — geen afwijking te bepalen', type: 'geen_actief_plan' }
  }

  const { data: planSessie } = await supabase
    .from('training_plan_sessions')
    .select('id, status')
    .eq('plan_id', plan.id).eq('date', datum)
    .maybeSingle()

  if (!planSessie) {
    return { nodig: true, reden: 'geen geplande sessie op deze datum — extra/onaangekondigde training', type: 'extra_training' }
  }

  if (planSessie.status === 'cancelled') {
    return { nodig: true, reden: 'geplande sessie was geannuleerd, toch uitgevoerd', type: 'ondanks_annulering' }
  }

  return { nodig: false, reden: 'komt overeen met de planning', type: 'komt_overeen_met_planning' }
}
