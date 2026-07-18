import { createAdminClient } from '@/lib/supabase'
import { genereerCoachPolicy } from './coach-policy'
import { haalGoalsMetProgress } from './goal-engine'

// ── Daily Adjustment Layer — Adaptive Training Plan Engine, Fase 1 ─────
// Bron: docs/adaptive-training-plan-decision-contract-v1.md, sectie 2-3.
// VOLLEDIG DETERMINISTISCH.
//
// EERLIJKE DEKKING — niet alle 5 triggers zijn in deze eerste versie
// even volledig gecheckt:
// - missed_session:      ✅ volledig — vergelijkt geplande datum met vandaag
// - injury_protection:    ✅ volledig — checkt actieve blessures
// - goal_change:           ✅ volledig — vergelijkt plan.goal_id met huidig leidend doel
// - fatigue_detected:       🟡 GEDEELTELIJK — checkt alleen de huidige dag
//   (CoachPolicy recoveryState), NIET "meerdere dagen op rij" zoals de
//   spec zelf noemt als drempel — dat vergt historische CoachPolicy-
//   waarden die nu niet worden bijgehouden. Vergt een aparte
//   implementatiestap (bijv. dagelijkse recovery-snapshot opslaan).
// - vacation_mode:          ❌ NOG NIET — vergt eerst een UI om
//   onbeschikbare dagen in te voeren, die bestaat nog niet.

export interface AanpassingResultaat {
  sessie_id: string
  oude_type: string
  nieuwe_type: string | null // null = overgeslagen, geen vervanging
  reason: 'missed_session' | 'fatigue_detected' | 'injury_protection' | 'goal_change'
}

export async function voerDailyAdjustmentUit(userId: string, planId: string): Promise<AanpassingResultaat[]> {
  const supabase = createAdminClient()
  const aanpassingen: AanpassingResultaat[] = []
  const vandaag = new Date().toISOString().split('T')[0]

  // ── Trigger 1: missed_session ────────────────────────────────────────
  const { data: gemisteSessies } = await supabase
    .from('training_plan_sessions')
    .select('*')
    .eq('plan_id', planId)
    .eq('status', 'scheduled')
    .lt('date', vandaag)
    .is('completed_activity_id', null)

  for (const sessie of gemisteSessies || []) {
    // Deterministisch: verplaatst naar vandaag als er nog geen sessie
    // vandaag gepland staat, anders overgeslagen (geen dubbele belasting)
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
          plan_id: planId, date: vandaag, sport: 'cycling', type: sessie.type,
          duration: sessie.duration, load_target: sessie.load_target,
          status: 'adjusted', original_session_id: sessie.id, adjustment_reason: 'missed_session',
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
      .eq('type', 'interval')

    for (const sessie of toekomstigeIntervals || []) {
      const { data: nieuweSessie } = await supabase
        .from('training_plan_sessions')
        .insert({
          plan_id: planId, date: sessie.date, sport: 'cycling', type: 'duurtraining',
          duration: sessie.duration, load_target: sessie.load_target,
          status: 'adjusted', original_session_id: sessie.id, adjustment_reason: 'injury_protection',
        })
        .select()
        .single()
      await supabase.from('training_plan_sessions').update({ status: 'cancelled' }).eq('id', sessie.id)
      if (nieuweSessie) aanpassingen.push({ sessie_id: sessie.id, oude_type: 'interval', nieuwe_type: 'duurtraining', reason: 'injury_protection' })
    }
  }

  // ── Trigger 3: fatigue_detected — GEDEELTELIJK, alleen vandaag ───────
  const policy = await genereerCoachPolicy(userId)
  if (policy.recoveryState === 'low') {
    const { data: vandaagSessie } = await supabase
      .from('training_plan_sessions')
      .select('*')
      .eq('plan_id', planId)
      .eq('date', vandaag)
      .in('status', ['scheduled', 'planned'])
      .maybeSingle()

    if (vandaagSessie && vandaagSessie.type === 'interval') {
      const { data: nieuweSessie } = await supabase
        .from('training_plan_sessions')
        .insert({
          plan_id: planId, date: vandaag, sport: 'cycling', type: 'herstel',
          duration: Math.round(vandaagSessie.duration * 0.6), load_target: vandaagSessie.load_target,
          status: 'adjusted', original_session_id: vandaagSessie.id, adjustment_reason: 'fatigue_detected',
        })
        .select()
        .single()
      await supabase.from('training_plan_sessions').update({ status: 'cancelled' }).eq('id', vandaagSessie.id)
      if (nieuweSessie) aanpassingen.push({ sessie_id: vandaagSessie.id, oude_type: 'interval', nieuwe_type: 'herstel', reason: 'fatigue_detected' })
    }
  }

  // ── Trigger 4: goal_change ────────────────────────────────────────────
  const { data: plan } = await supabase.from('training_plans').select('goal_id').eq('id', planId).single()
  const goalProgress = await haalGoalsMetProgress(userId, 'cycling')
  const specialistDoelen = goalProgress.filter(g => g.goal_scope === 'specialist')
  const importanceRang: Record<string, number> = { must: 3, high: 2, normal: 1, low: 0 }
  const huidigLeidendDoel = specialistDoelen.length > 0
    ? specialistDoelen.reduce((a, b) => importanceRang[a.importance] >= importanceRang[b.importance] ? a : b)
    : null

  if (plan && huidigLeidendDoel && plan.goal_id !== huidigLeidendDoel.goal_id) {
    // Doel is gewijzigd sinds het plan werd gemaakt — hele macrocyclus
    // moet opnieuw (dit signaleren we hier alleen, de daadwerkelijke
    // hergeneratie roept de aanroepende code aan via genereerTrainingsplan)
    aanpassingen.push({ sessie_id: plan.goal_id || 'onbekend', oude_type: 'macrocyclus', nieuwe_type: null, reason: 'goal_change' })
  }

  return aanpassingen
}
