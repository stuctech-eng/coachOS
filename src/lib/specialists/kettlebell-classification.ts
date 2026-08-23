import { createAdminClient } from '@/lib/supabase'
import type { KettlebellDiscipline } from './kettlebell-data'
import type { EngineResult } from './kettlebell-analysis'

// ── Kettlebell Classification Engine — MVP2 ─────────────────────────────
// Vaste regel (herhaald uit de opdracht van de gebruiker): classificeert
// UITSLUITEND tegen rijen die daadwerkelijk in kettlebell_classifications
// staan. Zolang die tabel leeg is (huidige status: leeg, in afwachting
// van het officiële WKSF-rankingdocument), geeft deze engine altijd
// status: 'unavailable' terug — nooit 'estimated' of geïnterpoleerd.
// Zie docs/sources/wksf-rules-2023-2027.md voor de bronstatus.

export interface ClassificationQuery {
  discipline: KettlebellDiscipline
  sex: 'male' | 'female'
  bellWeightKg: number
  bestReps: number
}

export interface ClassificationOutcome {
  status: 'classified' | 'unavailable'
  current_class?: string
  next_class?: string
  required_reps_for_next?: number
  gap?: number
  reason: string
  source_reference?: string
}

export async function classificeerAtleet(query: ClassificationQuery): Promise<EngineResult<ClassificationOutcome>> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('kettlebell_classifications')
    .select('class_name, required_reps, source_reference')
    .eq('discipline', query.discipline)
    .eq('bell_weight_kg', query.bellWeightKg)
    .eq('sex', query.sex)
    .not('required_reps', 'is', null)
    .order('required_reps', { ascending: true })

  if (error) throw error

  if (!data || data.length === 0) {
    return {
      resultaat: {
        status: 'unavailable',
        reason: 'Official WKSF classification norm not verified.',
      },
      reden: ['Geen geverifieerde classificatienorm in kettlebell_classifications voor deze discipline/bell weight/geslacht.'],
      databronnen: ['kettlebell_classifications'],
      gegenereerd_op: new Date().toISOString(),
    }
  }

  const behaald = data.filter(d => (d.required_reps ?? Infinity) <= query.bestReps)
  const current = behaald.at(-1)
  const next = data.find(d => (d.required_reps ?? -Infinity) > query.bestReps)

  return {
    resultaat: {
      status: 'classified',
      current_class: current?.class_name,
      next_class: next?.class_name,
      required_reps_for_next: next?.required_reps ?? undefined,
      gap: next && next.required_reps != null ? next.required_reps - query.bestReps : undefined,
      reason: 'Classificatie gebaseerd op geverifieerde WKSF-classificatienorm.',
      source_reference: (next ?? current)?.source_reference ?? undefined,
    },
    reden: ['Classificatie berekend op basis van geverifieerde kettlebell_classifications-rijen.'],
    databronnen: ['kettlebell_classifications'],
    gegenereerd_op: new Date().toISOString(),
  }
}
