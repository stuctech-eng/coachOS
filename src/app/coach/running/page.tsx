'use client'
import { useState, useEffect } from 'react'
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Minus, Settings } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import Link from 'next/link'

// ── Running Hub — v2.4.83, tweede specialist ────────────────────────────
// Exact spiegelbeeld van coach/cycling/page.tsx (v2.4.68/70). Bevestigt
// dat de Hub-structuur zelf al herbruikbaar was — enige verschil is
// "vermogen" → "snelheid" (running heeft doorgaans geen vermogensmeter).

interface RunningAdvies {
  samenvatting: string
  sterke_punten: string
  aandachtspunten: string
  advies: string
  generated_at: string
}

interface RunningEngineResultaat {
  trainingsfrequentie: { aantal_deze_periode: number; aantal_vorige_periode: number; trend: 'stijgend' | 'stabiel' | 'dalend' }
  snelheid: { gemiddelde_snelheid: number | null; max_snelheid: number | null; trend_pct: number | null }
  afstand: { totaal_km: number; gemiddeld_km_per_activiteit: number | null }
  trainingsbelasting: { totale_minuten: number; score: 'laag' | 'gemiddeld' | 'hoog' }
}

interface RunningDashboard {
  week_km: number
  maand_km: number
  jaar_km: number
  trainingen_deze_week: number
  gemiddelde_pace_sec_per_km: number | null
  gemiddelde_hartslag: number | null
  gemiddelde_cadans: number | null
  hoogtemeters: number
  trainingstijd_minuten: number
  langste_duurloop: { minuten: number; datum: string } | null
  snelste_training: { pace_sec_per_km: number; datum: string } | null
}

interface AfstandRecord {
  afstand_m: number
  tijd_sec: number
  datum: string
}

// Leesbare labels voor de standaard-doelafstanden — zelfde lijst als
// afstandscurve.ts::STANDAARD_DOELAFSTANDEN
const AFSTAND_LABELS: Record<number, string> = {
  100: '100 m', 200: '200 m', 400: '400 m', 800: '800 m', 1000: '1 km',
  1609: '1 mile', 3000: '3 km', 5000: '5 km', 10000: '10 km', 15000: '15 km',
  16093: '10 mile', 21097: 'Halve marathon', 25000: '25 km', 30000: '30 km', 42195: 'Marathon',
}

function formatteerTijd(sec: number): string {
  const uren = Math.floor(sec / 3600)
  const minuten = Math.floor((sec % 3600) / 60)
  const seconden = Math.round(sec % 60)
  if (uren > 0) return `${uren}:${String(minuten).padStart(2, '0')}:${String(seconden).padStart(2, '0')}`
  return `${minuten}:${String(seconden).padStart(2, '0')}`
}

function formatteerPace(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${min}:${String(sec).padStart(2, '0')}`
}

function TrendIcoon({ trend }: { trend: 'stijgend' | 'stabiel' | 'dalend' }) {
  if (trend === 'stijgend') return <TrendingUp size={14} className="text-green-400" />
  if (trend === 'dalend') return <TrendingDown size={14} className="text-red-400" />
  return <Minus size={14} className="text-slate-400" />
}

export default function RunningHubPage() {
  const [laden, setLaden] = useState(true)
  const [advies, setAdvies] = useState<RunningAdvies | null>(null)
  const [engineData, setEngineData] = useState<RunningEngineResultaat | null>(null)
  const [verversen, setVerversen] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [dormant, setDormant] = useState(false)
  const [dashboard, setDashboard] = useState<RunningDashboard | null>(null)
  const [records, setRecords] = useState<AfstandRecord[]>([])

  async function laadAlles() {
    setLaden(true)
    setFout(null)
    try {
      const [adviesRes, engineRes, specialistenRes, dashboardRes] = await Promise.all([
        fetch('/api/specialists/running/coach', { credentials: 'include' }),
        fetch('/api/specialists/running/engine?period_days=90', { credentials: 'include' }),
        fetch('/api/specialists', { credentials: 'include' }),
        fetch('/api/specialists/running/dashboard', { credentials: 'include' }).catch(() => null),
      ])
      const adviesData = await adviesRes.json()
      const engineDataRes = await engineRes.json()
      const specialistenData = await specialistenRes.json()

      if (adviesData?.analysis) setAdvies(adviesData.analysis)
      if (engineDataRes?.resultaat) setEngineData(engineDataRes.resultaat)
      if (dashboardRes) {
        const dashboardData = await dashboardRes.json()
        if (dashboardData?.dashboard) setDashboard(dashboardData.dashboard)
        if (dashboardData?.records) setRecords(dashboardData.records)
      }

      const runningEntry = (specialistenData.specialisten || []).find((s: { specialist_type: string }) => s.specialist_type === 'running')
      setDormant(runningEntry?.lifecycle?.state === 'DORMANT')
    } catch (e) {
      setFout((e as Error).message)
    } finally {
      setLaden(false)
    }
  }

  async function genereerNieuwAdvies() {
    setVerversen(true)
    setFout(null)
    try {
      const res = await fetch('/api/specialists/running/coach', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_days: 90 }),
      })
      const data = await res.json()
      if (data?.analysis) setAdvies(data.analysis)
      else if (data?.error) setFout(data.error)
    } catch (e) {
      setFout((e as Error).message)
    } finally {
      setVerversen(false)
    }
  }

  useEffect(() => { laadAlles() }, [])

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link href={'/specialisten'} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">Running Coach</h1>
            <p className="text-xs text-slate-500">Specialist-hub · laatste 90 dagen</p>
          </div>
          {/* v2.4.126: link naar Running Profile — Roadmap v1.0 Fase 1 */}
          <Link href="/settings/running-profile" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <Settings size={16} className="text-slate-400" />
          </Link>
        </div>

        {!laden && dormant && (
          <Card className="p-4 bg-slate-800/40 border-slate-700/50">
            <p className="text-xs text-slate-400">
              Momenteel geen recente hardloopactiviteiten. Je geschiedenis en
              analyses blijven gewoon bewaard — zodra je weer hardloopt,
              pakken we het samen op.
            </p>
          </Card>
        )}

        {laden && (
          <div className="flex flex-col gap-3">
            <div className="h-24 bg-slate-800/50 rounded-2xl animate-pulse" />
            <div className="h-32 bg-slate-800/50 rounded-2xl animate-pulse" />
          </div>
        )}

        {/* v2.4.127: Dashboard — Roadmap v1.0 Fase 1. Bewust los van het
            AI-advies hieronder getoond (die kan leeg zijn als er nog geen
            analyse gegenereerd is), zodat kengetallen altijd meteen
            zichtbaar zijn zodra er hardloopdata is. */}
        {!laden && dashboard && (dashboard.jaar_km > 0 || dashboard.trainingstijd_minuten > 0) && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Dashboard</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Week</p>
                <p className="text-lg font-bold text-white">{dashboard.week_km}<span className="text-xs text-slate-500 font-normal"> km</span></p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Maand</p>
                <p className="text-lg font-bold text-white">{dashboard.maand_km}<span className="text-xs text-slate-500 font-normal"> km</span></p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Jaar</p>
                <p className="text-lg font-bold text-white">{dashboard.jaar_km}<span className="text-xs text-slate-500 font-normal"> km</span></p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Gem. pace</p>
                <p className="text-sm font-semibold text-white">{dashboard.gemiddelde_pace_sec_per_km ? `${formatteerPace(dashboard.gemiddelde_pace_sec_per_km)}/km` : '–'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Gem. HR</p>
                <p className="text-sm font-semibold text-white">{dashboard.gemiddelde_hartslag ? `${dashboard.gemiddelde_hartslag} bpm` : '–'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Gem. cadans</p>
                <p className="text-sm font-semibold text-white">{dashboard.gemiddelde_cadans ? `${dashboard.gemiddelde_cadans} spm` : '–'}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-3 border-t border-coach-border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Deze week</span>
                <span className="text-sm font-semibold text-white">{dashboard.trainingen_deze_week} training{dashboard.trainingen_deze_week !== 1 ? 'en' : ''}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Hoogtemeters (jaar)</span>
                <span className="text-sm font-semibold text-white">{dashboard.hoogtemeters} m</span>
              </div>
              {dashboard.langste_duurloop && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Langste duurloop</span>
                  <span className="text-sm font-semibold text-white">{dashboard.langste_duurloop.minuten} min</span>
                </div>
              )}
              {dashboard.snelste_training && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Snelste training</span>
                  <span className="text-sm font-semibold text-white">{formatteerPace(dashboard.snelste_training.pace_sec_per_km)}/km</span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* v2.4.128: Records — Roadmap v1.0 Fase 1, laatste stap. Alleen
            afstanden tonen waar daadwerkelijk data voor is — geen lege
            rijen voor bijv. 100m/200m die de meeste gebruikers nooit met
            genoeg GPS-nauwkeurigheid zullen halen. */}
        {!laden && records.length > 0 && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Records</p>
            <p className="text-[10px] text-slate-600 mb-3">Snelste tijd per afstand, over al je Garmin-geïmporteerde runs sinds v2.4.128. Korte afstanden (100-400m) verschijnen alleen bij baan-precisie GPS of een footpod.</p>
            <div className="flex flex-col gap-2.5">
              {records.map(r => (
                <div key={r.afstand_m} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{AFSTAND_LABELS[r.afstand_m] || `${r.afstand_m} m`}</span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{formatteerTijd(r.tijd_sec)}</p>
                    <p className="text-[10px] text-slate-600">{new Date(r.datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {!laden && fout && (
          <Card className="p-5 bg-red-500/5 border-red-500/20">
            <p className="text-sm text-red-400">{fout}</p>
          </Card>
        )}

        {!laden && !advies && !fout && (
          <Card className="p-6 text-center">
            <p className="text-sm text-slate-400 mb-4">Nog geen hardloop-analyse gegenereerd.</p>
            <button onClick={genereerNieuwAdvies} disabled={verversen}
              className="px-5 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {verversen ? 'Bezig...' : 'Genereer je eerste analyse'}
            </button>
          </Card>
        )}

        {!laden && advies && (
          <>
            <Card className="p-5 bg-primary-500/10 border-primary-500/20">
              <p className="text-sm text-white leading-relaxed">{advies.samenvatting}</p>
            </Card>

            {engineData && (
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4">
                  <p className="text-xs text-slate-500 mb-1">Frequentie</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xl font-bold text-white">{engineData.trainingsfrequentie.aantal_deze_periode}</p>
                    <TrendIcoon trend={engineData.trainingsfrequentie.trend} />
                  </div>
                  <p className="text-xs text-slate-600">runs</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-slate-500 mb-1">Snelheid</p>
                  <p className="text-xl font-bold text-white">{engineData.snelheid.gemiddelde_snelheid ?? '–'}</p>
                  <p className="text-xs text-slate-600">{engineData.snelheid.max_snelheid ? `max ${engineData.snelheid.max_snelheid}` : 'gemiddeld'}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-slate-500 mb-1">Afstand</p>
                  <p className="text-xl font-bold text-white">{engineData.afstand.totaal_km}</p>
                  <p className="text-xs text-slate-600">km totaal</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-slate-500 mb-1">Belasting</p>
                  <p className="text-xl font-bold text-white capitalize">{engineData.trainingsbelasting.score}</p>
                  <p className="text-xs text-slate-600">{engineData.trainingsbelasting.totale_minuten} min totaal</p>
                </Card>
              </div>
            )}

            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Sterke punten</p>
              <p className="text-sm text-slate-200 leading-relaxed">{advies.sterke_punten}</p>
            </Card>

            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Aandachtspunten</p>
              <p className="text-sm text-slate-200 leading-relaxed">{advies.aandachtspunten}</p>
            </Card>

            <Card className="p-5 bg-green-500/5 border-green-500/20">
              <p className="text-xs text-green-400 uppercase tracking-wider mb-2">Advies</p>
              <p className="text-sm text-slate-200 leading-relaxed">{advies.advies}</p>
            </Card>

            <button onClick={genereerNieuwAdvies} disabled={verversen}
              className="w-full py-3 bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              <RefreshCw size={14} className={verversen ? 'animate-spin' : ''} />
              {verversen ? 'Bezig...' : 'Ververs analyse'}
            </button>
            <p className="text-xs text-slate-600 text-center -mt-2">
              Max. 1x per 24 uur een nieuwe analyse — binnen die tijd krijg je de bestaande terug.
            </p>
          </>
        )}
      </div>
    </AppShell>
  )
}
