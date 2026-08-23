import { bepaalPaceCoach } from './kettlebell-pace-coach'
import { classificeerAtleet, type RankingBlock } from './kettlebell-classification'
import type { KettlebellDiscipline } from './kettlebell-data'
import type { EngineResult } from './kettlebell-analysis'

// ── Kettlebell Competition Simulator — MVP3 ──────────────────────────────
// Bron: Master Plan §18. Combineert twee bestaande, al gebouwde engines
// (Pace Coach + Classification Engine) tot een PROJECTIE — geen nieuwe
// data, geen nieuwe aannames, geen fysiologisch model. Puur:
// "als je je huidige sustainable RPM volhoudt voor de officiële
// wedstrijdduur, zou dat ongeveer X reps opleveren" — expliciet als
// projectie gelabeld, nooit als voorspelling/garantie.
//
// Reuse-bevestiging: geen dubbele RPM-berekening (die komt 1-op-1 uit
// bepaalPaceCoach), geen dubbele classificatielogica (die komt 1-op-1
// uit classificeerAtleet — zelfde functie als Beat My Class).

export interface CompetitionSimulatorOutcome {
  status: 'projected' | 'insufficient_data'
  projected_reps?: number
  based_on_sustainable_rpm?: number
  projected_current_class?: string
  projected_next_class?: string
  projected_gap?: number
  reason: string
}

export async function simuleerWedstrijd(
  userId: string,
  kettlebellDiscipline: KettlebellDiscipline,
  bellWeightKg: number,
  competitionDurationSec: number,
  rankingDiscipline: string,
  sex: 'male' | 'female',
  bodyweightClass: string,
  rankingBlock: RankingBlock,
): Promise<EngineResult<CompetitionSimulatorOutcome>> {
  const paceCoach = await bepaalPaceCoach(userId, kettlebellDiscipline, bellWeightKg)

  if (paceCoach.resultaat.status === 'insufficient_data') {
    return {
      resultaat: {
        status: 'insufficient_data',
        reason: `Simulatie vereist een sustainable-RPM-basis van Pace Coach: ${paceCoach.resultaat.reason}`,
      },
      reden: ['Geen sustainable RPM beschikbaar om een wedstrijdduur op te projecteren.'],
      databronnen: ['kettlebell_gs_sessions'],
      gegenereerd_op: new Date().toISOString(),
    }
  }

  const sustainableRpm = paceCoach.resultaat.sustainable_rpm as number
  const projectedReps = Math.round(sustainableRpm * (competitionDurationSec / 60))

  const classificatie = await classificeerAtleet({
    discipline: rankingDiscipline, sex, bodyweightClass, rankingBlock, bestReps: projectedReps,
  })

  const classificatieDeel = classificatie.resultaat.status === 'classified_provisional'
    ? {
        projected_current_class: classificatie.resultaat.current_class,
        projected_next_class: classificatie.resultaat.next_class,
        projected_gap: classificatie.resultaat.gap,
      }
    : {}

  return {
    resultaat: {
      status: 'projected',
      projected_reps: projectedReps,
      based_on_sustainable_rpm: sustainableRpm,
      ...classificatieDeel,
      reason: `Projectie, geen voorspelling: bij ${sustainableRpm} RPM volgehouden over ${Math.round(competitionDurationSec / 60)} minuten zou dat ${projectedReps} reps opleveren. Gebaseerd op je eigen trainingsgeschiedenis (Pace Coach), niet op een fysiologisch model van vermoeidheid — een langere duur dan je ooit trainde kan in werkelijkheid lager uitvallen.`,
    },
    reden: [
      'Reps-projectie: sustainable_rpm × wedstrijdduur (lineaire extrapolatie, geen vermoeidheidsmodel).',
      classificatie.resultaat.status === 'classified_provisional'
        ? 'Classificatie-projectie via dezelfde Classification Engine als Beat My Class — ook hier strongly_indicated, geen definitieve claim.'
        : 'Geen classificatienorm beschikbaar voor deze combinatie, dus geen klasse-projectie.',
    ],
    databronnen: ['kettlebell_gs_sessions', 'kettlebell_classifications'],
    gegenereerd_op: new Date().toISOString(),
  }
}
