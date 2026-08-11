import { createAdminClient } from '@/lib/supabase'
import { calculateRecoveryScore } from '@/core/ai-engine/recovery-engine'
import { haalPerformanceVoorRecovery } from './health-analysis-engine'
// v2.4.319 (CoachDecision-contract — gebruiker + GPT-overleg, 11
// augustus 2026): beide functies bestaan al, hier hergebruikt zonder
// enige wijziging aan hun eigen logica — geen nieuwe query, geen
// nieuwe categorisatieregel.
import { fetchTodaysLifeEvents } from '@/core/utils/life-events-context'
import { bepaalDagContext } from '@/core/utils/context-resolver'

// ── Coach Policy Generator ──────────────────────────────────────────────
// Bron: docs/specialist-coach-policy.md. VOLLEDIG DETERMINISTISCH — geen
// AI-aanroep. Hergebruikt de BESTAANDE calculateRecoveryScore()
// (src/core/ai-engine/recovery-engine.ts, al gebruikt in api/coach/route.ts)
// en vertaalt die naar beleid: WAT mag een specialist vandaag, niet
// WELKE ruwe cijfers daaronder liggen.
//
// De specialist krijgt dus nooit "HRV = 45ms" te zien — alleen
// "maxIntensity: low". Zie specialist-coach-policy.md voor de volledige
// onderbouwing van dit onderscheid.
//
// v2.4.319 — CoachDecision-contract toegevoegd (gebruiker + GPT-overleg,
// 11 augustus 2026, na de "84/75/76 minuten"-bevinding). Nieuwe,
// hogere-orde beslissing: REST | TRAIN | ADJUST. Dit is de ENIGE plek
// die deze beslissing produceert — geen tweede engine, geen AI-aanroep.
//
// SEMANTIEK, letterlijk uit het contract:
// - REST   = actieve blessure OF ziekte (bestaande, al-gedefinieerde
//            -100%-blokkade in context-resolver.ts's MODIFIERS — geen
//            nieuwe fysiologische regel, hergebruik van bestaand bewijs)
// - TRAIN  = geen REST, geen bestaande aanpassing noodzakelijk
// - ADJUST = geen REST, bestaande context (herstel/vakantie/cross-sport/
//            belasting) vereist aanpassing — pasWorkoutAan() blijft de
//            ENIGE plek die de workout daadwerkelijk aanpast
//
// EXPLICIET NIET GEDAAN, zoals besloten: ACWR > 1,7 wordt GEEN REST —
// geen bestaand contract voor volledige blokkade op basis van ACWR
// alleen, blijft binnen ADJUST via de bestaande belastinglogica.
//
// GEEN confidence-veld — consistent met het eerdere besluit dat een
// technische onzekerheidsscore geen rol speelt in een gebruikersgerichte
// beslissing (zelfde principe als bij Workout Matching-confidence).
//
// PRIORITEIT — ongewijzigd overgenomen uit context-resolver.ts's
// CONTEXT_PRIORITY: blessure > ziekte > vakantie > herstel > wedstrijd >
// werk > training > vrije_tijd. Een wedstrijd morgen overrulet dus geen
// actieve blessure — dat is een bestaande, niet-nieuwe regel.
//
// CONTEXT-TOEGANG, bevestigd vóór bouwen (niet aangenomen): deze functie
// haalde tot nu toe GEEN life_events op — kon dus geen ziekte/vakantie/
// wedstrijd/werk zien, alleen blessures (injuries-tabel). Uitgebreid met
// fetchTodaysLifeEvents() + bepaalDagContext() — beide bestaande,
// ongewijzigde functies, geen duplicatie.

export type CoachDecision = 'REST' | 'TRAIN' | 'ADJUST'

export type RecoveryState = 'low' | 'moderate' | 'good'
export type IntensityLevel = 'low' | 'moderate' | 'high'
export type Priority = 'recovery' | 'performance' | 'balance'

export interface CoachPolicy {
  decision: CoachDecision
  recoveryState: RecoveryState
  maxIntensity: IntensityLevel
  volumeAdjustmentPct: number
  priority: Priority
  allowedTrainingTypes: string[]
  forbiddenTrainingTypes: string[]
  reasons: string[]
}

// Eén stap omlaag op de intensiteitsladder — gebruikt bij de
// blessure-regel hieronder (Decision Engine-regel 2: blessures > periodisering)
function verlaagIntensiteit(niveau: IntensityLevel): IntensityLevel {
  if (niveau === 'high') return 'moderate'
  if (niveau === 'moderate') return 'low'
  return 'low'
}

export async function genereerCoachPolicy(userId: string): Promise<CoachPolicy> {
  const supabase = createAdminClient()
  const vandaag = new Date().toISOString().split('T')[0]
  const nu = new Date()
  const dagNummer = nu.getDay()
  const isWeekend = dagNummer === 0 || dagNummer === 6

  const [checkinRes, metricsRes, blessuresRes, performance, levensgebeurtenissen] = await Promise.all([
    supabase.from('daily_checkins').select('*').eq('user_id', userId).eq('date', vandaag).single(),
    supabase.from('health_metrics').select('*').eq('user_id', userId).eq('date', vandaag).single(),
    supabase.from('injuries').select('body_part, pain_score').eq('user_id', userId).eq('active', true),
    // v2.4.148 (Niveau 2): Training Readiness + belastingsverhouding nu
    // ook input voor de Recovery Score — zie recovery-engine.ts voor de
    // weging/correctie-logica. Eigen catch, mag CoachPolicy nooit blokkeren.
    haalPerformanceVoorRecovery(userId).catch(() => null),
    // v2.4.319: nieuw — was hiervoor niet opgehaald, zie module-comment.
    // Eigen catch, mag CoachDecision nooit laten crashen — bij een fout
    // hier valt de winnendeCategorie simpelweg terug op 'vrije_tijd'
    // (geen levensgebeurtenissen bekend), nooit een gok naar REST.
    fetchTodaysLifeEvents(supabase, userId, dagNummer, isWeekend).catch(() => []),
  ])

  const recovery = calculateRecoveryScore(checkinRes.data || null, metricsRes.data || null, 0, performance)
  const actieveBlessures = blessuresRes.data || []

  const reasons: string[] = [`Herstelscore: ${recovery.score}/100 (${recovery.status})`]

  // ── Basisbeleid uit de herstelscore, exacte tabel uit specialist-coach-policy.md ──
  let recoveryState: RecoveryState
  let maxIntensity: IntensityLevel
  let volumeAdjustmentPct: number
  let priority: Priority
  let allowedTrainingTypes: string[]
  let forbiddenTrainingTypes: string[]

  if (recovery.color === 'green') {
    recoveryState = 'good'
    maxIntensity = 'high'
    volumeAdjustmentPct = 0
    priority = 'performance'
    allowedTrainingTypes = ['hoge_intensiteit', 'duurtraining', 'kracht', 'herstel']
    forbiddenTrainingTypes = []
  } else if (recovery.color === 'orange') {
    recoveryState = 'moderate'
    maxIntensity = 'moderate'
    volumeAdjustmentPct = -20
    priority = 'balance'
    allowedTrainingTypes = ['duurtraining', 'kracht_licht', 'herstel']
    forbiddenTrainingTypes = ['hoge_intensiteit']
  } else {
    recoveryState = 'low'
    maxIntensity = 'low'
    volumeAdjustmentPct = -40
    priority = 'recovery'
    allowedTrainingTypes = ['herstel', 'duurtraining_zone2']
    forbiddenTrainingTypes = ['hoge_intensiteit', 'kracht']
  }

  // ── Blessure-regel, bovenop de herstelscore ──────────────────────────
  // Consistent met specialist-decision-engine.md regel 2:
  // "blessures gaan vóór periodisering" — minimaal één stap omlaag,
  // ongeacht wat de herstelscore alleen zou zeggen. ONGEWIJZIGD — dit
  // blijft gelden voor maxIntensity/forbiddenTrainingTypes zoals het al
  // deed. De NIEUWE `decision` hieronder is een aparte, hogere-orde
  // beslissing en laat deze bestaande, mildere intensiteitsverlaging
  // niet een REST-blokkade "verzachten" (expliciet besloten in het
  // CoachDecision-contract-overleg).
  if (actieveBlessures.length > 0) {
    maxIntensity = verlaagIntensiteit(maxIntensity)
    if (!forbiddenTrainingTypes.includes('hoge_intensiteit')) forbiddenTrainingTypes.push('hoge_intensiteit')
    if (!forbiddenTrainingTypes.includes('kracht')) forbiddenTrainingTypes.push('kracht')
    reasons.push(`Actieve blessure(s) aanwezig (${actieveBlessures.map(b => b.body_part).join(', ')}) — intensiteit extra beperkt`)
  }

  // ── CoachDecision — v2.4.319, zie module-comment voor de volledige
  // toelichting. bepaalDagContext() bestaat al (context-resolver.ts) —
  // hier hergebruikt, geen nieuwe categorisatielogica.
  const dagContext = bepaalDagContext({
    lifeEvents: levensgebeurtenissen,
    injuries: actieveBlessures,
  })
  const winnendeCategorie = dagContext.lifeContext.mode

  let decision: CoachDecision
  if (winnendeCategorie === 'blessure' || winnendeCategorie === 'ziekte') {
    // REST — bestaande -100%-blokkade (context-resolver.ts's MODIFIERS),
    // geen nieuwe fysiologische regel. Prioriteit ongewijzigd: blessure/
    // ziekte winnen altijd, ook bij bijv. een wedstrijd morgen.
    decision = 'REST'
    reasons.push(dagContext.lifeContext.coachInstruction || `${winnendeCategorie === 'blessure' ? 'Actieve blessure' : 'Ziekte'} — geen training vandaag`)
  } else if (recoveryState !== 'good' || dagContext.trainingImpact.trainingModifier < 0) {
    // ADJUST — geen REST, maar bestaande context (herstel/vakantie/
    // cross-sport/belasting) vereist een aanpassing. ACWR > 1,7 valt
    // hier ook onder, via de bestaande belastinglogica — expliciet GEEN
    // eigen REST-drempel, geen bestaand contract daarvoor gevonden.
    decision = 'ADJUST'
  } else {
    decision = 'TRAIN'
  }

  return {
    decision,
    recoveryState,
    maxIntensity,
    volumeAdjustmentPct,
    priority,
    allowedTrainingTypes: [...new Set(allowedTrainingTypes)],
    forbiddenTrainingTypes: [...new Set(forbiddenTrainingTypes)],
    reasons,
  }
}
