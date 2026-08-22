import type { KettlebellGsSessie, KettlebellDiscipline } from './kettlebell-data'

// ── Analysis Engine voor Kettlebell (Girevoy Sport) ─────────────────────
// Bron: docs/specialist-engine-architecture.md — Analysis Engine is
// ALTIJD deterministisch, geen AI-aanroep. Vaste EngineResult<T>-vorm
// (resultaat/reden/databronnen/gegenereerd_op) uit datzelfde document.
//
// MVP1-scope: alleen wat met de nu al opgeslagen sessiedata te berekenen
// is (PR's, volume, trend). Limiter Engine/Fatigue Signature/Efficiency
// (spec §11-14) vereisen meer datapunten dan MVP1 verzamelt — bewust
// NIET hier gegokt, komt in MVP3.

export interface EngineResult<T> {
  resultaat: T
  confidence?: number
  reden: string[]
  databronnen: string[]
  gegenereerd_op: string
}

export interface KettlebellPersoonlijkRecord {
  discipline: KettlebellDiscipline
  bell_weight_kg: number
  reps: number
  duration_sec: number
  rpm_avg: number | null
  behaald_op: string
}

export interface KettlebellVolumeStatistieken {
  aantal_sessies: number
  totale_reps: number
  totale_duur_sec: number
  gemiddelde_rpm: number | null
}

export interface KettlebellAnalyseResultaat {
  volume: KettlebellVolumeStatistieken
  persoonlijke_records: KettlebellPersoonlijkRecord[]
}

/** PR per unieke combinatie van discipline + bell weight — vergelijken
 * van 24kg Long Cycle met 32kg Long Cycle zou zinloos zijn, dus geen
 * enkele "hoogste reps"-waarde over alle gewichten heen. */
function bepaalPersoonlijkeRecords(sessies: KettlebellGsSessie[]): KettlebellPersoonlijkRecord[] {
  const perSleutel = new Map<string, KettlebellPersoonlijkRecord>()

  for (const s of sessies) {
    const sleutel = `${s.discipline}__${s.bell_weight_kg}`
    const bestaand = perSleutel.get(sleutel)
    if (!bestaand || s.reps > bestaand.reps) {
      perSleutel.set(sleutel, {
        discipline: s.discipline,
        bell_weight_kg: s.bell_weight_kg,
        reps: s.reps,
        duration_sec: s.duration_sec,
        rpm_avg: s.rpm_avg,
        behaald_op: s.performed_at,
      })
    }
  }

  return Array.from(perSleutel.values()).sort((a, b) => b.behaald_op.localeCompare(a.behaald_op))
}

function berekenVolume(sessies: KettlebellGsSessie[]): KettlebellVolumeStatistieken {
  const totaleReps = sessies.reduce((som, s) => som + s.reps, 0)
  const totaleDuur = sessies.reduce((som, s) => som + s.duration_sec, 0)
  const sessiesMetRpm = sessies.filter(s => s.rpm_avg != null)
  const gemiddeldeRpm = sessiesMetRpm.length > 0
    ? sessiesMetRpm.reduce((som, s) => som + (s.rpm_avg as number), 0) / sessiesMetRpm.length
    : null

  return {
    aantal_sessies: sessies.length,
    totale_reps: totaleReps,
    totale_duur_sec: totaleDuur,
    gemiddelde_rpm: gemiddeldeRpm !== null ? Math.round(gemiddeldeRpm * 10) / 10 : null,
  }
}

export function analyseerKettlebellData(sessies: KettlebellGsSessie[]): EngineResult<KettlebellAnalyseResultaat> {
  const volume = berekenVolume(sessies)
  const persoonlijkeRecords = bepaalPersoonlijkeRecords(sessies)

  return {
    resultaat: { volume, persoonlijke_records: persoonlijkeRecords },
    reden: [
      sessies.length === 0
        ? 'Nog geen kettlebell-sessies gelogd in deze periode'
        : `${sessies.length} sessie(s) geanalyseerd, PR bepaald per unieke combinatie van discipline en bell weight`,
    ],
    databronnen: ['kettlebell_gs_sessions'],
    gegenereerd_op: new Date().toISOString(),
  }
}
