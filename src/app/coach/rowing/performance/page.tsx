'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { bronLabel } from '@/components/ActiviteitenSectie'

// ── Rowing Performance Center — 8 augustus 2026 ──────────────────────────
// Bron: bevestigd gat ("Rowing Performance Center ontbreekt", Cycling/
// Running hebben het al) — Activiteiten-scherm-verificatiefase. Zelfde
// dependency-vrije SVG/CSS-grafiekaanpak als coach/running/grafieken/
// page.tsx (LijnGrafiek/StaafGrafiek 1-op-1 hergebruikt, niet opnieuw
// uitgevonden). Eén gecombineerde pagina (Dashboard + CTL/ATL/TSB +
// wekelijkse trends + Records/Progressie) i.p.v. Running's twee losse
// pagina's — bewust compacter, sluit aan bij Cycling's single-page
// "Power"-aanpak.
//
// v2.4.310: Records/Progressie alsnog toegevoegd — bewust ZONDER
// nieuwe tabel (zie module-comment in rowing-grafieken.ts): roeiers
// doen typisch hele sessies als testafstand, query-time af te leiden.
// Eerlijke beperking: alleen Concept2-sessies, Garmin TCX-Rowing nog
// niet (mist de precieze duur die hiervoor nodig is).
//
// v2.4.369 (Roeiprestaties-uitbreiding): periodeselector, Performance
// Comparison, Recente trainingen + bronbadge, GEMETEN/BEREKEND/
// GESCHAT-labels — Fase 2-live-gevalideerd tegen de productie-
// Intervals.icu-bridge (25 augustus 2026). Watts bewust NIET
// opgenomen: bevestigd afwezig in zowel de directe Concept2-sync als
// de Intervals.icu-relay (icu_average_watts null in alle geteste
// sessies), geen veld voor data die structureel niet bestaat.

interface RowingDashboard {
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
interface DagelijkseBelasting { datum: string; geschatte_tss: number; ctl: number; atl: number; tsb: number }
interface WekelijkseTrend { week_start: string; gemiddelde_split_sec_per_500m: number | null; gemiddelde_hartslag: number | null; gemiddelde_slagfrequentie: number | null }
interface RowingRecord { afstand_m: number; tijd_sec: number; datum: string }
interface RowingAfstandTrendPunt { datum: string; tijd_sec: number }
interface RowingRecenteSessie {
  id: string
  datum: string
  afstand_m: number | null
  duur_min: number
  split_sec_per_500m: number | null
  gemiddelde_hartslag: number | null
  gemiddelde_slagfrequentie: number | null
  bron: string
}
interface RowingPeriodeSamenvatting {
  afstand_km: number
  aantal_trainingen: number
  gemiddelde_split_sec_per_500m: number | null
  gemiddelde_slagfrequentie: number | null
  gemiddelde_hartslag: number | null
}
interface RowingPeriodeVergelijking {
  huidige_periode: RowingPeriodeSamenvatting
  vorige_periode: RowingPeriodeSamenvatting
}

const TESTAFSTANDEN_MET_LABEL: [number, string][] = [
  [500, '500m'], [1000, '1000m'], [2000, '2000m'], [5000, '5000m'], [6000, '6000m'], [10000, '10.000m'],
  [21097, 'Halve marathon'], [42195, 'Marathon'],
]

const PERIODES: [string, string][] = [
  ['7D', '7D'], ['30D', '30D'], ['3M', '3M'], ['6M', '6M'], ['1J', '1J'],
]

// v2.4.369: kleine, herbruikbare data-status-badge (§33 Roeiprestaties-
// plan) — GEMETEN/BEREKEND/GESCHAT, puur presentatie, geen logica.
function DataLabel({ status }: { status: 'gemeten' | 'berekend' | 'geschat' }) {
  const stijl = status === 'gemeten'
    ? 'text-green-500/70 border-green-500/20'
    : status === 'berekend'
      ? 'text-blue-400/70 border-blue-400/20'
      : 'text-amber-400/70 border-amber-400/20'
  const tekst = status === 'gemeten' ? 'GEMETEN' : status === 'berekend' ? 'BEREKEND' : 'GESCHAT'
  return <span className={`text-[8px] font-semibold tracking-wider border rounded px-1 py-0.5 ${stijl}`}>{tekst}</span>
}

function formatTijd(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`
}

function formatSplit(secPer500m: number): string {
  const min = Math.floor(secPer500m / 60)
  const sec = Math.round(secPer500m % 60)
  return `${min}:${sec.toString().padStart(2, '0')}/500m`
}
function formatWeekLabel(weekStart: string): string {
  return new Date(weekStart).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}
function formatDuur(min: number): string {
  // v2.4.371: 'm' verving naar 'min' — "50m" naast "50 SPM" en afstanden
  // in km las als meters, verwarrend in de Recente-trainingen-lijst.
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}u ${m}min` : `${h}u`
}
function formatDatumKort(datum: string): string {
  return new Date(datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}
function formatAfstand(m: number | null): string {
  if (m === null) return '—'
  return m >= 1000 ? `${(m / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 2 })} km` : `${Math.round(m)} m`
}

// ── Simpel SVG-lijndiagram, geen dependency — 1-op-1 hergebruikt van
// coach/running/grafieken/page.tsx (zelfde patroon als Cycling) ─────────
function LijnGrafiek({ data, lijnen, hoogte = 140 }: {
  data: DagelijkseBelasting[]
  lijnen: Array<{ key: 'ctl' | 'atl'; kleur: string; label: string }>
  hoogte?: number
}) {
  if (data.length === 0) return null
  const breedte = 320
  const alleWaarden = data.flatMap(d => lijnen.map(l => d[l.key]))
  const max = Math.max(...alleWaarden, 1)
  const min = Math.min(...alleWaarden, 0)
  const bereik = max - min || 1

  function puntenVoor(key: 'ctl' | 'atl'): string {
    return data.map((d, i) => {
      const x = (i / (data.length - 1 || 1)) * breedte
      const y = hoogte - ((d[key] - min) / bereik) * hoogte
      return `${x},${y}`
    }).join(' ')
  }

  return (
    <div>
      <svg viewBox={`0 0 ${breedte} ${hoogte}`} className="w-full" style={{ height: hoogte }}>
        {lijnen.map(l => (
          <polyline key={l.key} points={puntenVoor(l.key)} fill="none" stroke={l.kleur} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        ))}
      </svg>
      <div className="flex gap-4 mt-1">
        {lijnen.map(l => (
          <div key={l.key} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.kleur }} />
            <span className="text-[10px] text-slate-500">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Simpele staafdiagram voor de wekelijkse trend, via CSS — 1-op-1
// hergebruikt van coach/running/grafieken/page.tsx ──────────────────────
function StaafGrafiek({ data, veld, formatter, kleur = 'bg-primary-500' }: {
  data: WekelijkseTrend[]; veld: 'gemiddelde_split_sec_per_500m' | 'gemiddelde_hartslag' | 'gemiddelde_slagfrequentie'
  formatter: (v: number) => string; kleur?: string
}) {
  const punten = data.filter(d => d[veld] !== null) as (WekelijkseTrend & Record<typeof veld, number>)[]
  if (punten.length < 2) return <p className="text-[11px] text-slate-600 py-4 text-center">Nog te weinig weken met data.</p>

  const waarden = punten.map(p => p[veld])
  const max = Math.max(...waarden)
  const min = Math.min(...waarden)
  const bereik = max - min || 1

  return (
    <div>
      <div className="flex items-end gap-1" style={{ height: 70 }}>
        {punten.map((p, i) => {
          const hoogtePct = Math.max(8, Math.round(((p[veld] - min) / bereik) * 100))
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: 70 }}>
              <div className={`w-full ${kleur} rounded-t-sm opacity-80`} style={{ height: `${hoogtePct}%` }} />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-slate-600">{formatWeekLabel(punten[0].week_start)} · {formatter(punten[0][veld])}</span>
        <span className="text-[9px] text-slate-600">{formatWeekLabel(punten[punten.length - 1].week_start)} · {formatter(punten[punten.length - 1][veld])}</span>
      </div>
    </div>
  )
}

export default function RowingPerformanceCenterPage() {
  const [laden, setLaden] = useState(true)
  const [heeftBaseline, setHeeftBaseline] = useState(true)
  const [periode, setPeriode] = useState('30D')
  const [dashboard, setDashboard] = useState<RowingDashboard | null>(null)
  const [ctlAtlTsb, setCtlAtlTsb] = useState<DagelijkseBelasting[]>([])
  const [wekelijkseTrend, setWekelijkseTrend] = useState<WekelijkseTrend[]>([])
  const [records, setRecords] = useState<RowingRecord[]>([])
  const [afstandTrends, setAfstandTrends] = useState<Record<number, RowingAfstandTrendPunt[]>>({})
  const [recenteSessies, setRecenteSessies] = useState<RowingRecenteSessie[]>([])
  const [periodeVergelijking, setPeriodeVergelijking] = useState<RowingPeriodeVergelijking | null>(null)

  useEffect(() => {
    async function laadAlles() {
      setLaden(true)
      try {
        const [profielRes, grafiekenRes] = await Promise.all([
          fetch('/api/specialists/rowing/profile', { credentials: 'include' }),
          fetch(`/api/specialists/rowing/grafieken?periode=${periode}`, { credentials: 'include' }),
        ])
        const profielData = await profielRes.json()
        const grafiekenData = await grafiekenRes.json()

        setHeeftBaseline(!!profielData?.preferences?.laatste_2k_tijd_sec)
        setDashboard(grafiekenData?.dashboard || null)
        setCtlAtlTsb(grafiekenData?.ctl_atl_tsb || [])
        setWekelijkseTrend(grafiekenData?.wekelijkse_trend || [])
        setRecords(grafiekenData?.records || [])
        setAfstandTrends(grafiekenData?.afstand_trends || {})
        setRecenteSessies(grafiekenData?.recente_sessies || [])
        setPeriodeVergelijking(grafiekenData?.periode_vergelijking || null)
      } catch {
        // Elke sectie checkt zelf op aanwezige data
      } finally {
        setLaden(false)
      }
    }
    laadAlles()
  }, [periode])

  const laatsteTsb = ctlAtlTsb.length > 0 ? ctlAtlTsb[ctlAtlTsb.length - 1] : null
  const geenDataHelemaal = !laden && !dashboard?.trainingen_deze_week && ctlAtlTsb.length === 0 && dashboard?.jaar_km === 0
  const heeftVergelijkingsdata = !!periodeVergelijking && (periodeVergelijking.huidige_periode.aantal_trainingen > 0 || periodeVergelijking.vorige_periode.aantal_trainingen > 0)

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link href="/coach/rowing" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Performance Center</h1>
            <p className="text-xs text-slate-500">Dashboard, belasting &amp; trends</p>
          </div>
        </div>

        <div className="flex gap-1.5">
          {PERIODES.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriode(key)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                periode === key ? 'bg-primary-500 text-white' : 'bg-white/5 text-slate-400 active:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {laden && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-800/50 rounded-2xl animate-pulse" />)}
          </div>
        )}

        {!laden && !heeftBaseline && (
          <Card className="p-4">
            <p className="text-sm text-slate-300 mb-2">Nog geen 2.000m-testtijd ingevuld — Trainingsbelasting (TSS/CTL/ATL/TSB) vergt een persoonlijke baseline.</p>
            <Link href="/settings/rowing-profile" className="text-sm text-primary-400 underline">Vul je 2k-testtijd in →</Link>
          </Card>
        )}

        {!laden && dashboard && (
          <Card className="p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Dashboard</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><p className="text-xs text-slate-500">Deze week</p><p className="text-lg font-bold text-white">{dashboard.week_km} km</p></div>
              <div><p className="text-xs text-slate-500">Deze maand</p><p className="text-lg font-bold text-white">{dashboard.maand_km} km</p></div>
              <div><p className="text-xs text-slate-500">Dit jaar</p><p className="text-lg font-bold text-white">{dashboard.jaar_km} km</p></div>
              <div><p className="text-xs text-slate-500">Trainingen deze week</p><p className="text-lg font-bold text-white">{dashboard.trainingen_deze_week}</p></div>
            </div>
            <div className="flex flex-wrap gap-4 pt-3 border-t border-coach-border">
              {dashboard.gemiddelde_split_sec_per_500m && (
                <div>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">Gem. split <DataLabel status="berekend" /></p>
                  <p className="text-sm font-medium text-white">{formatSplit(dashboard.gemiddelde_split_sec_per_500m)}</p>
                </div>
              )}
              {dashboard.gemiddelde_hartslag && (
                <div>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">Gem. hartslag <DataLabel status="gemeten" /></p>
                  <p className="text-sm font-medium text-white">{dashboard.gemiddelde_hartslag} bpm</p>
                </div>
              )}
              {dashboard.gemiddelde_slagfrequentie && (
                <div>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">Gem. slagfrequentie <DataLabel status="gemeten" /></p>
                  <p className="text-sm font-medium text-white">{dashboard.gemiddelde_slagfrequentie} spm</p>
                </div>
              )}
              {dashboard.langste_sessie && (
                <div><p className="text-xs text-slate-500">Langste sessie</p><p className="text-sm font-medium text-white">{formatDuur(dashboard.langste_sessie.minuten)}</p></div>
              )}
              {dashboard.snelste_training && (
                <div><p className="text-xs text-slate-500">Snelste split</p><p className="text-sm font-medium text-white">{formatSplit(dashboard.snelste_training.split_sec_per_500m)}</p></div>
              )}
            </div>
          </Card>
        )}

        {!laden && laatsteTsb && (
          <Card className="p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">Trainingsbelasting <DataLabel status="geschat" /></p>
            <p className="text-[10px] text-slate-600 mb-3">Geschatte TSS — gebaseerd op je 2.000m-testtijd, geen instrument-gemeten waarde.</p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div><p className="text-xs text-slate-500">CTL</p><p className="text-lg font-bold text-white">{laatsteTsb.ctl}</p></div>
              <div><p className="text-xs text-slate-500">ATL</p><p className="text-lg font-bold text-white">{laatsteTsb.atl}</p></div>
              <div><p className="text-xs text-slate-500">TSB</p><p className="text-lg font-bold text-white">{laatsteTsb.tsb}</p></div>
            </div>
            <LijnGrafiek data={ctlAtlTsb} lijnen={[{ key: 'ctl', kleur: '#3b82f6', label: 'CTL (fitness)' }, { key: 'atl', kleur: '#f43f5e', label: 'ATL (vermoeidheid)' }]} />
          </Card>
        )}

        {!laden && heeftVergelijkingsdata && periodeVergelijking && (
          <Card className="p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Performance Comparison</p>
            <p className="text-[10px] text-slate-600 mb-3">Vergelijking van beschikbare periodegemiddelden — deze periode ({periode}) tegenover de voorgaande periode van gelijke lengte.</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] text-slate-600">
                  <th className="font-normal pb-1"></th>
                  <th className="font-normal pb-1 text-right">Deze periode</th>
                  <th className="font-normal pb-1 text-right">Vorige periode</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-coach-border">
                  <td className="py-1.5 text-slate-400">Afstand</td>
                  <td className="py-1.5 text-right text-white font-medium">{periodeVergelijking.huidige_periode.afstand_km} km</td>
                  <td className="py-1.5 text-right text-slate-500">{periodeVergelijking.vorige_periode.afstand_km} km</td>
                </tr>
                <tr className="border-t border-coach-border">
                  <td className="py-1.5 text-slate-400">Trainingen</td>
                  <td className="py-1.5 text-right text-white font-medium">{periodeVergelijking.huidige_periode.aantal_trainingen}</td>
                  <td className="py-1.5 text-right text-slate-500">{periodeVergelijking.vorige_periode.aantal_trainingen}</td>
                </tr>
                <tr className="border-t border-coach-border">
                  <td className="py-1.5 text-slate-400">Gem. split</td>
                  <td className="py-1.5 text-right text-white font-medium">
                    {periodeVergelijking.huidige_periode.gemiddelde_split_sec_per_500m ? formatSplit(periodeVergelijking.huidige_periode.gemiddelde_split_sec_per_500m) : '—'}
                  </td>
                  <td className="py-1.5 text-right text-slate-500">
                    {periodeVergelijking.vorige_periode.gemiddelde_split_sec_per_500m ? formatSplit(periodeVergelijking.vorige_periode.gemiddelde_split_sec_per_500m) : '—'}
                  </td>
                </tr>
                <tr className="border-t border-coach-border">
                  <td className="py-1.5 text-slate-400">Gem. SPM</td>
                  <td className="py-1.5 text-right text-white font-medium">{periodeVergelijking.huidige_periode.gemiddelde_slagfrequentie ?? '—'}</td>
                  <td className="py-1.5 text-right text-slate-500">{periodeVergelijking.vorige_periode.gemiddelde_slagfrequentie ?? '—'}</td>
                </tr>
                <tr className="border-t border-coach-border">
                  <td className="py-1.5 text-slate-400">Gem. HR</td>
                  <td className="py-1.5 text-right text-white font-medium">{periodeVergelijking.huidige_periode.gemiddelde_hartslag ?? '—'}</td>
                  <td className="py-1.5 text-right text-slate-500">{periodeVergelijking.vorige_periode.gemiddelde_hartslag ?? '—'}</td>
                </tr>
              </tbody>
            </table>
          </Card>
        )}

        {!laden && periodeVergelijking && !heeftVergelijkingsdata && (
          <Card className="p-4 text-center">
            <p className="text-xs text-slate-500">Nog onvoldoende roeigegevens voor deze periode.</p>
          </Card>
        )}

        {!laden && wekelijkseTrend.length > 0 && (
          <>
            <Card className="p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Gemiddelde split per week</p>
              <StaafGrafiek data={wekelijkseTrend} veld="gemiddelde_split_sec_per_500m" formatter={formatSplit} kleur="bg-primary-500" />
            </Card>
            <Card className="p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Gemiddelde hartslag per week</p>
              <StaafGrafiek data={wekelijkseTrend} veld="gemiddelde_hartslag" formatter={v => `${Math.round(v)} bpm`} kleur="bg-red-500" />
            </Card>
            <Card className="p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Gemiddelde slagfrequentie per week</p>
              <StaafGrafiek data={wekelijkseTrend} veld="gemiddelde_slagfrequentie" formatter={v => `${Math.round(v)} spm`} kleur="bg-amber-500" />
            </Card>
          </>
        )}

        {!laden && recenteSessies.length > 0 && (
          <Card className="p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Recente trainingen</p>
            <div className="flex flex-col gap-3">
              {recenteSessies.map(s => (
                <div key={s.id} className="flex items-center justify-between border-t border-coach-border pt-3 first:border-0 first:pt-0">
                  <div>
                    <p className="text-sm text-white font-medium">{formatDatumKort(s.datum)} — {formatAfstand(s.afstand_m)}</p>
                    <p className="text-xs text-slate-500">
                      {formatDuur(s.duur_min)}
                      {' · '}{s.split_sec_per_500m ? formatSplit(s.split_sec_per_500m) : '—'}
                      {' · '}{s.gemiddelde_slagfrequentie !== null ? `${s.gemiddelde_slagfrequentie} SPM` : 'SPM —'}
                      {' · '}{s.gemiddelde_hartslag !== null ? `HR ${s.gemiddelde_hartslag}` : 'HR —'}
                    </p>
                  </div>
                  <span className="text-[9px] font-semibold tracking-wide text-slate-400 bg-white/5 rounded-full px-2 py-1 whitespace-nowrap">
                    {bronLabel(s.bron)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* v2.4.310: Records — hele sessies rond een standaard
            testafstand, geen lap-extractie zoals bij Running. Alleen
            Concept2-sessies (metrics.precieze_duur_sec), zie de
            module-comment in rowing-grafieken.ts. */}
        {!laden && records.length > 0 && (
          <Card className="p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Persoonlijke records</p>
            <p className="text-[10px] text-slate-600 mb-3">Op basis van hele sessies die (bijna) exact een testafstand waren — alleen via Concept2 gesynchroniseerde sessies.</p>
            <div className="flex flex-col gap-2">
              {records.map(r => {
                const label = TESTAFSTANDEN_MET_LABEL.find(([m]) => m === r.afstand_m)?.[1] || `${r.afstand_m}m`
                return (
                  <div key={r.afstand_m} className="flex items-center justify-between text-sm border-t border-coach-border pt-2 first:border-0 first:pt-0">
                    <span className="text-slate-400">{label}</span>
                    <div className="text-right">
                      <p className="text-white font-medium">{formatTijd(r.tijd_sec)}</p>
                      <p className="text-[10px] text-slate-600">{new Date(r.datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* v2.4.310: Progressie per testafstand — chronologische reeks
            i.p.v. alleen het record, zelfde bron als hierboven */}
        {!laden && TESTAFSTANDEN_MET_LABEL.some(([m]) => (afstandTrends[m] || []).length >= 2) && (
          <Card className="p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Progressie</p>
            <div className="flex flex-col gap-3">
              {TESTAFSTANDEN_MET_LABEL.map(([m, label]) => {
                const trend = afstandTrends[m] || []
                if (trend.length < 2) return null
                const eerste = trend[0], laatste = trend[trend.length - 1]
                const verbeterdSec = eerste.tijd_sec - laatste.tijd_sec
                return (
                  <div key={m} className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">{label}</span>
                    <span className={`font-medium ${verbeterdSec > 0 ? 'text-green-400' : verbeterdSec < 0 ? 'text-slate-300' : 'text-slate-400'}`}>
                      {formatTijd(laatste.tijd_sec)} {verbeterdSec !== 0 ? `(${verbeterdSec > 0 ? '−' : '+'}${formatTijd(Math.abs(verbeterdSec))})` : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {geenDataHelemaal && (
          <Card className="p-6 text-center">
            <p className="text-sm text-slate-400">Nog geen data — roei een paar keer om hier je Performance Center te zien vullen.</p>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
