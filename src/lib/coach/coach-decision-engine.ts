import type { SupabaseClient } from '@supabase/supabase-js'
import { genereerCoachPolicy } from '@/lib/specialists/coach-policy'

// ── Coach Decision Engine / "Decision Service" ────────────────────────────
// Bron: docs/guardian-mode-coach-call-trigger-v1.md (v1.2), Final
// Architecture Update (gebruiker, 5 augustus 2026).
//
// v2.4.292 (Fase 2): NAAMGEVING BEWUST NIET GEWIJZIGD (bestandsnaam
// blijft coach-decision-engine.ts) — een file-rename zou de drie
// al-gekoppelde aanroeppunten (concept2-result-processor.ts,
// garmin-activity-tcx/route.ts, training/complete/route.ts) onnodig
// laten schuiven zonder functionele winst. Inhoudelijk is dit wél een
// "Decision Service" geworden, zoals de gebruiker voorstelde: BEREKENT
// ZELF NIETS. Elk signaal hieronder komt van een al-bestaande,
// al-geteste functie/tabel — geen enkele parallelle berekening.
//
// ARCHITECTUURREGEL, letterlijk overgenomen: "Nieuwe functionaliteit
// mag pas worden gebouwd nadat expliciet is vastgesteld dat de
// benodigde logica niet al elders in CoachOS bestaat. De Coach
// Decision Service mag uitsluitend bestaande subsystemen raadplegen en
// geen parallelle berekeningen introduceren."
//
// Signalen en hun bron, ALLEMAAL consolidatie, GEEN nieuwbouw:
// - Planning-vergelijking → training_plan_sessions (Fase 1, ongewijzigd)
// - Cross-sport-afwijking → training_plan_sessions, breder bevraagd
//   (nieuwe QUERY, geen nieuwe LOGICA/tabel)
// - Herstel → genereerCoachPolicy()'s `recoveryState` — al een kant-en-
//   klaar "low/moderate/good"-veld, calculateRecoveryScore() hoeft hier
//   niet apart aangeroepen te worden
// - Blessure → `injuries`-tabel, `active=true` — EXACT dezelfde query
//   die genereerCoachPolicy() zelf ook al intern doet (coach-policy.ts,
//   regel ~45) — hier apart herhaald omdat CoachPolicy zelf geen kant-
//   en-klaar boolean-veld teruggeeft (alleen verwerkt in `reasons`/
//   `maxIntensity`), niet omdat het een nieuwe databron is

export interface CoachCallBehoefte {
  nodig: boolean
  reden: string
  type:
    | 'komt_overeen_met_planning'
    | 'geen_actief_plan'
    | 'extra_training'
    | 'ondanks_annulering'
    | 'andere_sport_dan_gepland'
    | 'ondanks_actieve_blessure'
    | 'ondanks_laag_herstel'
}

const INTENSIEVE_SESSIE_MIN_DUUR = 20 // minuten — zelfde ordegrootte als MINIMUM_SESSIE_DUUR_MINUTEN elders, hier lokaal gehouden om geen cross-module afhankelijkheid toe te voegen voor één constante

export async function evalueerCoachCallBehoefte(
  supabase: SupabaseClient,
  userId: string,
  sport: string,
  datum: string,
  duurMinuten: number = 0,
): Promise<CoachCallBehoefte> {
  // ── Signaal 1: actieve blessure (bestaande tabel, CoachPolicy's
  //    eigen query hergebruikt, geen nieuwe databron) ──────────────────
  const { data: blessures } = await supabase
    .from('injuries').select('body_part').eq('user_id', userId).eq('active', true)
  if (blessures && blessures.length > 0) {
    return {
      nodig: true,
      reden: `actieve blessure (${blessures.map(b => b.body_part).join(', ')}) — training toch uitgevoerd`,
      type: 'ondanks_actieve_blessure',
    }
  }

  // ── Signaal 2: herstel (genereerCoachPolicy's kant-en-klare
  //    recoveryState — geen eigen berekening) ──────────────────────────
  if (duurMinuten >= INTENSIEVE_SESSIE_MIN_DUUR) {
    try {
      const policy = await genereerCoachPolicy(userId)
      if (policy.recoveryState === 'low') {
        return {
          nodig: true,
          reden: `herstel was laag (CoachPolicy: '${policy.recoveryState}'), toch een sessie van ${duurMinuten} min uitgevoerd`,
          type: 'ondanks_laag_herstel',
        }
      }
    } catch (policyErr) {
      // CoachPolicy-aanroep mag deze evaluatie nooit blokkeren — bij een
      // fout hier vallen we gewoon door naar de planning-vergelijking.
      console.error('[coach-decision-engine] genereerCoachPolicy mislukt, herstel-signaal overgeslagen:', policyErr)
    }
  }

  // ── Signaal 3: eigen-sport-planning (Fase 1, ongewijzigd) ────────────
  const { data: plan } = await supabase
    .from('training_plans')
    .select('id')
    .eq('athlete_id', userId).eq('sport', sport).eq('status', 'active')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()

  if (plan) {
    const { data: planSessie } = await supabase
      .from('training_plan_sessions')
      .select('id, status')
      .eq('plan_id', plan.id).eq('date', datum)
      .maybeSingle()

    if (planSessie && planSessie.status !== 'cancelled') {
      return { nodig: false, reden: 'komt overeen met de planning', type: 'komt_overeen_met_planning' }
    }
    if (planSessie && planSessie.status === 'cancelled') {
      return { nodig: true, reden: 'geplande sessie was geannuleerd, toch uitgevoerd', type: 'ondanks_annulering' }
    }
    // Geen sessie deze datum voor DEZE sport, maar er is wel een plan —
    // val door naar Signaal 4 (misschien een andere sport ingehaald).
  }

  // ── Signaal 4: cross-sport — stond er een ANDERE sport gepland
  //    dezelfde dag? (nieuwe QUERY, bestaande tabel/logica) ────────────
  const { data: anderePlannen } = await supabase
    .from('training_plans').select('id, sport')
    .eq('athlete_id', userId).eq('status', 'active').neq('sport', sport)

  if (anderePlannen && anderePlannen.length > 0) {
    const { data: anderesSessieDezeDag } = await supabase
      .from('training_plan_sessions')
      .select('id, plan_id')
      .in('plan_id', anderePlannen.map(p => p.id))
      .eq('date', datum)
      .in('status', ['scheduled', 'planned'])
      .maybeSingle()

    if (anderesSessieDezeDag) {
      const anderePlan = anderePlannen.find(p => p.id === anderesSessieDezeDag.plan_id)
      return {
        nodig: true,
        reden: `${anderePlan?.sport || 'andere sport'} stond gepland, ${sport} is uitgevoerd`,
        type: 'andere_sport_dan_gepland',
      }
    }
  }

  if (!plan) {
    // v2.4.290-FIX (ongewijzigd behouden): geen plan is zelf onzekerheid
    // — voorzichtigheidshalve wél vragen, behoudt het oude "altijd
    // vragen"-gedrag voor sporten zonder Training Plan Engine
    // (Strength/Kettlebell/etc.).
    return { nodig: true, reden: 'geen actief trainingsplan voor deze sport — geen vergelijking mogelijk, dus voorzichtigheidshalve wél vragen', type: 'geen_actief_plan' }
  }

  return { nodig: true, reden: 'geen geplande sessie op deze datum — extra/onaangekondigde training', type: 'extra_training' }
}
