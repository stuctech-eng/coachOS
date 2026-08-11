'use client'
import { useState, useEffect } from 'react'
import { ArrowLeft, RefreshCw, Calendar, CheckCircle2, XCircle, ArrowRightLeft, PauseCircle } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { isoDatum } from '@/utils'
import { Card, Button } from '@/components/ui'
import Link from 'next/link'

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
  // v2.4.315-FIX: definitieve, mogelijk aangepaste duur voor VANDAAG's
  // sessie (server-side berekend, zelfde keten als Today Engine) —
  // los van het rauwe `duration`-veld. Alleen gevuld voor de sessie van
  // vandaag, null/undefined voor alle andere.
  definitieveDuur?: number
  definitieveDuurReden?: string | null
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

// v2.4.266 (Workout Platform-UI gelijkgetrokken met Rowing): toont de
// concrete workout van de Workout Platform-koppeling (bestond al sinds
// v2.4.242, maar had nooit een UI om 'm te bereiken — gemeld: "kan de
// trainingen zien, alleen bij rowing kan ik ze openen"). Mirror van
// rowing/trainingsplan/page.tsx's WorkoutDetail, aangepast voor
// vermogen_watt i.p.v. SPM.
const SPORT_ICOON: Record<string, string> = { rowing: '🚣', running: '🏃', cycling: '🚴' }
const SPORT_NAAM: Record<string, string> = { rowing: 'roeien', running: 'hardlopen', cycling: 'fietsen' }
const BLOK_TYPE_LABEL: Record<string, string> = {
  warmup: 'Warming-up', hoofdblok: 'Hoofdblok', interval: 'Intervallen',
  herstel: 'Herstel', techniek: 'Techniek', cadans: 'Cadans',
  mobiliteit: 'Mobiliteit', cooldown: 'Cooling-down',
}

interface VertaaldBlok {
  id: string; type: string; duration_sec: number
  repeat?: number; rust_na_repeat_sec?: number
  instruction: string
  fietsVertaling: { vermogen_watt?: string }[]
}

function WorkoutDetail({ sessieId }: { sessieId: string }) {
  const [laden, setLaden] = useState(true)
  const [data, setData] = useState<{ workout: { adaptations: string[]; kruisSportBron?: string }; vertaaldeBlokken: VertaaldBlok[]; uitvoeringsHints: string[]; materiaal: { benodigd: string[]; ontbreekt: string[] }; alternatieven?: { reden: string; workout_id: string }[]; heeftFtp: boolean } | null>(null)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/specialists/cycling/training-plan/workout?sessieId=${sessieId}`)
      .then(r => r.json())
      .then(d => { if (d.error) setFout(d.error); else setData(d) })
      .catch(() => setFout('Kon workout niet laden'))
      .finally(() => setLaden(false))
  }, [sessieId])

  if (laden) return <div className="h-24 bg-slate-800/30 rounded-xl animate-pulse mt-1" />
  if (fout) return <Card className="p-3 mt-1 bg-red-500/10 text-red-400 border-red-500/20 text-xs">{fout}</Card>
  if (!data) return null

  return (
    <Card className="p-4 mt-1 flex flex-col gap-3">
      {data.workout.adaptations.length > 0 && (
        <Card className="p-3 bg-amber-500/10 border-amber-500/20">
          <p className="text-sm font-semibold text-amber-400">
            {SPORT_ICOON[data.workout.kruisSportBron || ''] || '⚡'} Workout aangepast
            {data.workout.kruisSportBron && <span className="font-normal text-amber-400/80"> — beïnvloed door {SPORT_NAAM[data.workout.kruisSportBron] || data.workout.kruisSportBron}</span>}
          </p>
          <div className="mt-2 flex flex-col gap-1">
            {data.workout.adaptations.map((a, i) => <p key={i} className="text-xs text-amber-200/80">• {a}</p>)}
          </div>
        </Card>
      )}

      {!data.heeftFtp && (
        <p className="text-xs text-slate-500">💡 Vul je FTP in bij je profiel voor concrete vermogenswaarden per blok.</p>
      )}

      {data.materiaal.ontbreekt.length > 0 && (
        <div>
          <p className="text-xs text-amber-400">⚠️ Ontbrekend materiaal: {data.materiaal.ontbreekt.join(', ')}</p>
          {data.alternatieven && data.alternatieven.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              {data.alternatieven.map((alt, i) => (
                <Link key={i} href={`/coach/${alt.workout_id}/trainingsplan`}
                  className="text-xs bg-slate-800 rounded-lg px-3 py-2 text-primary-400 flex items-center justify-between">
                  <span>{SPORT_ICOON[alt.workout_id] || '💪'} {alt.reden}</span>
                  <span>→</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {data.vertaaldeBlokken.map(blok => {
          const vermogen = blok.fietsVertaling.find(v => v.vermogen_watt)?.vermogen_watt
          return (
            <div key={blok.id} className="border-l-2 border-primary-500/50 pl-3">
              <p className="text-sm text-white font-medium">
                {BLOK_TYPE_LABEL[blok.type] || blok.type}
                {blok.repeat && blok.repeat > 1 ? ` · ${blok.repeat}× ${Math.round(blok.duration_sec / 60)} min` : ` · ${Math.round(blok.duration_sec / 60)} min`}
                {blok.rust_na_repeat_sec ? ` (${Math.round(blok.rust_na_repeat_sec / 60)} min rust ertussen)` : ''}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{blok.instruction}</p>
              {vermogen && <p className="text-xs text-primary-400 mt-0.5">{vermogen}</p>}
            </div>
          )
        })}
      </div>
      {data.uitvoeringsHints.length > 0 && (
        <div className="pt-2 border-t border-coach-border">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Uitvoering</p>
          {data.uitvoeringsHints.map((hint, i) => <p key={i} className="text-xs text-slate-500">• {hint}</p>)}
        </div>
      )}
    </Card>
  )
}

export default function TrainingsplanPage() {
  const [laden, setLaden] = useState(true)
  const [genereren, setGenereren] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [sessies, setSessies] = useState<Sessie[]>([])
  const [vandaagUitleg, setVandaagUitleg] = useState<string | null>(null)
  const [uitlegLaden, setUitlegLaden] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [heeftGepauzeerdPlan, setHeeftGepauzeerdPlan] = useState(false)
  // v2.4.266: welke sessie toont de concrete workout
  const [uitgeklapteSessieId, setUitgeklapteSessieId] = useState<string | null>(null)

  useEffect(() => { laadPlan() }, [])

  async function laadPlan() {
    setLaden(true)
    setFout(null)
    try {
      const res = await fetch('/api/specialists/cycling/training-plan', { credentials: 'include' })
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

  // v2.4.183: Pauzeer/Hervat — zie toelichting in de Running-versie
  const [pauzeAction, setPauzeAction] = useState(false)
  async function pauzeerOfHervat(actie: 'pause' | 'resume') {
    setPauzeAction(true)
    try {
      const res = await fetch('/api/specialists/cycling/training-plan', {
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
          <Link href={'/coach/cycling'} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
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
              <div>
                <Card className="p-5 bg-primary-500/10 border-primary-500/20 cursor-pointer"
                  onClick={() => setUitgeklapteSessieId(uitgeklapteSessieId === vandaagSessie.id ? null : vandaagSessie.id)}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-primary-400 uppercase tracking-wider font-semibold">Vandaag</p>
                    {vandaagSessie.adjustment_reason && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                        {REASON_LABEL[vandaagSessie.adjustment_reason] || 'Aangepast'}
                      </span>
                    )}
                  </div>
                  <p className="text-lg font-bold text-white mb-1">{TYPE_LABEL[vandaagSessie.type] || vandaagSessie.type}</p>
                  <p className="text-sm text-slate-400 mb-3">
                    {vandaagSessie.definitieveDuur !== undefined && vandaagSessie.definitieveDuur !== vandaagSessie.duration
                      ? <>{vandaagSessie.definitieveDuur} minuten <span className="line-through opacity-50">{vandaagSessie.duration} min</span></>
                      : <>{vandaagSessie.definitieveDuur ?? vandaagSessie.duration} minuten</>
                    } · tik voor details
                  </p>
                  {uitlegLaden && <p className="text-xs text-slate-500 italic">Coach schrijft uitleg...</p>}
                  {vandaagUitleg && <p className="text-sm text-slate-200 leading-relaxed">{vandaagUitleg}</p>}
                </Card>
                {uitgeklapteSessieId === vandaagSessie.id && <WorkoutDetail sessieId={vandaagSessie.id} />}
              </div>
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
                    <div key={s.id}>
                      <Card className="p-4 cursor-pointer" onClick={() => setUitgeklapteSessieId(uitgeklapteSessieId === s.id ? null : s.id)}>
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
                            <span className="text-slate-500 text-xs">{uitgeklapteSessieId === s.id ? '▲' : '▼'}</span>
                          </div>
                        </div>
                      </Card>
                      {uitgeklapteSessieId === s.id && <WorkoutDetail sessieId={s.id} />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-slate-600 text-center px-4">
              Verder dan {komendeSessies.length > 0 ? formatDatum(komendeSessies[komendeSessies.length - 1].date) : 'nu'} plant de coach nog geen concrete dagen — dat volgt automatisch zodra die week dichterbij komt.
            </p>

            <div className="flex gap-2">
              <Link href={'/coach/cycling/kalender'}
                className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                <Calendar size={14} />
                Kalender
              </Link>
              <button onClick={laadPlan} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                <RefreshCw size={14} />
                Ververs
              </button>
            </div>
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
