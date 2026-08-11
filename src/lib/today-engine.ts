import { createAdminClient } from '@/lib/supabase'
import { haalGoalsMetProgress } from '@/lib/specialists/goal-engine'
import { beslisTussenSpecialisten, type SpecialistSummaryVoorBeslissing } from '@/lib/specialists/decision-engine'
import { verlengRollingHorizonIndienNodigCore } from '@/lib/specialists/training-plan-engine/core'
import { cyclingAdapter } from '@/lib/specialists/training-plan-engine/cycling-adapter'
import { runningAdapter } from '@/lib/specialists/training-plan-engine/running-adapter'
import { rowingAdapter } from '@/lib/specialists/training-plan-engine/rowing-adapter'
// v2.4.314 (Coach Decision Integrity-bouwopdracht, 11 augustus 2026):
// dezelfde workout/adaptation-keten die de detailpagina's al gebruiken
// (api/specialists/{sport}/training-plan/workout) — geen tweede
// interpretatie van de aanpassing, geen nieuw/parallel systeem.
import { bouwWorkout, type WorkoutBuilderInput } from '@/core/workout-builder/builder'
import { pasWorkoutAan, totaalDuurVanWorkout, type AdaptationSignal } from '@/core/workout-builder/adaptation'
import type { WorkoutTrainingType, WorkoutMesocycle } from '@/core/workout-builder/types'
import { haalAthleteState } from '@/core/athlete-platform/storage'
import { bepaalKruisSportSignaal } from '@/core/athlete-platform/cross-sport-bridge'
import { voerDailyAdjustmentUitCore } from '@/lib/specialists/training-plan-engine/adjuster-core'
// v2.4.319 (CoachDecision-contract): genereerCoachPolicy() bevat nu de
// centrale REST/TRAIN/ADJUST-beslissing — hier hergebruikt, geen
// tweede engine.
import { genereerCoachPolicy, type CoachDecision } from '@/lib/specialists/coach-policy'

// ── Today Engine ──────────────────────────────────────────────────────
// Bron: overleg 22 juli 2026, uitgebreid 22 juli 2026 (multi-sport-
// voorbereiding). "De Today Engine maakt zelf nooit trainingen. Hij
// kiest alleen welke bron vandaag de waarheid is." — dat is de kern.
//
// VASTE HIËRARCHIE (platformregel, niet alleen voor Cycling/Running):
// 1. Veiligheid — CoachPolicy/blessures/herstel (al elders geborgd,
//    Today Engine herberekent dit niet, leest alleen de uitkomst)
// 2. Specialist-trainingsplan (Cycling/Running nu, later Rowing/
//    Kettlebell/etc. zodra die specialisten bestaan) — wint als er een
//    actief plan met een sessie voor vandaag is. Bij MEERDERE
//    specialisten met een sessie dezelfde dag: de bestaande Decision
//    Engine beslist (importance → calculated_urgency als tiebreaker) —
//    zie hieronder, geen arbitraire volgorde meer.
// 3. Trainer AI (Universal Training Engine) — alleen als er GEEN
//    actief specialist-plan is voor vandaag
// 4. Handmatige bibliotheekkeuze — buiten de Today Engine om
//
// FASE 1 (dit bestand, nu): altijd precies ÉÉN TodayPlan naar Home.
// FASE 2 (later, zodra Rowing/Kettlebell/etc. echte specialisten
// worden): TodaySchedule — meerdere voorstellen tegelijk, een echte
// dagplanning i.p.v. één sessie. Daarom is de interne structuur hier
// BEWUST al een `proposals[]`-array, ook al bevat die nu maximaal 2
// items (cycling/running) — de engine hoeft dan niet opnieuw ontworpen
// te worden, alleen uitgebreid.
//
// EERLIJKE BEPERKING: "Regel 4 — Planfase (Build > Base > Recovery)"
// uit het overleg gebruikt NOG STEEDS geen mesocyclus voor de
// prioriteitsbeslissing tussen specialisten (die blijft bij Regel 3 —
// Goal Engine-importance/-urgentie). mesocycle_type wordt vanaf
// v2.4.176 wél opgeslagen en doorgegeven — maar puur als BESCHRIJVENDE
// context bij TodayPlan, niet als extra tiebreak-regel. Dat is een
// bewuste, kleinere scope dan "gebruik dit óók om tussen specialisten
// te kiezen" — die uitbreiding kan later, met een concreet scenario om
// tegen te testen.

export interface TodayPlan {
  source: 'cycling' | 'running' | 'rowing' | 'trainer' | 'rust'
  title: string
  duration: number | null
  intensity: 'licht' | 'matig' | 'hoog' | null
  reason: string
  coachMessage: string
  actionHref: string
  actionLabel: string
  // v2.4.176: periodiserings-context — bestond al in de Training Plan
  // Engine (bepaalMesocycli), werd nooit opgeslagen. Nu wel. Bewust
  // UITBREIDBAAR ontworpen (matcht het "Training Phase"-blok uit het
  // overleg) — week-binnen-blok/dagen-tot-wedstrijd zijn hier bewust
  // NIET aan toegevoegd, die data bestaat nog nergens om op te baseren.
  trainingPhase: { mesocycleType: 'basis' | 'opbouw' | 'piek' | 'herstel' } | null
  // v2.4.250: sessie-id van de onderliggende training_plan_sessions-rij
  // — nodig om de Coach-route de concrete workout (met kruis-sport-
  // aanpassingen) te laten ophalen. Alleen gevuld bij een specialist-
  // sessie (source cycling/running/rowing), niet bij trainer/rust.
  sessieId: string | null
  // v2.4.314 (Coach Decision Integrity): `duration` is voortaan de
  // DEFINITIEVE, mogelijk aangepaste waarde (uit dezelfde
  // bouwWorkout()→signalen→pasWorkoutAan()-keten als de detailpagina) —
  // niet langer de rauwe, ongewijzigde training_plan_sessions.duration.
  // originalDuration bewaart die oorspronkelijke, geplande waarde apart,
  // puur voor transparantie (kaart/AI mogen "50 → 35" laten zien zonder
  // de oorspronkelijke planning te verliezen). null bij trainer/rust
  // (geen specialist-workout om aan te passen) of als er geen aanpassing
  // was (dan zijn beide gelijk, maar originalDuration blijft gevuld).
  originalDuration: number | null
  /** Gecombineerde redentekst van alle actieve aanpassingssignalen
   * (bijv. "je bent op vakantie; laag herstel vandaag") — null als er
   * geen aanpassing is. De AI krijgt dit letterlijk mee, mag het niet
   * zelf verzinnen of herformuleren naar een ander getal. */
  adjustmentReason: string | null
  // v2.4.319 (CoachDecision-contract): REST | TRAIN | ADJUST, direct
  // van genereerCoachPolicy() overgenomen — de enige plek die dit
  // bepaalt. null bij Trainer AI/rust-pad (geen specialist-sessie om
  // over te beslissen — dat pad kent CoachDecision niet, blijft
  // ongewijzigd). Bij REST: duration/originalDuration/adjustmentReason
  // zijn ook null — er is geen workout, alleen een reden.
  trainingDecision: CoachDecision | null
}

// v2.4.315: geëxporteerd (was lokaal) — hergebruikt door de Cycling/
// Running training-plan-GET-routes voor dezelfde 84-vs-83-fix als hier.
export interface TrainingPlanSessie {
  id: string
  type: string
  duration: number
  status: string
  adjustment_reason: string | null
  mesocycle_type: 'basis' | 'opbouw' | 'piek' | 'herstel' | null
  // v2.4.314: nodig voor voerDailyAdjustmentUitCore() in
  // berekenDefinitieveDuur() — die functie vergt het plan-ID, niet het
  // sessie-ID.
  plan_id: string
}

export interface SpecialistProposal {
  sport: 'cycling' | 'running' | 'rowing'
  sessie: TrainingPlanSessie
}

const SPORT_LABELS: Record<string, string> = {
  interval: 'Interval', duurtraining: 'Duurtraining', lange_duurtraining: 'Lange duurtraining', herstel: 'Herstel', // cycling
  easy_run: 'Easy Run', lange_duurloop: 'Lange duurloop', tempo: 'Tempo', // running (interval/herstel gedeeld)
  // v2.4.231-FIX: rowing ontbrak volledig — Today Engine (en dus ook
  // Smart Actions/Home) miste elke actieve Rowing-trainingsplansessie.
  // Labels exact matchend met training-plan-engine/rowing-adapter.ts's
  // vocabulaire (endurance/interval/recovery/lange_afstand/test).
  endurance: 'Duurtraining', recovery: 'Herstel', lange_afstand: 'Lange afstand', test: 'Test', // rowing (interval gedeeld)
}

async function haalSpecialistSessieVanVandaag(userId: string, sport: 'cycling' | 'running' | 'rowing', vandaag: string): Promise<TrainingPlanSessie | null> {
  const supabase = createAdminClient()

  const { data: actievePlannen } = await supabase
    .from('training_plans')
    .select('id')
    .eq('athlete_id', userId)
    .eq('sport', sport)
    .eq('status', 'active')

  const planIds = (actievePlannen || []).map(p => p.id)
  if (planIds.length === 0) return null

  const { data: sessie } = await supabase
    .from('training_plan_sessions')
    .select('id, type, duration, status, adjustment_reason, mesocycle_type, plan_id')
    .eq('date', vandaag)
    .in('plan_id', planIds)
    .neq('status', 'cancelled')
    .maybeSingle()

  return sessie || null
}

const MESOCYCLE_LABELS: Record<string, string> = { basis: 'Base-week', opbouw: 'Build-week', piek: 'Peak-week', herstel: 'Recovery-week' }

// v2.4.314: exact overgenomen uit elke sport se eigen
// api/specialists/{sport}/training-plan/workout/route.ts — niet
// opnieuw verzonnen, letterlijk dezelfde mapping-tabellen, zodat Today
// Engine precies dezelfde WorkoutBuilderInput bouwt als de detailpagina.
const TRAININGTYPE_MAP_PER_SPORT: Record<string, Record<string, WorkoutTrainingType>> = {
  cycling: { duurtraining: 'endurance', interval: 'interval', herstel: 'herstel', lange_duurtraining: 'lange_afstand' },
  running: { easy_run: 'endurance', interval: 'interval', herstel: 'herstel', lange_duurloop: 'lange_afstand', tempo: 'tempo' },
  rowing: { endurance: 'endurance', interval: 'interval', recovery: 'herstel', lange_afstand: 'lange_afstand', test: 'test' },
}
const MESOCYCLE_MAP: Record<string, WorkoutMesocycle> = { basis: 'basis', opbouw: 'opbouw', piek: 'piek', herstel: 'herstel' }
const ADAPTER_PER_SPORT: Record<string, typeof cyclingAdapter> = { cycling: cyclingAdapter, running: runningAdapter, rowing: rowingAdapter }

/**
 * v2.4.314 (Coach Decision Integrity-bouwopdracht, 11 augustus 2026):
 * bouwt dezelfde workout als de detailpagina (bouwWorkout → signalen
 * → pasWorkoutAan) en leidt daaruit de DEFINITIEVE totaalduur af via
 * totaalDuurVanWorkout() — nooit UniversalWorkout.duration_sec zelf,
 * dat veld wordt door pasWorkoutAan() niet herberekend (geverifieerd,
 * zie README Regel 0c). Bij elke fout: nette terugval op de
 * oorspronkelijke, ongewijzigde duur — een probleem hier mag Home
 * nooit laten crashen (zelfde principe als de bestaande try/catches
 * in de workout-routes zelf).
 */
// v2.4.320-FIX: optioneel vierde parameter, doorgegeven aan
// voerDailyAdjustmentUitCore() — zie de toelichting daar (adjuster-core.ts)
// voor de volledige root cause. Voorkomt een dubbele
// genereerCoachPolicy()-aanroep binnen dezelfde Today Engine-aanroep.
export async function berekenDefinitieveDuur(userId: string, proposal: SpecialistProposal, vooraf_berekend_recoveryState?: 'low' | 'moderate' | 'good'): Promise<{ duur: number; reden: string | null }> {
  const origineleDuur = proposal.sessie.duration
  try {
    const supabase = createAdminClient()
    const trainingType = TRAININGTYPE_MAP_PER_SPORT[proposal.sport]?.[proposal.sessie.type] || 'endurance'
    const mesocycle = MESOCYCLE_MAP[proposal.sessie.mesocycle_type || ''] || 'basis'

    const input: WorkoutBuilderInput = {
      sport: proposal.sport, trainingType, mesocycle,
      duration_sec: (origineleDuur || 60) * 60,
      difficulty: 'gemiddeld',
    }
    let workout = bouwWorkout(input)

    const alleSignalen: AdaptationSignal[] = []
    const athleteState = await haalAthleteState(supabase, userId)
    const kruisSportSignaal = bepaalKruisSportSignaal(athleteState)
    if (kruisSportSignaal) alleSignalen.push(kruisSportSignaal)

    const adapter = ADAPTER_PER_SPORT[proposal.sport]
    const dailyAdjustment = await voerDailyAdjustmentUitCore(userId, proposal.sessie.plan_id, adapter, vooraf_berekend_recoveryState)
    if (dailyAdjustment.fatigueSignaal) alleSignalen.push(dailyAdjustment.fatigueSignaal)
    if (dailyAdjustment.vacationSignaal) alleSignalen.push(dailyAdjustment.vacationSignaal)

    let reden: string | null = null
    if (alleSignalen.length > 0) {
      workout = pasWorkoutAan(workout, { signalen: alleSignalen })
      reden = alleSignalen.map(s => s.reden).join('; ')
    }

    return { duur: totaalDuurVanWorkout(workout), reden }
  } catch (err) {
    console.error('[today-engine] Definitieve duur berekenen mislukt, val terug op origineel:', err)
    return { duur: origineleDuur, reden: null }
  }
}

async function proposalNaarTodayPlan(userId: string, proposal: SpecialistProposal): Promise<TodayPlan> {
  // ── CoachDecision — v2.4.319, contract-vastgelegd 11 augustus 2026 ────
  // ÉÉN aanroep, aan het begin, vóór er ook maar iets van een workout
  // gebouwd wordt. Bij REST: direct terug, bouwWorkout()/pasWorkoutAan()
  // worden NOOIT aangeroepen — "REST krijgt geen workout" is hiermee
  // technisch afgedwongen, niet alleen een prompt-instructie.
  let policy
  try {
    policy = await genereerCoachPolicy(userId)
  } catch (err) {
    console.error('[today-engine] CoachPolicy ophalen mislukt, val terug op TRAIN (geen blokkade bij een fout):', err)
    policy = null
  }

  if (policy?.decision === 'REST') {
    const SPORT_NAAM_LABEL_REST: Record<string, string> = { cycling: 'Cycling', running: 'Running', rowing: 'Rowing' }
    return {
      source: proposal.sport,
      title: 'Rustdag',
      duration: null,
      intensity: null,
      reason: policy.reasons.join('; '),
      coachMessage: `Vandaag geen ${SPORT_NAAM_LABEL_REST[proposal.sport] || proposal.sport}-training — ${policy.reasons[policy.reasons.length - 1] || 'rust staat voorop'}.`,
      actionHref: `/coach/${proposal.sport}/trainingsplan`,
      actionLabel: 'Bekijk trainingsplan',
      trainingPhase: proposal.sessie.mesocycle_type ? { mesocycleType: proposal.sessie.mesocycle_type } : null,
      sessieId: proposal.sessie.id,
      originalDuration: proposal.sessie.duration,
      adjustmentReason: null,
      trainingDecision: 'REST',
    }
  }

  // v2.4.231-FIX: Rowing gebruikt 'recovery' i.p.v. 'herstel' voor
  // hetzelfde concept (zie SPORT_LABELS hierboven) — zonder deze
  // toevoeging zou een Rowing-hersteldag als 'matig' (i.p.v. 'licht')
  // intensiteit gelden, exact hetzelfde soort vocabulaire-mismatch als
  // eerder vandaag gevonden bij de Training Plan Engine-koppeling.
  const intensiteit: TodayPlan['intensity'] = proposal.sessie.type === 'interval' ? 'hoog'
    : (proposal.sessie.type === 'herstel' || proposal.sessie.type === 'recovery') ? 'licht' : 'matig'
  const fase = proposal.sessie.mesocycle_type
  const faseLabel = fase ? MESOCYCLE_LABELS[fase] : null
  // v2.4.231-FIX: was een hardcoded cycling/running-ternary, exact
  // dezelfde bug-klasse als eerder vandaag gevonden in training-plan-
  // engine/core.ts — zou bij Rowing altijd "Running" tonen. Nu generiek.
  const SPORT_NAAM_LABEL: Record<string, string> = { cycling: 'Cycling', running: 'Running', rowing: 'Rowing' }

  const { duur: definitieveDuur, reden: aanpassingsReden } = await berekenDefinitieveDuur(userId, proposal, policy?.recoveryState)

  return {
    source: proposal.sport,
    title: SPORT_LABELS[proposal.sessie.type] || proposal.sessie.type,
    duration: definitieveDuur,
    intensity: intensiteit,
    reason: `Onderdeel van je ${SPORT_NAAM_LABEL[proposal.sport] || proposal.sport}-trainingsplan${faseLabel ? ` (${faseLabel})` : ''}`,
    coachMessage: aanpassingsReden
      ? 'Deze sessie is aangepast op basis van vandaag — zie het trainingsplan voor de volledige uitleg.'
      : (proposal.sessie.adjustment_reason
        ? 'Deze sessie is aangepast op basis van je herstel — zie het trainingsplan voor de volledige uitleg.'
        : 'Volgens schema — ga ervoor!'),
    actionHref: `/coach/${proposal.sport}/trainingsplan`,
    actionLabel: 'Open trainingsplan',
    trainingPhase: fase ? { mesocycleType: fase } : null,
    sessieId: proposal.sessie.id,
    originalDuration: proposal.sessie.duration,
    adjustmentReason: aanpassingsReden,
    trainingDecision: policy?.decision ?? null,
  }
}

/**
 * Kiest tussen meerdere gelijktijdige specialist-voorstellen via de
 * bestaande Decision Engine (importance → calculated_urgency als
 * tiebreaker) — i.p.v. de vorige, arbitraire "Cycling wint altijd"-
 * volgorde. load/risk zijn hier bewust een eenvoudige, eerlijk benoemde
 * aanname ('moderate'/'none') — een sessie staat immers al gepland,
 * echte blessure-/belastingsrisico's zijn al door Laag 1 (CoachPolicy)
 * afgehandeld vóórdat we hier komen.
 */
async function kiesTussenProposals(userId: string, proposals: SpecialistProposal[]): Promise<SpecialistProposal> {
  if (proposals.length === 1) return proposals[0]

  const summaries: SpecialistSummaryVoorBeslissing[] = await Promise.all(
    proposals.map(async (p): Promise<SpecialistSummaryVoorBeslissing> => {
      const goals = await haalGoalsMetProgress(userId, p.sport).catch(() => [])
      const specialistDoelen = goals.filter(g => g.goal_scope === 'specialist')
      const importanceRang: Record<string, number> = { must: 3, high: 2, normal: 1, low: 0 }
      const leidendDoel = specialistDoelen.length > 0
        ? specialistDoelen.reduce((a, b) => importanceRang[a.importance] >= importanceRang[b.importance] ? a : b)
        : null
      return {
        specialist: p.sport,
        load: 'moderate',
        risk: 'none',
        recommendation: p.sessie.type,
        hoogsteImportance: leidendDoel?.importance,
        hoogsteUrgentie: leidendDoel?.calculated_urgency,
        naasteDeadlineDagen: leidendDoel?.dagen_resterend ?? null,
      }
    })
  )

  const beslissing = beslisTussenSpecialisten(summaries, 'balance')
  if (!beslissing) return proposals[0] // geen doeldata om op te beslissen — eerste voorstel (stabiele volgorde, geen willekeur)

  return proposals.find(p => p.sport === beslissing.selectedCoach) || proposals[0]
}

export async function bepaalTodayPlan(userId: string, cookieHeader: string, baseUrl: string): Promise<TodayPlan> {
  const supabase = createAdminClient()
  const vandaag = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })

  // ── Laag 1: veiligheid ───────────────────────────────────────────────
  const { data: coachRec } = await supabase
    .from('coach_recommendations')
    .select('actie_type')
    .eq('user_id', userId).eq('date', vandaag).eq('type', 'coach')
    .maybeSingle()
  const actieType = coachRec?.actie_type as 'trainen' | 'herstel' | 'rust' | undefined

  if (actieType === 'rust') {
    return {
      source: 'rust', title: 'Rustdag', duration: null, intensity: null,
      reason: 'Coach adviseert vandaag volledige rust',
      coachMessage: 'Vandaag is herstel de training. Geen sportieve inspanning gepland.',
      actionHref: '/coach', actionLabel: 'Bekijk Coach-advies',
      trainingPhase: null, sessieId: null, originalDuration: null, adjustmentReason: null, trainingDecision: null,
    }
  }

  // v2.4.249-FIX: gemeld — rolling horizon-verlenging (v2.4.248) werkte
  // alleen als je toevallig de trainingsplan-pagina van DIE specifieke
  // sport bezocht had. Bezocht je alleen Rowing, dan bleef Running/
  // Cycling leeglopen (en andersom). Nu automatisch, voor alle drie
  // tegelijk, bij elke Today Engine-aanroep (dus ook gewoon bij het
  // openen van Home) — ongeacht welke specifieke pagina je bezoekt.
  // In een try/catch per sport: één mislukte verlenging mag de andere
  // twee, en vooral de rest van Today Engine, nooit blokkeren.
  const actievePlannen = await supabase
    .from('training_plans').select('id, sport').eq('athlete_id', userId).eq('status', 'active')
  const adapterPerSport: Record<string, typeof cyclingAdapter> = { cycling: cyclingAdapter, running: runningAdapter, rowing: rowingAdapter }
  await Promise.all((actievePlannen.data || []).map(async (plan) => {
    const adapter = adapterPerSport[plan.sport]
    if (!adapter) return
    try {
      await verlengRollingHorizonIndienNodigCore(userId, plan.id, adapter)
    } catch (verlengErr) {
      console.error(`[today-engine] Rolling horizon-verlenging mislukt voor ${plan.sport}:`, verlengErr)
    }
  }))

  // ── Laag 2: Specialist-trainingsplannen — proposals[] i.p.v. losse
  // if/else, klaar voor meer specialisten later ───────────────────────
  // v2.4.231-FIX: rowing toegevoegd — de code was hier al expliciet op
  // voorbereid ("proposals[] i.p.v. losse if/else, klaar voor meer
  // specialisten later"), Rowing sluit gewoon aan op hetzelfde patroon
  const [cyclingSessie, runningSessie, rowingSessie] = await Promise.all([
    haalSpecialistSessieVanVandaag(userId, 'cycling', vandaag),
    haalSpecialistSessieVanVandaag(userId, 'running', vandaag),
    haalSpecialistSessieVanVandaag(userId, 'rowing', vandaag),
  ])

  const proposals: SpecialistProposal[] = []
  if (cyclingSessie) proposals.push({ sport: 'cycling', sessie: cyclingSessie })
  if (runningSessie) proposals.push({ sport: 'running', sessie: runningSessie })
  if (rowingSessie) proposals.push({ sport: 'rowing', sessie: rowingSessie })

  if (proposals.length > 0) {
    const gekozenProposal = await kiesTussenProposals(userId, proposals)
    return await proposalNaarTodayPlan(userId, gekozenProposal)
  }

  // ── Laag 3: Trainer AI — alleen als er geen specialist-plan is ─────
  try {
    // v2.4.184-FIX: VERCEL_URL verwijderd — die wijst naar een
    // deployment-specifieke URL (kan afwijken van het custom domain/
    // production-alias waar de gebruiker daadwerkelijk op inlogt).
    // Cookie-domain-mismatch tussen die twee URLs kon de sessie-cookie
    // ongeldig maken bij deze interne aanroep — precies bevestigd:
    // Trainer-tab in de browser werkte prima, deze interne aanroep
    // faalde stil. baseUrl komt nu van de aanroeper, afgeleid van het
    // daadwerkelijke inkomende verzoek — gegarandeerd hetzelfde domein.
    const trainerRes = await fetch(`${baseUrl}/api/training/today`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
      body: JSON.stringify({}),
    })
    if (!trainerRes.ok) {
      console.error('[today-engine] Trainer AI-aanroep gaf status', trainerRes.status, 'baseUrl:', baseUrl)
    } else {
      const data = await trainerRes.json()
      const instr = data.instruction
      if (instr && instr.training_allowed) {
        return {
          source: 'trainer',
          title: instr.title || 'Training',
          duration: instr.duration,
          intensity: instr.intensity === 'heavy' ? 'hoog' : instr.intensity === 'medium' ? 'matig' : 'licht',
          reason: instr.reason || 'Trainer AI-sessie',
          coachMessage: instr.coach_message || 'Veel succes met je training!',
          actionHref: '/training', actionLabel: 'Start Training',
          trainingPhase: null, sessieId: null, originalDuration: null, adjustmentReason: null, trainingDecision: null,
        }
      } else {
        console.error('[today-engine] Trainer AI gaf geen bruikbare instructie terug:', JSON.stringify(data).slice(0, 300))
      }
    }
  } catch (err) {
    console.error('[today-engine] Trainer AI ophalen mislukt, baseUrl:', baseUrl, 'fout:', err)
  }

  // Geen enkele bron leverde iets op — nette lege staat, geen gok
  return {
    source: 'rust', title: 'Geen training gepland', duration: null, intensity: null,
    reason: 'Geen actief trainingsplan en Trainer AI kon geen sessie bepalen',
    coachMessage: 'Wil je toch trainen? Kies zelf een module in de bibliotheek.',
    actionHref: '/training', actionLabel: 'Bibliotheek openen',
    trainingPhase: null, sessieId: null, originalDuration: null, adjustmentReason: null, trainingDecision: null,
  }
}
