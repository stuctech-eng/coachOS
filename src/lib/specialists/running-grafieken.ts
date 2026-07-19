import { createAdminClient } from '@/lib/supabase'
import { isoDatum } from '@/utils'

// ── Running Dashboard — Roadmap v1.0, Fase 1 ────────────────────────────
// Bron: overleg 19 juli 2026. VOLLEDIG DETERMINISTISCH — geen AI. Puur
// aggregatie van al-bestaande activity_sessions-data (Hardlopen), geen
// nieuwe databron, geen nieuwe SQL.

const RUNNING_ACTIVITEIT_NAMEN = ['Hardlopen']

export interface RunningDashboard {
  week_km: number
  maand_km: number
  jaar_km: number
  totaal_km: number
  trainingen_deze_week: number
  gemiddelde_pace_sec_per_km: number | null
  gemiddelde_hartslag: number | null
  gemiddelde_cadans: number | null
  hoogtemeters: number
  trainingstijd_minuten: number
  langste_duurloop: { minuten: number; datum: string } | null
  snelste_training: { pace_sec_per_km: number; datum: string } | null
}

interface RunningActiviteitRij {
  date: string
  duration: number
  metrics: { distance_m?: number; avg_speed_kmh?: number; avg_hr?: number; avg_cadence?: number; elevation_gain_m?: number } | null
}

function maandagVanWeek(datum: Date): Date {
  const d = new Date(datum)
  const dagIndex = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dagIndex)
  d.setHours(0, 0, 0, 0)
  return d
}

/** km/u -> sec/km. */
function kmuNaarSecPerKm(kmu: number): number {
  return Math.round(3600 / kmu)
}

export async function haalRunningDashboard(userId: string): Promise<RunningDashboard> {
  const supabase = createAdminClient()
  const vandaag = new Date()
  const jaarStart = new Date(vandaag.getFullYear(), 0, 1)

  const { data, error } = await supabase
    .from('activity_sessions')
    .select('date, duration, metrics, activities!inner(name)')
    .eq('user_id', userId)
    .in('activities.name', RUNNING_ACTIVITEIT_NAMEN)
    .gte('date', isoDatum(jaarStart))
    .order('date', { ascending: true })

  if (error) throw error
  const activiteiten = (data || []) as unknown as RunningActiviteitRij[]

  if (activiteiten.length === 0) {
    return {
      week_km: 0, maand_km: 0, jaar_km: 0, totaal_km: 0,
      trainingen_deze_week: 0, gemiddelde_pace_sec_per_km: null,
      gemiddelde_hartslag: null, gemiddelde_cadans: null,
      hoogtemeters: 0, trainingstijd_minuten: 0,
      langste_duurloop: null, snelste_training: null,
    }
  }

  // "Totaal" gebruikt hier bewust dezelfde periode als de rest (jaar-tot-
  // nu) — een écht all-time totaal zou een aparte, ongefilterde query
  // vergen. Voor Fase 1 is jaar-tot-nu voldoende; expliciet zo genoemd
  // i.p.v. "totaal" te suggereren dat het meer omvat dan het doet.
  const weekStart = maandagVanWeek(vandaag)
  const maandStart = new Date(vandaag.getFullYear(), vandaag.getMonth(), 1)

  let weekKm = 0, maandKm = 0, jaarKm = 0
  let trainingenDezeWeek = 0
  let hoogtemeters = 0
  let trainingstijdMinuten = 0
  const speedWaarden: number[] = []
  const hrWaarden: number[] = []
  const cadansWaarden: number[] = []
  let langsteDuurloop: { minuten: number; datum: string } | null = null
  let snelsteTraining: { pace_sec_per_km: number; datum: string } | null = null

  for (const a of activiteiten) {
    const datum = new Date(a.date)
    const km = (a.metrics?.distance_m || 0) / 1000
    jaarKm += km
    if (datum >= maandStart) maandKm += km
    if (datum >= weekStart) { weekKm += km; trainingenDezeWeek++ }

    trainingstijdMinuten += a.duration || 0
    hoogtemeters += a.metrics?.elevation_gain_m || 0
    if (a.metrics?.avg_speed_kmh) speedWaarden.push(a.metrics.avg_speed_kmh)
    if (a.metrics?.avg_hr) hrWaarden.push(a.metrics.avg_hr)
    if (a.metrics?.avg_cadence) cadansWaarden.push(a.metrics.avg_cadence)

    if (a.duration > 0 && (!langsteDuurloop || a.duration > langsteDuurloop.minuten)) {
      langsteDuurloop = { minuten: a.duration, datum: a.date }
    }
    if (a.metrics?.avg_speed_kmh && a.metrics.avg_speed_kmh > 0) {
      const paceSecPerKm = kmuNaarSecPerKm(a.metrics.avg_speed_kmh)
      if (!snelsteTraining || paceSecPerKm < snelsteTraining.pace_sec_per_km) {
        snelsteTraining = { pace_sec_per_km: paceSecPerKm, datum: a.date }
      }
    }
  }

  const gemiddelde = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null
  const gemSpeedKmu = gemiddelde(speedWaarden)

  return {
    week_km: Math.round(weekKm * 10) / 10,
    maand_km: Math.round(maandKm * 10) / 10,
    jaar_km: Math.round(jaarKm * 10) / 10,
    totaal_km: Math.round(jaarKm * 10) / 10, // zie toelichting hierboven — jaar-tot-nu
    trainingen_deze_week: trainingenDezeWeek,
    gemiddelde_pace_sec_per_km: gemSpeedKmu ? kmuNaarSecPerKm(gemSpeedKmu) : null,
    gemiddelde_hartslag: gemiddelde(hrWaarden) ? Math.round(gemiddelde(hrWaarden)!) : null,
    gemiddelde_cadans: gemiddelde(cadansWaarden) ? Math.round(gemiddelde(cadansWaarden)!) : null,
    hoogtemeters: Math.round(hoogtemeters),
    trainingstijd_minuten: trainingstijdMinuten,
    langste_duurloop: langsteDuurloop,
    snelste_training: snelsteTraining,
  }
}
