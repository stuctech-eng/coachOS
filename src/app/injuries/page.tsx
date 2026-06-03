'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, CheckCircle, Trash2, AlertTriangle, Activity, ChevronDown, ChevronUp } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'

interface Injury {
  id: string
  body_part: string
  pain_score: number | null
  started_at: string | null
  notes: string | null
  active: boolean
}

interface InjuryUpdate {
  id: string
  pain_score: number
  notes: string | null
  created_at: string
}

const LICHAAMSDELEN = [
  'Knie', 'Enkel', 'Achillespees', 'Schouder', 'Rug', 'Nek',
  'Heup', 'Hamstring', 'Kuit', 'Voet', 'Elleboog', 'Pols',
]

function InjuryDetail({ injury, onClose, onUpdate, onHerstel, onVerwijder }: {
  injury: Injury
  onClose: () => void
  onUpdate: (id: string, score: number) => void
  onHerstel: (id: string) => void
  onVerwijder: (id: string) => void
}) {
  const [updates, setUpdates] = useState<InjuryUpdate[]>([])
  const [nieuwScore, setNieuwScore] = useState(injury.pain_score || 5)
  const [nieuwNotitie, setNieuwNotitie] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/injury-updates?injury_id=' + injury.id)
      .then(r => r.json())
      .then(d => setUpdates(d.updates || []))
      .catch(() => {})
  }, [injury.id])

  async function slaOp() {
    setSaving(true)
    try {
      const res = await fetch('/api/injury-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ injury_id: injury.id, pain_score: nieuwScore, notes: nieuwNotitie || null }),
      })
      const data = await res.json()
      if (data.update) {
        setUpdates(prev => [data.update, ...prev])
        onUpdate(injury.id, nieuwScore)
        setNieuwNotitie('')
        setMessage('✅ Update opgeslagen')
        setTimeout(() => setMessage(''), 2000)
      }
    } catch {
      setMessage('❌ Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  const pijnKleur = (score: number) => score >= 7 ? 'text-red-400' : score >= 4 ? 'text-orange-400' : 'text-green-400'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center active:bg-slate-700">
          <ArrowLeft size={20} className="text-slate-400" />
        </button>
        <h2 className="text-lg font-bold text-white flex-1">{injury.body_part}</h2>
        <button onClick={() => onHerstel(injury.id)} className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center active:bg-green-500/20">
          <CheckCircle size={18} className="text-green-400" />
        </button>
        <button onClick={() => onVerwijder(injury.id)} className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center active:bg-red-500/20">
          <Trash2 size={16} className="text-red-400" />
        </button>
      </div>

      {message && (
        <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-3">
          <p className="text-primary-400 text-sm">{message}</p>
        </div>
      )}

      {/* Update pijnscore */}
      <Card className="p-4 flex flex-col gap-4">
        <p className="text-sm font-semibold text-white">Hoe is het nu?</p>
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-xs text-slate-400">Pijnscore</label>
            <span className={`text-lg font-bold ${pijnKleur(nieuwScore)}`}>{nieuwScore}/10</span>
          </div>
          <input
            type="range" min="1" max="10" value={nieuwScore}
            onChange={e => setNieuwScore(Number(e.target.value))}
            className="w-full accent-primary-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>Geen pijn (1)</span>
            <span>Ernstig (10)</span>
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Notitie</label>
          <input
            value={nieuwNotitie}
            onChange={e => setNieuwNotitie(e.target.value)}
            placeholder="Hoe voelt het vandaag?"
            className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <Button onClick={slaOp} loading={saving} fullWidth size="sm">Update opslaan</Button>
      </Card>

      {/* Historie */}
      {updates.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Historie</p>
          <div className="flex flex-col gap-2">
            {updates.map((u, i) => (
              <Card key={u.id} className="p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    {new Date(u.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="flex items-center gap-2">
                    {i > 0 && updates[i - 1] && (
                      u.pain_score < updates[i - 1].pain_score
                        ? <ChevronDown size={14} className="text-green-400" />
                        : u.pain_score > updates[i - 1].pain_score
                          ? <ChevronUp size={14} className="text-red-400" />
                          : null
                    )}
                    <span className={`text-sm font-bold ${pijnKleur(u.pain_score)}`}>{u.pain_score}/10</span>
                  </div>
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

export default function InjuriesPage() {
  const router = useRouter()
  const [injuries, setInjuries] = useState<Injury[]>([])
  const [loading, setLoading] = useState(true)
  const [showNieuw, setShowNieuw] = useState(false)
  const [geselecteerde, setGeselecteerde] = useState<Injury | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ body_part: '', pain_score: 5, started_at: new Date().toISOString().split('T')[0], notes: '' })

  useEffect(() => { laadBlessures() }, [])

  async function laadBlessures() {
    setLoading(true)
    try {
      const res = await fetch('/api/injuries')
      const data = await res.json()
      setInjuries(data.injuries || [])
    } catch {
      setInjuries([])
    } finally {
      setLoading(false)
    }
  }

  async function voegToe() {
    if (!form.body_part) return
    setSaving(true)
    try {
      const res = await fetch('/api/injuries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (data.injury) {
        setInjuries(prev => [data.injury, ...prev])
        setShowNieuw(false)
        setForm({ body_part: '', pain_score: 5, started_at: new Date().toISOString().split('T')[0], notes: '' })
        setMessage('✅ Blessure toegevoegd')
        setTimeout(() => setMessage(''), 2000)
      }
    } catch {
      setMessage('❌ Toevoegen mislukt')
    } finally {
      setSaving(false)
    }
  }

  async function herstel(id: string) {
    await fetch('/api/injuries', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, active: false }) })
    setInjuries(prev => prev.map(i => i.id === id ? { ...i, active: false } : i))
    setGeselecteerde(null)
    setMessage('✅ Blessure hersteld!')
    setTimeout(() => setMessage(''), 2000)
  }

  async function verwijder(id: string) {
    await fetch('/api/injuries?id=' + id, { method: 'DELETE' })
    setInjuries(prev => prev.filter(i => i.id !== id))
    setGeselecteerde(null)
  }

  function updateScore(id: string, score: number) {
    setInjuries(prev => prev.map(i => i.id === id ? { ...i, pain_score: score } : i))
    if (geselecteerde?.id === id) setGeselecteerde(prev => prev ? { ...prev, pain_score: score } : null)
  }

  const actief = injuries.filter(i => i.active)
  const hersteld = injuries.filter(i => !i.active)

  if (geselecteerde) {
    return (
      <AppShell showNav={false}>
        <div className="px-5 py-6">
          <InjuryDetail
            injury={geselecteerde}
            onClose={() => setGeselecteerde(null)}
            onUpdate={updateScore}
            onHerstel={herstel}
            onVerwijder={verwijder}
          />
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
          <h1 className="text-xl font-bold text-white flex-1">Blessures</h1>
          <button onClick={() => setShowNieuw(true)} className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center active:bg-primary-700">
            <Plus size={20} className="text-white" />
          </button>
        </div>

        {message && <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-3"><p className="text-primary-400 text-sm">{message}</p></div>}

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-400">Tik op een blessure om de pijnscore bij te werken. De coach past het advies automatisch aan.</p>
        </div>

        {showNieuw && (
          <Card className="p-4 flex flex-col gap-4">
            <p className="text-sm font-semibold text-white">Nieuwe blessure</p>
            <div className="flex flex-wrap gap-2">
              {LICHAAMSDELEN.map(deel => (
                <button key={deel} onClick={() => setForm(f => ({ ...f, body_part: deel }))}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${form.body_part === deel ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {deel}
                </button>
              ))}
            </div>
            <input value={LICHAAMSDELEN.includes(form.body_part) ? '' : form.body_part} onChange={e => setForm(f => ({ ...f, body_part: e.target.value }))}
              placeholder="Of typ zelf..." className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Pijnscore: <span className="text-white font-semibold">{form.pain_score}/10</span></label>
              <input type="range" min="1" max="10" value={form.pain_score} onChange={e => setForm(f => ({ ...f, pain_score: Number(e.target.value) }))} className="w-full accent-primary-500" />
            </div>
            <div className="flex gap-2">
              <Button onClick={voegToe} loading={saving} fullWidth size="sm">Opslaan</Button>
              <button onClick={() => setShowNieuw(false)} className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl text-sm">Annuleer</button>
            </div>
          </Card>
        )}

        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Actief ({actief.length})</p>
          {loading ? (
            <div className="flex flex-col gap-2">{[1,2].map(i => <div key={i} className="h-16 rounded-2xl bg-coach-card animate-pulse" />)}</div>
          ) : actief.length === 0 ? (
            <Card className="p-6 text-center">
              <Activity size={32} className="text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Geen actieve blessures</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {actief.map(injury => (
                <button key={injury.id} onClick={() => setGeselecteerde(injury)} className="w-full text-left">
                  <Card className="p-4 active:bg-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={16} className="text-red-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-semibold text-sm">{injury.body_part}</p>
                        {injury.started_at && <p className="text-xs text-slate-500 mt-0.5">Sinds {new Date(injury.started_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</p>}
                      </div>
                      <div className="text-right">
                        {injury.pain_score && <p className={`text-lg font-bold ${injury.pain_score >= 7 ? 'text-red-400' : injury.pain_score >= 4 ? 'text-orange-400' : 'text-green-400'}`}>{injury.pain_score}/10</p>}
                        <p className="text-xs text-slate-500">Tik om bij te werken</p>
                      </div>
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </div>

        {hersteld.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Hersteld ({hersteld.length})</p>
            <div className="flex flex-col gap-2">
              {hersteld.map(injury => (
                <Card key={injury.id} className="p-4 opacity-50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={16} className="text-green-400" />
                    </div>
                    <p className="flex-1 text-slate-400 text-sm line-through">{injury.body_part}</p>
                    <button onClick={() => verwijder(injury.id)} className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
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
