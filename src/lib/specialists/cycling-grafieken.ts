import { createAdminClient } from '@/lib/supabase'
import { isoDatum } from '@/utils'

// ── Cycling Grafieken — Cycling Specialist Roadmap v1.0, Fase 2d ───────
// VOLLEDIG DETERMINISTISCH — geen AI.
//
// ⚠️ BELANGRIJKE, EERLIJKE BEPERKING: TSS (Training Stress Score) volgens
// Coggan's originele, publiek gedocumenteerde formule gebruikt Normalized
// Power (NP) — een gewogen gemiddelde uit een seconde-voor-seconde
// vermogensreeks. Die reeks wordt hier NIET opgeslagen (alleen
// avg_watts/max_watts per rit). Wat hieronder berekend wordt is daarom
// een SCHATTING op basis van gemiddeld vermogen — nauwkeurig genoeg voor
// gelijkmatige duurritten, minder nauwkeurig bij zeer wisselende
// inspanning (bijv. intervaltrainingen, waar NP duidelijk hoger ligt dan
// het gemiddelde). Dit wordt overal — code, API-respons, UI — expliciet
// "geschat" genoemd, nooit als exacte TSS gepresenteerd.
//
// CTL/ATL/TSB-formules (Coggan, publiek gedocumenteerd, exponentieel
// gewogen voortschrijdend gemiddelde — niet propriëtair, door talloze
// open-source tools onafhankelijk geïmplementeerd):
// CTL_vandaag = CTL_gisteren + (TSS_vandaag - CTL_gisteren) / 42
// ATL_vandaag = ATL_gisteren + (TSS_vandaag - ATL_gisteren) / 7
// TSB_vandaag = CTL_gisteren - ATL_gisteren (vorm vóór vandaags belasting)

export interface WeekVolume {
  week_start: string
  totaal_km: number
  totaal_minuten: number
  gemiddeld_watt: number | null
}

export interface DagelijkseBelasting {
  datum: string
  geschatte_tss: number
  ctl: number
  atl: number
  tsb: number
}

function maandagVanWeek(datum: Date): Date {
  const d = new Date(datum)
  const dagIndex = (d.getDay() + 6) % 7 // maandag = 0
  d.setDate(d.getDate() - dagIndex)
  d.setHours(0, 0, 0, 0)
  return d
}


/**
 * Geschatte TSS voor één activiteit. Formule (Coggan, benaderd zonder NP):
 * IF (Intensity Factor) ≈ gemiddeld_watt / FTP
 * TSS_geschat = uren × IF² × 100
 */
export function berekenGeschatteTSS(duurMinuten: number, gemiddeldWatt: number | null, ftp: number): number {
  if (!gemiddeldWatt || !ftp || ftp <= 0) return 0
  const uren = duurMinuten / 60
  const intensityFactor = gemiddeldWatt / ftp
  return Math.round(uren * intensityFactor * intensityFactor * 100)
}

export async function haalWekelijkseVolumes(userId: string, aantalWeken: number): Promise<WeekVolume[]> {
  const supabase = createAdminClient()
  const vandaag = new Date()
  const periodeStart = new Date(vandaag)
  periodeStart.setDate(periodeStart.getDate() - aantalWeken * 7)

  const { data: activiteiten, error } = await supabase
    .from('activity_sessions')
    .select('date, duration, metrics, activities!inner(name)')
    .eq('user_id', userId)
    .in('activities.name', ['Fietsen', 'Fietsen (buiten)', 'Indoor Fietsen'])
    .gte('date', isoDatum(periodeStart))
    .order('date', { ascending: true })

  if (error) throw error

  const perWeek: Record<string, { km: number; minuten: number; wattSom: number; wattCount: number }> = {}

  for (const a of activiteiten || []) {
    const weekKey = isoDatum(maandagVanWeek(new Date(a.date)))
    if (!perWeek[weekKey]) perWeek[weekKey] = { km: 0, minuten: 0, wattSom: 0, wattCount: 0 }
    const metrics = a.metrics as { distance?: number; avg_watts?: number } | null
    perWeek[weekKey].km += (metrics?.distance || 0) / 1000
    perWeek[weekKey].minuten += a.duration || 0
    if (metrics?.avg_watts) {
      perWeek[weekKey].wattSom += metrics.avg_watts
      perWeek[weekKey].wattCount += 1
    }
  }

  return Object.entries(perWeek)
    .map(([week_start, w]) => ({
      week_start,
      totaal_km: Math.round(w.km * 10) / 10,
      totaal_minuten: w.minuten,
      gemiddeld_watt: w.wattCount > 0 ? Math.round(w.wattSom / w.wattCount) : null,
    }))
    .sort((a, b) => a.week_start.localeCompare(b.week_start))
}

// ── Records — Fase 2e ────────────────────────────────────────────────
// ⚠️ EERLIJKE BEPERKING: "beste inspanning per duur" (5s/30s/1min/5min/
// 20min/60min) vergt een vermogenscurve uit seconde-voor-seconde data —
// die wordt niet opgeslagen (zelfde beperking als NP voor TSS, zie
// boven). Wat hieronder berekend wordt, is UITSLUITEND gebaseerd op wat
// daadwerkelijk per activiteit is opgeslagen: duur, afstand,
// hoogtemeters, max/gemiddeld vermogen, gemiddelde snelheid — geen
// duur-specifieke "beste 5 minuten"-records.

export interface CyclingRecords {
  langste_rit_km: { waarde: number; datum: string } | null
  langste_rit_minuten: { waarde: number; datum: string } | null
  meeste_hoogtemeters: { waarde: number; datum: string } | null
  hoogste_vermogen: { waarde: number; datum: string } | null
  hoogste_gem_snelheid: { waarde: number; datum: string } | null
  grootste_week_km: { waarde: number; week_start: string } | null
}

export async function haalRecords(userId: string): Promise<CyclingRecords> {
  const supabase = createAdminClient()

  const { data: activiteiten, error } = await supabase
    .from('activity_sessions')
    .select('date, duration, metrics, activities!inner(name)')
    .eq('user_id', userId)
    .in('activities.name', ['Fietsen', 'Fietsen (buiten)', 'Indoor Fietsen'])
    .order('date', { ascending: true })

  if (error) throw error
  if (!activiteiten || activiteiten.length === 0) {
    return {
      langste_rit_km: null, langste_rit_minuten: null, meeste_hoogtemeters: null,
      hoogste_vermogen: null, hoogste_gem_snelheid: null, grootste_week_km: null,
    }
  }

  let langsteKm: { waarde: number; datum: string } | null = null
  let langsteMin: { waarde: number; datum: string } | null = null
  let meesteHoogte: { waarde: number; datum: string } | null = null
  let hoogsteVermogen: { waarde: number; datum: string } | null = null
  let hoogsteSnelheid: { waarde: number; datum: string } | null = null

  for (const a of activiteiten) {
    const metrics = a.metrics as { distance?: number; elevation?: number; elevation_gain?: number; max_watts?: number; avg_speed?: number } | null
    const km = (metrics?.distance || 0) / 1000
    const hoogte = metrics?.elevation ?? metrics?.elevation_gain ?? 0

    if (km > 0 && (!langsteKm || km > langsteKm.waarde)) langsteKm = { waarde: Math.round(km * 10) / 10, datum: a.date }
    if (a.duration > 0 && (!langsteMin || a.duration > langsteMin.waarde)) langsteMin = { waarde: a.duration, datum: a.date }
    if (hoogte > 0 && (!meesteHoogte || hoogte > meesteHoogte.waarde)) meesteHoogte = { waarde: Math.round(hoogte), datum: a.date }
    if (metrics?.max_watts && (!hoogsteVermogen || metrics.max_watts > hoogsteVermogen.waarde)) hoogsteVermogen = { waarde: metrics.max_watts, datum: a.date }
    if (metrics?.avg_speed && (!hoogsteSnelheid || metrics.avg_speed > hoogsteSnelheid.waarde)) hoogsteSnelheid = { waarde: metrics.avg_speed, datum: a.date }
  }

  // Grootste week hergebruikt de al-bestaande wekelijkse-volumes-logica
  // — geen nieuwe berekening, alleen het maximum eruit gehaald
  const volumes = await haalWekelijkseVolumes(userId, 104) // ~2 jaar terugkijken
  const grootsteWeek = volumes.length > 0
    ? volumes.reduce((a, b) => (b.totaal_km > a.totaal_km ? b : a))
    : null

  return {
    langste_rit_km: langsteKm,
    langste_rit_minuten: langsteMin,
    meeste_hoogtemeters: meesteHoogte,
    hoogste_vermogen: hoogsteVermogen,
    hoogste_gem_snelheid: hoogsteSnelheid,
    grootste_week_km: grootsteWeek ? { waarde: grootsteWeek.totaal_km, week_start: grootsteWeek.week_start } : null,
  }
}

// ── Vermogenscurve — Fase 3 (v2.4.110/115) ──────────────────────────────
// Bron: docs/vermogenscurve-datalaag-spec.md. Haalt het all-time beste
// vermogen per duur op — max(watts) per duration_sec, over alle
// activiteiten heen. Puur een query op de al-berekende, al-opgeslagen
// cycling_power_curve-tabel — geen nieuwe berekening hier.

export interface VermogensCurvePunt {
  duration_sec: number
  watts: number
}

export async function haalVermogenscurve(userId: string): Promise<VermogensCurvePunt[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cycling_power_curve')
    .select('duration_sec, watts')
    .eq('user_id', userId)
    .order('duration_sec', { ascending: true })

  if (error) throw error
  if (!data || data.length === 0) return []

  // All-time beste per duur — er kunnen meerdere activiteiten dezelfde
  // duration_sec hebben, we willen het maximum daarvan
  const besteWattsPerDuur = new Map<number, number>()
  for (const punt of data) {
    const huidig = besteWattsPerDuur.get(punt.duration_sec)
    if (!huidig || punt.watts > huidig) besteWattsPerDuur.set(punt.duration_sec, punt.watts)
  }

  return Array.from(besteWattsPerDuur.entries())
    .map(([duration_sec, watts]) => ({ duration_sec, watts }))
    .sort((a, b) => a.duration_sec - b.duration_sec)
}

export async function haalCTLATLTSB(userId: string, aantalDagen: number): Promise<DagelijkseBelasting[]> {
  const supabase = createAdminClient()

  const [profielRes, activiteitenRes] = await Promise.all([
    supabase.from('specialist_profiles').select('preferences').eq('user_id', userId).eq('specialist_type', 'cycling').maybeSingle(),
    (async () => {
      const vandaag = new Date()
      // Historie iets ruimer ophalen dan gevraagd, zodat CTL (42-dagen-
      // venster) al enigszins is "ingegroeid" vóór de gevraagde periode
      const periodeStart = new Date(vandaag)
      periodeStart.setDate(periodeStart.getDate() - (aantalDagen + 42))
      return supabase
        .from('activity_sessions')
        .select('date, duration, metrics, activities!inner(name)')
        .eq('user_id', userId)
        .in('activities.name', ['Fietsen', 'Fietsen (buiten)', 'Indoor Fietsen'])
        .gte('date', isoDatum(periodeStart))
        .order('date', { ascending: true })
    })(),
  ])

  const ftp = (profielRes.data?.preferences as { ftp?: number } | null)?.ftp
  if (!ftp) return [] // Geen FTP ingesteld — geen TSS-schatting mogelijk, eerlijk leeg teruggeven

  const tssPerDag: Record<string, number> = {}
  for (const a of activiteitenRes.data || []) {
    const metrics = a.metrics as { avg_watts?: number } | null
    const tss = berekenGeschatteTSS(a.duration || 0, metrics?.avg_watts || null, ftp)
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

  // Alleen de daadwerkelijk gevraagde periode teruggeven — de extra 42
  // dagen ervoor waren alleen om CTL te laten "ingroeien"
  return resultaat.slice(-aantalDagen)
}
