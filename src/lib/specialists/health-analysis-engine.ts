import { createAdminClient } from '@/lib/supabase'
import { isoDatum } from '@/utils'

// ── Health Analysis Engine ───────────────────────────────────────────────
// Bron: overleg 20 juli 2026. VOLLEDIG DETERMINISTISCH — geen AI.
//
// Bewuste architectuurkeuze: trend/baseline/status worden NERGENS
// opgeslagen — alleen berekend bij opvragen, uit de ruwe metingen in
// morning_health_metrics. Reden: dit zijn afgeleide waarden. Verandert
// het aantal dagen voor de baseline ooit (bijv. van 7 naar 14), dan is
// er geen historische migratie nodig — de eerstvolgende berekening
// gebruikt gewoon de nieuwe regel.
//
// CoachPolicy blijft hier volledig buiten — dit is een input-signaal,
// geen policy-wijziging. Zie coach-policy.ts, dat ongewijzigd blijft.

export interface HrvTrendResultaat {
  vandaag_ms: number
  gemiddelde_7d_ms: number | null
  trend: 'stijgend' | 'dalend' | 'stabiel' | null
  verschil_pct: number | null
  boodschap: string
}

const HRV_TREND_DREMPEL_PCT = 8

export function berekenHrvTrend(vandaagMs: number, voorgaandeMetingen: { hrv_ms: number | null }[]): HrvTrendResultaat {
  const geldig = voorgaandeMetingen.map(m => m.hrv_ms).filter((v): v is number => v !== null)
  const gemiddelde7d = geldig.length > 0 ? geldig.reduce((s, v) => s + v, 0) / geldig.length : null

  if (gemiddelde7d === null) {
    return {
      vandaag_ms: vandaagMs, gemiddelde_7d_ms: null, trend: null, verschil_pct: null,
      boodschap: 'Eerste HRV-meting genoteerd. Na een week zie je hier je persoonlijke trend.',
    }
  }

  const verschilPct = Math.round(((vandaagMs - gemiddelde7d) / gemiddelde7d) * 1000) / 10
  let trend: 'stijgend' | 'dalend' | 'stabiel'
  let boodschap: string
  if (verschilPct <= -HRV_TREND_DREMPEL_PCT) {
    trend = 'dalend'
    boodschap = `HRV ligt ${Math.abs(verschilPct)}% onder je gemiddelde. Vandaag iets rustiger aan is een goed idee.`
  } else if (verschilPct >= HRV_TREND_DREMPEL_PCT) {
    trend = 'stijgend'
    boodschap = `HRV ligt ${verschilPct}% boven je gemiddelde. Je herstel ziet er goed uit.`
  } else {
    trend = 'stabiel'
    boodschap = 'HRV ligt rond je gebruikelijke niveau. Geen bijzonderheden.'
  }
  return { vandaag_ms: vandaagMs, gemiddelde_7d_ms: Math.round(gemiddelde7d * 10) / 10, trend, verschil_pct: verschilPct, boodschap }
}

/** Haalt vandaag + de voorgaande 7 dagen op en berekent de trend — geen opslag van het resultaat. */
export async function haalHrvTrend(userId: string): Promise<HrvTrendResultaat | null> {
  const supabase = createAdminClient()
  const vandaag = isoDatum(new Date())
  const zevenDagenGeleden = new Date()
  zevenDagenGeleden.setDate(zevenDagenGeleden.getDate() - 7)

  const { data: rijen } = await supabase
    .from('morning_health_metrics')
    .select('date, hrv_ms')
    .eq('user_id', userId)
    .gte('date', isoDatum(zevenDagenGeleden))
    .order('date', { ascending: true })

  const alle = rijen || []
  const vandaagRij = alle.find(r => r.date === vandaag)
  if (!vandaagRij?.hrv_ms) return null

  const voorgaand = alle.filter(r => r.date !== vandaag)
  return berekenHrvTrend(vandaagRij.hrv_ms, voorgaand)
}
