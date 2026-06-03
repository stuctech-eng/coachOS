'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Calendar } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'

interface LifeEvent {
  id: string
  type: string
  start_time: string
  end_time: string | null
  recovery_impact: number
  stress_load: number
  sleep_disruption: number
  notes: string | null
}

const EVENT_TYPES = [
  { type: 'nachtdienst', label: 'Nachtdienst', icon: '🌙', recovery_impact: 2, stress_load: 1, sleep_disruption: 3 },
  { type: 'vroege_dienst', label: 'Vroege dienst', icon: '🌅', recovery_impact: 1, stress_load: 1, sleep_disruption: 2 },
  { type: 'reizen', label: 'Reizen', icon: '✈️', recovery_impact: 2, stress_load: 1, sleep_disruption: 1 },
  { type: 'werk_stress', label: 'Werkstress', icon: '💼', recovery_impact: 1, stress_load: 3, sleep_disruption: 1 },
  { type: 'feest', label: 'Feest / Late avond', icon: '🎉', recovery_impact: 2, stress_load: 0, sleep_disruption: 2 },
  { type: 'ziek', label: 'Ziek', icon: '🤒', recovery_impact: 3, stress_load: 1, sleep_disruption: 2 },
  { type: 'emotionele_stress', label: 'Emotionele stress', icon: '😔', recovery_impact: 2, stress_load: 3, sleep_disruption: 2 },
  { type: 'vakantie', label: 'Vakantie', icon: '🏖️', recovery_impact: 0, stress_load: 0, sleep_disruption: 1 },
]

function formatDatum(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function ImpactBadge({ label, value }: { label: string; value: number }) {
  if (value === 0) return null
  const kleur = value >= 3 ? 'text-red-400 bg-red-500/10' : value >= 2 ? 'text-orange-400 bg-orange-500/10' : 'text-yellow-400 bg-yellow-500/10'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${kleur}`}>
      {label} {'●'.repeat(value)}
    </span>
  )
}

export default function LifeEventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<LifeEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showNieuw, setShowNieuw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [geselecteerd, setGeselecteerd] = useState<typeof EVENT_TYPES[0] | null>(null)
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16))
  const [notes, setNotes] = useState('')

  useEffect(() => {
    laadEvents()
  }, [])

  async function laadEvents() {
    setLoading(true)
    try {
      const res = await fetch('/api/life-events')
      const data = await res.json()
      setEvents(data.events || [])
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  async function voegToe() {
    if (!geselecteerd) return
    setSaving(true)
    try {
      const res = await fetch('/api/life-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: geselecteerd.type,
          start_time: new Date(startTime).toISOString(),
          recovery_impact: geselecteerd.recovery_impact,
          stress_load: geselecteerd.stress_load,
          sleep_disruption: geselecteerd.sleep_disruption,
          notes: notes || null,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setMessage('❌ ' + data.error)
      } else {
        setEvents(prev => [data.event, ...prev])
        setShowNieuw(false)
        setGeselecteerd(null)
        setNotes('')
        setMessage('✅ Event toegevoegd')
        setTimeout(() => setMessage(''), 2000)
      }
    } catch {
      setMessage('❌ Toevoegen mislukt')
    } finally {
      setSaving(false)
    }
  }

  async function verwijder(id: string) {
    try {
      await fetch('/api/life-events?id=' + id, { method: 'DELETE' })
      setEvents(prev => prev.filter(e => e.id !== id))
    } catch {
      setMessage('❌ Verwijderen mislukt')
    }
  }

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
          <h1 className="text-xl font-bold text-white flex-1">Levensgebeurtenissen</h1>
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
            De coach past je herstel- en trainingsadvies aan op basis van wat er in je leven speelt.
          </p>
        </div>

        {/* Nieuw event */}
        {showNieuw && (
          <Card className="p-4 flex flex-col gap-4">
            <p className="text-sm font-semibold text-white">Wat speelt er?</p>

            <div className="grid grid-cols-2 gap-2">
              {EVENT_TYPES.map(et => (
                <button
                  key={et.type}
                  onClick={() => setGeselecteerd(et)}
                  className={`flex items-center gap-2 px-3 py-3 rounded-xl text-sm transition-colors text-left ${
                    geselecteerd?.type === et.type
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-800 text-slate-300 active:bg-slate-700'
                  }`}
                >
                  <span className="text-lg">{et.icon}</span>
                  <span className="text-xs font-medium">{et.label}</span>
                </button>
              ))}
            </div>

            {geselecteerd && (
              <>
                <div className="flex gap-2 flex-wrap">
                  <ImpactBadge label="Herstel" value={geselecteerd.recovery_impact} />
                  <ImpactBadge label="Stress" value={geselecteerd.stress_load} />
                  <ImpactBadge label="Slaap" value={geselecteerd.sleep_disruption} />
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Wanneer</label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Notitie (optioneel)</label>
                  <input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Extra context..."
                    className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button onClick={voegToe} loading={saving} fullWidth size="sm" disabled={!geselecteerd}>
                Opslaan
              </Button>
              <button
                onClick={() => { setShowNieuw(false); setGeselecteerd(null) }}
                className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl text-sm active:bg-slate-700"
              >
                Annuleer
              </button>
            </div>
          </Card>
        )}

        {/* Events lijst */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Laatste 14 dagen</p>
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-coach-card animate-pulse" />)}
            </div>
          ) : events.length === 0 ? (
            <Card className="p-6 text-center">
              <Calendar size={32} className="text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Geen events geregistreerd</p>
              <p className="text-xs text-slate-500 mt-1">Tik op + om een event toe te voegen</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {events.map(event => {
                const et = EVENT_TYPES.find(e => e.type === event.type)
                return (
                  <Card key={event.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">{et?.icon || '📅'}</span>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{et?.label || event.type}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{formatDatum(event.start_time)}</p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          <ImpactBadge label="Herstel" value={event.recovery_impact} />
                          <ImpactBadge label="Stress" value={event.stress_load} />
                          <ImpactBadge label="Slaap" value={event.sleep_disruption} />
                        </div>
                        {event.notes && <p className="text-xs text-slate-400 mt-1">{event.notes}</p>}
                      </div>
                      <button
                        onClick={() => verwijder(event.id)}
                        className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center active:bg-red-500/20 flex-shrink-0"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </AppShell>
  )
}
