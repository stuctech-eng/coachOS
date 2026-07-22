'use client'
import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import Link from 'next/link'

// ── Running Grafieken-scherm — Fase 2 (Professional) ────────────────────
// Bron: overleg 22 juli 2026. Spiegelt coach/cycling/grafieken/page.tsx —
// zelfde dependency-vrije SVG-aanpak, maar pace/hartslag/cadans i.p.v.
// vermogen. Alle onderliggende data bestond al (running-grafieken.ts),
// nooit eerder samengevoegd achter één scherm.

interface WekelijkseTrend { week_start: string; gemiddelde_pace_sec_per_km: number | null; gemiddelde_hartslag: number | null; gemiddelde_cadans: number | null }
interface DagelijkseBelasting { datum: string; geschatte_tss: number; ctl: number; atl: number; tsb: number }
interface AfstandRecord { afstand_m: number; tijd_sec: number; datum: string }
interface AfstandTrendPunt { datum: string; tijd_sec: number }

function formatWeekLabel(weekStart: string): string {
  return new Date(weekStart).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}
function formatPace(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${min}:${sec.toString().padStart(2, '0')}/km`
}
function formatTijd(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`
}
function afstandLabel(m: number): string {
  if (m >= 1000) return `${(m / 1000).toString().replace('.', ',')} km`
  return `${m} m`
}

const AFSTANDEN_MET_LABEL: [number, string][] = [
  [5000, '5 km'], [10000, '10 km'], [21097, 'Halve marathon'], [42195, 'Marathon'],
]

// ── Simpel SVG-lijndiagram, geen dependency — zelfde patroon als Cycling ──
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

// ── Simpele staafdiagram voor de wekelijkse trend, via CSS ───────────────
function StaafGrafiek({ data, veld, formatter, kleur = 'bg-primary-500' }: {
  data: WekelijkseTrend[]; veld: 'gemiddelde_pace_sec_per_km' | 'gemiddelde_hartslag' | 'gemiddelde_cadans'
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

export default function RunningGrafiekenPage() {
  const [laden, setLaden] = useState(true)
  const [wekelijkseTrend, setWekelijkseTrend] = useState<WekelijkseTrend[]>([])
  const [ctlAtlTsb, setCtlAtlTsb] = useState<DagelijkseBelasting[]>([])
  const [records, setRecords] = useState<AfstandRecord[]>([])
  const [afstandTrends, setAfstandTrends] = useState<Record<number, AfstandTrendPunt[]>>({})

  useEffect(() => {
    fetch('/api/specialists/running/grafieken?weken=12', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setWekelijkseTrend(data.wekelijkse_trend || [])
        setCtlAtlTsb(data.ctl_atl_tsb || [])
        setRecords(data.records || [])
        setAfstandTrends(data.afstand_trends || {})
      })
      .catch(() => {})
      .finally(() => setLaden(false))
  }, [])

  const laatsteTsb = ctlAtlTsb.length > 0 ? ctlAtlTsb[ctlAtlTsb.length - 1] : null

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link href={'/coach/running'} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Grafieken</h1>
            <p className="text-xs text-slate-500">Pace, hartslag, belasting — 12 weken</p>
          </div>
        </div>

        {laden && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-800/50 rounded-2xl animate-pulse" />)}
          </div>
        )}

        {!laden && (
          <>
            {/* Trainingsbelasting */}
            {laatsteTsb && (
              <Card className="p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Trainingsbelasting</p>
                <p className="text-[10px] text-slate-600 mb-3">Geschatte TSS — geen Normalized Power-achtig gegeven beschikbaar bij hardlopen, dit is een schatting op basis van gemiddelde snelheid.</p>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div><p className="text-xs text-slate-500">CTL</p><p className="text-lg font-bold text-white">{laatsteTsb.ctl}</p></div>
                  <div><p className="text-xs text-slate-500">ATL</p><p className="text-lg font-bold text-white">{laatsteTsb.atl}</p></div>
                  <div><p className="text-xs text-slate-500">TSB</p><p className="text-lg font-bold text-white">{laatsteTsb.tsb}</p></div>
                </div>
                <LijnGrafiek data={ctlAtlTsb} lijnen={[{ key: 'ctl', kleur: '#3b82f6', label: 'CTL (fitness)' }, { key: 'atl', kleur: '#f43f5e', label: 'ATL (vermoeidheid)' }]} />
              </Card>
            )}

            {/* Wekelijkse trend */}
            <Card className="p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Gemiddelde pace per week</p>
              <StaafGrafiek data={wekelijkseTrend} veld="gemiddelde_pace_sec_per_km" formatter={formatPace} kleur="bg-primary-500" />
            </Card>
            <Card className="p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Gemiddelde hartslag per week</p>
              <StaafGrafiek data={wekelijkseTrend} veld="gemiddelde_hartslag" formatter={v => `${Math.round(v)} bpm`} kleur="bg-red-500" />
            </Card>
            <Card className="p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Gemiddelde cadans per week</p>
              <StaafGrafiek data={wekelijkseTrend} veld="gemiddelde_cadans" formatter={v => `${Math.round(v)} spm`} kleur="bg-amber-500"  />
            </Card>

            {/* Progressie per kernafstand */}
            {AFSTANDEN_MET_LABEL.some(([m]) => (afstandTrends[m] || []).length >= 2) && (
              <Card className="p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Progressie</p>
                <div className="flex flex-col gap-3">
                  {AFSTANDEN_MET_LABEL.map(([m, label]) => {
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

            {/* Volledige records-lijst */}
            {records.length > 0 && (
              <Card className="p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Persoonlijke records</p>
                <div className="flex flex-col gap-2">
                  {records.map(r => (
                    <div key={r.afstand_m} className="flex items-center justify-between text-sm border-t border-coach-border pt-2 first:border-0 first:pt-0">
                      <span className="text-slate-400">{afstandLabel(r.afstand_m)}</span>
                      <div className="text-right">
                        <p className="text-white font-medium">{formatTijd(r.tijd_sec)}</p>
                        <p className="text-[10px] text-slate-600">{formatPace(r.tijd_sec / (r.afstand_m / 1000))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {wekelijkseTrend.length === 0 && ctlAtlTsb.length === 0 && records.length === 0 && (
              <Card className="p-6 text-center">
                <p className="text-sm text-slate-400">Nog geen data — loop een paar keer om hier grafieken te zien verschijnen.</p>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
