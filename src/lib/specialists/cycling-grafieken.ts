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
