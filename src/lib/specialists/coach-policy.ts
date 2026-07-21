import { createAdminClient } from '@/lib/supabase'
import { calculateRecoveryScore } from '@/core/ai-engine/recovery-engine'
import { haalPerformanceVoorRecovery } from './health-analysis-engine'

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

export type RecoveryState = 'low' | 'moderate' | 'good'
export type IntensityLevel = 'low' | 'moderate' | 'high'
export type Priority = 'recovery' | 'performance' | 'balance'

export interface CoachPolicy {
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

  const [checkinRes, metricsRes, blessuresRes, performance] = await Promise.all([
    supabase.from('daily_checkins').select('*').eq('user_id', userId).eq('date', vandaag).single(),
    supabase.from('health_metrics').select('*').eq('user_id', userId).eq('date', vandaag).single(),
    supabase.from('injuries').select('body_part, pain_score').eq('user_id', userId).eq('active', true),
    // v2.4.148 (Niveau 2): Training Readiness + belastingsverhouding nu
    // ook input voor de Recovery Score — zie recovery-engine.ts voor de
    // weging/correctie-logica. Eigen catch, mag CoachPolicy nooit blokkeren.
    haalPerformanceVoorRecovery(userId).catch(() => null),
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
  // ongeacht wat de herstelscore alleen zou zeggen
  if (actieveBlessures.length > 0) {
    maxIntensity = verlaagIntensiteit(maxIntensity)
    if (!forbiddenTrainingTypes.includes('hoge_intensiteit')) forbiddenTrainingTypes.push('hoge_intensiteit')
    if (!forbiddenTrainingTypes.includes('kracht')) forbiddenTrainingTypes.push('kracht')
    reasons.push(`Actieve blessure(s) aanwezig (${actieveBlessures.map(b => b.body_part).join(', ')}) — intensiteit extra beperkt`)
  }

  return {
    recoveryState,
    maxIntensity,
    volumeAdjustmentPct,
    priority,
    allowedTrainingTypes: [...new Set(allowedTrainingTypes)],
    forbiddenTrainingTypes: [...new Set(forbiddenTrainingTypes)],
    reasons,
  }
}
