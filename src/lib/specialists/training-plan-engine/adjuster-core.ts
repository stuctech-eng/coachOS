import { createAdminClient } from '@/lib/supabase'
import { isoDatum } from '@/utils'
import { genereerCoachPolicy } from '../coach-policy'
import { haalGoalsMetProgress } from '../goal-engine'
import type { AanpassingResultaat, TrainingPlanSportAdapter } from './types'
import type { AdaptationSignal } from '@/core/workout-builder/adaptation'
// v2.4.314: hergebruikt voor Trigger 5 (vacation_mode) — geen nieuwe
// vakantie-datalaag, exact dezelfde functie/interface als de Coach
// Vooruitblik-kaart al gebruikt (coach-planning-overzicht.ts).
import { isEventActiefOpDag, type LifeEventRij } from '@/lib/coach-planning-overzicht'

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
// - vacation_mode:          ✅ v2.4.314 — Coach Decision Integrity-
//   bouwopdracht (11 augustus 2026). Zelfde patroon als fatigue_detected:
//   levert een signaal, muteert de database NIET. Hergebruikt
//   isEventActiefOpDag()/LifeEventRij uit coach-planning-overzicht.ts —
//   geen nieuwe vakantie-datalaag.

export interface DailyAdjustmentResultaat {
  aanpassingen: AanpassingResultaat[]
  /** v2.4.265: fatigue_detected levert nu een signaal i.p.v. een
   * database-mutatie — de aanroeper combineert dit zelf met andere
   * signalen vóór het bouwen van de concrete workout. */
  fatigueSignaal: AdaptationSignal | null
  /** v2.4.314: vacation_mode — zelfde soort signaal, zelfde reden om
   * niet te muteren (contextueel, dagafhankelijk, geen structurele
   * planningswijziging). */
  vacationSignaal: AdaptationSignal | null
}

// v2.4.320-FIX: gemeld — "Open trainingsplan" verscheen vaak niet meer
// bij Snelle Acties. Root cause: deze functie roept genereerCoachPolicy()
// aan (Trigger 3), maar Today Engine (today-engine.ts) roept die functie
// SINDS v2.4.319 ook al zelf aan, vóór deze functie ooit bereikt wordt
// (de nieuwe REST-check). Binnen één Today Engine-aanroep gebeurde de
// volledige CoachPolicy-berekening dus TWEE keer — genoeg extra latency
// om Smart Actions' bestaande, harde 2,5-seconden-tijdslimiet
// (api/smart-actions/route.ts) te overschrijden, waardoor het
// trainingsvoorstel stil werd overgeslagen.
//
// Fix: optioneel, vierde parameter — een al-berekend recoveryState. Als
// meegegeven: geen tweede genereerCoachPolicy()-aanroep. Als weggelaten
// (de drie workout-detail-routes, die geen "buiten" al-berekende policy
// hebben): ONGEWIJZIGD gedrag, zelfde als vóór deze fix.
export async function voerDailyAdjustmentUitCore(userId: string, planId: string, adapter: TrainingPlanSportAdapter, vooraf_berekend_recoveryState?: 'low' | 'moderate' | 'good'): Promise<DailyAdjustmentResultaat> {
  const supabase = createAdminClient()
  const aanpassingen: AanpassingResultaat[] = []
  let fatigueSignaal: AdaptationSignal | null = null
  let vacationSignaal: AdaptationSignal | null = null
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

  // ── Trigger 3: fatigue_detected — alleen vandaag ──────────────────────
  // v2.4.265 (ADR-007): muteert de database NIET meer. Bepaalt alleen OF
  // er bij laag herstel een sessie vandaag gepland staat, en levert dat
  // als signaal — de daadwerkelijke aanpassing gebeurt uitsluitend in de
  // Workout Builder's Adaptation Engine.
  //
  // v2.4.317-FIX (Coach Decision Integrity — "84/75/76 minuten"-bevinding,
  // overleg gebruiker + GPT, 11 augustus 2026): de eis
  // `vandaagSessie.type === adapter.hoogIntensiteitsType` verwijderd.
  // Onderzocht vóór wijzigen: het oorspronkelijke contract
  // (adaptive-training-plan-decision-contract-v1.md) beschrijft
  // fatigue_detected breder ("microcyclus verzwakt"), en er is geen
  // enkele documentatie/ADR gevonden die deze beperking tot intervallen
  // als bewuste, fysiologisch onderbouwde keuze vastlegt — dus
  // behandeld als onvolledige scope, niet als grens die met bewijs
  // overschreven wordt. DREMPELWAARDE ONGEWIJZIGD
  // (policy.recoveryState === 'low', confidence 65) — alleen de
  // sessietype-restrictie is weg. Zonder deze fix kon de AI bij laag
  // herstel op een duurtraining zelf een reductie "verzinnen" (rauwe
  // HRV-data elders in de prompt), terwijl de kaart 84 bleef tonen —
  // precies het gat dat Regel 0c moet dichten.
  const policy = vooraf_berekend_recoveryState
    ? { recoveryState: vooraf_berekend_recoveryState }
    : await genereerCoachPolicy(userId)
  if (policy.recoveryState === 'low') {
    const { data: vandaagSessie } = await supabase
      .from('training_plan_sessions')
      .select('*')
      .eq('plan_id', planId)
      .eq('date', vandaag)
      .in('status', ['scheduled', 'planned'])
      .maybeSingle()

    if (vandaagSessie) {
      // Confidence: CoachPolicy heeft geen eigen expliciet confidence-
      // getal — 65 is een redelijk, MEDIUM-achtig startpunt (zelfde
      // orde van grootte als de Universal Athlete Platform-adapters),
      // geen verzonnen precisie. Ongewijzigd t.o.v. de eerdere,
      // interval-only-versie — geen nieuwe drempelwaarde verzonnen.
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

  // ── Trigger 5: vacation_mode ──────────────────────────────────────────
  // v2.4.314 (Coach Decision Integrity-bouwopdracht, 11 augustus 2026).
  // Zelfde soort signaal als fatigue_detected hierboven — geen database-
  // mutatie, puur een AdaptationSignal voor de aanroeper. Hergebruikt
  // isEventActiefOpDag()/LifeEventRij (coach-planning-overzicht.ts) —
  // geen nieuwe vakantie-datalaag. Vakantie-events zijn altijd eenmalig
  // (nooit recurrence), maar isEventActiefOpDag() handelt dat pad ook
  // correct af (regel `if (!e.recurrence) { ... }`), dus geen aparte,
  // vereenvoudigde check nodig.
  const { data: vakantieEvents } = await supabase
    .from('life_events')
    .select('type, start_time, end_date, recurrence, recurrence_days, recurrence_end_date, recurrence_exceptions')
    .eq('user_id', userId)
    .eq('type', 'vakantie')

  const actieveVakantie = (vakantieEvents as LifeEventRij[] | null || [])
    .find(e => isEventActiefOpDag(e, vandaag))

  if (actieveVakantie) {
    vacationSignaal = {
      source: 'vacation', severity: 'medium', confidence: 100,
      reden: 'je bent op vakantie',
    }
  }

  return { aanpassingen, fatigueSignaal, vacationSignaal }
}
