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
