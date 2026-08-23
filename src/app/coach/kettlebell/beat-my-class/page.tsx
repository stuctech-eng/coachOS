'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

// ── Beat My Class — MVP2 ────────────────────────────────────────────────
// Toont NOOIT een geschat percentage/gap. Zolang kettlebell_classifications
// leeg is (huidige status, in afwachting van het officiële WKSF-
// rankingdocument), toont deze pagina expliciet dat de norm niet
// geverifieerd is — exact zoals de gebruiker in de opdracht vroeg.

const DISCIPLINES = [
  { waarde: 'jerk', label: 'Jerk' },
  { waarde: 'snatch', label: 'Snatch' },
  { waarde: 'long_cycle', label: 'Long Cycle' },
  { waarde: 'biathlon', label: 'Biathlon' },
]

interface PromotieResultaat {
  status: 'promotion_tracked' | 'no_pr' | 'unavailable'
  current_class?: string
  next_class?: string
  best_reps?: number
  gap?: number
  progress_pct?: number
  reason: string
}

export default function BeatMyClassPage() {
  const [discipline, setDiscipline] = useState('long_cycle')
  const [bellWeight, setBellWeight] = useState('24')
  const [sex, setSex] = useState<'male' | 'female'>('male')
  const [laden, setLaden] = useState(false)
  const [resultaat, setResultaat] = useState<PromotieResultaat | null>(null)
  const [fout, setFout] = useState<string | null>(null)

  const check = useCallback(() => {
    setLaden(true)
    setFout(null)
    fetch(`/api/specialists/kettlebell/beat-my-class?discipline=${discipline}&bell_weight_kg=${bellWeight}&sex=${sex}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setFout(d.error)
        else setResultaat(d.resultaat)
      })
      .catch(() => setFout('Kon Beat My Class niet ophalen'))
      .finally(() => setLaden(false))
  }, [discipline, bellWeight, sex])

  useEffect(() => { check() }, [check])

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href="/coach/kettlebell" className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
            <ArrowLeft size={20} className="text-slate-400" />
          </Link>
          <h1 className="text-xl font-bold text-white">Beat My Class</h1>
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
              <p className="text-sm font-medium text-white mb-2">Geslacht</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setSex('male')} className={`py-2.5 rounded-lg text-sm font-medium ${sex === 'male' ? 'bg-primary-500 text-white' : 'bg-white/5 text-slate-400'}`}>M</button>
                <button onClick={() => setSex('female')} className={`py-2.5 rounded-lg text-sm font-medium ${sex === 'female' ? 'bg-primary-500 text-white' : 'bg-white/5 text-slate-400'}`}>V</button>
              </div>
            </div>
          </div>
        </Card>

        {laden && <div className="h-32 bg-slate-800/50 rounded-2xl animate-pulse" />}
        {fout && <Card className="p-3 text-sm bg-red-500/10 text-red-400 border-red-500/20">{fout}</Card>}

        {!laden && resultaat?.status === 'unavailable' && (
          <Card className="p-5">
            <p className="text-sm font-semibold text-white mb-1">Nog niet beschikbaar</p>
            <p className="text-sm text-slate-400">
              Officiële WKSF-classificatienorm nog niet geverifieerd voor deze discipline, bell weight en geslacht.
            </p>
            {resultaat.best_reps != null && (
              <p className="text-xs text-slate-500 mt-3">Je huidige PR: {resultaat.best_reps} reps (geen vergelijking met een norm mogelijk).</p>
            )}
          </Card>
        )}

        {!laden && resultaat?.status === 'no_pr' && (
          <Card className="p-5 text-center">
            <p className="text-sm text-slate-400">Nog geen sessie gelogd voor deze discipline en bell weight.</p>
          </Card>
        )}

        {!laden && resultaat?.status === 'promotion_tracked' && (
          <Card className="p-5">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Huidige klasse</p>
                <p className="text-lg font-bold text-white">{resultaat.current_class || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Volgende klasse</p>
                <p className="text-lg font-bold text-white">{resultaat.next_class || '—'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Huidige PR</p>
                <p className="text-lg font-bold text-white">{resultaat.best_reps} reps</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Gap</p>
                <p className="text-lg font-bold text-white">{resultaat.gap != null ? `${resultaat.gap} reps` : '—'}</p>
              </div>
            </div>
            {resultaat.progress_pct != null && (
              <div className="mt-4">
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500" style={{ width: `${resultaat.progress_pct}%` }} />
                </div>
                <p className="text-xs text-slate-500 mt-1">{resultaat.progress_pct}% richting volgende klasse</p>
              </div>
            )}
          </Card>
        )}
      </div>
    </AppShell>
  )
}
