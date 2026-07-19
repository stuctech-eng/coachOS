// ── Running Pace Zones — Daniels/Gilbert VDOT-model ─────────────────────
// Bron: Running Specialist Roadmap v1.0, Fase 1. VOLLEDIG DETERMINISTISCH
// — geen AI.
//
// Gebaseerd op de PUBLIEK GEPUBLICEERDE Daniels & Gilbert-formules
// (Oxygen Power: Performance Tables for Distance Runners, 1979) — niet
// op de propriëtaire VDOT-tabellen uit latere commerciële boeken/apps.
// Zelf berekend uit de onderliggende wiskunde, net zoals Cycling's
// TSS/CTL/ATL de publiek gedocumenteerde Coggan-methode volgt i.p.v.
// een namaak van TrainingPeaks' implementatie.
//
// Formules geverifieerd (19 juli 2026) tegen een onafhankelijke externe
// bron met dezelfde worked example (5K in 20:00 → VDOT 49,8) — exacte
// match, inclusief de gepubliceerde zone-percentages (Easy 59-74%,
// Marathon ~84%, Threshold ~88%, Interval ~98%, Repetition >100%).

/**
 * Zuurstofkosten van een gegeven loopsnelheid.
 * v in meter/minuut. Output in ml/kg/min.
 */
function berekenVO2(vMeterPerMin: number): number {
  return -4.6 + 0.182258 * vMeterPerMin + 0.000104 * vMeterPerMin ** 2
}

/**
 * Welk percentage van VO2max vol te houden is over een gegeven duur.
 * t in minuten. Output 0-1.
 */
function berekenPercentVO2max(tMin: number): number {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * tMin) + 0.2989558 * Math.exp(-0.1932605 * tMin)
}

/**
 * Inverse van berekenVO2: welke snelheid hoort bij een gegeven VO2.
 * Kwadratische formule opgelost via de abc-formule.
 */
function snelheidVoorVO2(vo2: number): number {
  const a = 0.000104
  const b = 0.182258
  const c = -(4.6 + vo2)
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
}

/**
 * Berekent VDOT uit een recente wedstrijdprestatie.
 * afstandMeter: afstand in meters. tijdSec: tijd in seconden.
 */
export function berekenVDOT(afstandMeter: number, tijdSec: number): number {
  const tijdMin = tijdSec / 60
  const vMeterPerMin = afstandMeter / tijdMin
  const vo2 = berekenVO2(vMeterPerMin)
  const percentVo2max = berekenPercentVO2max(tijdMin)
  return vo2 / percentVo2max
}

export interface PaceZone {
  naam: string
  pct_van: number
  pct_tot: number | null // null = geen bovengrens (Repetition, open einde)
  pace_van_sec_per_km: number // langzaamste rand van de zone (ondergrens intensiteit)
  pace_tot_sec_per_km: number // snelste rand van de zone (bovengrens intensiteit)
}

// Zone-percentages van VDOT — publiek gepubliceerd/breed geciteerd
// (Daniels' Running Formula, meerdere onafhankelijke bronnen bevestigen
// dezelfde bandbreedtes). Recovery en de bovengrens van Repetition zijn
// een redelijke, expliciet-benoemde aanname (geen harde Daniels-grens
// gepubliceerd) — niet als "officieel Daniels-getal" gepresenteerd.
const PACE_ZONE_DEFINITIES = [
  { naam: 'Recovery', pctVan: 0, pctTot: 59 },
  { naam: 'Easy', pctVan: 59, pctTot: 74 },
  { naam: 'Marathon', pctVan: 75, pctTot: 84 },
  { naam: 'Threshold', pctVan: 84, pctTot: 88 },
  { naam: 'Interval', pctVan: 95, pctTot: 100 },
  { naam: 'Repetition', pctVan: 100, pctTot: null },
]
// Repetition heeft geen gepubliceerde harde bovengrens (Daniels noemt dit
// zelf "sneller dan VO2max, over zeer korte intervallen") — voor de
// weergave van een pace-ondergrens gebruiken we intern 130% als praktisch
// plafond, zonder dit als exacte Daniels-waarde te presenteren.
const REPETITION_PRAKTISCH_PLAFOND_PCT = 130

export function berekenPaceZones(vdot: number): PaceZone[] {
  return PACE_ZONE_DEFINITIES.map(def => {
    const pctTotVoorBerekening = def.pctTot ?? REPETITION_PRAKTISCH_PLAFOND_PCT
    const vVan = snelheidVoorVO2((def.pctVan / 100) * vdot)
    const vTot = snelheidVoorVO2((pctTotVoorBerekening / 100) * vdot)
    return {
      naam: def.naam,
      pct_van: def.pctVan,
      pct_tot: def.pctTot,
      // v in m/min -> sec/km: (1000/v) minuten/km * 60 = sec/km
      pace_van_sec_per_km: Math.round((1000 / vVan) * 60),
      pace_tot_sec_per_km: Math.round((1000 / vTot) * 60),
    }
  })
}

/** Formatteert seconden/km als "M:SS min/km" voor weergave. */
export function formatteerPace(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${min}:${String(sec).padStart(2, '0')}`
}
