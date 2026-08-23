'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'

// ── Training genereren (MVP2.5-test) — v2.4.367 ──────────────────────────
// De ontbrekende schakel: de route/adapter bestonden al sinds v2.4.353,
// maar er was geen enkele knop in de app om ze te proberen. Deze pagina
// vertaalt gewoon: kies wat, tik op de knop, zie de training.

const DISCIPLINES = [
  { waarde: 'long_cycle', label: 'Long Cycle' },
  { waarde: 'jerk', label: 'Jerk' },
  { waarde: 'snatch', label: 'Snatch' },
  { waarde: 'biathlon', label: 'Biathlon' },
  { waarde: 'one_arm_long_cycle', label: 'One Arm Long Cycle' },
]

interface WorkoutBlock {
  type: string
  duration_sec: number
  instruction: string
  targets: { type: string; waarde?: number; zone_nummer?: number }[]
}

interface UniversalWorkout {
  goal: string
  trainingType: string
  duration_sec: number
  warmup: WorkoutBlock[]
  mainBlocks: WorkoutBlock[]
  cooldown?: WorkoutBlock[]
  coachNotes?: string
  equipment: { benodigd: string[] }
}

function labelBlokType(type: string): string {
  const labels: Record<string, string> = {
    warmup: 'Warming-up', hoofdblok: 'Hoofdblok', interval: 'Interval',
    herstel: 'Herstel', techniek: 'Techniek', cooldown: 'Cooling-down',
  }
  return labels[type] || type
}

export default function TrainingGenererenPage() {
  const [discipline, setDiscipline] = useState('long_cycle')
  const [bellWeight, setBellWeight] = useState('24')
  const [duurMin, setDuurMin] = useState('10')
  const [bezig, setBezig] = useState(false)
  const [workout, setWorkout] = useState<UniversalWorkout | null>(null)
  const [rustmelding, setRustmelding] = useState<string | null>(null)
  const [fout, setFout] = useState<string | null>(null)

  async function maakTraining() {
    setBezig(true)
    setFout(null)
    setWorkout(null)
    setRustmelding(null)
    try {
      const res = await fetch('/api/specialists/kettlebell/training-plan/workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request: {
            core: {
              discipline,
              bell_weight_kg: Number(bellWeight),
              duration_sec: Number(duurMin) * 60,
              competition_specific: false,
            },
            reden: ['Handmatig aangevraagd via Training genereren-pagina'],
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) { setFout(data.error || 'Er ging iets mis'); return }
      if (data.rest) { setRustmelding(data.reasons?.join(' ') || 'CoachOS raadt vandaag rust aan.'); return }
      setWorkout(data.workout)
    } catch {
      setFout('Verbindingsfout — probeer het nog eens')
    } finally {
      setBezig(false)
    }
  }

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href="/coach/kettlebell" className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
            <ArrowLeft size={20} className="text-slate-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Training genereren</h1>
            <p className="text-xs text-slate-500">Test hoe de Kettlebell Specialist een training samenstelt</p>
          </div>
        </div>

        <Card className="p-5 flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-white mb-2">Discipline</p>
            <div className="grid grid-cols-2 gap-2">
              {DISCIPLINES.map(d => (
                <button key={d.waarde} onClick={() => setDiscipline(d.waarde)}
                  className={`py-2.5 rounded-lg text-sm font-medium ${discipline === d.waarde ? 'bg-primary-500 text-white' : 'bg-white/5 text-slate-400'}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm font-medium text-white mb-2">Bell weight (kg)</p>
              <input type="number" value={bellWeight} onChange={e => setBellWeight(e.target.value)}
                className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none" />
            </div>
            <div>
              <p className="text-sm font-medium text-white mb-2">Duur (min)</p>
              <input type="number" value={duurMin} onChange={e => setDuurMin(e.target.value)}
                className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none" />
            </div>
          </div>
          <Button onClick={maakTraining} disabled={bezig}>
            {bezig ? 'Bezig...' : 'Maak training'}
          </Button>
        </Card>

        {fout && <Card className="p-4 bg-red-500/10 border-red-500/20"><p className="text-sm text-red-400">{fout}</p></Card>}

        {rustmelding && (
          <Card className="p-5">
            <p className="text-sm font-semibold text-white mb-1">CoachOS raadt vandaag rust aan</p>
            <p className="text-sm text-slate-400">{rustmelding}</p>
            <p className="text-xs text-slate-500 mt-3">Dit is de bestaande CoachPolicy (Master Coach) die meeweegt — geen bug, precies zoals bedoeld: de specialist mag nooit om je herstel heen trainingen voorstellen.</p>
          </Card>
        )}

        {workout && (
          <>
            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Type training</p>
              <p className="text-lg font-bold text-white">{workout.trainingType}</p>
              <p className="text-xs text-slate-500 mt-1">{Math.round(workout.duration_sec / 60)} minuten totaal</p>
            </Card>

            {[...workout.warmup, ...workout.mainBlocks, ...(workout.cooldown || [])].map((blok, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-white">{labelBlokType(blok.type)}</p>
                  <p className="text-xs text-slate-500">{Math.round(blok.duration_sec / 60)} min</p>
                </div>
                <p className="text-xs text-slate-400 mb-2">{blok.instruction}</p>
                {blok.targets.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {blok.targets.map((t, j) => (
                      <span key={j} className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-slate-300">
                        {t.type}{t.waarde != null ? `: ${t.waarde}` : t.zone_nummer != null ? ` zone ${t.zone_nummer}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            ))}

            {workout.coachNotes && (
              <Card className="p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Coach-notitie</p>
                <p className="text-sm text-slate-300">{workout.coachNotes}</p>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
