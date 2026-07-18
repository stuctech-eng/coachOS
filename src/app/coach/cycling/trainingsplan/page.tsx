'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, Calendar, CheckCircle2, XCircle, ArrowRightLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { isoDatum } from '@/utils'
import { Card, Button } from '@/components/ui'

// ── Trainingsplan-scherm — Adaptive Training Plan Engine, Fase 2a
//    sub-stap 3/3 (UI) ────────────────────────────────────────────────
// Bron: docs/adaptive-training-plan-engine-spec.md +
// docs/adaptive-training-plan-decision-contract-v1.md. Toont wat de
// Plan Generator + Daily Adjustment Layer (deterministisch) hebben
// bepaald, met de AI-uitleg (Coach-uitleglaag) voor vandaag.

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
  duurtraining: 'Duurtraining',
  lange_duurtraining: 'Lange duurtraining',
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

export default function TrainingsplanPage() {
  const router = useRouter()
  const [laden, setLaden] = useState(true)
  const [genereren, setGenereren] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [sessies, setSessies] = useState<Sessie[]>([])
  const [vandaagUitleg, setVandaagUitleg] = useState<string | null>(null)
  const [uitlegLaden, setUitlegLaden] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => { laadPlan() }, [])

  async function laadPlan() {
    setLaden(true)
    setFout(null)
    try {
      const res = await fetch('/api/specialists/cycling/training-plan', { credentials: 'include' })
      const data = await res.json()
      setPlan(data.plan)
      setSessies(data.sessies || [])

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

  async function laadUitleg() {
    setUitlegLaden(true)
    try {
      const res = await fetch('/api/specialists/cycling/training-plan/explain', { credentials: 'include' })
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
      const res = await fetch('/api/specialists/cycling/training-plan', { method: 'POST', credentials: 'include' })
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
          <button onClick={() => router.push('/coach/cycling')} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </button>
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
            <p className="text-sm text-slate-400 mb-4">Nog geen trainingsplan gegenereerd.</p>
            <button onClick={genereerPlan} disabled={genereren}
              className="px-5 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {genereren ? 'Bezig...' : 'Genereer je trainingsplan'}
            </button>
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

            <div className="flex gap-2">
              <button onClick={() => router.push('/coach/cycling/kalender')}
                className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                <Calendar size={14} />
                Kalender
              </button>
              <button onClick={laadPlan} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                <RefreshCw size={14} />
                Ververs
              </button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
