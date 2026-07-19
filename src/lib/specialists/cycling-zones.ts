// ── Cycling Zone Calculator ──────────────────────────────────────────────
// Bron: docs/cycling-specialist-roadmap-v1.md, Fase 1. VOLLEDIG
// DETERMINISTISCH — geen AI.
//
// Vermogenszones volgen Andrew Coggan's publiek gedocumenteerde 7-zone-
// model (wijdverspreid gepubliceerd, o.a. in "Training and Racing with
// a Power Meter") — NIET een namaak van een propriëtair platform-eigen
// model. Hartslagzones volgen het gangbare %-van-max-hartslag-model
// (5 zones), eveneens publiek en niet-propriëtair.

export interface VermogensZone {
  zone: number
  naam: string
  van_pct: number
  tot_pct: number | null // null = geen bovengrens (zone 7)
  van_watt: number
  tot_watt: number | null
}

export interface HartslagZone {
  zone: number
  naam: string
  van_pct: number
  tot_pct: number
  van_bpm: number
  tot_bpm: number
}

// Coggan-model, publiek gedocumenteerd
const VERMOGENSZONE_DEFINITIES = [
  { zone: 1, naam: 'Actief herstel', van_pct: 0, tot_pct: 55 },
  { zone: 2, naam: 'Duurtraining', van_pct: 56, tot_pct: 75 },
  { zone: 3, naam: 'Tempo', van_pct: 76, tot_pct: 90 },
  { zone: 4, naam: 'Drempel', van_pct: 91, tot_pct: 105 },
  { zone: 5, naam: 'VO2max', van_pct: 106, tot_pct: 120 },
  { zone: 6, naam: 'Anaerobe capaciteit', van_pct: 121, tot_pct: 150 },
  { zone: 7, naam: 'Neuromusculair vermogen', van_pct: 151, tot_pct: null },
]

// Gangbaar 5-zone-model, % van max hartslag
const HARTSLAGZONE_DEFINITIES = [
  { zone: 1, naam: 'Herstel', van_pct: 50, tot_pct: 60 },
  { zone: 2, naam: 'Duurtraining', van_pct: 60, tot_pct: 70 },
  { zone: 3, naam: 'Tempo', van_pct: 70, tot_pct: 80 },
  { zone: 4, naam: 'Drempel', van_pct: 80, tot_pct: 90 },
  { zone: 5, naam: 'Maximaal', van_pct: 90, tot_pct: 100 },
]

export function berekenVermogensZones(ftp: number): VermogensZone[] {
  return VERMOGENSZONE_DEFINITIES.map(def => ({
    zone: def.zone,
    naam: def.naam,
    van_pct: def.van_pct,
    tot_pct: def.tot_pct,
    van_watt: Math.round((ftp * def.van_pct) / 100),
    tot_watt: def.tot_pct !== null ? Math.round((ftp * def.tot_pct) / 100) : null,
  }))
}

export function berekenHartslagZones(maxHartslag: number): HartslagZone[] {
  return HARTSLAGZONE_DEFINITIES.map(def => ({
    zone: def.zone,
    naam: def.naam,
    van_pct: def.van_pct,
    tot_pct: def.tot_pct,
    van_bpm: Math.round((maxHartslag * def.van_pct) / 100),
    tot_bpm: Math.round((maxHartslag * def.tot_pct) / 100),
  }))
}

/**
 * Berekent leeftijd uit een geboortedatum. Puur behulpzame functie voor
 * weergave (bijv. leeftijdscategorie) — vervangt op termijn het
 * statische profiles.age-veld.
 */
export function berekenLeeftijd(birthDate: string): number {
  const geboorte = new Date(birthDate)
  const nu = new Date()
  let leeftijd = nu.getFullYear() - geboorte.getFullYear()
  const nogNietJarigDitJaar = nu.getMonth() < geboorte.getMonth() ||
    (nu.getMonth() === geboorte.getMonth() && nu.getDate() < geboorte.getDate())
  if (nogNietJarigDitJaar) leeftijd -= 1
  return leeftijd
}
