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
  metrics: { distance?: number; avg_hr?: number; avg_stroke_rate?: number } | null
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

// ── Rowing Dashboard — Activiteiten-scherm-vervolg, 8 augustus 2026 ─────
// Bron: "Rowing Performance Center ontbreekt"-gat, bevestigd tijdens de
// Activiteiten-scherm-verificatiefase. Spiegelbeeld van
// haalRunningDashboard() (running-grafieken.ts) — zelfde structuur,
// zelfde jaar-tot-nu-beperking eerlijk zo benoemd, geen "totaal"-
// suggestie die meer omvat dan het doet.
//
// Roei-conventie i.p.v. Running's pace/cadans: split per 500m
// (Concept2/British Rowing-standaard, niet km/u) en slagfrequentie
// i.p.v. cadans. Snelheid wordt — net als bij de TSS-berekening
// hierboven — altijd afgeleid uit afstand/duur, nooit uit een
// eventueel los opgeslagen avg_speed-veld: Concept2's eigen sync
// (concept2-result-processor.ts) slaat geen avg_speed op, alleen
// distance/avg_stroke_rate/avg_hr — consistent dezelfde afleiding
// hergebruiken i.p.v. een veld aan te nemen dat er niet is.

export interface RowingDashboard {
  week_km: number
  maand_km: number
  jaar_km: number
  totaal_km: number
  trainingen_deze_week: number
  gemiddelde_split_sec_per_500m: number | null
  gemiddelde_hartslag: number | null
  gemiddelde_slagfrequentie: number | null
  trainingstijd_minuten: number
  langste_sessie: { minuten: number; datum: string } | null
  snelste_training: { split_sec_per_500m: number; datum: string } | null
}

function maandagVanWeekRowing(datum: Date): Date {
  const d = new Date(datum)
  const dagIndex = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dagIndex)
  d.setHours(0, 0, 0, 0)
  return d
}

/** meters/minuut -> seconden per 500m (roei-conventie). */
function mPerMinNaarSplitPer500m(mPerMin: number): number {
  if (mPerMin <= 0) return 0
  return Math.round((500 / mPerMin) * 60)
}

export async function haalRowingDashboard(userId: string): Promise<RowingDashboard> {
  const supabase = createAdminClient()
  const vandaag = new Date()
  const jaarStart = new Date(vandaag.getFullYear(), 0, 1)

  const { data, error } = await supabase
    .from('activity_sessions')
    .select('date, duration, metrics, activities!inner(name)')
    .eq('user_id', userId)
    .in('activities.name', ['Roeien'])
    .gte('date', isoDatum(jaarStart))
    .order('date', { ascending: true })

  if (error) throw error
  const activiteiten = (data || []) as unknown as RowingActiviteitRij[]

  if (activiteiten.length === 0) {
    return {
      week_km: 0, maand_km: 0, jaar_km: 0, totaal_km: 0,
      trainingen_deze_week: 0, gemiddelde_split_sec_per_500m: null,
      gemiddelde_hartslag: null, gemiddelde_slagfrequentie: null,
      trainingstijd_minuten: 0, langste_sessie: null, snelste_training: null,
    }
  }

  const weekStart = maandagVanWeekRowing(vandaag)
  const maandStart = new Date(vandaag.getFullYear(), vandaag.getMonth(), 1)

  let weekKm = 0, maandKm = 0, jaarKm = 0
  let trainingenDezeWeek = 0
  let trainingstijdMinuten = 0
  const mPerMinWaarden: number[] = []
  const hrWaarden: number[] = []
  const slagfrequentieWaarden: number[] = []
  let langsteSessie: { minuten: number; datum: string } | null = null
  let snelsteTraining: { split_sec_per_500m: number; datum: string } | null = null

  for (const a of activiteiten) {
    const datum = new Date(a.date)
    const km = (a.metrics?.distance || 0) / 1000
    jaarKm += km
    if (datum >= maandStart) maandKm += km
    if (datum >= weekStart) { weekKm += km; trainingenDezeWeek++ }

    trainingstijdMinuten += a.duration || 0
    if (a.metrics?.avg_hr) hrWaarden.push(a.metrics.avg_hr)
    if (a.metrics?.avg_stroke_rate) slagfrequentieWaarden.push(a.metrics.avg_stroke_rate)

    if (a.duration > 0 && (!langsteSessie || a.duration > langsteSessie.minuten)) {
      langsteSessie = { minuten: a.duration, datum: a.date }
    }
    if (a.metrics?.distance && a.duration > 0) {
      const mPerMin = a.metrics.distance / a.duration
      mPerMinWaarden.push(mPerMin)
      const splitSecPer500m = mPerMinNaarSplitPer500m(mPerMin)
      if (!snelsteTraining || splitSecPer500m < snelsteTraining.split_sec_per_500m) {
        snelsteTraining = { split_sec_per_500m: splitSecPer500m, datum: a.date }
      }
    }
  }

  const gemiddelde = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null
  const gemMPerMin = gemiddelde(mPerMinWaarden)

  return {
    week_km: Math.round(weekKm * 10) / 10,
    maand_km: Math.round(maandKm * 10) / 10,
    jaar_km: Math.round(jaarKm * 10) / 10,
    totaal_km: Math.round(jaarKm * 10) / 10, // jaar-tot-nu, zelfde eerlijke beperking als Running
    trainingen_deze_week: trainingenDezeWeek,
    gemiddelde_split_sec_per_500m: gemMPerMin ? mPerMinNaarSplitPer500m(gemMPerMin) : null,
    gemiddelde_hartslag: gemiddelde(hrWaarden) ? Math.round(gemiddelde(hrWaarden)!) : null,
    gemiddelde_slagfrequentie: gemiddelde(slagfrequentieWaarden) ? Math.round(gemiddelde(slagfrequentieWaarden)!) : null,
    trainingstijd_minuten: trainingstijdMinuten,
    langste_sessie: langsteSessie,
    snelste_training: snelsteTraining,
  }
}

export interface WekelijkseRowingTrend {
  week_start: string
  gemiddelde_split_sec_per_500m: number | null
  gemiddelde_hartslag: number | null
  gemiddelde_slagfrequentie: number | null
}

export async function haalWekelijkseRowingTrend(userId: string, aantalWeken: number): Promise<WekelijkseRowingTrend[]> {
  const supabase = createAdminClient()
  const vandaag = new Date()
  const periodeStart = new Date(vandaag)
  periodeStart.setDate(periodeStart.getDate() - aantalWeken * 7)

  const { data: activiteiten, error } = await supabase
    .from('activity_sessions')
    .select('date, duration, metrics, activities!inner(name)')
    .eq('user_id', userId)
    .in('activities.name', ['Roeien'])
    .gte('date', isoDatum(periodeStart))
    .order('date', { ascending: true })

  if (error) throw error

  const perWeek: Record<string, { mPerMinSom: number; mPerMinCount: number; hrSom: number; hrCount: number; slagSom: number; slagCount: number }> = {}

  for (const a of (activiteiten || []) as unknown as RowingActiviteitRij[]) {
    const weekKey = isoDatum(maandagVanWeekRowing(new Date(a.date)))
    if (!perWeek[weekKey]) perWeek[weekKey] = { mPerMinSom: 0, mPerMinCount: 0, hrSom: 0, hrCount: 0, slagSom: 0, slagCount: 0 }
    if (a.metrics?.distance && a.duration > 0) {
      perWeek[weekKey].mPerMinSom += a.metrics.distance / a.duration
      perWeek[weekKey].mPerMinCount++
    }
    if (a.metrics?.avg_hr) { perWeek[weekKey].hrSom += a.metrics.avg_hr; perWeek[weekKey].hrCount++ }
    if (a.metrics?.avg_stroke_rate) { perWeek[weekKey].slagSom += a.metrics.avg_stroke_rate; perWeek[weekKey].slagCount++ }
  }

  return Object.entries(perWeek)
    .map(([week_start, w]) => ({
      week_start,
      gemiddelde_split_sec_per_500m: w.mPerMinCount > 0 ? mPerMinNaarSplitPer500m(w.mPerMinSom / w.mPerMinCount) : null,
      gemiddelde_hartslag: w.hrCount > 0 ? Math.round(w.hrSom / w.hrCount) : null,
      gemiddelde_slagfrequentie: w.slagCount > 0 ? Math.round(w.slagSom / w.slagCount) : null,
    }))
    .sort((a, b) => a.week_start.localeCompare(b.week_start))
}

// ── Records & Afstand-trends — v2.4.310 ─────────────────────────────────
// Bron: expliciet, eerder opengelaten gat alsnog gedicht, op verzoek
// van de gebruiker ("niet laten liggen"). BEWUST GEEN nieuwe tabel en
// GEEN parser-tijd-berekening zoals Running's running_distance_records
// — die aanpak past niet bij hoe roeiers records zetten.
//
// Running haalt records uit LOSSE LAP-SEGMENTEN binnen één langere
// activiteit (bijv. de snelste 5km ergens midden in een duurloop).
// Roeiers doen daarentegen typisch een HELE SESSIE exact als
// 2k-test/5k-test — geen sub-segment nodig. Daarom: query-time
// afgeleid direct uit activity_sessions, geen aparte tabel.
//
// EERLIJKE BEPERKING, EXPLICIET (niet stilzwijgend): vergt een
// precieze duur (metrics.precieze_duur_sec, v2.4.310) — momenteel
// ALLEEN gevuld door de Concept2-sync. Garmin TCX-Rowing-sessies
// hebben dit veld nog niet (tcx-parser.ts rondt ook af op hele
// minuten, net als Concept2 vóór deze fix deed) — die tellen hier dus
// nog niet mee. Apart, kleiner vervolgpunt: hetzelfde precieze-duur-
// veld ook aan de TCX-parser toevoegen, bewust nu niet meegenomen
// (raakt een gedeeld bestand dat alle sporten gebruikt, niet alleen
// Rowing — groter risico dan de Concept2-only-aanpassing hierboven).

// v2.4.311: 21097m (halve marathon) en 42195m (marathon) toegevoegd —
// bevestigd officiële Concept2-standaardafstanden (log.concept2.com's
// eigen ranking-documentatie: "500m, 1000m, 2000m, 5000m, 6000m,
// 10000m, 21097m, 42195m or 100,000m"), niet zelf verzonnen. Zelfde
// waarden als Running's PROGRESSIE_AFSTANDEN.
const STANDAARD_TESTAFSTANDEN = [500, 1000, 2000, 5000, 6000, 10000, 21097, 42195]
const AFSTAND_TOLERANTIE_PCT = 0.02 // ±2% — vangt normale erg-stopvariatie op, niet een toevallig gepasseerde afstand in een langere training

export interface RowingRecord {
  afstand_m: number
  tijd_sec: number
  datum: string
}

interface RowingActiviteitMetPrecisie {
  date: string
  metrics: { distance?: number; precieze_duur_sec?: number } | null
}

async function haalRowingSessiesMetPrecisie(userId: string, sindsDagenGeleden?: number): Promise<RowingActiviteitMetPrecisie[]> {
  const supabase = createAdminClient()
  let query = supabase
    .from('activity_sessions')
    .select('date, metrics, activities!inner(name)')
    .eq('user_id', userId)
    .in('activities.name', ['Roeien'])
    .order('date', { ascending: true })

  if (sindsDagenGeleden) {
    const vanaf = new Date()
    vanaf.setDate(vanaf.getDate() - sindsDagenGeleden)
    query = query.gte('date', isoDatum(vanaf))
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []) as unknown as RowingActiviteitMetPrecisie[]
}

/** Voor elke standaard testafstand: welke sessies vallen binnen de
 * tolerantie, gesorteerd chronologisch. Gedeeld door zowel records als
 * afstand-trends, geen dubbele filterlogica. */
function groepeerPerTestafstand(sessies: RowingActiviteitMetPrecisie[]): Record<number, { datum: string; tijd_sec: number }[]> {
  const resultaat: Record<number, { datum: string; tijd_sec: number }[]> = {}
  for (const s of sessies) {
    const afstand = s.metrics?.distance
    const tijd = s.metrics?.precieze_duur_sec
    if (!afstand || !tijd) continue
    for (const testafstand of STANDAARD_TESTAFSTANDEN) {
      if (Math.abs(afstand - testafstand) <= testafstand * AFSTAND_TOLERANTIE_PCT) {
        if (!resultaat[testafstand]) resultaat[testafstand] = []
        resultaat[testafstand].push({ datum: s.date, tijd_sec: tijd })
      }
    }
  }
  for (const afstand of Object.keys(resultaat)) {
    resultaat[Number(afstand)].sort((a, b) => a.datum.localeCompare(b.datum))
  }
  return resultaat
}

export async function haalRowingRecords(userId: string): Promise<RowingRecord[]> {
  const sessies = await haalRowingSessiesMetPrecisie(userId)
  const perAfstand = groepeerPerTestafstand(sessies)

  const records: RowingRecord[] = []
  for (const [afstandStr, pogingen] of Object.entries(perAfstand)) {
    const beste = pogingen.reduce((snelste, p) => p.tijd_sec < snelste.tijd_sec ? p : snelste)
    records.push({ afstand_m: Number(afstandStr), tijd_sec: beste.tijd_sec, datum: beste.datum })
  }
  return records.sort((a, b) => a.afstand_m - b.afstand_m)
}

export interface RowingAfstandTrendPunt {
  datum: string
  tijd_sec: number
}

export async function haalRowingAfstandTrends(userId: string): Promise<Record<number, RowingAfstandTrendPunt[]>> {
  const sessies = await haalRowingSessiesMetPrecisie(userId)
  const perAfstand = groepeerPerTestafstand(sessies)
  const resultaat: Record<number, RowingAfstandTrendPunt[]> = {}
  for (const [afstandStr, pogingen] of Object.entries(perAfstand)) {
    resultaat[Number(afstandStr)] = pogingen.map(p => ({ datum: p.datum, tijd_sec: p.tijd_sec }))
  }
  return resultaat
}

// ── Periode-vergelijking & Recente sessies — Roeiprestaties-uitbreiding ──
// Bron: Fase 2-live-validatie (25 augustus 2026) tegen de productie-
// Intervals.icu-bridge, bevestigde architectuur — geen nieuwe engine,
// alleen nieuwe, additieve query-functies bovenop dezelfde
// activity_sessions-waarheid. Geen van de bestaande functies hierboven
// is gewijzigd.
//
// Watts is hier bewust NERGENS opgenomen: de live dry-run-validatie
// liet zien dat noch de directe Concept2-sync, noch de Intervals.icu-
// relay ooit een watts-waarde levert (icu_average_watts stond null in
// alle 10 geteste sessies, ondanks device_watts:true) — geen
// schijnfunctionaliteit bouwen voor een veld dat structureel niet
// bestaat in de brondata.

interface RowingActiviteitMetBron {
  id: string
  date: string
  duration: number
  metrics: { distance?: number; avg_hr?: number; avg_stroke_rate?: number } | null
  source: string
}

export interface RowingRecenteSessie {
  id: string
  datum: string
  afstand_m: number | null
  duur_min: number
  split_sec_per_500m: number | null
  gemiddelde_hartslag: number | null
  gemiddelde_slagfrequentie: number | null
  bron: string
}

/** Meest recente N sessies, incl. bron — voor de "Recente trainingen"-
 * lijst (§30 Roeiprestaties-plan). Per-sessie, geen aggregatie, zodat
 * de bronbadge (§31) per rij klopt i.p.v. een gemiddelde over meerdere
 * bronnen heen. */
export async function haalRowingRecenteSessies(userId: string, aantal: number = 10): Promise<RowingRecenteSessie[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('activity_sessions')
    .select('id, date, duration, metrics, source, activities!inner(name)')
    .eq('user_id', userId)
    .in('activities.name', ['Roeien'])
    .order('date', { ascending: false })
    .limit(aantal)

  if (error) throw error

  return ((data || []) as unknown as RowingActiviteitMetBron[]).map(a => {
    const mPerMin = a.metrics?.distance && a.duration > 0 ? a.metrics.distance / a.duration : null
    return {
      id: a.id,
      datum: a.date,
      afstand_m: a.metrics?.distance ?? null,
      duur_min: a.duration,
      split_sec_per_500m: mPerMin ? mPerMinNaarSplitPer500m(mPerMin) : null,
      gemiddelde_hartslag: a.metrics?.avg_hr ?? null,
      gemiddelde_slagfrequentie: a.metrics?.avg_stroke_rate ?? null,
      bron: a.source,
    }
  })
}

export interface RowingPeriodeSamenvatting {
  afstand_km: number
  aantal_trainingen: number
  gemiddelde_split_sec_per_500m: number | null
  gemiddelde_slagfrequentie: number | null
  gemiddelde_hartslag: number | null
}

export interface RowingPeriodeVergelijking {
  huidige_periode: RowingPeriodeSamenvatting
  vorige_periode: RowingPeriodeSamenvatting
}

function samenvattenRowingPeriode(sessies: RowingActiviteitMetBron[]): RowingPeriodeSamenvatting {
  let afstandM = 0
  const mPerMinWaarden: number[] = []
  const hrWaarden: number[] = []
  const slagWaarden: number[] = []

  for (const a of sessies) {
    afstandM += a.metrics?.distance || 0
    if (a.metrics?.distance && a.duration > 0) mPerMinWaarden.push(a.metrics.distance / a.duration)
    if (a.metrics?.avg_hr) hrWaarden.push(a.metrics.avg_hr)
    if (a.metrics?.avg_stroke_rate) slagWaarden.push(a.metrics.avg_stroke_rate)
  }

  const gemiddelde = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null
  const gemMPerMin = gemiddelde(mPerMinWaarden)

  return {
    afstand_km: Math.round((afstandM / 1000) * 10) / 10,
    aantal_trainingen: sessies.length,
    gemiddelde_split_sec_per_500m: gemMPerMin ? mPerMinNaarSplitPer500m(gemMPerMin) : null,
    gemiddelde_slagfrequentie: gemiddelde(slagWaarden) ? Math.round(gemiddelde(slagWaarden)!) : null,
    gemiddelde_hartslag: gemiddelde(hrWaarden) ? Math.round(gemiddelde(hrWaarden)!) : null,
  }
}

/** Vergelijkt de gekozen periode met de daaraan voorafgaande periode van
 * gelijke lengte (§24 Roeiprestaties-plan) — op periodeniveau i.p.v.
 * losse weken, consistent met de periodeselector (§18). */
export async function haalRowingPeriodeVergelijking(userId: string, periodeDagen: number): Promise<RowingPeriodeVergelijking> {
  const supabase = createAdminClient()
  const vandaag = new Date()
  const huidigeStart = new Date(vandaag)
  huidigeStart.setDate(huidigeStart.getDate() - periodeDagen)
  const vorigeStart = new Date(huidigeStart)
  vorigeStart.setDate(vorigeStart.getDate() - periodeDagen)

  const { data, error } = await supabase
    .from('activity_sessions')
    .select('id, date, duration, metrics, source, activities!inner(name)')
    .eq('user_id', userId)
    .in('activities.name', ['Roeien'])
    .gte('date', isoDatum(vorigeStart))
    .order('date', { ascending: true })

  if (error) throw error
  const alleSessies = (data || []) as unknown as RowingActiviteitMetBron[]
  const huidigeStartStr = isoDatum(huidigeStart)

  return {
    huidige_periode: samenvattenRowingPeriode(alleSessies.filter(a => a.date >= huidigeStartStr)),
    vorige_periode: samenvattenRowingPeriode(alleSessies.filter(a => a.date < huidigeStartStr)),
  }
}
