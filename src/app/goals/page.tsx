'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, CheckCircle, Trash2, Target } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'

interface Goal {
  id: string
  title: string
  goal_type: string
  status: string
  priority: number
  target_date: string | null
  created_at: string
}

const DOEL_SUGGESTIES = [
  'Afvallen',
  'Spiermassa opbouwen',
  'Meer bewegen',
  'Beter slapen',
  'Minder stress',
  'Marathon lopen',
  'Fitter worden',
  'Gezonder eten',
]

export default function GoalsPage() {
  const router = useRouter()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [nieuwDoel, setNieuwDoel] = useState('')
  const [toevoegen, setToevoegen] = useState(false)
  const [showNieuw, setShowNieuw] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    laadDoelen()
  }, [])

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
        body: JSON.stringify({ title: titel.trim(), goal_type: 'custom' }),
      })
      const data = await res.json()
      if (data.error) {
        setMessage('❌ ' + data.error)
      } else {
        setGoals(g => [...g, data.goal])
        setNieuwDoel('')
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

  async function verwijder(id: string) {
    try {
      await fetch('/api/goals?id=' + id, { method: 'DELETE' })
      setGoals(g => g.filter(goal => goal.id !== id))
    } catch {
      setMessage('❌ Verwijderen mislukt')
    }
  }

  async function afronden(id: string) {
    try {
      await fetch('/api/goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'completed' }),
      })
      setGoals(g => g.map(goal => goal.id === id ? { ...goal, status: 'completed' } : goal))
      setMessage('✅ Doel afgerond!')
      setTimeout(() => setMessage(''), 2000)
    } catch {
      setMessage('❌ Updaten mislukt')
    }
  }

  const actief = goals.filter(g => g.status === 'active')
  const afgerond = goals.filter(g => g.status === 'completed')

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center active:bg-slate-700">
            <ArrowLeft size={20} className="text-slate-400" />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">Doelen beheren</h1>
          <button
            onClick={() => setShowNieuw(true)}
            className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center active:bg-primary-700"
          >
            <Plus size={20} className="text-white" />
          </button>
        </div>

        {message && (
          <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-3">
            <p className="text-primary-400 text-sm">{message}</p>
          </div>
        )}

        {/* Nieuw doel toevoegen */}
        {showNieuw && (
          <Card className="p-4 flex flex-col gap-3">
            <p className="text-sm font-semibold text-white">Nieuw doel</p>
            <input
              value={nieuwDoel}
              onChange={e => setNieuwDoel(e.target.value)}
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Omschrijf je doel..."
              autoFocus
            />
            {/* Suggesties */}
            <div className="flex flex-wrap gap-2">
              {DOEL_SUGGESTIES.filter(s => !actief.find(g => g.title === s)).map(s => (
                <button
                  key={s}
                  onClick={() => voegToe(s)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-full text-xs active:bg-slate-700"
                >
                  + {s}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => voegToe(nieuwDoel)} loading={toevoegen} fullWidth size="sm">
                Toevoegen
              </Button>
              <button
                onClick={() => { setShowNieuw(false); setNieuwDoel('') }}
                className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl text-sm active:bg-slate-700"
              >
                Annuleer
              </button>
            </div>
          </Card>
        )}

        {/* Actieve doelen */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">
            Actieve doelen ({actief.length})
          </p>
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 rounded-2xl bg-coach-card animate-pulse" />
              ))}
            </div>
          ) : actief.length === 0 ? (
            <Card className="p-6 text-center">
              <Target size={32} className="text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Nog geen doelen</p>
              <p className="text-xs text-slate-500 mt-1">Tik op + om een doel toe te voegen</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {actief.map(goal => (
                <Card key={goal.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                      <Target size={16} className="text-primary-400" />
                    </div>
                    <p className="flex-1 text-sm text-white">{goal.title}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => afronden(goal.id)}
                        className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center active:bg-green-500/20"
                      >
                        <CheckCircle size={16} className="text-green-400" />
                      </button>
                      <button
                        onClick={() => verwijder(goal.id)}
                        className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center active:bg-red-500/20"
                      >
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Afgeronde doelen */}
        {afgerond.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">
              Afgerond ({afgerond.length})
            </p>
            <div className="flex flex-col gap-2">
              {afgerond.map(goal => (
                <Card key={goal.id} className="p-4 opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={16} className="text-green-400" />
                    </div>
                    <p className="flex-1 text-sm text-slate-400 line-through">{goal.title}</p>
                    <button
                      onClick={() => verwijder(goal.id)}
                      className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center active:bg-red-500/20"
                    >
                      <Trash2 size={16} className="text-red-400" />
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
