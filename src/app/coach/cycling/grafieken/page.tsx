'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Info } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

// ── Grafieken-scherm — Cycling Specialist Roadmap v1.0, Fase 2d ────────
// Geen nieuwe npm-dependency — staafdiagram via CSS, lijndiagram via
// native SVG. Bewust dependency-vrij, consistent met de rest van de app.

interface WeekVolume {
  week_start: string
  totaal_km: number
  totaal_minuten: number
  gemiddeld_watt: number | null
}

interface DagelijkseBelasting {
  datum: string
  geschatte_tss: number
  ctl: number
  atl: number
  tsb: number
}

interface CyclingRecords {
  langste_rit_km: { waarde: number; datum: string } | null
  langste_rit_minuten: { waarde: number; datum: string } | null
  meeste_hoogtemeters: { waarde: number; datum: string } | null
  hoogste_vermogen: { waarde: number; datum: string } | null
  hoogste_gem_snelheid: { waarde: number; datum: string } | null
  grootste_week_km: { waarde: number; week_start: string } | null
}

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart)
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

// ── Simpel SVG-lijndiagram, geen dependency ─────────────────────────────
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

export default function GrafiekenPage() {
  const router = useRouter()
  const [laden, setLaden] = useState(true)
  const [volumes, setVolumes] = useState<WeekVolume[]>([])
  const [belasting, setBelasting] = useState<DagelijkseBelasting[]>([])
  const [records, setRecords] = useState<CyclingRecords | null>(null)

  useEffect(() => {
    fetch('/api/specialists/cycling/grafieken?weken=12', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setVolumes(data.wekelijkse_volumes || [])
        setBelasting(data.ctl_atl_tsb || [])
        setRecords(data.records || null)
      })
      .catch(() => {})
      .finally(() => setLaden(false))
  }, [])

  const maxKm = Math.max(...volumes.map(v => v.totaal_km), 1)
  const huidigeTsb = belasting.length > 0 ? belasting[belasting.length - 1].tsb : null

  const recordsItems = records ? [
    { label: 'Langste rit', waarde: records.langste_rit_km ? `${records.langste_rit_km.waarde} km` : null, datum: records.langste_rit_km?.datum },
    { label: 'Langste tijd', waarde: records.langste_rit_minuten ? `${records.langste_rit_minuten.waarde} min` : null, datum: records.langste_rit_minuten?.datum },
    { label: 'Meeste hoogtemeters', waarde: records.meeste_hoogtemeters ? `${records.meeste_hoogtemeters.waarde} m` : null, datum: records.meeste_hoogtemeters?.datum },
    { label: 'Hoogste vermogen', waarde: records.hoogste_vermogen ? `${records.hoogste_vermogen.waarde} W` : null, datum: records.hoogste_vermogen?.datum },
    { label: 'Hoogste gem. snelheid', waarde: records.hoogste_gem_snelheid ? `${records.hoogste_gem_snelheid.waarde} km/u` : null, datum: records.hoogste_gem_snelheid?.datum },
    { label: 'Grootste week', waarde: records.grootste_week_km ? `${records.grootste_week_km.waarde} km` : null, datum: records.grootste_week_km?.week_start },
  ].filter((item): item is { label: string; waarde: string; datum: string | undefined } => item.waarde !== null) : []

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/coach/cycling')} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">Grafieken</h1>
            <p className="text-xs text-slate-500">Laatste 12 weken</p>
          </div>
        </div>

        {laden && (
          <div className="flex flex-col gap-3">
            <div className="h-40 bg-slate-800/50 rounded-2xl animate-pulse" />
            <div className="h-40 bg-slate-800/50 rounded-2xl animate-pulse" />
          </div>
        )}

        {!laden && volumes.length === 0 && belasting.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-sm text-slate-400">Nog onvoldoende data voor grafieken.</p>
          </Card>
        )}

        {!laden && volumes.length > 0 && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Wekelijks volume (km)</p>
            <div className="flex items-end gap-1.5" style={{ height: 128 }}>
              {volumes.map(v => {
                // v2.4.104: pixel-hoogte i.p.v. percentage — percentage-
                // hoogte binnen geneste flex-containers resolvet niet
                // betrouwbaar (de kolom-wrapper had geen expliciete
                // hoogte om het percentage tegenaan te berekenen)
                const barHoogtePx = Math.max(4, Math.round((v.totaal_km / maxKm) * 128))
                return (
                  <div key={v.week_start} className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: 128 }}>
                    <div className="w-full bg-primary-500/70 rounded-t-sm" style={{ height: barHoogtePx }} />
                    <span className="text-[8px] text-slate-600">{formatWeekLabel(v.week_start)}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {!laden && belasting.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Trainingsbelasting</p>
              {huidigeTsb !== null && (
                <span className={`text-xs font-semibold ${huidigeTsb < -10 ? 'text-red-400' : huidigeTsb > 10 ? 'text-green-400' : 'text-slate-400'}`}>
                  Vorm: {huidigeTsb > 0 ? '+' : ''}{huidigeTsb}
                </span>
              )}
            </div>
            <div className="flex items-start gap-1.5 mb-3 mt-3 p-2 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <Info size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-400/90 leading-relaxed">
                Geschat op basis van gemiddeld vermogen (geen Normalized Power beschikbaar) — nauwkeurig bij gelijkmatige ritten, minder bij wisselende inspanning.
              </p>
            </div>
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

        {!laden && recordsItems.length > 0 && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Records</p>
            <p className="text-[10px] text-slate-600 mb-3">Gebaseerd op wat per rit is opgeslagen — geen duur-specifieke records (bijv. &quot;beste 5 minuten&quot;) zonder vermogenscurve-data.</p>
            <div className="flex flex-col gap-3">
              {recordsItems.map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{item.label}</span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{item.waarde}</p>
                    {item.datum && <p className="text-[10px] text-slate-600">{new Date(item.datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {!laden && belasting.length === 0 && !laden && (
          <Card className="p-5">
            <p className="text-sm text-slate-400">Geen FTP ingesteld — trainingsbelasting kan niet geschat worden. Vul je FTP in via <button onClick={() => router.push('/settings/cycling-profile')} className="text-primary-400 underline">Cycling Profile</button>.</p>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
