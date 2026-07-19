'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Minus, Settings } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { isoDatum } from '@/utils'

// ── Cycling Hub — eerste echte Hub-UI (Stap 5/5, referentie-implementatie) ──
// Bron: docs/specialist-coaches.md §6 (Hub-structuur), aparte route
// (/coach/cycling), bereikt vanuit de Coach-omgeving. Toont: Coach Layer-
// advies (Fase 3, AI) leesbaar geformatteerd, plus de onderliggende
// Analysis Engine-cijfers (Fase 2b). Geen ruwe JSON meer — dit is de
// eerste stap van debug-testschermpje naar daadwerkelijke gebruikers-UI.
//
// Gebruikt bewust GEEN Capability Registry-gate voor niet-bestaande
// modules (Periodisering/Wedstrijden/etc.) — die worden simpelweg niet
// gerenderd, in plaats van grijs/uitgeschakeld getoond. Een module die
// nog niet bestaat, hoort niet zichtbaar te zijn als "binnenkort" —
// dat zou overclaiming zijn.

interface CyclingAdvies {
  samenvatting: string
  sterke_punten: string
  aandachtspunten: string
  advies: string
  generated_at: string
}

interface CyclingEngineResultaat {
  trainingsfrequentie: { aantal_deze_periode: number; aantal_vorige_periode: number; trend: 'stijgend' | 'stabiel' | 'dalend' }
  vermogen: { gemiddeld_watt: number | null; max_watt: number | null; trend_pct: number | null }
  afstand: { totaal_km: number; gemiddeld_km_per_activiteit: number | null }
  trainingsbelasting: { totale_minuten: number; score: 'laag' | 'gemiddeld' | 'hoog' }
}

function TrendIcoon({ trend }: { trend: 'stijgend' | 'stabiel' | 'dalend' }) {
  if (trend === 'stijgend') return <TrendingUp size={14} className="text-green-400" />
  if (trend === 'dalend') return <TrendingDown size={14} className="text-red-400" />
  return <Minus size={14} className="text-slate-400" />
}

export default function CyclingHubPage() {
  const router = useRouter()
  const [laden, setLaden] = useState(true)
  const [advies, setAdvies] = useState<CyclingAdvies | null>(null)
  const [engineData, setEngineData] = useState<CyclingEngineResultaat | null>(null)
  const [verversen, setVerversen] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  // v2.4.70: Lifecycle Engine-state — DORMANT toont een melding, Hub
  // blijft verder gewoon zichtbaar (kennis/geschiedenis gaat nooit
  // verloren, zie specialist-coaches.md-vervolgoverleg)
  const [dormant, setDormant] = useState(false)
  // v2.4.102: Fase 2c Dashboard — "volgende training" + "doelvoortgang",
  // de twee dingen die de roadmap noemt en die nog ontbraken
  const [vandaagTraining, setVandaagTraining] = useState<{ type: string; duration: number } | null>(null)
  const [leidendDoel, setLeidendDoel] = useState<{ title: string; dagen_resterend: number | null; waarde_kloof: number | null } | null>(null)

  async function laadAlles() {
    setLaden(true)
    setFout(null)
    try {
      const [adviesRes, engineRes, specialistenRes, planRes, doelRes] = await Promise.all([
        fetch('/api/specialists/cycling/coach', { credentials: 'include' }),
        fetch('/api/specialists/cycling/engine?period_days=90', { credentials: 'include' }),
        fetch('/api/specialists', { credentials: 'include' }),
        fetch('/api/specialists/cycling/training-plan', { credentials: 'include' }).catch(() => null),
        fetch('/api/specialists/cycling/doelvoortgang', { credentials: 'include' }).catch(() => null),
      ])
      const adviesData = await adviesRes.json()
      const engineDataRes = await engineRes.json()
      const specialistenData = await specialistenRes.json()

      if (adviesData?.analysis) setAdvies(adviesData.analysis)
      if (engineDataRes?.resultaat) setEngineData(engineDataRes.resultaat)

      const cyclingEntry = (specialistenData.specialisten || []).find((s: { specialist_type: string }) => s.specialist_type === 'cycling')
      setDormant(cyclingEntry?.lifecycle?.state === 'DORMANT')

      // Vandaag-training en doelvoortgang zijn verrijkingen, geen
      // kritieke functionaliteit — falen hiervan mag de rest van de
      // Hub nooit blokkeren
      try {
        if (planRes) {
          const planData = await planRes.json()
          const vandaagStr = isoDatum(new Date())
          const sessie = (planData.sessies || []).find((s: { date: string; status: string }) => s.date === vandaagStr && s.status !== 'cancelled')
          if (sessie) setVandaagTraining({ type: sessie.type, duration: sessie.duration })
        }
      } catch { /* stil falen */ }
      try {
        if (doelRes) {
          const doelData = await doelRes.json()
          if (doelData.leidend_doel) setLeidendDoel(doelData.leidend_doel)
        }
      } catch { /* stil falen */ }
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
      const res = await fetch('/api/specialists/cycling/coach', {
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
          <button onClick={() => router.push('/specialisten')} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">Cycling Coach</h1>
            <p className="text-xs text-slate-500">Specialist-hub · laatste 90 dagen</p>
          </div>
          {/* v2.4.91: link naar Cycling Profile — Fase 1, Cycling Foundation */}
          <button onClick={() => router.push('/settings/cycling-profile')} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <Settings size={16} className="text-slate-400" />
          </button>
        </div>

        {/* v2.4.70: DORMANT — Hub blijft zichtbaar, kennis blijft
            behouden, alleen een informatieve melding erbij */}
        {!laden && dormant && (
          <Card className="p-4 bg-slate-800/40 border-slate-700/50">
            <p className="text-xs text-slate-400">
              Momenteel geen recente fietsactiviteiten. Je geschiedenis en
              analyses blijven gewoon bewaard — zodra je weer fietst,
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
            <p className="text-sm text-slate-400 mb-4">Nog geen cycling-analyse gegenereerd.</p>
            <button onClick={genereerNieuwAdvies} disabled={verversen}
              className="px-5 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {verversen ? 'Bezig...' : 'Genereer je eerste analyse'}
            </button>
          </Card>
        )}

        {!laden && advies && (
          <>
            {/* v2.4.102: Fase 2c Dashboard — "Vandaag"-overzicht met
                volgende training + doelvoortgang, vóór de AI-tekst */}
            {(vandaagTraining || leidendDoel) && (
              <div className="grid grid-cols-2 gap-3">
                {vandaagTraining ? (
                  <button onClick={() => router.push('/coach/cycling/trainingsplan')} className="text-left">
                    <Card className="p-4 h-full active:bg-slate-700">
                      <p className="text-xs text-slate-500 mb-1">Vandaag</p>
                      <p className="text-sm font-semibold text-white capitalize">{vandaagTraining.type.replace('_', ' ')}</p>
                      <p className="text-xs text-slate-600">{vandaagTraining.duration} min</p>
                    </Card>
                  </button>
                ) : (
                  <Card className="p-4 h-full">
                    <p className="text-xs text-slate-500 mb-1">Vandaag</p>
                    <p className="text-sm text-slate-400">Geen training gepland</p>
                  </Card>
                )}
                {leidendDoel ? (
                  <button onClick={() => router.push('/goals')} className="text-left">
                    <Card className="p-4 h-full active:bg-slate-700">
                      <p className="text-xs text-slate-500 mb-1">Doel</p>
                      <p className="text-sm font-semibold text-white line-clamp-1">{leidendDoel.title}</p>
                      <p className="text-xs text-slate-600">
                        {leidendDoel.dagen_resterend !== null ? `nog ${leidendDoel.dagen_resterend} dagen` : 'geen deadline'}
                      </p>
                    </Card>
                  </button>
                ) : (
                  <Card className="p-4 h-full">
                    <p className="text-xs text-slate-500 mb-1">Doel</p>
                    <p className="text-sm text-slate-400">Geen Cycling-doel ingesteld</p>
                  </Card>
                )}
              </div>
            )}

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
                  <p className="text-xs text-slate-600">ritten</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-slate-500 mb-1">Vermogen</p>
                  <p className="text-xl font-bold text-white">{engineData.vermogen.gemiddeld_watt ?? '–'}W</p>
                  <p className="text-xs text-slate-600">{engineData.vermogen.max_watt ? `max ${engineData.vermogen.max_watt}W` : 'gemiddeld'}</p>
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

            {/* v2.4.99: link naar het adaptieve trainingsplan — Fase 2a sub-stap 3 */}
            <button onClick={() => router.push('/coach/cycling/trainingsplan')}
              className="w-full p-4 rounded-2xl bg-gradient-to-r from-primary-500/20 to-primary-500/5 border border-primary-500/30 flex items-center justify-between active:bg-primary-500/25">
              <div className="text-left">
                <p className="text-sm font-semibold text-white">Bekijk je trainingsplan</p>
                <p className="text-xs text-slate-400">Adaptief schema, past zich aan op je herstel</p>
              </div>
              <span className="text-primary-400 text-lg">→</span>
            </button>

            {/* v2.4.107: link naar Progress Center — Fase 2i, "het hart
                van de Cycling Hub", vandaar bovenaan de snelkoppelingen */}
            <button onClick={() => router.push('/coach/cycling/progress')}
              className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 to-amber-500/5 border border-amber-500/30 flex items-center justify-between active:bg-amber-500/25">
              <div className="text-left">
                <p className="text-sm font-semibold text-white">Progress Center</p>
                <p className="text-xs text-slate-400">Doel, records, W/kg en wat je coach over je weet</p>
              </div>
              <span className="text-amber-400 text-lg">→</span>
            </button>

            {/* v2.4.103: link naar Grafieken — Fase 2d */}
            <button onClick={() => router.push('/coach/cycling/grafieken')}
              className="w-full p-4 rounded-2xl bg-slate-800/70 border border-slate-700/50 flex items-center justify-between active:bg-slate-700">
              <div className="text-left">
                <p className="text-sm font-semibold text-white">Grafieken</p>
                <p className="text-xs text-slate-400">Volume, fitness en vermoeidheid over tijd</p>
              </div>
              <span className="text-slate-500 text-lg">→</span>
            </button>

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
