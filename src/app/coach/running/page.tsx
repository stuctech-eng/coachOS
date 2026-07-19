'use client'
import { useState, useEffect } from 'react'
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
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

  async function laadAlles() {
    setLaden(true)
    setFout(null)
    try {
      const [adviesRes, engineRes, specialistenRes] = await Promise.all([
        fetch('/api/specialists/running/coach', { credentials: 'include' }),
        fetch('/api/specialists/running/engine?period_days=90', { credentials: 'include' }),
        fetch('/api/specialists', { credentials: 'include' }),
      ])
      const adviesData = await adviesRes.json()
      const engineDataRes = await engineRes.json()
      const specialistenData = await specialistenRes.json()

      if (adviesData?.analysis) setAdvies(adviesData.analysis)
      if (engineDataRes?.resultaat) setEngineData(engineDataRes.resultaat)

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
          <div>
            <h1 className="text-lg font-bold text-white">Running Coach</h1>
            <p className="text-xs text-slate-500">Specialist-hub · laatste 90 dagen</p>
          </div>
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
