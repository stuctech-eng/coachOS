import { createAdminClient } from '@/lib/supabase'
import { isoDatum } from '@/utils'

// ── Rowing CTL/ATL/TSB — Fase 2 (Personal Baseline) ─────────────────────
// Bron: overleg 3 augustus 2026. Spiegelbeeld van running-grafieken.ts —
// zelfde EWMA-wiskunde (CTL=42-dagen, ATL=7-dagen), zelfde intensity-
// factor-in-het-kwadraat-TSS-formule. Enige verschil: de baseline komt
// uit een 2.000m-testtijd i.p.v. een wedstrijdprestatie/VDOT.
//
// EERLIJK, net als bij Running: GEEN baseline = GEEN berekening. Een
// gegokte drempelsnelheid zou schijnprecisie zijn — exact wat we willen
// vermijden. Zonder 2k-tijd: lege array, Population Model blijft van
// toepassing (geen individuele TSS-claim).
//
// 2k-split → drempelsnelheid: het 2.000m-testresultaat wordt behandeld
// als de referentie-topsnelheid (zelfde rol als VDOT bij Running — een
// nabij-maximale, herhaalbare prestatie die de basis vormt voor alle
// afgeleide zones). Geen aparte, complexere fysiologische correctie
// (zoals Running's %VO2max-curve) — 2k-tijd IS in de roeiwereld al de
// gangbare, direct bruikbare referentie (Concept2/British Rowing-
// conventie), geen extra omrekenstap nodig zoals bij VDOT.

export interface DagelijkseBelasting {
  datum: string
  geschatte_tss: number
  ctl: number
  atl: number
  tsb: number
}

interface RowingActiviteitRij {
  date: string
  duration: number
  metrics: { distance?: number } | null
}

/** 2k-testtijd (seconden) → drempelsnelheid in meters/minuut.
 * 2000m / (tijd_sec/60) = m/min. */
export function berekenRowingDrempelsnelheid(tweeKmTijdSec: number): number {
  if (tweeKmTijdSec <= 0) return 0
  return Math.round((2000 / (tweeKmTijdSec / 60)) * 10) / 10
}

/** Zelfde formule als running-grafieken.ts's berekenGeschatteRunningTSS —
 * intensity-factor-in-het-kwadraat, bewezen, geen nieuwe wiskunde. */
export function berekenGeschatteRowingTSS(duurMinuten: number, gemiddeldeSnelheidMPerMin: number | null, drempelsnelheidMPerMin: number): number {
  if (!gemiddeldeSnelheidMPerMin || !drempelsnelheidMPerMin || drempelsnelheidMPerMin <= 0) return 0
  const uren = duurMinuten / 60
  const intensityFactor = gemiddeldeSnelheidMPerMin / drempelsnelheidMPerMin
  return Math.round(uren * intensityFactor * intensityFactor * 100)
}

export async function haalRowingCTLATLTSB(userId: string, aantalDagen: number): Promise<DagelijkseBelasting[]> {
  const supabase = createAdminClient()

  const [profielRes, activiteitenRes] = await Promise.all([
    supabase.from('specialist_profiles').select('preferences').eq('user_id', userId).eq('specialist_type', 'rowing').maybeSingle(),
    (async () => {
      const vandaag = new Date()
      const periodeStart = new Date(vandaag)
      periodeStart.setDate(periodeStart.getDate() - (aantalDagen + 42))
      return supabase
        .from('activity_sessions')
        .select('date, duration, metrics, activities!inner(name)')
        .eq('user_id', userId)
        .in('activities.name', ['Roeien'])
        .gte('date', isoDatum(periodeStart))
        .order('date', { ascending: true })
    })(),
  ])

  const prefs = profielRes.data?.preferences as { laatste_2k_tijd_sec?: number } | null
  if (!prefs?.laatste_2k_tijd_sec) return [] // Geen 2k-baseline — eerlijk leeg, geen gegokte drempelsnelheid

  const drempelsnelheidMPerMin = berekenRowingDrempelsnelheid(prefs.laatste_2k_tijd_sec)

  const tssPerDag: Record<string, number> = {}
  for (const a of (activiteitenRes.data || []) as unknown as RowingActiviteitRij[]) {
    // Gemiddelde snelheid = afstand (m) / duur (min) — metrics.distance
    // komt uit de Concept2-sync (v2.4.219), handmatige/Strava-imports
    // hebben mogelijk geen afstand — dan telt die sessie niet mee in de
    // TSS (eerlijk, geen gegokte afstand), maar blijft wel in de lijst
    // staan voor andere doeleinden.
    const snelheidMPerMin = a.metrics?.distance && a.duration > 0 ? a.metrics.distance / a.duration : null
    const tss = berekenGeschatteRowingTSS(a.duration || 0, snelheidMPerMin, drempelsnelheidMPerMin)
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
