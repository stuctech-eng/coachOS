import { createAdminClient } from '@/lib/supabase'
import { haalGoalsMetProgress } from '@/lib/specialists/goal-engine'
import { beslisTussenSpecialisten, type SpecialistSummaryVoorBeslissing } from '@/lib/specialists/decision-engine'

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
}

interface TrainingPlanSessie {
  id: string
  type: string
  duration: number
  status: string
  adjustment_reason: string | null
  mesocycle_type: 'basis' | 'opbouw' | 'piek' | 'herstel' | null
}

interface SpecialistProposal {
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
    .select('id, type, duration, status, adjustment_reason, mesocycle_type')
    .eq('date', vandaag)
    .in('plan_id', planIds)
    .neq('status', 'cancelled')
    .maybeSingle()

  return sessie || null
}

const MESOCYCLE_LABELS: Record<string, string> = { basis: 'Base-week', opbouw: 'Build-week', piek: 'Peak-week', herstel: 'Recovery-week' }

function proposalNaarTodayPlan(proposal: SpecialistProposal): TodayPlan {
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
  return {
    source: proposal.sport,
    title: SPORT_LABELS[proposal.sessie.type] || proposal.sessie.type,
    duration: proposal.sessie.duration,
    intensity: intensiteit,
    reason: `Onderdeel van je ${SPORT_NAAM_LABEL[proposal.sport] || proposal.sport}-trainingsplan${faseLabel ? ` (${faseLabel})` : ''}`,
    coachMessage: proposal.sessie.adjustment_reason
      ? 'Deze sessie is aangepast op basis van je herstel — zie het trainingsplan voor de volledige uitleg.'
      : 'Volgens schema — ga ervoor!',
    actionHref: `/coach/${proposal.sport}/trainingsplan`,
    actionLabel: 'Open trainingsplan',
    trainingPhase: fase ? { mesocycleType: fase } : null,
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
      trainingPhase: null,
    }
  }

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
    return proposalNaarTodayPlan(gekozenProposal)
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
          trainingPhase: null,
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
    trainingPhase: null,
  }
}
