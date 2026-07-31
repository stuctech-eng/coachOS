'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, Calendar, Flame, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

// ── Performance Dashboard ────────────────────────────────────────────────
// Bron: overleg 21 juli 2026, "schoon schip"-ronde. Herbouwd bovenop de
// Performance Intelligence Platform-laag (src/core/performance/) i.p.v.
// de oorspronkelijke, eenvoudigere berekening direct op ruwe data
// (v2.4.142/143) — dit is nu de ENIGE plek die deze cijfers berekent,
// geen twee verschillende versies van dezelfde waarheid meer.
//
// v2.4.208: visuele herbouw naar een gedecoreerde weergave (cirkel-
// gauges, voortgangsbalken, losse factor-pillen) — puur presentatie,
// dezelfde onderliggende data/API, geen logica-wijziging.
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
const KLEUR_HEX: Record<Kleur, string> = { groen: '#4ade80', amber: '#fb923c', rood: '#f87171', neutraal: '#94a3b8' }
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
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${KLEUR_CLASSES[confidenceKleur(confidence.level)]}`}>
      {confidence.level} · {confidence.score}%
    </span>
  )
}

// v2.4.208: cirkel-gauge (SVG ring), hergebruikt voor Herstelscore en Consistentie
function CirkelGauge({ percentage, label, sublabel, kleur = '#4ade80', grootte = 128 }: { percentage: number; label: string; sublabel?: string; kleur?: string; grootte?: number }) {
  const straal = (grootte - 12) / 2
  const omtrek = 2 * Math.PI * straal
  const gevuld = (Math.min(100, Math.max(0, percentage)) / 100) * omtrek
  return (
    <div className="relative flex-shrink-0" style={{ width: grootte, height: grootte }}>
      <svg width={grootte} height={grootte} className="-rotate-90">
        <circle cx={grootte / 2} cy={grootte / 2} r={straal} fill="none" stroke="#334155" strokeWidth="10" />
        <circle cx={grootte / 2} cy={grootte / 2} r={straal} fill="none" stroke={kleur} strokeWidth="10"
          strokeDasharray={`${gevuld} ${omtrek}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-bold text-white">{label}</p>
        {sublabel && <p className="text-[10px] text-slate-500 text-center px-2">{sublabel}</p>}
      </div>
    </div>
  )
}

// v2.4.208: voortgangsbalk onder CTL/ATL/TSB/Vermoeidheid — max is een
// redelijke, vaste schaal (geen exacte wetenschappelijke normering,
// puur visueel — de kale cijfers ernaast blijven de waarheid)
function VoortgangsBalk({ waarde, max, kleur = '#60a5fa' }: { waarde: number; max: number; kleur?: string }) {
  const pct = Math.min(100, Math.max(0, (waarde / max) * 100))
  return (
    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden mt-2">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: kleur }} />
    </div>
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
      {/* v2.4.208: kleine visuele balk — puur decoratief, geen echte
          historische sparkline (die data bestaat niet per indicator) */}
      {typeof score === 'number' && <VoortgangsBalk waarde={score} max={100} kleur={KLEUR_HEX[kleur === 'neutraal' ? 'groen' : kleur]} />}
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

// v2.4.208: gemiddelde + trend (laatste 7 dagen t.o.v. de 7 dagen
// daarvoor) — puur afgeleid van bestaande recoveryHistorie-data, geen
// nieuwe databron
function berekenTrend(data: HistoriePunt[]): { gemiddelde: number; trendPct: number | null; richting: 'stijgend' | 'stabiel' | 'dalend' } {
  if (data.length === 0) return { gemiddelde: 0, trendPct: null, richting: 'stabiel' }
  const gemiddelde = Math.round(data.reduce((a, p) => a + p.score, 0) / data.length)
  if (data.length < 14) return { gemiddelde, trendPct: null, richting: 'stabiel' }
  const laatste7 = data.slice(-7)
  const vorige7 = data.slice(-14, -7)
  const gemLaatste = laatste7.reduce((a, p) => a + p.score, 0) / laatste7.length
  const gemVorige = vorige7.reduce((a, p) => a + p.score, 0) / vorige7.length
  const trendPct = gemVorige === 0 ? 0 : Math.round(((gemLaatste - gemVorige) / gemVorige) * 100)
  const richting = trendPct > 2 ? 'stijgend' : trendPct < -2 ? 'dalend' : 'stabiel'
  return { gemiddelde, trendPct, richting }
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

  const trend = data ? berekenTrend(data.recoveryHistorie) : null
  // v2.4.208: top-3 factoren op bijdrage_score, als losse pillen
  const topFactoren = data?.recovery.value.breakdown
    ? [...data.recovery.value.breakdown].sort((a, b) => b.bijdrage_score - a.bijdrage_score).slice(0, 3)
    : []

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/home" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
              <Menu size={18} className="text-slate-400" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white">Performance</h1>
              <p className="text-xs text-slate-500">Herstel &amp; belastbaarheid</p>
            </div>
          </div>
          {data && <ConfidenceBadge confidence={data.recovery.confidence} />}
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
            {/* Vandaag — Recovery + Readiness + cirkel-gauge */}
            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Vandaag</p>
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex-1 flex flex-col gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Herstel</p>
                    <p className="text-2xl font-bold text-white">{data.recovery.value.score}<span className="text-sm text-slate-500 font-normal">/100</span></p>
                    <p className="text-[10px] text-slate-500">{data.recovery.value.status}</p>
                    <VoortgangsBalk waarde={data.recovery.value.score} max={100} kleur={KLEUR_HEX[data.recovery.value.color === 'green' ? 'groen' : data.recovery.value.color === 'orange' ? 'amber' : 'rood']} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Klaar om te presteren</p>
                    <p className="text-2xl font-bold text-white">{data.readiness.value.score}<span className="text-sm text-slate-500 font-normal">/100</span></p>
                    <p className="text-[10px] text-slate-500">{data.readiness.value.label}</p>
                    <VoortgangsBalk waarde={data.readiness.value.score} max={100} kleur="#4ade80" />
                  </div>
                </div>
                <CirkelGauge percentage={data.recovery.value.score} label={String(data.recovery.value.score)} sublabel="Herstelscore /100"
                  kleur={KLEUR_HEX[data.recovery.value.color === 'green' ? 'groen' : data.recovery.value.color === 'orange' ? 'amber' : 'rood']} />
              </div>

              <div className="flex items-start justify-between gap-4 pt-3 border-t border-coach-border">
                {data.recovery.explanation && (
                  <div className="flex items-start gap-2 flex-1">
                    <span className="text-lg flex-shrink-0">🧠</span>
                    <p className="text-xs text-slate-300">{data.recovery.explanation.coachMessage}</p>
                  </div>
                )}
                {topFactoren.length > 0 && (
                  <div className="flex-shrink-0">
                    <p className="text-[10px] text-slate-500 mb-1.5">Belangrijkste factoren:</p>
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {topFactoren.map((f, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">+ {f.factor}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[10px] text-slate-600 mt-3">Max. intensiteit vandaag (CoachPolicy): <span className="text-slate-400 font-medium">{data.readiness.value.policy_maxIntensity}</span></p>
              {data.recovery.confidence.limitations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-coach-border">
                  {data.recovery.confidence.limitations.slice(0, 2).map((l, i) => <p key={i} className="text-[10px] text-slate-600">• {l}</p>)}
                </div>
              )}
            </Card>

            {/* Belastbaarheid — met voortgangsbalken, 4 kolommen */}
            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Belastbaarheid</p>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <p className="text-xs text-slate-500">CTL</p>
                  <p className="text-lg font-bold text-white">{data.load.value.ctl}</p>
                  <p className="text-[9px] text-slate-600">Korte termijn</p>
                  <VoortgangsBalk waarde={data.load.value.ctl} max={20} kleur="#60a5fa" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">ATL</p>
                  <p className="text-lg font-bold text-white">{data.load.value.atl}</p>
                  <p className="text-[9px] text-slate-600">Middellange termijn</p>
                  <VoortgangsBalk waarde={data.load.value.atl} max={20} kleur="#60a5fa" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">TSB</p>
                  <p className="text-lg font-bold text-white">{data.load.value.tsb}</p>
                  <p className="text-[9px] text-slate-600">Vermoeidheid</p>
                  <VoortgangsBalk waarde={data.load.value.tsb + 20} max={40} kleur="#60a5fa" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Vermoeidheid</p>
                  <p className="text-lg font-bold text-amber-400">{data.fatigue.value.score}/100</p>
                  <p className="text-[9px] text-slate-600">{data.fatigue.value.label}</p>
                  <VoortgangsBalk waarde={data.fatigue.value.score} max={100} kleur="#fb923c" />
                </div>
              </div>
            </Card>

            {/* Trends — met gemiddelde/trend-paneel */}
            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Herstel — 30 dagen</p>
              <div className="flex gap-4">
                <div className="flex-1">
                  <TrendGrafiek data={data.recoveryHistorie} kleur="#22c55e" />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>30 dgn geleden</span>
                    <span>Vandaag</span>
                  </div>
                </div>
                {trend && (
                  <div className="flex-shrink-0 w-28 bg-slate-800/50 rounded-xl p-3 flex flex-col gap-3">
                    <div>
                      <p className="text-[10px] text-slate-500">Gemiddelde</p>
                      <p className="text-lg font-bold text-green-400">{trend.gemiddelde}/100</p>
                    </div>
                    {trend.trendPct !== null && (
                      <div>
                        <p className="text-[10px] text-slate-500 mb-0.5">Trend</p>
                        <div className="flex items-center gap-1">
                          {trend.richting === 'stijgend' ? <TrendingUp size={12} className="text-green-400" /> : trend.richting === 'dalend' ? <TrendingDown size={12} className="text-amber-400" /> : <Minus size={12} className="text-slate-400" />}
                          <span className={`text-xs font-medium ${trend.richting === 'stijgend' ? 'text-green-400' : trend.richting === 'dalend' ? 'text-amber-400' : 'text-slate-400'}`}>
                            {trend.richting === 'stabiel' ? 'Stabiel' : `${trend.trendPct! > 0 ? '+' : ''}${trend.trendPct}%`}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-600 mt-0.5">vs. vorige week</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Consistentie — cirkel-gauge */}
            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Consistentie (8 weken)</p>
              <div className="flex items-center gap-5">
                <CirkelGauge percentage={data.consistency.value.percentage} label={`${data.consistency.value.percentage}%`}
                  sublabel={data.consistency.value.percentage >= 80 ? 'Goed' : data.consistency.value.percentage >= 50 ? 'Matig' : 'Laag'}
                  kleur={data.consistency.value.percentage >= 80 ? '#4ade80' : data.consistency.value.percentage >= 50 ? '#fb923c' : '#f87171'} grootte={112} />
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-green-400" />
                    <div>
                      <p className="text-[10px] text-slate-500">Huidige streak</p>
                      <p className="text-sm font-semibold text-white">{data.consistency.value.huidigeStreakWeken} week{data.consistency.value.huidigeStreakWeken === 1 ? '' : 'en'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Flame size={16} className="text-amber-400" />
                    <div>
                      <p className="text-[10px] text-slate-500">Langste onderbreking</p>
                      <p className="text-sm font-semibold text-white">{data.consistency.value.langsteOnderbrekingWeken} week{data.consistency.value.langsteOnderbrekingWeken === 1 ? '' : 'en'}</p>
                    </div>
                  </div>
                </div>
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

            {/* v2.4.208: Focus vandaag — afgeleid van bestaande readiness/
                fatigue-labels, geen nieuwe databron */}
            <Card className="p-4 flex items-start gap-3">
              <span className="text-xl flex-shrink-0">💡</span>
              <div>
                <p className="text-sm font-semibold text-white">
                  Focus vandaag: {data.readiness.value.policy_maxIntensity === 'high' ? 'ruimte voor een pittige training' : data.readiness.value.policy_maxIntensity === 'low' ? 'actief herstel' : 'basisduur of techniektraining in Z2'}.
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {data.fatigue.value.score >= 60 ? 'Vermijd hoge intensiteit — je vermoeidheid loopt op.' : 'Luister naar je lichaam en pas aan waar nodig.'}
                </p>
              </div>
            </Card>

            <p className="text-[10px] text-slate-600 text-center px-4">
              Deze cijfers zijn dezelfde data die Coach AI, Cycling Coach en Running Coach al gebruiken in hun advies.
            </p>
          </>
        )}
      </div>
    </AppShell>
  )
}
