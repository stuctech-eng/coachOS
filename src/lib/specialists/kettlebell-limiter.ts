import { haalKettlebellData, type KettlebellDiscipline } from './kettlebell-data'
import type { EngineResult } from './kettlebell-analysis'

// ── Kettlebell Limiter Engine — MVP3 ─────────────────────────────────────
// Bron: Kettlebell Specialist Master Plan §14. Bepaalt WAAROM iemand
// achterloopt, niet alleen DAT. Volledig deterministisch (geen AI) —
// zelfde architectuurregel als alle andere Kettlebell-engines.
//
// HARDE DATA-EIS: minimaal MIN_SESSIES sessies voor dezelfde discipline +
// bell weight, anders 'insufficient_data'. Bij te weinig data levert elk
// signaal ruis op, niet inzicht — dat zou zelf een vorm van gokken zijn,
// alleen dan met cijfers in plaats van met een classificatienorm. Zelfde
// principe als de Classification Engine ("onbekend is beter dan fout"),
// hier toegepast op trainingsdata i.p.v. WKSF-bronnen.

export type Limiter =
  | 'local_muscular_endurance' | 'grip' | 'technique' | 'pacing'
  | 'aerobic_capacity' | 'recovery'

export interface LimiterOutcome {
  status: 'limiter_indicated' | 'insufficient_data'
  limiter?: Limiter
  reason: string
  sessions_used?: number
  sessions_required?: number
}

const MIN_SESSIES = 5

export async function bepaalLimiter(
  userId: string,
  discipline: KettlebellDiscipline,
  bellWeightKg: number,
): Promise<EngineResult<LimiterOutcome>> {
  const data = await haalKettlebellData(userId, 365)
  const relevant = data.activiteiten
    .filter(s => s.discipline === discipline && s.bell_weight_kg === bellWeightKg)
    .sort((a, b) => a.performed_at.localeCompare(b.performed_at))

  if (relevant.length < MIN_SESSIES) {
    return {
      resultaat: {
        status: 'insufficient_data',
        reason: `Minimaal ${MIN_SESSIES} sessies nodig voor deze discipline+bell weight om een limiter te kunnen aanwijzen, nu ${relevant.length}.`,
        sessions_used: relevant.length,
        sessions_required: MIN_SESSIES,
      },
      reden: ['Te weinig data om een betrouwbaar signaal te onderscheiden van ruis.'],
      databronnen: ['kettlebell_gs_sessions'],
      gegenereerd_op: new Date().toISOString(),
    }
  }

  // Vanaf hier: alleen deterministische, uitlegbare signalen — geen
  // black-box score. Elk signaal heeft minimaal 1 concrete databehoefte;
  // ontbrekende velden (rpe/technique_score zijn optioneel bij het loggen)
  // worden overgeslagen, nooit aangevuld met een schatting.
  const metRpe = relevant.filter(s => s.rpe != null)
  const metTechniek = relevant.filter(s => s.technique_score != null)
  const repsReeks = relevant.map(s => s.reps)
  const repsTrend = repsReeks.at(-1)! - repsReeks[0]

  let limiter: Limiter | undefined
  let reason = ''

  if (metTechniek.length >= MIN_SESSIES) {
    const techniekTrend = metTechniek.at(-1)!.technique_score! - metTechniek[0].technique_score!
    if (techniekTrend < 0 && repsTrend >= 0) {
      limiter = 'technique'
      reason = `Techniekscore daalt (${metTechniek[0].technique_score} → ${metTechniek.at(-1)!.technique_score}) terwijl reps gelijk blijven of stijgen — mogelijk wordt volume gehaald ten koste van techniek.`
    }
  }

  if (!limiter && metRpe.length >= MIN_SESSIES) {
    const rpeTrend = metRpe.at(-1)!.rpe! - metRpe[0].rpe!
    if (rpeTrend > 0 && repsTrend <= 0) {
      limiter = 'local_muscular_endurance'
      reason = `RPE stijgt (${metRpe[0].rpe} → ${metRpe.at(-1)!.rpe}) terwijl reps gelijk blijven of dalen bij hetzelfde gewicht — wijst op een plateau in lokale spieruithoudingsvermogen.`
    }
  }

  const gemNoCounts = relevant.reduce((s, x) => s + x.no_counts, 0) / relevant.length
  if (!limiter && gemNoCounts >= 2) {
    limiter = 'technique'
    reason = `Gemiddeld ${gemNoCounts.toFixed(1)} no-counts per sessie over de laatste ${relevant.length} sessies — herhaalde technische afkeuringen wijzen op een technisch, geen fysiek plafond.`
  }

  if (!limiter) {
    return {
      resultaat: {
        status: 'insufficient_data',
        reason: 'Genoeg sessies aanwezig, maar geen van de bekende signalen (techniek-trend, RPE-trend, no-counts) wijst eenduidig op één limiter. Meer data of aanvullende metrics (RPE/techniek consequent loggen) nodig.',
        sessions_used: relevant.length,
        sessions_required: MIN_SESSIES,
      },
      reden: ['Geen van de gedefinieerde signalen gaf een duidelijke uitslag.'],
      databronnen: ['kettlebell_gs_sessions'],
      gegenereerd_op: new Date().toISOString(),
    }
  }

  return {
    resultaat: { status: 'limiter_indicated', limiter, reason, sessions_used: relevant.length },
    reden: [reason],
    databronnen: ['kettlebell_gs_sessions'],
    gegenereerd_op: new Date().toISOString(),
  }
}
