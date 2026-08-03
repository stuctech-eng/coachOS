'use client'
import { useState, useEffect } from 'react'
import { ArrowLeft, CheckCircle2, XCircle, ArrowRightLeft, PauseCircle } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'
import Link from 'next/link'

// ── Rowing Trainingsplan-scherm — Fase 1, stap 3 ─────────────────────────
// Bron: Rowing Platform Master Vision (1 augustus 2026). Spiegelbeeld
// van coach/cycling/trainingsplan/page.tsx — bewust compacter (geen
// uitleg-laag/AI-coach-tekst hier, dat is een latere verfijning), maar
// wel de kern: genereren, tonen, pauzeren/hervatten.

interface Sessie {
  id: string; date: string; type: string; duration: number
  status: 'planned' | 'scheduled' | 'completed' | 'skipped' | 'adjusted' | 'cancelled'
  adjustment_reason: string | null
}
interface Plan { id: string; start_date: string; end_date: string }

const TYPE_LABEL: Record<string, string> = {
  endurance: 'Duurtraining', lange_afstand: 'Lange afstand', interval: 'Interval', recovery: 'Herstel', test: 'Test',
}
const REASON_LABEL: Record<string, string> = {
  missed_session: 'Verplaatst — gemiste training', fatigue_detected: 'Aangepast — laag herstel',
  injury_protection: 'Aangepast — blessurepreventie', vacation_mode: 'Aangepast — onbeschikbaarheid', goal_change: 'Herpland — doel gewijzigd',
}

function formatDatum(dateStr: string): string {
  const vandaag = new Date().toISOString().split('T')[0]
  if (dateStr === vandaag) return 'Vandaag'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' })
}

function StatusIcoon({ status }: { status: Sessie['status'] }) {
  if (status === 'completed') return <CheckCircle2 size={16} className="text-green-400" />
  if (status === 'skipped' || status === 'cancelled') return <XCircle size={16} className="text-slate-600" />
  if (status === 'adjusted') return <ArrowRightLeft size={16} className="text-amber-400" />
  return null
}

// v2.4.230 (Rowing Fase 2, UI): toont de concrete workout van de
// nieuwe Workout Platform — eerste keer dat een gebruiker dit
// daadwerkelijk te zien krijgt, niet alleen "Interval, 60 min".
// v2.4.247: sport-icoon/-naam voor de kruis-sport-transparantie-kaart
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
  roeiVertaling: { spm?: { van: number; tot: number } }[]
}

function WorkoutDetail({ sessieId }: { sessieId: string }) {
  const [laden, setLaden] = useState(true)
  const [data, setData] = useState<{ workout: { adaptations: string[]; kruisSportBron?: string }; vertaaldeBlokken: VertaaldBlok[]; uitvoeringsHints: string[]; materiaal: { benodigd: string[]; ontbreekt: string[] } } | null>(null)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/specialists/rowing/training-plan/workout?sessieId=${sessieId}`)
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
      {/* v2.4.247 (Universal Athlete Platform — zichtbaar maken): toont
          waarom een workout is aangepast, met de bronsport erbij, i.p.v.
          dit stil in de achtergrond te laten gebeuren */}
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

      {data.materiaal.ontbreekt.length > 0 && (
        <p className="text-xs text-amber-400">⚠️ Ontbrekend materiaal: {data.materiaal.ontbreekt.join(', ')}</p>
      )}
      <div className="flex flex-col gap-2">
        {data.vertaaldeBlokken.map(blok => {
          const spm = blok.roeiVertaling.find(v => v.spm)?.spm
          return (
            <div key={blok.id} className="border-l-2 border-primary-500/50 pl-3">
              <p className="text-sm text-white font-medium">
                {BLOK_TYPE_LABEL[blok.type] || blok.type}
                {blok.repeat && blok.repeat > 1 ? ` · ${blok.repeat}× ${Math.round(blok.duration_sec / 60)} min` : ` · ${Math.round(blok.duration_sec / 60)} min`}
                {blok.rust_na_repeat_sec ? ` (${Math.round(blok.rust_na_repeat_sec / 60)} min rust ertussen)` : ''}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{blok.instruction}</p>
              {spm && <p className="text-xs text-primary-400 mt-0.5">{spm.van}-{spm.tot} SPM</p>}
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

export default function RowingTrainingsplanPage() {
  const [laden, setLaden] = useState(true)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [sessies, setSessies] = useState<Sessie[]>([])
  const [heeftGepauzeerdPlan, setHeeftGepauzeerdPlan] = useState(false)
  const [genererenBezig, setGenererenBezig] = useState(false)
  const [pauzeerBezig, setPauzeerBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  // v2.4.230 (Rowing Fase 2, UI): welke sessie toont de concrete workout
  const [uitgeklapteSessieId, setUitgeklapteSessieId] = useState<string | null>(null)

  useEffect(() => { laadPlan() }, [])

  async function laadPlan() {
    setLaden(true)
    try {
      const res = await fetch('/api/specialists/rowing/training-plan', { credentials: 'include' })
      const data = await res.json()
      setPlan(data.plan)
      setSessies(data.sessies || [])
      setHeeftGepauzeerdPlan(!!data.heeftGepauzeerdPlan)
    } catch { setFout('Kon plan niet laden') } finally { setLaden(false) }
  }

  async function genereerPlan() {
    setGenererenBezig(true)
    setFout(null)
    try {
      const res = await fetch('/api/specialists/rowing/training-plan', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) setFout(data.error || 'Genereren mislukt')
      else await laadPlan()
    } catch { setFout('Genereren mislukt') } finally { setGenererenBezig(false) }
  }

  async function pauzeerOfHervat(actie: 'pause' | 'resume') {
    setPauzeerBezig(true)
    setFout(null)
    try {
      const res = await fetch('/api/specialists/rowing/training-plan', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: actie }),
      })
      const data = await res.json()
      if (!res.ok) setFout(data.error || 'Actie mislukt')
      else await laadPlan()
    } catch { setFout('Actie mislukt') } finally { setPauzeerBezig(false) }
  }

  const vandaag = new Date().toISOString().split('T')[0]
  const toekomstigeSessies = sessies.filter(s => s.date >= vandaag)

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href="/coach/rowing" className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
            <ArrowLeft size={20} className="text-slate-400" />
          </Link>
          <h1 className="text-xl font-bold text-white">Rowing Trainingsplan</h1>
        </div>

        {laden && <div className="h-40 bg-slate-800/50 rounded-2xl animate-pulse" />}
        {fout && <Card className="p-3 bg-red-500/10 text-red-400 border-red-500/20 text-sm">{fout}</Card>}

        {!laden && !plan && (
          <Card className="p-6 flex flex-col items-center text-center gap-3">
            <p className="text-white font-semibold">Nog geen trainingsplan</p>
            <p className="text-sm text-slate-400">
              Zorg dat je trainingsdagen zijn ingesteld via <Link href="/settings/rowing-profile" className="text-primary-400 underline">Rowing Profiel</Link>, genereer daarna een plan.
            </p>
            <Button onClick={genereerPlan} disabled={genererenBezig}>
              {genererenBezig ? 'Bezig...' : 'Genereer trainingsplan'}
            </Button>
            {heeftGepauzeerdPlan && (
              <button onClick={() => pauzeerOfHervat('resume')} disabled={pauzeerBezig} className="text-xs text-primary-400 mt-1">
                {pauzeerBezig ? 'Bezig...' : 'Hervat gepauzeerd plan'}
              </button>
            )}
          </Card>
        )}

        {!laden && plan && (
          <>
            <Card className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Plan loopt</p>
                <p className="text-sm text-white">{formatDatum(plan.start_date)} — {formatDatum(plan.end_date)}</p>
              </div>
              <button onClick={() => pauzeerOfHervat('pause')} disabled={pauzeerBezig}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium">
                <PauseCircle size={14} /> {pauzeerBezig ? 'Bezig...' : 'Pauzeer plan'}
              </button>
            </Card>

            <div className="flex flex-col gap-2">
              {toekomstigeSessies.slice(0, 14).map(s => (
                <div key={s.id}>
                  <Card className="p-3 flex items-center justify-between cursor-pointer"
                    onClick={() => setUitgeklapteSessieId(uitgeklapteSessieId === s.id ? null : s.id)}>
                    <div className="flex items-center gap-2">
                      <StatusIcoon status={s.status} />
                      <div>
                        <p className="text-sm text-white capitalize">{formatDatum(s.date)}</p>
                        <p className="text-xs text-slate-500">
                          {TYPE_LABEL[s.type] || s.type} · {s.duration} min
                          {s.adjustment_reason && ` · ${REASON_LABEL[s.adjustment_reason] || s.adjustment_reason}`}
                        </p>
                      </div>
                    </div>
                    <span className="text-slate-500 text-xs">{uitgeklapteSessieId === s.id ? '▲' : '▼'}</span>
                  </Card>
                  {uitgeklapteSessieId === s.id && <WorkoutDetail sessieId={s.id} />}
                </div>
              ))}
              {toekomstigeSessies.length === 0 && (
                <Card className="p-6 text-center"><p className="text-sm text-slate-400">Geen aankomende sessies</p></Card>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
