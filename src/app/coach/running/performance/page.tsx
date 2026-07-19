'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

// ── Running Performance Center — Roadmap v1.0, Fase 2, eerste levering ──
// Bron: overleg 19 juli 2026. BEWUST GEEN nieuwe SQL, nieuwe API-routes
// of nieuwe berekeningen — dit is uitsluitend een samenvoeging van twee
// al-bestaande endpoints tot één analysecentrum, zelfde aanpak als
// Cycling's Power Center (v2.4.118):
//   - /api/specialists/running/profile   → VDOT, Pace Zones, Hartslagzones
//   - /api/specialists/running/dashboard → Dashboard-kengetallen + Records
//
// Pace Curve is GEEN nieuwe data — het is de Records-data (afstandscurve,
// v2.4.128) als grafiek getoond i.p.v. een lijst. "Persoonlijke records"
// en "Pace Curve" uit de Master Spec zijn dezelfde onderliggende data,
// twee weergaven.
//
// FUNDAMENT, GEEN EINDPUNT: Trainingsbelasting, Progressie en andere
// Fase 2/3-onderdelen krijgen later een eigen sectie hier.

interface PaceZone {
  naam: string
  pct_van: number
  pct_tot: number | null
  pace_van_sec_per_km: number
  pace_tot_sec_per_km: number
}
interface HartslagZone { zone: number; naam: string; van_pct: number; tot_pct: number; van_bpm: number; tot_bpm: number }
interface AfstandRecord { afstand_m: number; tijd_sec: number; datum: string }
interface RunningDashboard {
  gemiddelde_pace_sec_per_km: number | null
  gemiddelde_hartslag: number | null
  gemiddelde_cadans: number | null
  hoogtemeters: number
}
interface DagelijkseBelasting { datum: string; geschatte_tss: number; ctl: number; atl: number; tsb: number }
interface AfstandTrendPunt { datum: string; tijd_sec: number }
interface WekelijkseRunningTrend { week_start: string; gemiddelde_pace_sec_per_km: number | null; gemiddelde_hartslag: number | null; gemiddelde_cadans: number | null }

const AFSTAND_TREND_LABELS: Record<number, string> = { 5000: '5 km', 10000: '10 km', 21097: 'Halve marathon', 42195: 'Marathon' }

function TrendIcoon({ trend }: { trend: 'stijgend' | 'stabiel' | 'dalend' }) {
  if (trend === 'stijgend') return <TrendingUp size={14} className="text-green-400" />
  if (trend === 'dalend') return <TrendingDown size={14} className="text-red-400" />
  return <Minus size={14} className="text-slate-400" />
}

const AFSTAND_LABELS: Record<number, string> = {
  100: '100m', 200: '200m', 400: '400m', 800: '800m', 1000: '1km',
  1609: '1mi', 3000: '3km', 5000: '5km', 10000: '10km', 15000: '15km',
  16093: '10mi', 21097: 'Halve', 25000: '25km', 30000: '30km', 42195: 'Marathon',
}

function formatteerPace(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${min}:${String(sec).padStart(2, '0')}`
}

function formatteerTijd(sec: number): string {
  const uren = Math.floor(sec / 3600)
  const minuten = Math.floor((sec % 3600) / 60)
  const seconden = Math.round(sec % 60)
  if (uren > 0) return `${uren}:${String(minuten).padStart(2, '0')}:${String(seconden).padStart(2, '0')}`
  return `${minuten}:${String(seconden).padStart(2, '0')}`
}

// Zelfde SVG-lijndiagram-component als coach/cycling/grafieken/page.tsx
// — geen dependency, consistent met de rest van de app.
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
    <svg viewBox={`0 0 ${breedte} ${hoogte}`} className="w-full" style={{ height: hoogte }}>
      {lijnen.map(l => (
        <polyline key={l.key} points={puntenVoor(l.key)} fill="none" stroke={l.kleur} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      ))}
    </svg>
  )
}

export default function RunningPerformanceCenterPage() {
  const [laden, setLaden] = useState(true)
  const [vdot, setVdot] = useState<number | null>(null)
  const [pacezones, setPacezones] = useState<PaceZone[] | null>(null)
  const [hartslagzones, setHartslagzones] = useState<HartslagZone[] | null>(null)
  const [records, setRecords] = useState<AfstandRecord[]>([])
  const [dashboard, setDashboard] = useState<RunningDashboard | null>(null)
  const [belasting, setBelasting] = useState<DagelijkseBelasting[]>([])
  const [afstandTrends, setAfstandTrends] = useState<Record<number, AfstandTrendPunt[]>>({})
  const [wekelijkseTrend, setWekelijkseTrend] = useState<WekelijkseRunningTrend[]>([])

  useEffect(() => {
    async function laadAlles() {
      setLaden(true)
      try {
        const [profielRes, dashboardRes] = await Promise.all([
          fetch('/api/specialists/running/profile', { credentials: 'include' }),
          fetch('/api/specialists/running/dashboard', { credentials: 'include' }),
        ])
        const profielData = await profielRes.json()
        const dashboardData = await dashboardRes.json()

        setVdot(profielData?.vdot ?? null)
        setPacezones(profielData?.pacezones || null)
        setHartslagzones(profielData?.hartslagzones || null)
        setRecords(dashboardData?.records || [])
        setDashboard(dashboardData?.dashboard || null)
        setBelasting(dashboardData?.belasting || [])
        setAfstandTrends(dashboardData?.afstand_trends || {})
        setWekelijkseTrend(dashboardData?.wekelijkse_trend || [])
      } catch {
        // Elke sectie checkt zelf op aanwezige data — geen aparte
        // globale foutstaat nodig
      } finally {
        setLaden(false)
      }
    }
    laadAlles()
  }, [])

  // Pace Curve: snelheid (m/s) als basis voor bar-hoogte — zelfde
  // visuele taal als de Cycling-vermogenscurve (korte afstand = hoge
  // snelheid = hoge balk)
  const curvePunten = records.map(r => ({ ...r, snelheidMps: r.afstand_m / r.tijd_sec }))
  const maxSnelheid = curvePunten.length > 0 ? Math.max(...curvePunten.map(p => p.snelheidMps)) : 1

  const geenDataHelemaal = !laden && !vdot && records.length === 0 && !dashboard

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href="/coach/running" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Performance Center</h1>
            <p className="text-xs text-slate-500">VDOT, Pace Curve, records &amp; zones</p>
          </div>
        </div>

        {laden && (
          <div className="flex flex-col gap-3">
            <div className="h-24 bg-slate-800/50 rounded-2xl animate-pulse" />
            <div className="h-40 bg-slate-800/50 rounded-2xl animate-pulse" />
            <div className="h-32 bg-slate-800/50 rounded-2xl animate-pulse" />
          </div>
        )}

        {geenDataHelemaal && (
          <Card className="p-6 text-center">
            <p className="text-sm text-slate-400 mb-4">Nog geen race-resultaat ingevuld en geen hardloopdata beschikbaar.</p>
            <Link href="/settings/running-profile"
              className="inline-block px-5 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold">
              Running Profile instellen
            </Link>
          </Card>
        )}

        {/* 1. Overzicht */}
        {!laden && (vdot || dashboard) && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Overzicht</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">VDOT</p>
                <p className="text-2xl font-bold text-white">{vdot ?? '–'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Gem. pace</p>
                <p className="text-2xl font-bold text-white">
                  {dashboard?.gemiddelde_pace_sec_per_km ? `${formatteerPace(dashboard.gemiddelde_pace_sec_per_km)}` : '–'}
                  <span className="text-xs text-slate-500 font-normal"> /km</span>
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* 2. Pace Curve */}
        {!laden && curvePunten.length > 0 && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Pace Curve</p>
            <p className="text-[10px] text-slate-600 mb-4">All-time snelste tijd per afstand, over al je Garmin-geïmporteerde runs sinds v2.4.128.</p>
            <div className="flex items-end gap-1" style={{ height: 110 }}>
              {curvePunten.map(punt => {
                const barHoogtePx = Math.max(4, Math.round((punt.snelheidMps / maxSnelheid) * 90))
                const paceSecPerKm = punt.tijd_sec / (punt.afstand_m / 1000)
                return (
                  <div key={punt.afstand_m} className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: 110 }}>
                    <span className="text-[8px] text-slate-400 font-medium">{formatteerPace(paceSecPerKm)}</span>
                    <div className="w-full bg-amber-500/70 rounded-t-sm" style={{ height: barHoogtePx }} />
                    <span className="text-[8px] text-slate-600">{AFSTAND_LABELS[punt.afstand_m] || `${punt.afstand_m}m`}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* 2b. Trainingsbelasting — Fase 2, tweede levering. Zelfde
            Coggan-methode als Cycling, snelheid-gebaseerde Intensity
            Factor i.p.v. vermogen-gebaseerd. */}
        {!laden && belasting.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Trainingsbelasting</p>
              {belasting.length > 0 && (
                <span className={`text-xs font-semibold ${belasting[belasting.length - 1].tsb < -10 ? 'text-red-400' : belasting[belasting.length - 1].tsb > 10 ? 'text-green-400' : 'text-slate-400'}`}>
                  Vorm: {belasting[belasting.length - 1].tsb > 0 ? '+' : ''}{belasting[belasting.length - 1].tsb}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-600 mb-3">Geschat op basis van gemiddelde snelheid t.o.v. je drempelsnelheid (uit VDOT) — minder nauwkeurig bij heuvelachtig terrein of intervaltraining.</p>
            <LijnGrafiek data={belasting} lijnen={[
              { key: 'ctl', kleur: '#3b82f6', label: 'Fitness (CTL)' },
              { key: 'atl', kleur: '#f59e0b', label: 'Vermoeidheid (ATL)' },
            ]} />
            <div className="flex gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[10px] text-slate-500">Fitness (CTL)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[10px] text-slate-500">Vermoeidheid (ATL)</span>
              </div>
            </div>
          </Card>
        )}
        {!laden && belasting.length === 0 && vdot && (
          <Card className="p-5">
            <p className="text-sm text-slate-400">Trainingsbelasting kan nog niet berekend worden — nog geen hardloopactiviteiten in de laatste periode.</p>
          </Card>
        )}

        {/* 2c. Progressie — Fase 2, derde levering. Afstand-trends
            hergebruiken running_distance_records (elke poging, niet
            alleen het record), wekelijkse trend hergebruikt hetzelfde
            aggregatiepatroon als het Dashboard. */}
        {!laden && Object.keys(afstandTrends).some(k => afstandTrends[Number(k)].length >= 2) && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Progressie — race-afstanden</p>
            <p className="text-[10px] text-slate-600 mb-3">Alleen afstanden met 2+ pogingen getoond — anders geen trend te bepalen.</p>
            <div className="flex flex-col gap-3">
              {[5000, 10000, 21097, 42195].map(afstand => {
                const punten = afstandTrends[afstand]
                if (!punten || punten.length < 2) return null
                const laatste = punten[punten.length - 1]
                const vorige = punten[punten.length - 2]
                const trend: 'stijgend' | 'stabiel' | 'dalend' = laatste.tijd_sec < vorige.tijd_sec ? 'stijgend' : laatste.tijd_sec > vorige.tijd_sec ? 'dalend' : 'stabiel'
                return (
                  <div key={afstand} className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{AFSTAND_TREND_LABELS[afstand]}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-white">{formatteerTijd(laatste.tijd_sec)}</span>
                      <TrendIcoon trend={trend} />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-[9px] text-slate-600 mt-3">↑ groen = sneller dan de vorige poging op deze afstand.</p>
          </Card>
        )}

        {!laden && wekelijkseTrend.length > 1 && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Progressie — wekelijkse pace</p>
            <p className="text-[10px] text-slate-600 mb-3">Laatste 12 weken.</p>
            <div className="flex items-end gap-1" style={{ height: 90 }}>
              {(() => {
                const paces = wekelijkseTrend.filter(w => w.gemiddelde_pace_sec_per_km !== null).map(w => w.gemiddelde_pace_sec_per_km as number)
                if (paces.length === 0) return null
                const snelste = Math.min(...paces) // lager = sneller = hogere balk
                const langzaamste = Math.max(...paces)
                const bereik = langzaamste - snelste || 1
                return wekelijkseTrend.map(w => {
                  const pace = w.gemiddelde_pace_sec_per_km
                  const barHoogtePx = pace !== null ? Math.max(4, Math.round((1 - (pace - snelste) / bereik) * 70) + 10) : 4
                  return (
                    <div key={w.week_start} className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: 90 }}>
                      <div className={`w-full rounded-t-sm ${pace !== null ? 'bg-primary-500/70' : 'bg-slate-800'}`} style={{ height: barHoogtePx }} />
                    </div>
                  )
                })
              })()}
            </div>
            <p className="text-[9px] text-slate-600 mt-2">Hogere balk = sneller gemiddeld tempo die week.</p>
          </Card>
        )}

        {/* 3. Persoonlijke records */}
        {!laden && records.length > 0 && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Persoonlijke records</p>
            <div className="flex flex-col gap-2.5">
              {records.map(r => (
                <div key={r.afstand_m} className="flex items-start justify-between gap-3">
                  <span className="text-sm text-slate-300 flex-1 min-w-0">{AFSTAND_LABELS[r.afstand_m] || `${r.afstand_m} m`}</span>
                  <span className="text-sm font-semibold text-white whitespace-nowrap flex-shrink-0">{formatteerTijd(r.tijd_sec)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 4. Pace Zones */}
        {!laden && pacezones && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Pace Zones</p>
            <p className="text-[10px] text-slate-600 mb-3">Daniels/Gilbert VDOT-model.</p>
            <div className="flex flex-col gap-2.5">
              {pacezones.map(zone => (
                <div key={zone.naam} className="flex items-start justify-between gap-3">
                  <span className="text-sm text-slate-300 flex-1 min-w-0">{zone.naam}</span>
                  <span className="text-sm font-semibold text-white whitespace-nowrap flex-shrink-0">
                    {formatteerPace(zone.pace_van_sec_per_km)}–{formatteerPace(zone.pace_tot_sec_per_km)} /km
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 5. Hartslagzones */}
        {!laden && hartslagzones && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Hartslagzones</p>
            <div className="flex flex-col gap-2.5">
              {hartslagzones.map(z => (
                <div key={z.zone} className="flex items-start justify-between gap-3">
                  <span className="text-sm text-slate-300 flex-1 min-w-0">Z{z.zone} — {z.naam}</span>
                  <span className="text-sm font-semibold text-white whitespace-nowrap flex-shrink-0">{z.van_bpm}–{z.tot_bpm} bpm</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 6. Cadans & hoogte — hergebruikt uit het Dashboard, geen
            nieuwe berekening */}
        {!laden && dashboard && (dashboard.gemiddelde_cadans || dashboard.hoogtemeters > 0) && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Cadans &amp; hoogte</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Gem. cadans</p>
                <p className="text-lg font-bold text-white">{dashboard.gemiddelde_cadans ? `${dashboard.gemiddelde_cadans}` : '–'}<span className="text-xs text-slate-500 font-normal"> spm</span></p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Hoogtemeters (jaar)</p>
                <p className="text-lg font-bold text-white">{dashboard.hoogtemeters}<span className="text-xs text-slate-500 font-normal"> m</span></p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
