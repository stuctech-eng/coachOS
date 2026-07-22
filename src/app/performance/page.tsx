'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

// ── Performance Dashboard ────────────────────────────────────────────────
// Bron: overleg 21 juli 2026, "schoon schip"-ronde. Herbouwd bovenop de
// Performance Intelligence Platform-laag (src/core/performance/) i.p.v.
// de oorspronkelijke, eenvoudigere berekening direct op ruwe data
// (v2.4.142/143) — dit is nu de ENIGE plek die deze cijfers berekent,
// geen twee verschillende versies van dezelfde waarheid meer.
//
// Bewust GEEN onderdeel van Cycling of Running — dit is platformbreed,
// hoort bij de Master Coach.

interface Breakdown { factor: string; ruwe_waarde: string; bijdrage_score: number }
interface Confidence { score: number; level: 'LOW' | 'MEDIUM' | 'HIGH'; limitations: string[] }
interface EngineResult<T> { engine: string; value: T; confidence: Confidence }

interface RecoveryValue { score: number; status: string; color: 'green' | 'orange' | 'red'; breakdown: Breakdown[] }
interface LoadValue { ctl: number; atl: number; tsb: number; per_sport: { sport: string; ctl: number; atl: number; tsb: number }[] }
interface FatigueValue { score: number; label: string }
interface ReadinessValue { score: number; label: string; policy_maxIntensity: string }
interface ConsistencyValue { percentage: number; huidigeStreakWeken: number; langsteOnderbrekingWeken: number }
interface EnduranceValue { score: number; label: string }
interface SprintValue { score: number; peak_watts: number | null; duration_sec: number | null }
interface EfficiencyValue { score: number; gemiddelde_ef: number | null }
interface ClimbingValue { score: number; hoogtemeters_30d: number; watt_per_kg: number | null }
interface ProgressValue { percentageVerandering: number | null; richting: string; bronEngine: string }
interface HistoriePunt { date: string; score: number }

interface DashboardData {
  recovery: EngineResult<RecoveryValue> & { explanation?: { title: string; summary: string; coachMessage: string } }
  load: EngineResult<LoadValue>
  fatigue: EngineResult<FatigueValue>
  readiness: EngineResult<ReadinessValue>
  consistency: EngineResult<ConsistencyValue>
  endurance: EngineResult<EnduranceValue>
  sprint: EngineResult<SprintValue>
  efficiency: EngineResult<EfficiencyValue>
  climbing: EngineResult<ClimbingValue>
  progress: EngineResult<ProgressValue>
  recoveryHistorie: HistoriePunt[]
}

type Kleur = 'groen' | 'amber' | 'rood' | 'neutraal'
const KLEUR_CLASSES: Record<Kleur, string> = {
  groen: 'text-green-400 bg-green-500/10 border-green-500/20',
  amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  rood: 'text-red-400 bg-red-500/10 border-red-500/20',
  neutraal: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
}
function confidenceKleur(level: string): Kleur {
  if (level === 'HIGH') return 'groen'
  if (level === 'MEDIUM') return 'amber'
  return 'rood'
}
function labelKleur(label: string): Kleur {
  const groen = ['Uitstekend', 'Goed', 'High', 'Low', 'Sterk', 'Explosief', 'Sterke klimmer', 'Bergspecialist', 'Zeer goed']
  const rood = ['Beginnend', 'Very High', 'Vlak terrein', 'Laag']
  if (groen.includes(label)) return 'groen'
  if (rood.includes(label)) return 'rood'
  return 'amber'
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${KLEUR_CLASSES[confidenceKleur(confidence.level)]}`}>
      {confidence.level} · {confidence.score}%
    </span>
  )
}

function ScoreKaart({ titel, score, sub, label, kleur }: { titel: string; score: number | string; sub?: string; label?: string; kleur: Kleur }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{titel}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-xl font-bold text-white">{score}</p>
        {label && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${KLEUR_CLASSES[kleur]}`}>{label}</span>}
      </div>
      {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
    </Card>
  )
}

function TrendGrafiek({ data, kleur = '#f43f5e', hoogte = 60 }: { data: HistoriePunt[]; kleur?: string; hoogte?: number }) {
  if (data.length < 2) return <p className="text-[11px] text-slate-600 py-2">Nog te weinig data voor een trend (minimaal 2 dagen).</p>
  const breedte = 320
  const waarden = data.map(p => p.score)
  const max = Math.max(...waarden), min = Math.min(...waarden), bereik = max - min || 1
  const punten = data.map((p, i) => {
    const x = (i / (data.length - 1)) * breedte
    const y = hoogte - ((p.score - min) / bereik) * hoogte
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${breedte} ${hoogte}`} className="w-full" style={{ height: hoogte }}>
      <polyline points={punten} fill="none" stroke={kleur} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export default function PerformancePage() {
  const [laden, setLaden] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/performance-engine', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.error) setFout(d.error); else setData(d) })
      .catch(() => setFout('Verbindingsfout — probeer het later opnieuw.'))
      .finally(() => setLaden(false))
  }, [])

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href="/home" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Performance</h1>
            <p className="text-xs text-slate-500">Herstel &amp; belastbaarheid, platformbreed</p>
          </div>
        </div>

        {laden && <div className="h-64 bg-slate-800/50 rounded-2xl animate-pulse" />}
        {fout && (
          <Card className="p-6 text-center">
            <p className="text-sm text-slate-400 mb-4">{fout}</p>
            <Link href="/settings/garmin-import" className="inline-block px-5 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold">
              Garmin Import openen
            </Link>
          </Card>
        )}

        {!laden && data && (
          <>
            {/* Vandaag — Recovery + Readiness, het meest actionable */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Vandaag</p>
                <ConfidenceBadge confidence={data.recovery.confidence} />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Herstel</p>
                  <p className="text-2xl font-bold text-white">{data.recovery.value.score}<span className="text-sm text-slate-500 font-normal">/100</span></p>
                  <p className="text-[10px] text-slate-500">{data.recovery.value.status}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Klaar om te presteren</p>
                  <p className="text-2xl font-bold text-white">{data.readiness.value.score}<span className="text-sm text-slate-500 font-normal">/100</span></p>
                  <p className="text-[10px] text-slate-500">{data.readiness.value.label}</p>
                </div>
              </div>
              {data.recovery.explanation && (
                <div className="p-3 bg-primary-500/5 border border-primary-500/20 rounded-xl mb-2">
                  <p className="text-sm text-slate-200 mb-1">{data.recovery.explanation.summary}</p>
                  <p className="text-xs text-primary-400 font-medium">{data.recovery.explanation.coachMessage}</p>
                </div>
              )}
              <p className="text-[10px] text-slate-600">Max. intensiteit vandaag (CoachPolicy): <span className="text-slate-400 font-medium">{data.readiness.value.policy_maxIntensity}</span></p>
              {data.recovery.confidence.limitations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-coach-border">
                  {data.recovery.confidence.limitations.slice(0, 2).map((l, i) => <p key={i} className="text-[10px] text-slate-600">• {l}</p>)}
                </div>
              )}
            </Card>

            {/* Belastbaarheid */}
            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Belastbaarheid</p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div><p className="text-xs text-slate-500">CTL</p><p className="text-lg font-bold text-white">{data.load.value.ctl}</p></div>
                <div><p className="text-xs text-slate-500">ATL</p><p className="text-lg font-bold text-white">{data.load.value.atl}</p></div>
                <div><p className="text-xs text-slate-500">TSB</p><p className="text-lg font-bold text-white">{data.load.value.tsb}</p></div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-coach-border">
                <span className="text-sm text-slate-300">Vermoeidheid</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${KLEUR_CLASSES[labelKleur(data.fatigue.value.label)]}`}>{data.fatigue.value.score}/100 — {data.fatigue.value.label}</span>
              </div>
            </Card>

            {/* Trends */}
            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Herstel — 30 dagen</p>
              <TrendGrafiek data={data.recoveryHistorie} kleur="#22c55e" />
            </Card>

            {/* Consistentie */}
            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Consistentie (8 weken)</p>
              <p className="text-2xl font-bold text-white mb-2">{data.consistency.value.percentage}%</p>
              <div className="flex gap-4 text-xs text-slate-500">
                <span>Huidige streak: {data.consistency.value.huidigeStreakWeken} wk</span>
                <span>Langste onderbreking: {data.consistency.value.langsteOnderbrekingWeken} wk</span>
              </div>
            </Card>

            {/* Fitness-indicatoren */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Fitness-indicatoren</p>
              <div className="grid grid-cols-2 gap-3">
                <ScoreKaart titel="Uithoudingsvermogen" score={data.endurance.value.score} label={data.endurance.value.label} kleur={labelKleur(data.endurance.value.label)} />
                <ScoreKaart titel="Sprint" score={data.sprint.value.score} sub={data.sprint.value.peak_watts ? `${data.sprint.value.peak_watts}W @ ${data.sprint.value.duration_sec}s` : 'geen data'} kleur="neutraal" />
                <ScoreKaart titel="Efficiency" score={data.efficiency.value.score} sub={data.efficiency.value.gemiddelde_ef ? `EF ${data.efficiency.value.gemiddelde_ef}` : 'geen data'} kleur="neutraal" />
                <ScoreKaart titel="Klimmen" score={data.climbing.value.score} sub={`${data.climbing.value.hoogtemeters_30d}m · ${data.climbing.value.watt_per_kg ?? '–'} W/kg`} kleur="neutraal" />
              </div>
            </div>

            {/* Progressie */}
            {data.progress.value.percentageVerandering !== null && (
              <Card className="p-5">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Progressie ({data.progress.value.bronEngine})</p>
                <p className="text-2xl font-bold text-white">
                  {data.progress.value.percentageVerandering > 0 ? '+' : ''}{data.progress.value.percentageVerandering}%
                </p>
                <p className="text-[10px] text-slate-500">t.o.v. de 14 dagen daarvoor — {data.progress.value.richting}</p>
              </Card>
            )}

            <p className="text-[10px] text-slate-600 text-center px-4">
              Deze cijfers zijn dezelfde data die Coach AI, Cycling Coach en Running Coach al gebruiken in hun advies.
            </p>
          </>
        )}
      </div>
    </AppShell>
  )
}
