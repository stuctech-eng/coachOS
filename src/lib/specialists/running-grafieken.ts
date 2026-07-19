import { createAdminClient } from '@/lib/supabase'
import { isoDatum } from '@/utils'

// ── Running Dashboard — Roadmap v1.0, Fase 1 ────────────────────────────
// Bron: overleg 19 juli 2026. VOLLEDIG DETERMINISTISCH — geen AI. Puur
// aggregatie van al-bestaande activity_sessions-data (Hardlopen), geen
// nieuwe databron, geen nieuwe SQL.

const RUNNING_ACTIVITEIT_NAMEN = ['Hardlopen']

export interface DagelijkseBelasting {
  datum: string
  geschatte_tss: number
  ctl: number
  atl: number
  tsb: number
}

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

// ── Trainingsbelasting — Fase 2, tweede levering ────────────────────────
// Bron: overleg 19 juli 2026. Zelfde publiek gedocumenteerde Coggan-
// methode als Cycling (CTL 42-dagen/ATL 7-dagen EWMA — sport-
// onafhankelijk). Enige verschil: Intensity Factor is hier snelheid-
// gebaseerd i.p.v. vermogen-gebaseerd.
//
// IF_running = gemiddelde_snelheid / drempelsnelheid  (i.p.v. watt/FTP)
// Drempelsnelheid komt uit de al-bestaande Threshold Pace Zone
// (midden van de 84-88%-VDOT-band) — geen nieuw profielveld nodig.
//
// ⚠️ EERLIJKE BEPERKING, zelfde als bij Cycling: dit is een SCHATTING
// op basis van gemiddelde snelheid, geen Normalized Graded Pace. Minder
// nauwkeurig bij sterk wisselend terrein (heuvels) of bij intervaltraining
// dan bij gelijkmatige duurlopen.

export function berekenDrempelsnelheidKmh(vdot: number): number {
  // Herbruikt dezelfde VO2/%VO2max-wiskunde als running-zones.ts, hier
  // lokaal om een circulaire import (running-zones <-> running-grafieken)
  // te vermijden — beide zijn kleine, stabiele formules.
  const percentVo2maxThreshold = 0.86 // midden van de Threshold-band (84-88%)
  const vo2Threshold = percentVo2maxThreshold * vdot
  const a = 0.000104, b = 0.182258, c = -(4.6 + vo2Threshold)
  const vMeterPerMin = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
  return Math.round((vMeterPerMin * 60 / 1000) * 10) / 10 // m/min -> km/u
}

export function berekenGeschatteRunningTSS(duurMinuten: number, gemiddeldeSnelheidKmh: number | null, drempelsnelheidKmh: number): number {
  if (!gemiddeldeSnelheidKmh || !drempelsnelheidKmh || drempelsnelheidKmh <= 0) return 0
  const uren = duurMinuten / 60
  const intensityFactor = gemiddeldeSnelheidKmh / drempelsnelheidKmh
  return Math.round(uren * intensityFactor * intensityFactor * 100)
}

export async function haalRunningCTLATLTSB(userId: string, aantalDagen: number): Promise<DagelijkseBelasting[]> {
  const supabase = createAdminClient()

  const [profielRes, activiteitenRes] = await Promise.all([
    supabase.from('specialist_profiles').select('preferences').eq('user_id', userId).eq('specialist_type', 'running').maybeSingle(),
    (async () => {
      const vandaag = new Date()
      const periodeStart = new Date(vandaag)
      periodeStart.setDate(periodeStart.getDate() - (aantalDagen + 42))
      return supabase
        .from('activity_sessions')
        .select('date, duration, metrics, activities!inner(name)')
        .eq('user_id', userId)
        .in('activities.name', RUNNING_ACTIVITEIT_NAMEN)
        .gte('date', isoDatum(periodeStart))
        .order('date', { ascending: true })
    })(),
  ])

  const prefs = profielRes.data?.preferences as { laatste_race_afstand_m?: number; laatste_race_tijd_sec?: number } | null
  if (!prefs?.laatste_race_afstand_m || !prefs?.laatste_race_tijd_sec) return [] // Geen VDOT — eerlijk leeg, geen gegokte drempelsnelheid

  // Kleine, lokale VDOT-herberekening (zelfde formule als running-zones.ts)
  const tijdMin = prefs.laatste_race_tijd_sec / 60
  const vMeterPerMin = prefs.laatste_race_afstand_m / tijdMin
  const vo2 = -4.6 + 0.182258 * vMeterPerMin + 0.000104 * vMeterPerMin ** 2
  const percentVo2max = 0.8 + 0.1894393 * Math.exp(-0.012778 * tijdMin) + 0.2989558 * Math.exp(-0.1932605 * tijdMin)
  const vdot = vo2 / percentVo2max
  const drempelsnelheidKmh = berekenDrempelsnelheidKmh(vdot)

  const tssPerDag: Record<string, number> = {}
  for (const a of (activiteitenRes.data || []) as unknown as RunningActiviteitRij[]) {
    const tss = berekenGeschatteRunningTSS(a.duration || 0, a.metrics?.avg_speed_kmh || null, drempelsnelheidKmh)
    tssPerDag[a.date] = (tssPerDag[a.date] || 0) + tss
  }

  const vandaag = new Date()
  const periodeStart = new Date(vandaag)
  periodeStart.setDate(periodeStart.getDate() - (aantalDagen + 42))

  const resultaat: DagelijkseBelasting[] = []
  let ctl = 0
  let atl = 0

  for (let d = new Date(periodeStart); d <= vandaag; d.setDate(d.getDate() + 1)) {
    const datumStr = isoDatum(d)
    const tssVandaag = tssPerDag[datumStr] || 0
    const tsbVoorVandaag = ctl - atl
    ctl = ctl + (tssVandaag - ctl) / 42
    atl = atl + (tssVandaag - atl) / 7

    resultaat.push({
      datum: datumStr,
      geschatte_tss: tssVandaag,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round(tsbVoorVandaag * 10) / 10,
    })
  }

  return resultaat.slice(-aantalDagen)
}

// ── Records per afstand — Fase 1, laatste stap ──────────────────────────
// Bron: overleg 19 juli 2026. Query op running_distance_records — puur
// het minimum (snelste tijd) per afstand, over alle activiteiten heen.
// Geen berekening hier, dat gebeurt al bij import (tcx-parser.ts +
// afstandscurve.ts).

export interface AfstandRecord {
  afstand_m: number
  tijd_sec: number
  datum: string
}

export async function haalRunningRecords(userId: string): Promise<AfstandRecord[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('running_distance_records')
    .select('distance_m, tijd_sec, activity_id, activity_sessions!inner(date)')
    .eq('user_id', userId)
    .order('distance_m', { ascending: true })

  if (error) throw error
  if (!data || data.length === 0) return []

  // Eén afstand kan meerdere rijen hebben (van verschillende
  // activiteiten) — hier het all-time snelste per afstand eruit halen
  const besteTijdPerAfstand = new Map<number, { tijd_sec: number; datum: string }>()
  for (const rij of data as unknown as { distance_m: number; tijd_sec: number; activity_sessions: { date: string } | { date: string }[] }[]) {
    const datum = Array.isArray(rij.activity_sessions) ? rij.activity_sessions[0]?.date : rij.activity_sessions?.date
    if (!datum) continue
    const huidig = besteTijdPerAfstand.get(rij.distance_m)
    if (!huidig || rij.tijd_sec < huidig.tijd_sec) {
      besteTijdPerAfstand.set(rij.distance_m, { tijd_sec: rij.tijd_sec, datum })
    }
  }

  return Array.from(besteTijdPerAfstand.entries())
    .map(([afstand_m, v]) => ({ afstand_m, tijd_sec: v.tijd_sec, datum: v.datum }))
    .sort((a, b) => a.afstand_m - b.afstand_m)
}
