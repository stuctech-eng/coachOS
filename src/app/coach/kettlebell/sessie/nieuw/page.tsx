'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'

// ── Kettlebell GS Sessie loggen — MVP1 ───────────────────────────────────
// Handmatige invoer, geen device-koppeling (die bestaat voor GS niet —
// zie architectuurdoc). Verplichte velden komen 1-op-1 overeen met de
// database-constraints in kettlebell_gs_sessions.

const DISCIPLINES = [
  { waarde: 'jerk', label: 'Jerk' },
  { waarde: 'snatch', label: 'Snatch' },
  { waarde: 'long_cycle', label: 'Long Cycle' },
  { waarde: 'biathlon', label: 'Biathlon' },
  { waarde: 'one_arm_long_cycle', label: 'One Arm Long Cycle' },
] as const

export default function NieuweKettlebellSessiePage() {
  const router = useRouter()
  const [discipline, setDiscipline] = useState<string>('long_cycle')
  const [bellWeight, setBellWeight] = useState('24')
  const [duurMin, setDuurMin] = useState('10')
  const [reps, setReps] = useState('')
  const [rpmAvg, setRpmAvg] = useState('')
  const [rpe, setRpe] = useState('')
  const [notes, setNotes] = useState('')
  const [opslaan, setOpslaan] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  async function opslaanKlik() {
    setFout(null)
    if (!reps || Number(reps) < 0) { setFout('Vul het aantal reps in'); return }
    if (!duurMin || Number(duurMin) <= 0) { setFout('Vul de duur in minuten in'); return }
    if (!bellWeight || Number(bellWeight) <= 0) { setFout('Vul het bell weight in'); return }

    setOpslaan(true)
    try {
      const res = await fetch('/api/specialists/kettlebell/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discipline,
          bell_weight_kg: Number(bellWeight),
          duration_sec: Math.round(Number(duurMin) * 60),
          reps: Number(reps),
          rpm_avg: rpmAvg ? Number(rpmAvg) : undefined,
          rpe: rpe ? Number(rpe) : undefined,
          notes: notes || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) router.push('/coach/kettlebell')
      else setFout(data.error || 'Opslaan mislukt')
    } catch {
      setFout('Opslaan mislukt: verbindingsfout')
    } finally {
      setOpslaan(false)
    }
  }

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href="/coach/kettlebell" className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
            <ArrowLeft size={20} className="text-slate-400" />
          </Link>
          <h1 className="text-xl font-bold text-white">Sessie loggen</h1>
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
                className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none" min="4" step="2" />
            </div>
            <div>
              <p className="text-sm font-medium text-white mb-2">Duur (min)</p>
              <input type="number" value={duurMin} onChange={e => setDuurMin(e.target.value)}
                className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none" min="1" />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-white mb-2">Reps</p>
            <input type="number" value={reps} onChange={e => setReps(e.target.value)}
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none" min="0" placeholder="Aantal reps" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm font-medium text-white mb-2">RPM (optioneel)</p>
              <input type="number" value={rpmAvg} onChange={e => setRpmAvg(e.target.value)}
                className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none" min="1" step="0.1" placeholder="bijv. 9.5" />
            </div>
            <div>
              <p className="text-sm font-medium text-white mb-2">RPE (optioneel)</p>
              <input type="number" value={rpe} onChange={e => setRpe(e.target.value)}
                className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none" min="1" max="10" placeholder="1-10" />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-white mb-2">Notities (optioneel)</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none" rows={3} placeholder="Techniek, pacing, gevoel..." />
          </div>

          {fout && <p className="text-xs text-red-400">{fout}</p>}

          <Button onClick={opslaanKlik} disabled={opslaan}>
            {opslaan ? 'Bezig...' : 'Sessie opslaan'}
          </Button>
        </Card>
      </div>
    </AppShell>
  )
}
