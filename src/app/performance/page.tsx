'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

// ── Performance — platformniveau ────────────────────────────────────────
// Bron: overleg 20 juli 2026. Bewust GEEN onderdeel van Cycling of
// Running — dit hoort bij de Master Coach, niet bij een specialist.
// Toont exact dezelfde data die de Coach AI en beide specialist-coaches
// al krijgen (v2.4.140-141) — deze pagina maakt dat voor het eerst ook
// zichtbaar voor de gebruiker zelf, geen nieuwe berekening.

interface HrvTrend {
  vandaag_ms: number
  gemiddelde_7d_ms: number | null
  trend: 'stijgend' | 'dalend' | 'stabiel' | null
  verschil_pct: number | null
}
interface Health {
  resting_hr: number | null
  body_battery_current: number | null
  hrv_7d_avg_ms: number | null
  hrv_status: string | null
  sleep_score: number | null
  stress: number | null
}
interface Performance {
  training_readiness: number | null
  training_readiness_label: string | null
  training_status_label: string | null
  acute_load: number | null
  chronic_load: number | null
  load_ratio: number | null
  vo2max: number | null
  vo2max_label: string | null
  endurance_score: number | null
  endurance_score_label: string | null
  hill_score: number | null
}

type Kleur = 'groen' | 'amber' | 'rood' | 'neutraal'
const KLEUR_CLASSES: Record<Kleur, string> = {
  groen: 'text-green-400 bg-green-500/10 border-green-500/20',
  amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  rood: 'text-red-400 bg-red-500/10 border-red-500/20',
  neutraal: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
}

function MetricRij({ label, waarde, sub, uitleg, kleur }: { label: string; waarde: string; sub?: string; uitleg: string; kleur: Kleur }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-coach-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-300">{label}</p>
        <p className="text-[10px] text-slate-600 mt-0.5">{uitleg}</p>
      </div>
      <div className={`text-right px-2.5 py-1 rounded-lg border ${KLEUR_CLASSES[kleur]}`}>
        <p className="text-sm font-semibold">{waarde}</p>
        {sub && <p className="text-[10px] opacity-70">{sub}</p>}
      </div>
    </div>
  )
}

function readinessKleur(waarde: number | null): Kleur {
  if (waarde === null) return 'neutraal'
  if (waarde >= 70) return 'groen'
  if (waarde >= 40) return 'amber'
  return 'rood'
}
function bodyBatteryKleur(waarde: number | null): Kleur {
  if (waarde === null) return 'neutraal'
  if (waarde >= 70) return 'groen'
  if (waarde >= 30) return 'amber'
  return 'rood'
}
function trendKleur(trend: HrvTrend['trend']): Kleur {
  if (trend === 'stijgend') return 'groen'
  if (trend === 'dalend') return 'rood'
  if (trend === 'stabiel') return 'neutraal'
  return 'neutraal'
}
function loadRatioKleur(ratio: number | null): Kleur {
  if (ratio === null) return 'neutraal'
  if (ratio >= 0.8 && ratio <= 1.3) return 'groen'
  if (ratio > 1.5) return 'rood'
  return 'amber'
}

export default function PerformancePage() {
  const [laden, setLaden] = useState(true)
  const [hrvTrend, setHrvTrend] = useState<HrvTrend | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [performance, setPerformance] = useState<Performance | null>(null)

  useEffect(() => {
    async function laad() {
      setLaden(true)
      try {
        const res = await fetch('/api/performance-overview', { credentials: 'include' })
        const data = await res.json()
        setHrvTrend(data.hrv_trend)
        setHealth(data.health)
        setPerformance(data.performance)
      } catch {
        // Elke sectie checkt zelf op aanwezige data
      } finally {
        setLaden(false)
      }
    }
    laad()
  }, [])

  const geenDataHelemaal = !laden && !health && !performance && !hrvTrend

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

        {geenDataHelemaal && (
          <Card className="p-6 text-center">
            <p className="text-sm text-slate-400 mb-4">Nog geen data voor vandaag. Upload een Garmin-screenshot of vul je ochtend-HRV in bij de Check-in.</p>
            <Link href="/settings/garmin-import" className="inline-block px-5 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold">
              Garmin Import openen
            </Link>
          </Card>
        )}

        {/* Herstel */}
        {!laden && (health || hrvTrend) && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Herstel</p>
            {performance?.training_status_label && (
              <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-2 ${KLEUR_CLASSES[trendKleur(hrvTrend?.trend ?? null)]}`}>
                {performance.training_status_label}
              </div>
            )}
            {hrvTrend?.trend && (
              <MetricRij label="HRV vannacht" waarde={`${hrvTrend.vandaag_ms} ms`}
                sub={hrvTrend.verschil_pct !== null ? `${hrvTrend.verschil_pct > 0 ? '+' : ''}${hrvTrend.verschil_pct}% vs gem.` : undefined}
                uitleg="T.o.v. je eigen 7-daags gemiddelde — niet een algemene norm." kleur={trendKleur(hrvTrend.trend)} />
            )}
            {health?.hrv_7d_avg_ms && (
              <MetricRij label="HRV (Garmin, 7d gem.)" waarde={`${health.hrv_7d_avg_ms} ms`} sub={health.hrv_status ?? undefined}
                uitleg="Garmin's eigen voortschrijdend gemiddelde." kleur="neutraal" />
            )}
            {health?.body_battery_current !== null && health?.body_battery_current !== undefined && (
              <MetricRij label="Body Battery" waarde={`${health.body_battery_current}`}
                uitleg="Energiereserve, 0-100. Hoger is beter." kleur={bodyBatteryKleur(health.body_battery_current)} />
            )}
            {health?.resting_hr !== null && health?.resting_hr !== undefined && (
              <MetricRij label="Rusthartslag" waarde={`${health.resting_hr} bpm`}
                uitleg="Sterk persoonsafhankelijk — kijk naar je eigen trend, niet naar een algemene norm." kleur="neutraal" />
            )}
            {health?.sleep_score !== null && health?.sleep_score !== undefined && (
              <MetricRij label="Slaapscore" waarde={`${health.sleep_score}`}
                uitleg="Garmin's slaapkwaliteitsscore, 0-100." kleur="neutraal" />
            )}
            {health?.stress !== null && health?.stress !== undefined && (
              <MetricRij label="Stress" waarde={`${health.stress}`}
                uitleg="Hoger betekent meer fysiologische stress, niet per se mentale stress." kleur="neutraal" />
            )}
          </Card>
        )}

        {/* Belastbaarheid */}
        {!laden && performance && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Belastbaarheid</p>
            {performance.training_readiness !== null && (
              <MetricRij label="Training Readiness" waarde={`${performance.training_readiness}`} sub={performance.training_readiness_label ?? undefined}
                uitleg="Garmin's inschatting hoe klaar je bent voor training vandaag." kleur={readinessKleur(performance.training_readiness)} />
            )}
            {performance.load_ratio !== null && (
              <MetricRij label="Belastingsverhouding" waarde={`${performance.load_ratio}`} sub={`${performance.acute_load ?? '–'}/${performance.chronic_load ?? '–'}`}
                uitleg="Acute t.o.v. chronische belasting. 0,8-1,3 is doorgaans gebalanceerd." kleur={loadRatioKleur(performance.load_ratio)} />
            )}
          </Card>
        )}

        {/* Conditie */}
        {!laden && performance && (performance.vo2max !== null || performance.endurance_score !== null || performance.hill_score !== null) && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Conditie</p>
            {performance.vo2max !== null && (
              <MetricRij label="VO2max" waarde={`${performance.vo2max}`} sub={performance.vo2max_label ?? undefined}
                uitleg="Geschatte maximale zuurstofopname — verandert langzaam, over weken." kleur="neutraal" />
            )}
            {performance.endurance_score !== null && (
              <MetricRij label="Endurance Score" waarde={`${performance.endurance_score}`} sub={performance.endurance_score_label ?? undefined}
                uitleg="Garmin's inschatting van je duurvermogen." kleur="neutraal" />
            )}
            <MetricRij label="Hill Score" waarde={performance.hill_score !== null ? `${performance.hill_score}` : '–'}
              uitleg={performance.hill_score !== null ? 'Klimvermogen.' : 'Nog niet beschikbaar — stond niet op je laatste screenshot.'} kleur="neutraal" />
          </Card>
        )}

        <p className="text-[10px] text-slate-600 text-center px-4">
          Deze cijfers zijn dezelfde data die Coach AI, Cycling Coach en Running Coach al gebruiken in hun advies — hier voor het eerst ook zichtbaar voor jou.
        </p>
      </div>
    </AppShell>
  )
}
