import { createAdminClient } from '@/lib/supabase'
import { isoDatum } from '@/utils'
import { genereerCoachPolicy } from '../coach-policy'
import { haalGoalsMetProgress } from '../goal-engine'
import type { AanpassingResultaat, TrainingPlanSportAdapter } from './types'
import type { AdaptationSignal } from '@/core/workout-builder/adaptation'

// ── Daily Adjustment Layer Core — platformcomponent ─────────────────────
// Bron: docs/adaptive-training-plan-decision-contract-v1.md, sectie 2-3
// (oorspronkelijk Cycling, hier sport-onafhankelijk gemaakt — de vijf
// triggers zelf kennen geen sport-concept, alleen welk sessietype
// "hoge intensiteit" is en waarmee het vervangen wordt, verschilt).
// VOLLEDIG DETERMINISTISCH.
//
// v2.4.265 (ADR-007 — Single Workout Mutation Principle, overleg 4
// augustus 2026): gevonden risico — deze laag paste de duur van een
// sessie AL aan (fatigue_detected, -40%), en de nieuwe Workout Builder-
// Adaptation Engine paste DAARNA nog eens aan (bijv. kruis-sport-
// signaal), bovenop een al-verlaagde sessie. Cumulatief, niet meer
// uitlegbaar. FIX: Trigger 3 (fatigue_detected) muteert de database
// NIET MEER — retourneert voortaan een AdaptationSignal, dat de
// aanroeper samen met andere signalen (bijv. cross_sport) in ÉÉN
// aanroep van de Workout Builder's pasWorkoutAan() meegeeft. Triggers
// 1/2/4 blijven ONGEWIJZIGD database-mutaties — dat zijn planning-
// beslissingen (welke sessie staat er/welk type), geen intensiteit-
// downscale, en overlappen niet met het gevonden risico.
//
// EERLIJKE DEKKING — zelfde beperkingen als de oorspronkelijke Cycling-
// versie, ongewijzigd overgenomen:
// - missed_session:      ✅ volledig
// - injury_protection:    ✅ volledig
// - goal_change:           ✅ volledig
// - fatigue_detected:       🟡 GEDEELTELIJK — alleen de huidige dag, niet
//   "meerdere dagen op rij" (vergt historische CoachPolicy-snapshots)
// - vacation_mode:          ❌ NOG NIET — vergt eerst een UI

export interface DailyAdjustmentResultaat {
  aanpassingen: AanpassingResultaat[]
  /** v2.4.265: fatigue_detected levert nu een signaal i.p.v. een
   * database-mutatie — de aanroeper combineert dit zelf met andere
   * signalen vóór het bouwen van de concrete workout. */
  fatigueSignaal: AdaptationSignal | null
}

export async function voerDailyAdjustmentUitCore(userId: string, planId: string, adapter: TrainingPlanSportAdapter): Promise<DailyAdjustmentResultaat> {
  const supabase = createAdminClient()
  const aanpassingen: AanpassingResultaat[] = []
  let fatigueSignaal: AdaptationSignal | null = null
  const vandaag = isoDatum(new Date())

  // ── Trigger 1: missed_session ────────────────────────────────────────
  const { data: gemisteSessies } = await supabase
    .from('training_plan_sessions')
    .select('*')
    .eq('plan_id', planId)
    .eq('status', 'scheduled')
    .lt('date', vandaag)
    .is('completed_activity_id', null)

  for (const sessie of gemisteSessies || []) {
    const { data: vandaagAlGepland } = await supabase
      .from('training_plan_sessions')
      .select('id')
      .eq('plan_id', planId)
      .eq('date', vandaag)
      .maybeSingle()

    if (vandaagAlGepland) {
      await supabase.from('training_plan_sessions').update({ status: 'skipped' }).eq('id', sessie.id)
      aanpassingen.push({ sessie_id: sessie.id, oude_type: sessie.type, nieuwe_type: null, reason: 'missed_session' })
    } else {
      const { data: nieuweSessie } = await supabase
        .from('training_plan_sessions')
        .insert({
          plan_id: planId, date: vandaag, sport: adapter.sport, type: sessie.type,
          duration: sessie.duration, load_target: sessie.load_target,
          status: 'adjusted', original_session_id: sessie.id, adjustment_reason: 'missed_session',
          // v2.4.176: anders zou de aangepaste sessie z'n trainingsfase kwijtraken
          mesocycle_type: sessie.mesocycle_type,
        })
        .select()
        .single()
      await supabase.from('training_plan_sessions').update({ status: 'cancelled' }).eq('id', sessie.id)
      if (nieuweSessie) aanpassingen.push({ sessie_id: sessie.id, oude_type: sessie.type, nieuwe_type: sessie.type, reason: 'missed_session' })
    }
  }

  // ── Trigger 2: injury_protection ─────────────────────────────────────
  const { data: actieveBlessures } = await supabase
    .from('injuries')
    .select('body_part')
    .eq('user_id', userId)
    .eq('active', true)

  if (actieveBlessures && actieveBlessures.length > 0) {
    const { data: toekomstigeIntervals } = await supabase
      .from('training_plan_sessions')
      .select('*')
      .eq('plan_id', planId)
      .gte('date', vandaag)
      .in('status', ['scheduled', 'planned'])
      .eq('type', adapter.hoogIntensiteitsType)

    for (const sessie of toekomstigeIntervals || []) {
      const { data: nieuweSessie } = await supabase
        .from('training_plan_sessions')
        .insert({
          plan_id: planId, date: sessie.date, sport: adapter.sport, type: adapter.vervangingBijBeperking,
          duration: sessie.duration, load_target: sessie.load_target,
          status: 'adjusted', original_session_id: sessie.id, adjustment_reason: 'injury_protection',
          mesocycle_type: sessie.mesocycle_type,
        })
        .select()
        .single()
      await supabase.from('training_plan_sessions').update({ status: 'cancelled' }).eq('id', sessie.id)
      if (nieuweSessie) aanpassingen.push({ sessie_id: sessie.id, oude_type: adapter.hoogIntensiteitsType, nieuwe_type: adapter.vervangingBijBeperking, reason: 'injury_protection' })
    }
  }

  // ── Trigger 3: fatigue_detected — GEDEELTELIJK, alleen vandaag ───────
  // v2.4.265 (ADR-007): muteert de database NIET meer. Bepaalt alleen
  // OF er een hoge-intensiteits-sessie vandaag gepland staat bij laag
  // herstel, en levert dat als signaal — de daadwerkelijke aanpassing
  // (inclusief eventuele combinatie met andere signalen) gebeurt nu
  // uitsluitend in de Workout Builder's Adaptation Engine.
  const policy = await genereerCoachPolicy(userId)
  if (policy.recoveryState === 'low') {
    const { data: vandaagSessie } = await supabase
      .from('training_plan_sessions')
      .select('*')
      .eq('plan_id', planId)
      .eq('date', vandaag)
      .in('status', ['scheduled', 'planned'])
      .maybeSingle()

    if (vandaagSessie && vandaagSessie.type === adapter.hoogIntensiteitsType) {
      // Confidence: CoachPolicy heeft geen eigen expliciet confidence-
      // getal — 65 is een redelijk, MEDIUM-achtig startpunt (zelfde
      // orde van grootte als de Universal Athlete Platform-adapters),
      // geen verzonnen precisie.
      fatigueSignaal = {
        source: 'fatigue', severity: 'high', confidence: 65,
        reden: 'laag herstel vandaag',
      }
    }
  }

  // ── Trigger 4: goal_change ────────────────────────────────────────────
  const { data: plan } = await supabase.from('training_plans').select('goal_id').eq('id', planId).single()
  const goalProgress = await haalGoalsMetProgress(userId, adapter.specialistType)
  const specialistDoelen = goalProgress.filter(g => g.goal_scope === 'specialist')
  const importanceRang: Record<string, number> = { must: 3, high: 2, normal: 1, low: 0 }
  const huidigLeidendDoel = specialistDoelen.length > 0
    ? specialistDoelen.reduce((a, b) => importanceRang[a.importance] >= importanceRang[b.importance] ? a : b)
    : null

  if (plan && huidigLeidendDoel && plan.goal_id !== huidigLeidendDoel.goal_id) {
    aanpassingen.push({ sessie_id: plan.goal_id || 'onbekend', oude_type: 'macrocyclus', nieuwe_type: null, reason: 'goal_change' })
  }

  return { aanpassingen, fatigueSignaal }
}
