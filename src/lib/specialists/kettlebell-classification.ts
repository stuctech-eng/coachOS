import { createAdminClient } from '@/lib/supabase'
import type { EngineResult } from './kettlebell-analysis'

// ── Kettlebell Classification Engine — v2 (na WKSF Ranking-import) ──────
// Vervangt de eerdere, striktere versie. Nieuw inzicht: de gebruiker kiest
// EXPLICIET welk rankingblok (A of B) van toepassing is — dit wordt NOOIT
// afgeleid uit bell_weight_kg, want de officiële blok→gewicht-koppeling is
// onbevestigd (zie supabase/kettlebell_wksf_ranking_import.sql).
//
// Zolang die koppeling onbevestigd is, geeft de engine wél een echte
// classificatie terug (gebaseerd op het door de gebruiker gekozen blok),
// maar ALTIJD met een expliciete disclaimer — nooit stilzwijgend als
// definitief gepresenteerd. Bij twee specifieke, gemarkeerde bronrijen
// (source_status='source_anomaly') komt er een extra waarschuwing bij.

export type RankingBlock = 'A' | 'B'

export interface ClassificationQuery {
  /** Canonieke sleutel incl. duur, bijv. 'long_cycle_10', 'jerk_60' —
   * matcht kettlebell_classifications.discipline exact. */
  discipline: string
  sex: 'male' | 'female'
  bodyweightClass: string
  rankingBlock: RankingBlock
  bestReps: number
}

export interface ClassificationOutcome {
  status: 'classified_provisional' | 'unavailable'
  current_class?: string
  next_class?: string
  required_reps_for_next?: number
  gap?: number
  reason: string
  source_reference?: string
  source_status?: string
  bell_weight_note: string
}

const BELL_WEIGHT_NOTE = 'Bell-weight-mapping voor dit rankingblok is nog niet officieel door WKSF bevestigd. Deze classificatie is gebaseerd op het door jou gekozen blok, niet op je kettlebellgewicht.'

export async function classificeerAtleet(query: ClassificationQuery): Promise<EngineResult<ClassificationOutcome>> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('kettlebell_classifications')
    .select('class_name, required_reps, source_reference, source_status')
    .eq('discipline', query.discipline)
    .eq('sex', query.sex)
    .eq('bodyweight_class', query.bodyweightClass)
    .eq('ranking_block', query.rankingBlock)
    .not('required_reps', 'is', null)
    .order('required_reps', { ascending: false })

  if (error) throw error

  if (!data || data.length === 0) {
    return {
      resultaat: {
        status: 'unavailable',
        reason: 'Geen WKSF-rankingdata gevonden voor deze discipline/geslacht/lichaamsgewichtcategorie/blok-combinatie.',
        bell_weight_note: BELL_WEIGHT_NOTE,
      },
      reden: ['Geen matchende rij in kettlebell_classifications.'],
      databronnen: ['kettlebell_classifications'],
      gegenereerd_op: new Date().toISOString(),
    }
  }

  // required_reps DESC: eerste = zwaarste klasse (MSEC/CMS), laatste = lichtste (Rank 3)
  const behaald = data.filter(d => (d.required_reps ?? -Infinity) <= query.bestReps)
  const current = behaald[0] // hoogste required_reps die nog gehaald is
  const nextIndex = current ? data.indexOf(current) - 1 : data.length - 1
  const next = nextIndex >= 0 ? data[nextIndex] : undefined

  const anomalie = [current, next].some(r => r?.source_status === 'source_anomaly')

  return {
    resultaat: {
      status: 'classified_provisional',
      current_class: current?.class_name,
      next_class: next?.class_name,
      required_reps_for_next: next?.required_reps ?? undefined,
      gap: next && next.required_reps != null ? next.required_reps - query.bestReps : undefined,
      reason: anomalie
        ? 'Classificatie berekend, MAAR één van de gebruikte rijen is gemarkeerd als source_anomaly (brontekst zelf bevatte een onduidelijkheid, niet gecorrigeerd) — extra voorzichtigheid geboden.'
        : 'Classificatie berekend op basis van de WKSF-rankingtabel voor het gekozen blok.',
      source_reference: (next ?? current)?.source_reference ?? undefined,
      source_status: (next ?? current)?.source_status,
      bell_weight_note: BELL_WEIGHT_NOTE,
    },
    reden: ['Classificatie is voorlopig (provisional) zolang de blok→bell-weight-koppeling niet officieel bevestigd is.'],
    databronnen: ['kettlebell_classifications'],
    gegenereerd_op: new Date().toISOString(),
  }
}
