import { haalKettlebellData, type KettlebellDiscipline } from './kettlebell-data'
import type { EngineResult } from './kettlebell-analysis'

// ── Kettlebell Pace Coach — MVP3 ──────────────────────────────────────────
// Bron: Master Plan §17. Bepaalt een "sustainable RPM" op basis van
// gelogde rpm_avg-waarden — het enige MVP3-onderdeel dat zonder
// datamodelwijziging haalbaar is naast de Limiter Engine, want rpm_avg
// bestaat al per sessie (v2.4.349). Output past direct in het bestaande
// KettlebellTrainingRequestIntelligence.recommended_rpm-veld
// (kettlebell-training-request.ts, ongewijzigd sinds v2.4.349) — dit is
// dus de eerste MVP3-engine die daadwerkelijk de MVP2.5-brug kan voeden.
//
// Data-eis: minimaal MIN_SESSIES sessies MET rpm_avg gelogd voor dezelfde
// discipline+bell weight. RPM is optioneel bij het loggen — sessies
// zonder rpm_avg tellen niet mee, worden niet geschat.

export interface PaceCoachOutcome {
  status: 'pace_indicated' | 'insufficient_data'
  sustainable_rpm?: number
  trend?: 'stijgend' | 'stabiel' | 'dalend'
  suggested_target_rpm?: number
  reason: string
  sessions_used?: number
  sessions_required?: number
}

const MIN_SESSIES = 3

export async function bepaalPaceCoach(
  userId: string,
  discipline: KettlebellDiscipline,
  bellWeightKg: number,
): Promise<EngineResult<PaceCoachOutcome>> {
  const data = await haalKettlebellData(userId, 365)
  const metRpm = data.activiteiten
    .filter(s => s.discipline === discipline && s.bell_weight_kg === bellWeightKg && s.rpm_avg != null)
    .sort((a, b) => a.performed_at.localeCompare(b.performed_at))

  if (metRpm.length < MIN_SESSIES) {
    return {
      resultaat: {
        status: 'insufficient_data',
        reason: `Minimaal ${MIN_SESSIES} sessies met gelogde RPM nodig voor deze discipline+bell weight, nu ${metRpm.length}.`,
        sessions_used: metRpm.length,
        sessions_required: MIN_SESSIES,
      },
      reden: ['Te weinig sessies met RPM gelogd om een betrouwbaar sustainable-RPM-getal te bepalen.'],
      databronnen: ['kettlebell_gs_sessions'],
      gegenereerd_op: new Date().toISOString(),
    }
  }

  const rpmWaarden = metRpm.map(s => s.rpm_avg as number).sort((a, b) => a - b)
  // Mediaan i.p.v. gemiddelde: minder gevoelig voor één uitschietersessie
  // (bijv. een korte technieksessie op lage RPM die niets zegt over
  // duurzaam tempo).
  const mediaan = rpmWaarden[Math.floor(rpmWaarden.length / 2)]

  const eersteHelft = metRpm.slice(0, Math.ceil(metRpm.length / 2))
  const tweedeHelft = metRpm.slice(Math.ceil(metRpm.length / 2))
  const gemEerste = eersteHelft.reduce((s, x) => s + (x.rpm_avg as number), 0) / eersteHelft.length
  const gemTweede = tweedeHelft.reduce((s, x) => s + (x.rpm_avg as number), 0) / tweedeHelft.length
  const verschil = gemTweede - gemEerste

  let trend: 'stijgend' | 'stabiel' | 'dalend' = 'stabiel'
  if (verschil > 0.2) trend = 'stijgend'
  else if (verschil < -0.2) trend = 'dalend'

  // Voorstel: mediaan + kleine stap bij stijgende trend, mediaan zelf bij
  // stabiel/dalend — bewust conservatief, geen extrapolatie voorbij wat
  // al daadwerkelijk gehaald is.
  const suggestedTarget = trend === 'stijgend' ? Math.round((mediaan + 0.2) * 10) / 10 : mediaan

  return {
    resultaat: {
      status: 'pace_indicated',
      sustainable_rpm: mediaan,
      trend,
      suggested_target_rpm: suggestedTarget,
      reason: `Mediaan RPM over de laatste ${metRpm.length} sessies is ${mediaan}. Trend: ${trend} (eerste helft ${gemEerste.toFixed(1)} → tweede helft ${gemTweede.toFixed(1)}).`,
      sessions_used: metRpm.length,
    },
    reden: [`Gebaseerd op ${metRpm.length} sessies met gelogde RPM voor deze discipline+bell weight.`],
    databronnen: ['kettlebell_gs_sessions'],
    gegenereerd_op: new Date().toISOString(),
  }
}
