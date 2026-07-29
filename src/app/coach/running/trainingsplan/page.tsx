'use client'
import { useState, useEffect } from 'react'
import { ArrowLeft, RefreshCw, Calendar, CheckCircle2, XCircle, ArrowRightLeft, PauseCircle } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { isoDatum } from '@/utils'
import { Card } from '@/components/ui'
import Link from 'next/link'

// ── Running Trainingsplan-scherm — Adaptive Training Plan Engine, ──────
//    Fase 3 (UI) ─────────────────────────────────────────────────────
// Bron: overleg 19 juli 2026, spiegelbeeld van coach/cycling/trainingsplan
// (v2.4.99) — beide draaien nu op dezelfde Training Plan Engine Core
// (training-plan-engine/), alleen deze pagina zelf is nieuw. Toont wat
// de Plan Generator + Daily Adjustment Layer (deterministisch) hebben
// bepaald, met de AI-uitleg (Coach-uitleglaag) voor vandaag.
//
// Verschil met de Cycling-versie: nog geen Running Kalender-pagina
// (staat nog open in de roadmap), dus die knop ontbreekt hier bewust —
// geen dode link naar iets dat nog niet bestaat.

interface Sessie {
  id: string
  date: string
  type: string
  duration: number
  status: 'planned' | 'scheduled' | 'completed' | 'skipped' | 'adjusted' | 'cancelled'
  adjustment_reason: string | null
}

interface Plan {
  id: string
  start_date: string
  end_date: string
}

const TYPE_LABEL: Record<string, string> = {
  easy_run: 'Easy Run',
  lange_duurloop: 'Lange duurloop',
  interval: 'Interval',
  herstel: 'Herstel',
  tempo: 'Tempo',
}

const REASON_LABEL: Record<string, string> = {
  missed_session: 'Verplaatst — gemiste training',
  fatigue_detected: 'Aangepast — laag herstel',
  injury_protection: 'Aangepast — blessurepreventie',
  vacation_mode: 'Aangepast — onbeschikbaarheid',
  goal_change: 'Herpland — doel gewijzigd',
}

function formatDatum(dateStr: string): string {
  const d = new Date(dateStr)
  const vandaag = isoDatum(new Date())
  if (dateStr === vandaag) return 'Vandaag'
  return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' })
}

function StatusIcoon({ status }: { status: Sessie['status'] }) {
  if (status === 'completed') return <CheckCircle2 size={16} className="text-green-400" />
  if (status === 'skipped' || status === 'cancelled') return <XCircle size={16} className="text-slate-600" />
  if (status === 'adjusted') return <ArrowRightLeft size={16} className="text-amber-400" />
  return null
}

export default function RunningTrainingsplanPage() {
  const [laden, setLaden] = useState(true)
  const [genereren, setGenereren] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [sessies, setSessies] = useState<Sessie[]>([])
  const [vandaagUitleg, setVandaagUitleg] = useState<string | null>(null)
  const [uitlegLaden, setUitlegLaden] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [heeftGepauzeerdPlan, setHeeftGepauzeerdPlan] = useState(false)

  useEffect(() => { laadPlan() }, [])

  async function laadPlan() {
    setLaden(true)
    setFout(null)
    try {
      const res = await fetch('/api/specialists/running/training-plan', { credentials: 'include' })
      const data = await res.json()
      setPlan(data.plan)
      setSessies(data.sessies || [])
      setHeeftGepauzeerdPlan(!!data.heeftGepauzeerdPlan)

      if (data.plan) {
        const vandaag = isoDatum(new Date())
        const vandaagSessie = (data.sessies || []).find((s: Sessie) => s.date === vandaag)
        if (vandaagSessie) laadUitleg()
      }
    } catch (e) {
      setFout((e as Error).message)
    } finally {
      setLaden(false)
    }
  }

  // v2.4.183: Pauzeer/Hervat — hergebruikt de bestaande 'abandoned'-
  // status. Nuttig bij een blessure/prioriteitswissel, en handig om de
  // Today Engine's vangnet (Trainer AI) te kunnen testen zonder SQL.
  const [pauzeAction, setPauzeAction] = useState(false)
  async function pauzeerOfHervat(actie: 'pause' | 'resume') {
    setPauzeAction(true)
    try {
      const res = await fetch('/api/specialists/running/training-plan', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actie }),
      })
      const data = await res.json()
      if (data.error) { setFout(data.error); return }
      await laadPlan()
    } catch (e) {
      setFout((e as Error).message)
    } finally {
      setPauzeAction(false)
    }
  }

  async function laadUitleg() {
    setUitlegLaden(true)
    try {
      const res = await fetch('/api/specialists/running/training-plan/explain', { credentials: 'include' })
      const data = await res.json()
      if (data.uitleg) setVandaagUitleg(data.uitleg)
    } catch {
      // Uitleg is een verrijking, geen kritieke functie — stil falen
    } finally {
      setUitlegLaden(false)
    }
  }

  async function genereerPlan() {
    setGenereren(true)
    setFout(null)
    try {
      const res = await fetch('/api/specialists/running/training-plan', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (data.error) {
        setFout(data.error)
      } else {
        await laadPlan()
      }
    } catch (e) {
      setFout((e as Error).message)
    } finally {
      setGenereren(false)
    }
  }

  const vandaag = isoDatum(new Date())
  const vandaagSessie = sessies.find(s => s.date === vandaag)
  const komendeSessies = sessies.filter(s => s.date > vandaag).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link href="/coach/running" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Trainingsplan</h1>
            <p className="text-xs text-slate-500">Adaptief, past zich aan op je herstel</p>
          </div>
        </div>

        {laden && (
          <div className="flex flex-col gap-3">
            <div className="h-32 bg-slate-800/50 rounded-2xl animate-pulse" />
            <div className="h-24 bg-slate-800/50 rounded-2xl animate-pulse" />
          </div>
        )}

        {!laden && fout && (
          <Card className="p-5 bg-red-500/5 border-red-500/20">
            <p className="text-sm text-red-400">{fout}</p>
          </Card>
        )}

        {!laden && !plan && !fout && (
          <Card className="p-6 text-center">
            <Calendar size={32} className="text-slate-600 mx-auto mb-3" />
            {heeftGepauzeerdPlan ? (
              <>
                <p className="text-sm text-slate-400 mb-4">Je trainingsplan staat gepauzeerd.</p>
                <button onClick={() => pauzeerOfHervat('resume')} disabled={pauzeAction}
                  className="px-5 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                  {pauzeAction ? 'Bezig...' : 'Hervat trainingsplan'}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-400 mb-4">Nog geen trainingsplan gegenereerd.</p>
                <button onClick={genereerPlan} disabled={genereren}
                  className="px-5 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                  {genereren ? 'Bezig...' : 'Genereer je trainingsplan'}
                </button>
              </>
            )}
          </Card>
        )}

        {!laden && plan && (
          <>
            {/* Vandaag — prominent, met AI-uitleg */}
            {vandaagSessie ? (
              <Card className="p-5 bg-primary-500/10 border-primary-500/20">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-primary-400 uppercase tracking-wider font-semibold">Vandaag</p>
                  {vandaagSessie.adjustment_reason && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                      {REASON_LABEL[vandaagSessie.adjustment_reason] || 'Aangepast'}
                    </span>
                  )}
                </div>
                <p className="text-lg font-bold text-white mb-1">{TYPE_LABEL[vandaagSessie.type] || vandaagSessie.type}</p>
                <p className="text-sm text-slate-400 mb-3">{vandaagSessie.duration} minuten</p>
                {uitlegLaden && <p className="text-xs text-slate-500 italic">Coach schrijft uitleg...</p>}
                {vandaagUitleg && <p className="text-sm text-slate-200 leading-relaxed">{vandaagUitleg}</p>}
              </Card>
            ) : (
              <Card className="p-5">
                <p className="text-sm text-slate-400">Geen training gepland voor vandaag — geniet van je rust.</p>
              </Card>
            )}

            {/* Komende sessies */}
            {komendeSessies.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Komende trainingen</p>
                <div className="flex flex-col gap-2">
                  {komendeSessies.map(s => (
                    <Card key={s.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-white font-medium">{formatDatum(s.date)}</p>
                          <p className="text-xs text-slate-400">{TYPE_LABEL[s.type] || s.type} · {s.duration} min</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {s.adjustment_reason && (
                            <span className="text-[10px] text-amber-400">{REASON_LABEL[s.adjustment_reason]}</span>
                          )}
                          <StatusIcoon status={s.status} />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-slate-600 text-center px-4">
              Verder dan {komendeSessies.length > 0 ? formatDatum(komendeSessies[komendeSessies.length - 1].date) : 'nu'} plant de coach nog geen concrete dagen — dat volgt automatisch zodra die week dichterbij komt.
            </p>

            {/* v2.4.159 (dit keer echt gecommit): Kalender bestaat nu */}
            <Link href="/coach/running/kalender"
              className="w-full py-3 bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
              <Calendar size={14} />
              Kalender
            </Link>
            <button onClick={laadPlan} className="w-full py-3 bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
              <RefreshCw size={14} />
              Ververs
            </button>
            {/* v2.4.183: Pauzeer — bevestiging vereist, dit is impactvol
                (Trainer AI neemt het over totdat je hervat) */}
            <button
              onClick={() => { if (window.confirm('Trainingsplan pauzeren? Je kunt het later weer hervatten.')) pauzeerOfHervat('pause') }}
              disabled={pauzeAction}
              className="w-full py-3 bg-slate-800 text-amber-400 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              <PauseCircle size={14} />
              {pauzeAction ? 'Bezig...' : 'Pauzeer plan'}
            </button>
          </>
        )}
      </div>
    </AppShell>
  )
}
