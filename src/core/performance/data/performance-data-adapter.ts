import { createAdminClient } from '@/lib/supabase'
import { isoDatum } from '../shared/dates'
import { haalPerformanceVoorRecovery } from '@/lib/specialists/health-analysis-engine'
import type { PerformanceContext } from '../core/types'

// ── Performance Data Adapter ──────────────────────────────────────────────
// Bron: overleg 21 juli 2026. "Supabase → data adapter → Performance
// Engine → Dashboard/Coach" — dit bestand is de ENIGE plek in
// src/core/performance/ die de database aanraakt. Elke engine krijgt
// uitsluitend een PerformanceContext, nooit een Supabase-client.
//
// Eén rijke functie (getPerformanceContext) i.p.v. losse getX()-
// functies per engine (op verzoek) — de engines bepalen zelf wat ze
// uit de context gebruiken.

export async function getPerformanceContext(userId: string): Promise<PerformanceContext> {
  const supabase = createAdminClient()
  const vandaag = isoDatum(new Date())
  const dertigDagenGeleden = new Date()
  dertigDagenGeleden.setDate(dertigDagenGeleden.getDate() - 30)

  const [
    checkinRes,
    healthMetricsRes,
    performanceSnapshot,
    activiteitenTotaalRes,
    activiteiten30Res,
    eersteActiviteitRes,
  ] = await Promise.all([
    supabase.from('daily_checkins').select('*').eq('user_id', userId).eq('date', vandaag).maybeSingle(),
    supabase.from('health_metrics').select('*').eq('user_id', userId).eq('date', vandaag).maybeSingle(),
    haalPerformanceVoorRecovery(userId).catch(() => null),
    supabase.from('activity_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('activity_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('date', isoDatum(dertigDagenGeleden)),
    supabase.from('activity_sessions').select('date').eq('user_id', userId).order('date', { ascending: true }).limit(1).maybeSingle(),
  ])

  const eersteActiviteitDatum = eersteActiviteitRes.data?.date || null
  const daysTracked = eersteActiviteitDatum
    ? Math.max(0, Math.round((new Date(vandaag).getTime() - new Date(eersteActiviteitDatum).getTime()) / (24 * 60 * 60 * 1000)))
    : 0

  // Health-veld-beschikbaarheid — kijkt naar de LAATSTE 7 dagen, niet
  // alleen vandaag (iemand kan een dag overslaan zonder dat de sensor
  // "niet beschikbaar" is)
  const zevenDagenGeleden = new Date()
  zevenDagenGeleden.setDate(zevenDagenGeleden.getDate() - 7)
  const { data: health7d } = await supabase
    .from('health_metrics')
    .select('hrv, sleep_score, body_battery, resting_hr')
    .eq('user_id', userId)
    .gte('date', isoDatum(zevenDagenGeleden))

  const heeftVeld = (veld: 'hrv' | 'sleep_score' | 'body_battery' | 'resting_hr') =>
    (health7d || []).some(r => r[veld] !== null && r[veld] !== undefined)

  return {
    userId,
    now: vandaag,
    activities: {
      total: activiteitenTotaalRes.count || 0,
      last30Days: activiteiten30Res.count || 0,
    },
    health: {
      hrvAvailable: heeftVeld('hrv'),
      sleepAvailable: heeftVeld('sleep_score'),
      bodyBatteryAvailable: heeftVeld('body_battery'),
      restingHrAvailable: heeftVeld('resting_hr'),
    },
    sensors: {
      garmin: heeftVeld('hrv') || heeftVeld('body_battery'), // indirecte aanwijzing — geen aparte "gekoppeld"-vlag bestaat vandaag
      strava: false, // zie README: Strava API-toegang extern geblokkeerd
    },
    history: {
      firstActivityDate: eersteActiviteitDatum,
      daysTracked,
    },
    raw: {
      checkin: checkinRes.data || null,
      healthMetrics: healthMetricsRes.data || null,
      performanceSnapshot: performanceSnapshot,
      lifeEventPenalty: 0, // zie toelichting in core/types.ts
    },
  }
}

// v2.4.156 (Endurance Index): VO2max apart, want haalPerformanceVoorRecovery()
// selecteert bewust maar 2 velden (training_readiness, load_ratio) —
// niet breder maken voor Recovery's doel, dus een eigen kleine functie.
export async function getVo2max(userId: string): Promise<number | null> {
  const supabase = createAdminClient()
  const vandaag = isoDatum(new Date())
  const { data } = await supabase
    .from('performance_snapshots')
    .select('vo2max')
    .eq('user_id', userId).eq('date', vandaag).maybeSingle()
  return data?.vo2max ?? null
}

// v2.4.157 (Efficiency Score): gemiddelde watt/hartslag-verhouding
// (Efficiency Factor, publiek gedocumenteerd concept) over recente
// Cycling-activiteiten met zowel vermogen als hartslag geregistreerd.
export async function getEfficiencyFactorData(userId: string, aantalDagen: number): Promise<{ avg_watts: number; avg_hr: number }[]> {
  const supabase = createAdminClient()
  const vanaf = new Date()
  vanaf.setDate(vanaf.getDate() - aantalDagen)

  const { data } = await supabase
    .from('activity_sessions')
    .select('metrics, activities!inner(name)')
    .eq('user_id', userId)
    .eq('activities.name', 'Fietsen')
    .gte('date', isoDatum(vanaf))

  return (data || [])
    .map((r: { metrics: { avg_watts?: number; avg_hr?: number } | null }) => r.metrics)
    .filter((m): m is { avg_watts: number; avg_hr: number } => !!m?.avg_watts && !!m?.avg_hr)
}

// v2.4.157 (Climbing Score): totale hoogtemeters in de periode, over
// Cycling-activiteiten.
export async function getHoogtemeters(userId: string, aantalDagen: number): Promise<number> {
  const supabase = createAdminClient()
  const vanaf = new Date()
  vanaf.setDate(vanaf.getDate() - aantalDagen)

  const { data } = await supabase
    .from('activity_sessions')
    .select('metrics, activities!inner(name)')
    .eq('user_id', userId)
    .eq('activities.name', 'Fietsen')
    .gte('date', isoDatum(vanaf))

  return (data || []).reduce((som: number, r: { metrics: { elevation_gain_m?: number } | null }) => som + (r.metrics?.elevation_gain_m || 0), 0)
}

// v2.4.157 (Climbing Score): FTP + gewicht, voor W/kg
export async function getFtpEnGewicht(userId: string): Promise<{ ftp: number | null; gewicht: number | null }> {
  const supabase = createAdminClient()
  const [profielRes, algemeenRes] = await Promise.all([
    supabase.from('specialist_profiles').select('preferences').eq('user_id', userId).eq('specialist_type', 'cycling').maybeSingle(),
    supabase.from('profiles').select('weight').eq('user_id', userId).maybeSingle(),
  ])
  const prefs = profielRes.data?.preferences as { ftp?: number } | null
  return { ftp: prefs?.ftp ?? null, gewicht: algemeenRes.data?.weight ?? null }
}

// v2.4.154 (Consistency Engine): apart van de rijke PerformanceContext
// hierboven — dit is fijnmaziger (per-week data over meerdere weken),
// past niet netjes in één plat contextobject. Blijft wel in de data/-
// map, zelfde principe: de ENIGE plek die de database aanraakt.
export interface WeekActiviteit {
  weekStart: string // ISO-datum van de maandag
  aantalActiviteiten: number
}

export async function getWekelijkseActiviteitPatroon(userId: string, aantalWeken: number): Promise<WeekActiviteit[]> {
  const supabase = createAdminClient()
  const vanaf = new Date()
  vanaf.setDate(vanaf.getDate() - aantalWeken * 7)

  const { data } = await supabase
    .from('activity_sessions')
    .select('date')
    .eq('user_id', userId)
    .gte('date', isoDatum(vanaf))
    .order('date', { ascending: true })

  function maandagVanWeek(datum: Date): Date {
    const d = new Date(datum)
    const dagIndex = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - dagIndex)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const perWeek = new Map<string, number>()
  for (const rij of data || []) {
    const weekKey = isoDatum(maandagVanWeek(new Date(rij.date)))
    perWeek.set(weekKey, (perWeek.get(weekKey) || 0) + 1)
  }

  // Vult ontbrekende weken (0 activiteiten) op — anders zou een streak-
  // berekening geen onderscheid kunnen maken tussen "geen data" en
  // "bewust geen activiteit die week"
  const resultaat: WeekActiviteit[] = []
  const huidigeWeekStart = maandagVanWeek(new Date())
  for (let i = aantalWeken - 1; i >= 0; i--) {
    const weekStart = new Date(huidigeWeekStart)
    weekStart.setDate(weekStart.getDate() - i * 7)
    const key = isoDatum(weekStart)
    resultaat.push({ weekStart: key, aantalActiviteiten: perWeek.get(key) || 0 })
  }
  return resultaat
}
