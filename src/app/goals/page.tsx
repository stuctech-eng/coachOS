'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, CheckCircle, Trash2, Target, TrendingUp } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'

interface Goal {
  id: string
  title: string
  goal_type: string
  status: string
  priority: number
  target_value: number | null
  current_value: number | null
  target_date: string | null
}

interface GoalUpdate {
  id: string
  current_value: number
  notes: string | null
  created_at: string
}

const DOEL_SUGGESTIES = ['Afvallen', 'Spiermassa opbouwen', 'Meer bewegen', 'Beter slapen', 'Minder stress', 'Marathon lopen', 'Fitter worden', 'Gezonder eten']

function GoalDetail({ goal, onClose, onUpdate, onAfronden, onVerwijder }: {
  goal: Goal
  onClose: () => void
  onUpdate: (id: string, value: number) => void
  onAfronden: (id: string) => void
  onVerwijder: (id: string) => void
}) {
  const [updates, setUpdates] = useState<GoalUpdate[]>([])
  const [nieuweWaarde, setNieuweWaarde] = useState(goal.current_value?.toString() || '')
  const [nieuweNotitie, setNieuweNotitie] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/goal-updates?goal_id=' + goal.id)
      .then(r => r.json())
      .then(d => setUpdates(d.updates || []))
      .catch(() => {})
  }, [goal.id])

  async function slaOp() {
    if (!nieuweWaarde) return
    setSaving(true)
    try {
      const res = await fetch('/api/goal-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal_id: goal.id, current_value: Number(nieuweWaarde), notes: nieuweNotitie || null }),
      })
      const data = await res.json()
      if (data.update) {
        setUpdates(prev => [data.update, ...prev])
        onUpdate(goal.id, Number(nieuweWaarde))
        setNieuweNotitie('')
        setMessage('✅ Voortgang opgeslagen')
        setTimeout(() => setMessage(''), 2000)
      }
    } catch {
      setMessage('❌ Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center active:bg-slate-700">
          <ArrowLeft size={20} className="text-slate-400" />
        </button>
        <h2 className="text-lg font-bold text-white flex-1">{goal.title}</h2>
        <button onClick={() => onAfronden(goal.id)} className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
          <CheckCircle size={18} className="text-green-400" />
        </button>
        <button onClick={() => onVerwijder(goal.id)} className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
          <Trash2 size={16} className="text-red-400" />
        </button>
      </div>

      {message && <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-3"><p className="text-primary-400 text-sm">{message}</p></div>}

      {/* Voortgang bijwerken */}
      <Card className="p-4 flex flex-col gap-4">
        <p className="text-sm font-semibold text-white">Voortgang bijwerken</p>
        {goal.target_value && (
          <div className="bg-slate-800 rounded-xl p-3">
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>Huidig: {goal.current_value ?? '—'}</span>
              <span>Doel: {goal.target_value}</span>
            </div>
            {goal.current_value && goal.target_value && (
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (goal.current_value / goal.target_value) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">
            {goal.target_value ? 'Nieuwe waarde' : 'Notitie over voortgang'}
          </label>
          {goal.target_value ? (
            <input
              type="number"
              value={nieuweWaarde}
              onChange={e => setNieuweWaarde(e.target.value)}
              placeholder={goal.current_value?.toString() || '0'}
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
            />
          ) : (
            <input
              value={nieuweNotitie}
              onChange={e => setNieuweNotitie(e.target.value)}
              placeholder="Hoe gaat het met dit doel?"
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
            />
          )}
        </div>
        {goal.target_value && (
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Notitie</label>
            <input value={nieuweNotitie} onChange={e => setNieuweNotitie(e.target.value)}
              placeholder="Optioneel..." className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        )}
        <Button onClick={slaOp} loading={saving} fullWidth size="sm">Opslaan</Button>
      </Card>

      {/* Historie */}
      {updates.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Historie</p>
          <div className="flex flex-col gap-2">
            {updates.map(u => (
              <Card key={u.id} className="p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">{new Date(u.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</p>
                  {u.current_value && <span className="text-sm font-bold text-primary-400">{u.current_value}</span>}
                </div>
                {u.notes && <p className="text-xs text-slate-400 mt-1">{u.notes}</p>}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function GoalsPage() {
  const router = useRouter()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showNieuw, setShowNieuw] = useState(false)
  const [geselecteerde, setGeselecteerde] = useState<Goal | null>(null)
  const [nieuwDoel, setNieuwDoel] = useState('')
  const [doelWaarde, setDoelWaarde] = useState('')
  const [toevoegen, setToevoegen] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { laadDoelen() }, [])

  async function laadDoelen() {
    setLoading(true)
    try {
      const res = await fetch('/api/goals')
      const data = await res.json()
      setGoals(data.goals || [])
    } catch {
      setGoals([])
    } finally {
      setLoading(false)
    }
  }

  async function voegToe(titel: string) {
    if (!titel.trim()) return
    setToevoegen(true)
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titel.trim(), goal_type: 'custom', target_value: doelWaarde ? Number(doelWaarde) : null }),
      })
      const data = await res.json()
      if (data.goal) {
        setGoals(g => [...g, data.goal])
        setNieuwDoel('')
        setDoelWaarde('')
        setShowNieuw(false)
        setMessage('✅ Doel toegevoegd')
        setTimeout(() => setMessage(''), 2000)
      }
    } catch {
      setMessage('❌ Toevoegen mislukt')
    } finally {
      setToevoegen(false)
    }
  }

  async function afronden(id: string) {
    await fetch('/api/goals', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'completed' }) })
    setGoals(g => g.map(goal => goal.id === id ? { ...goal, status: 'completed' } : goal))
    setGeselecteerde(null)
    setMessage('✅ Doel afgerond!')
    setTimeout(() => setMessage(''), 2000)
  }

  async function verwijder(id: string) {
    await fetch('/api/goals?id=' + id, { method: 'DELETE' })
    setGoals(g => g.filter(goal => goal.id !== id))
    setGeselecteerde(null)
  }

  function updateWaarde(id: string, value: number) {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, current_value: value } : g))
    if (geselecteerde?.id === id) setGeselecteerde(prev => prev ? { ...prev, current_value: value } : null)
  }

  const actief = goals.filter(g => g.status === 'active')
  const afgerond = goals.filter(g => g.status === 'completed')

  if (geselecteerde) {
    return (
      <AppShell showNav={false}>
        <div className="px-5 py-6">
          <GoalDetail goal={geselecteerde} onClose={() => setGeselecteerde(null)} onUpdate={updateWaarde} onAfronden={afronden} onVerwijder={verwijder} />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/settings')} className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center active:bg-slate-700">
            <ArrowLeft size={20} className="text-slate-400" />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">Doelen</h1>
          <button onClick={() => setShowNieuw(true)} className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center active:bg-primary-700">
            <Plus size={20} className="text-white" />
          </button>
        </div>

        {message && <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-3"><p className="text-primary-400 text-sm">{message}</p></div>}

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-400">Tik op een doel om voortgang bij te werken. De coach gebruikt dit in zijn adviezen.</p>
        </div>

        {showNieuw && (
          <Card className="p-4 flex flex-col gap-3">
            <p className="text-sm font-semibold text-white">Nieuw doel</p>
            <input value={nieuwDoel} onChange={e => setNieuwDoel(e.target.value)}
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500" placeholder="Omschrijf je doel..." />
            <input value={doelWaarde} onChange={e => setDoelWaarde(e.target.value)} type="number"
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500" placeholder="Doelwaarde (optioneel, bijv. 10 voor 10km)" />
            <div className="flex flex-wrap gap-2">
              {DOEL_SUGGESTIES.filter(s => !actief.find(g => g.title === s)).map(s => (
                <button key={s} onClick={() => voegToe(s)} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-full text-xs active:bg-slate-700">+ {s}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => voegToe(nieuwDoel)} loading={toevoegen} fullWidth size="sm">Toevoegen</Button>
              <button onClick={() => setShowNieuw(false)} className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl text-sm">Annuleer</button>
            </div>
          </Card>
        )}

        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Actief ({actief.length})</p>
          {loading ? (
            <div className="flex flex-col gap-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-2xl bg-coach-card animate-pulse" />)}</div>
          ) : actief.length === 0 ? (
            <Card className="p-6 text-center">
              <Target size={32} className="text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Nog geen doelen</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {actief.map(goal => (
                <button key={goal.id} onClick={() => setGeselecteerde(goal)} className="w-full text-left">
                  <Card className="p-4 active:bg-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                        <Target size={16} className="text-primary-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-white font-medium">{goal.title}</p>
                        {goal.target_value && goal.current_value && (
                          <div className="mt-1.5 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.min(100, (goal.current_value / goal.target_value) * 100)}%` }} />
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {goal.current_value !== null && goal.target_value && (
                          <p className="text-xs text-primary-400 font-medium">{goal.current_value}/{goal.target_value}</p>
                        )}
                        <p className="text-xs text-slate-500">Tik →</p>
                      </div>
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </div>

        {afgerond.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Afgerond ({afgerond.length})</p>
            <div className="flex flex-col gap-2">
              {afgerond.map(goal => (
                <Card key={goal.id} className="p-4 opacity-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={16} className="text-green-400" />
                    </div>
                    <p className="flex-1 text-sm text-slate-400 line-through">{goal.title}</p>
                    <button onClick={() => verwijder(goal.id)} className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
