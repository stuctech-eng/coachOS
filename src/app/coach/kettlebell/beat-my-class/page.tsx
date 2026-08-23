'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

// ── Beat My Class — v2 (na WKSF Ranking-import, v2.4.354) ────────────────
// ranking_block wordt EXPLICIET door de gebruiker gekozen (A/B) — nooit
// automatisch afgeleid uit bell weight, want die koppeling is nog niet
// officieel bevestigd door WKSF. Zie kettlebell-classification.ts.

const RANKING_DISCIPLINES = [
  { waarde: 'long_cycle_10', label: 'Long Cycle 10\'' },
  { waarde: 'biathlon_10', label: 'Biathlon 10\'' },
  { waarde: 'snatch_12', label: 'Snatch 12\'' },
  { waarde: 'one_arm_long_cycle_10', label: 'One Arm Long Cycle 10\'' },
  { waarde: 'snatch_10', label: 'Snatch 10\'' },
  { waarde: 'long_cycle_30', label: 'Long Cycle 30\'' },
  { waarde: 'jerk_30', label: 'Jerk 30\'' },
  { waarde: 'snatch_30', label: 'Snatch 30\'' },
  { waarde: 'long_cycle_60', label: 'Long Cycle 60\'' },
  { waarde: 'jerk_60', label: 'Jerk 60\'' },
]

const KETTLEBELL_DISCIPLINES = [
  { waarde: 'long_cycle', label: 'Long Cycle' },
  { waarde: 'jerk', label: 'Jerk' },
  { waarde: 'snatch', label: 'Snatch' },
  { waarde: 'biathlon', label: 'Biathlon' },
  { waarde: 'one_arm_long_cycle', label: 'One Arm Long Cycle' },
]

interface PromotieResultaat {
  promotion_status: 'pending_source_verification' | 'no_pr' | 'unavailable'
  current_class?: string
  next_class?: string
  best_reps?: number
  gap?: number
  progress_pct?: number
  reason: string
  bell_weight_note?: string
}

interface SimulatieResultaat {
  status: 'projected' | 'insufficient_data'
  projected_reps?: number
  based_on_sustainable_rpm?: number
  projected_current_class?: string
  projected_next_class?: string
  projected_gap?: number
  reason: string
}

// Duur direct uit de ranking-discipline-sleutel afgeleid (10/12/30/60) —
// geen los invoerveld nodig, geen risico op een inconsistente combinatie.
function duurUitDiscipline(rankingDiscipline: string): number {
  const match = rankingDiscipline.match(/_(\d+)$/)
  const minuten = match ? Number(match[1]) : 10
  return minuten * 60
}

export default function BeatMyClassPage() {
  const [rankingDiscipline, setRankingDiscipline] = useState('long_cycle_10')
  const [bodyweightClass, setBodyweightClass] = useState('74')
  const [rankingBlock, setRankingBlock] = useState<'A' | 'B'>('A')
  const [sex, setSex] = useState<'male' | 'female'>('male')
  const [kettlebellDiscipline, setKettlebellDiscipline] = useState('long_cycle')
  const [bellWeight, setBellWeight] = useState('24')
  const [laden, setLaden] = useState(false)
  const [resultaat, setResultaat] = useState<PromotieResultaat | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [simulatie, setSimulatie] = useState<SimulatieResultaat | null>(null)
  const [simuleren, setSimuleren] = useState(false)

  const check = useCallback(() => {
    setLaden(true)
    setFout(null)
    const params = new URLSearchParams({
      ranking_discipline: rankingDiscipline, bodyweight_class: bodyweightClass,
      ranking_block: rankingBlock, sex, kettlebell_discipline: kettlebellDiscipline, bell_weight_kg: bellWeight,
    })
    fetch(`/api/specialists/kettlebell/beat-my-class?${params}`)
      .then(r => r.json())
      .then(d => { if (d.error) setFout(d.error); else setResultaat(d.resultaat) })
      .catch(() => setFout('Kon Beat My Class niet ophalen'))
      .finally(() => setLaden(false))
  }, [rankingDiscipline, bodyweightClass, rankingBlock, sex, kettlebellDiscipline, bellWeight])

  useEffect(() => { check() }, [check])

  function simuleer() {
    setSimuleren(true)
    const params = new URLSearchParams({
      kettlebell_discipline: kettlebellDiscipline, bell_weight_kg: bellWeight,
      duration_sec: String(duurUitDiscipline(rankingDiscipline)),
      ranking_discipline: rankingDiscipline, sex, bodyweight_class: bodyweightClass, ranking_block: rankingBlock,
    })
    fetch(`/api/specialists/kettlebell/competition-simulator?${params}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setSimulatie(d.resultaat) })
      .finally(() => setSimuleren(false))
  }

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href="/coach/kettlebell" className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
            <ArrowLeft size={20} className="text-slate-400" />
          </Link>
          <h1 className="text-xl font-bold text-white">Beat My Class</h1>
        </div>

        <Card className="p-3 bg-amber-500/10 border-amber-500/20">
          <p className="text-xs text-amber-300">
            WKSF-rankingtabellen bevatten twee kolomblokken (A/B) waarvan het officiële kettlebellgewicht nog niet bevestigd is. Kies hieronder zelf welk blok van toepassing is — CoachOS raadt dit niet automatisch.
          </p>
        </Card>

        <Card className="p-5 flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-white mb-2">Ranking-discipline</p>
            <select value={rankingDiscipline} onChange={e => setRankingDiscipline(e.target.value)}
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none">
              {RANKING_DISCIPLINES.map(d => <option key={d.waarde} value={d.waarde}>{d.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm font-medium text-white mb-2">Geslacht</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setSex('male')} className={`py-2.5 rounded-lg text-sm font-medium ${sex === 'male' ? 'bg-primary-500 text-white' : 'bg-white/5 text-slate-400'}`}>M</button>
                <button onClick={() => setSex('female')} className={`py-2.5 rounded-lg text-sm font-medium ${sex === 'female' ? 'bg-primary-500 text-white' : 'bg-white/5 text-slate-400'}`}>V</button>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-white mb-2">Lichaamsgewichtcategorie</p>
              <input value={bodyweightClass} onChange={e => setBodyweightClass(e.target.value)}
                className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none" placeholder="bijv. 74 of over87" />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-white mb-2">Rankingblok</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setRankingBlock('A')} className={`py-2.5 rounded-lg text-sm font-medium ${rankingBlock === 'A' ? 'bg-primary-500 text-white' : 'bg-white/5 text-slate-400'}`}>Blok A</button>
              <button onClick={() => setRankingBlock('B')} className={`py-2.5 rounded-lg text-sm font-medium ${rankingBlock === 'B' ? 'bg-primary-500 text-white' : 'bg-white/5 text-slate-400'}`}>Blok B</button>
            </div>
          </div>

          <div className="pt-2 border-t border-coach-border">
            <p className="text-xs text-slate-500 mb-3">Voor het opzoeken van je PR (los van de WKSF-classificatie hierboven):</p>
            <div className="grid grid-cols-2 gap-3">
              <select value={kettlebellDiscipline} onChange={e => setKettlebellDiscipline(e.target.value)}
                className="bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none">
                {KETTLEBELL_DISCIPLINES.map(d => <option key={d.waarde} value={d.waarde}>{d.label}</option>)}
              </select>
              <input type="number" value={bellWeight} onChange={e => setBellWeight(e.target.value)}
                className="bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none" placeholder="Bell weight (kg)" />
            </div>
          </div>
        </Card>

        {laden && <div className="h-32 bg-slate-800/50 rounded-2xl animate-pulse" />}
        {fout && <Card className="p-3 text-sm bg-red-500/10 text-red-400 border-red-500/20">{fout}</Card>}

        {!laden && resultaat?.promotion_status === 'unavailable' && (
          <Card className="p-5">
            <p className="text-sm font-semibold text-white mb-1">Geen data</p>
            <p className="text-sm text-slate-400">{resultaat.reason}</p>
          </Card>
        )}

        {!laden && resultaat?.promotion_status === 'no_pr' && (
          <Card className="p-5 text-center">
            <p className="text-sm text-slate-400">Nog geen sessie gelogd voor deze discipline en bell weight.</p>
          </Card>
        )}

        {!laden && resultaat?.promotion_status === 'pending_source_verification' && (
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
            <div className="grid grid-cols-2 gap-4 mb-4">
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
              <div className="mb-4">
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500" style={{ width: `${resultaat.progress_pct}%` }} />
                </div>
                <p className="text-xs text-slate-500 mt-1">{resultaat.progress_pct}% richting volgende klasse</p>
              </div>
            )}
            <p className="text-xs text-amber-300 bg-amber-500/10 rounded-lg p-3">{resultaat.bell_weight_note}</p>
          </Card>
        )}

        <button onClick={simuleer} disabled={simuleren}
          className="py-3 rounded-xl text-sm font-medium bg-white/5 text-slate-300">
          {simuleren ? 'Bezig...' : `Simuleer ${Math.round(duurUitDiscipline(rankingDiscipline) / 60)}-minuten wedstrijd (MVP3)`}
        </button>

        {simulatie?.status === 'insufficient_data' && (
          <Card className="p-4"><p className="text-sm text-slate-400">{simulatie.reason}</p></Card>
        )}
        {simulatie?.status === 'projected' && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Wedstrijdsimulatie</p>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Projectie reps</p>
                <p className="text-lg font-bold text-white">{simulatie.projected_reps}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Op basis van RPM</p>
                <p className="text-lg font-bold text-white">{simulatie.based_on_sustainable_rpm}</p>
              </div>
            </div>
            {simulatie.projected_current_class && (
              <p className="text-sm text-white mb-2">Projectie klasse: {simulatie.projected_current_class}{simulatie.projected_next_class ? ` → ${simulatie.projected_gap} reps van ${simulatie.projected_next_class}` : ''}</p>
            )}
            <p className="text-xs text-amber-300 bg-amber-500/10 rounded-lg p-3">{simulatie.reason}</p>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
