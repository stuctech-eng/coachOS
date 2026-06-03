'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, CheckCircle, Trash2, AlertTriangle, Activity } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'

interface Injury {
  id: string
  body_part: string
  pain_score: number | null
  started_at: string | null
  notes: string | null
  active: boolean
  created_at: string
}

const LICHAAMSDELEN = [
  'Knie', 'Enkel', 'Achillespees', 'Schouder', 'Rug', 'Nek',
  'Heup', 'Hamstring', 'Kuit', 'Voet', 'Elleboog', 'Pols',
]

export default function InjuriesPage() {
  const router = useRouter()
  const [injuries, setInjuries] = useState<Injury[]>([])
  const [loading, setLoading] = useState(true)
  const [showNieuw, setShowNieuw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    body_part: '',
    pain_score: 5,
    started_at: new Date().toISOString().split('T')[0],
    notes: '',
  })

  useEffect(() => {
    laadBlessures()
  }, [])

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
      const res = await fetch('/api/injuries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error) {
        setMessage('❌ ' + data.error)
      } else {
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
    try {
      await fetch('/api/injuries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active: false }),
      })
      setInjuries(prev => prev.map(i => i.id === id ? { ...i, active: false } : i))
      setMessage('✅ Blessure hersteld!')
      setTimeout(() => setMessage(''), 2000)
    } catch {
      setMessage('❌ Updaten mislukt')
    }
  }

  async function verwijder(id: string) {
    try {
      await fetch('/api/injuries?id=' + id, { method: 'DELETE' })
      setInjuries(prev => prev.filter(i => i.id !== id))
    } catch {
      setMessage('❌ Verwijderen mislukt')
    }
  }

  const actief = injuries.filter(i => i.active)
  const hersteld = injuries.filter(i => !i.active)

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/settings')}
            className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center active:bg-slate-700"
          >
            <ArrowLeft size={20} className="text-slate-400" />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">Blessures</h1>
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

        {/* Info */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-400">
            De coach houdt automatisch rekening met je actieve blessures bij alle adviezen.
          </p>
        </div>

        {/* Nieuw formulier */}
        {showNieuw && (
          <Card className="p-4 flex flex-col gap-4">
            <p className="text-sm font-semibold text-white">Nieuwe blessure</p>

            {/* Lichaamsdeel */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Lichaamsdeel</label>
              <div className="flex flex-wrap gap-2">
                {LICHAAMSDELEN.map(deel => (
                  <button
                    key={deel}
                    onClick={() => setForm(f => ({ ...f, body_part: deel }))}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                      form.body_part === deel
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-800 text-slate-400 active:bg-slate-700'
                    }`}
                  >
                    {deel}
                  </button>
                ))}
              </div>
              <input
                value={LICHAAMSDELEN.includes(form.body_part) ? '' : form.body_part}
                onChange={e => setForm(f => ({ ...f, body_part: e.target.value }))}
                placeholder="Of typ zelf..."
                className="mt-2 w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Pijnscore */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block">
                Pijnscore: <span className="text-white font-semibold">{form.pain_score}/10</span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={form.pain_score}
                onChange={e => setForm(f => ({ ...f, pain_score: Number(e.target.value) }))}
                className="w-full accent-primary-500"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Licht (1)</span>
                <span>Ernstig (10)</span>
              </div>
            </div>

            {/* Startdatum */}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Startdatum</label>
              <input
                type="date"
                value={form.started_at}
                onChange={e => setForm(f => ({ ...f, started_at: e.target.value }))}
                className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Notities */}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Notities</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Beschrijf de blessure..."
                rows={2}
                className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={voegToe} loading={saving} fullWidth size="sm">
                Opslaan
              </Button>
              <button
                onClick={() => setShowNieuw(false)}
                className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl text-sm active:bg-slate-700"
              >
                Annuleer
              </button>
            </div>
          </Card>
        )}

        {/* Actieve blessures */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">
            Actief ({actief.length})
          </p>
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-coach-card animate-pulse" />)}
            </div>
          ) : actief.length === 0 ? (
            <Card className="p-6 text-center">
              <Activity size={32} className="text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Geen actieve blessures</p>
              <p className="text-xs text-slate-500 mt-1">Tik op + om een blessure toe te voegen</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {actief.map(injury => (
                <Card key={injury.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle size={16} className="text-red-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-white font-semibold text-sm">{injury.body_part}</p>
                        {injury.pain_score && (
                          <span className="text-xs text-red-400 font-medium">
                            Pijn: {injury.pain_score}/10
                          </span>
                        )}
                      </div>
                      {injury.started_at && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Sinds {new Date(injury.started_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                        </p>
                      )}
                      {injury.notes && (
                        <p className="text-xs text-slate-400 mt-1">{injury.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => herstel(injury.id)}
                        className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center active:bg-green-500/20"
                      >
                        <CheckCircle size={16} className="text-green-400" />
                      </button>
                      <button
                        onClick={() => verwijder(injury.id)}
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

        {/* Herstelde blessures */}
        {hersteld.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">
              Hersteld ({hersteld.length})
            </p>
            <div className="flex flex-col gap-2">
              {hersteld.map(injury => (
                <Card key={injury.id} className="p-4 opacity-50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={16} className="text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-slate-400 text-sm line-through">{injury.body_part}</p>
                    </div>
                    <button
                      onClick={() => verwijder(injury.id)}
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
