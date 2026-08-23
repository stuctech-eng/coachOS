import { createAdminClient } from '@/lib/supabase'
import { haalKettlebellData } from './kettlebell-data'
import { analyseerKettlebellData, type EngineResult } from './kettlebell-analysis'

// ── Kettlebell Records Engine — MVP2 ─────────────────────────────────────
// Onderscheidt expliciet (spec-eis: PR ≠ officiële WKSF-ranking):
// - Personal Best (training)   — hergebruikt de bestaande Analysis Engine
//   (bepaalPersoonlijkeRecords), GEEN dubbele PR-logica.
// - Competition Best           — beste reps uit voltooide
//   kettlebell_competition_entries, andere discipline-vocabulaire
//   (ranking-sleutels als 'long_cycle_10') dan trainingssessies
//   ('long_cycle').
// - Season Best                — subset van bovenstaande, huidig
//   kalenderjaar.
// Federatie-/wereldrecords zijn BEWUST niet opgenomen: er is geen
// toegankelijke, officiële WKSF-recordbron gevonden (zie eerdere
// bronaudits) — dat zou een record verzinnen zijn.

export interface TrainingBest {
  discipline: string
  bell_weight_kg: number
  reps: number
  behaald_op: string
}

export interface CompetitionBest {
  discipline: string
  reps: number
  competition_name: string
  behaald_op: string | null
}

export interface KettlebellRecordsOverzicht {
  personal_best_training: TrainingBest[]
  personal_best_competition: CompetitionBest[]
  season_best_training: TrainingBest[]
  season_best_competition: CompetitionBest[]
}

function isDitKalenderjaar(iso: string | null): boolean {
  if (!iso) return false
  return new Date(iso).getFullYear() === new Date().getFullYear()
}

export async function bepaalKettlebellRecords(userId: string): Promise<EngineResult<KettlebellRecordsOverzicht>> {
  // Training: hergebruik de bestaande Analysis Engine (periode ruim genoeg
  // om écht alle PR's mee te nemen, niet alleen de laatste 90 dagen zoals
  // het dashboard standaard toont).
  const data = await haalKettlebellData(userId, 3650)
  const analyse = analyseerKettlebellData(data.activiteiten)
  const trainingBest: TrainingBest[] = analyse.resultaat.persoonlijke_records.map(pr => ({
    discipline: pr.discipline,
    bell_weight_kg: pr.bell_weight_kg,
    reps: pr.reps,
    behaald_op: pr.behaald_op,
  }))

  // Competitie: apart, want andere tabel én andere discipline-vocabulaire.
  const supabase = createAdminClient()
  const { data: entries, error } = await supabase
    .from('kettlebell_competition_entries')
    .select('discipline, reps, created_at, kettlebell_competitions(name, event_date)')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('reps', 'is', null)

  if (error) throw error

  const perDiscipline = new Map<string, CompetitionBest>()
  for (const e of entries || []) {
    const naam = (e as { kettlebell_competitions?: { name?: string } }).kettlebell_competitions?.name ?? 'Onbekende wedstrijd'
    const datum = (e as { kettlebell_competitions?: { event_date?: string } }).kettlebell_competitions?.event_date ?? null
    const bestaand = perDiscipline.get(e.discipline)
    if (!bestaand || (e.reps ?? 0) > bestaand.reps) {
      perDiscipline.set(e.discipline, { discipline: e.discipline, reps: e.reps ?? 0, competition_name: naam, behaald_op: datum })
    }
  }
  const competitionBest = Array.from(perDiscipline.values())

  return {
    resultaat: {
      personal_best_training: trainingBest,
      personal_best_competition: competitionBest,
      season_best_training: trainingBest.filter(t => isDitKalenderjaar(t.behaald_op)),
      season_best_competition: competitionBest.filter(c => isDitKalenderjaar(c.behaald_op)),
    },
    reden: [
      'Training Best hergebruikt de bestaande Analysis Engine.',
      'Competition Best komt uit voltooide kettlebell_competition_entries, apart van trainingsdata.',
      'Geen federatie-/wereldrecords opgenomen: geen toegankelijke, officiële WKSF-recordbron gevonden.',
    ],
    databronnen: ['kettlebell_gs_sessions', 'kettlebell_competition_entries'],
    gegenereerd_op: new Date().toISOString(),
  }
}
