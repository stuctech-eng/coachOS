'use client'
import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, CheckCircle, Trash2, Target } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'
import Link from 'next/link'

interface Goal {
  id: string
  title: string
  goal_type: string
  status: string
  priority: number
  target_value: number | null
  current_value: number | null
  target_date: string | null
  // v2.4.88: Goal Engine-velden
  goal_scope: 'global' | 'specialist'
  specialist_type: string | null
  importance: 'must' | 'high' | 'normal' | 'low'
}

interface GoalUpdate {
  id: string
  current_value: number | null
  notes: string | null
  created_at: string
}

const DOEL_SUGGESTIES = ['Afvallen', 'Spiermassa opbouwen', 'Meer bewegen', 'Beter slapen', 'Minder stress', 'Marathon lopen', 'Fitter worden', 'Gezonder eten']

// ── v2.4.88: Goal Engine-UI — doeltype-, preset- en importance-config ──
// Bron: vervolgoverleg op specialist-api.md / goal-engine.ts. Ontworpen
// om schaalbaar te zijn — een toekomstige specialist toevoegen betekent
// alleen een nieuwe DOELTYPES-regel + PRESETS-entry, geen structuurwijziging.

interface DoeltypeOptie {
  key: string
  label: string
  icoon: string
  beschikbaar: boolean // false = specialist bestaat nog niet (status 'development')
}

// Bewust gesynchroniseerd met SPECIALIST_CONFIG in api/specialists/route.ts
// — alleen 'cycling'/'running' zijn daar 'active', dus alleen die zijn
// hier beschikbaar. Rowing/Strength staan zichtbaar maar uitgeschakeld,
// geen overclaiming van functionaliteit die nog niet bestaat.
const DOELTYPES: DoeltypeOptie[] = [
  { key: 'global', label: 'Algemeen', icoon: '🌍', beschikbaar: true },
  { key: 'cycling', label: 'Wielrennen', icoon: '🚴', beschikbaar: true },
  { key: 'running', label: 'Hardlopen', icoon: '🏃', beschikbaar: true },
  { key: 'rowing', label: 'Roeien', icoon: '🚣', beschikbaar: false },
  { key: 'strength', label: 'Krachttraining', icoon: '🏋️', beschikbaar: false },
]

interface DoelPreset {
  title: string
  target_value_label?: string
  target_date_label?: string
}

const PRESETS: Record<string, DoelPreset[]> = {
  cycling: [
    { title: 'FTP verhogen', target_value_label: 'Streef-FTP (watt)' },
    { title: 'Kilometerdoel', target_value_label: 'Streefafstand (km)' },
    { title: 'Hoogtemeters', target_value_label: 'Streef-hoogtemeters (m)' },
    { title: 'Gran Fondo', target_date_label: 'Wedstrijddatum' },
    { title: 'Tijdrit', target_value_label: 'Streeftijd (minuten)', target_date_label: 'Wedstrijddatum' },
    { title: 'Klimprestatie', target_date_label: 'Wedstrijddatum' },
  ],
  running: [
    { title: '5 km', target_value_label: 'Streeftijd (minuten)', target_date_label: 'Wedstrijddatum' },
    { title: '10 km', target_value_label: 'Streeftijd (minuten)', target_date_label: 'Wedstrijddatum' },
    { title: 'Halve marathon', target_value_label: 'Streeftijd (minuten)', target_date_label: 'Wedstrijddatum' },
    { title: 'Marathon', target_value_label: 'Streeftijd (minuten)', target_date_label: 'Wedstrijddatum' },
    { title: 'Weekkilometers', target_value_label: 'Streefafstand per week (km)' },
    { title: 'Tempo', target_value_label: 'Streeftempo (min/km)' },
  ],
}

const IMPORTANCE_OPTIES: { key: 'high' | 'normal' | 'low'; label: string }[] = [
  { key: 'high', label: 'Hoog' },
  { key: 'normal', label: 'Normaal' },
  { key: 'low', label: 'Laag' },
]

function specialistIcoon(specialistType: string | null): string {
  return DOELTYPES.find(d => d.key === specialistType)?.icoon || '🌍'
}

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
    if (!nieuweWaarde && !nieuweNotitie) return
    setSaving(true)
    try {
      const res = await fetch('/api/goal-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal_id: goal.id,
          current_value: nieuweWaarde ? Number(nieuweWaarde) : null,
          notes: nieuweNotitie || null,
        }),
      })
      const data = await res.json()
      if (data.update) {
        setUpdates(prev => [data.update, ...prev])
        if (nieuweWaarde) onUpdate(goal.id, Number(nieuweWaarde))
        setNieuweNotitie('')
        setMessage('✅ Voortgang opgeslagen')
        setTimeout(() => setMessage(''), 2000)
      } else {
        setMessage('❌ ' + (data.error || 'Opslaan mislukt'))
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
                <div className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (goal.current_value / goal.target_value) * 100)}%` }} />
              </div>
            )}
          </div>
        )}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">
            {goal.target_value ? 'Nieuwe waarde' : 'Notitie over voortgang'}
          </label>
          {goal.target_value ? (
            <input type="number" value={nieuweWaarde} onChange={e => setNieuweWaarde(e.target.value)}
              placeholder={goal.current_value?.toString() || '0'}
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
          ) : (
            <input value={nieuweNotitie} onChange={e => setNieuweNotitie(e.target.value)}
              placeholder="Hoe gaat het met dit doel?"
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
          )}
        </div>
        {goal.target_value && (
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Notitie</label>
            <input value={nieuweNotitie} onChange={e => setNieuweNotitie(e.target.value)}
              placeholder="Optioneel..."
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        )}
        <Button onClick={slaOp} loading={saving} fullWidth size="sm">Opslaan</Button>
      </Card>

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
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showNieuw, setShowNieuw] = useState(false)
  const [geselecteerde, setGeselecteerde] = useState<Goal | null>(null)
  // v2.4.88: stapsgewijze doel-aanmaakflow — eerst doeltype, dan
  // preset/custom titel, dan importance + relevante velden
  const [nieuwDoeltype, setNieuwDoeltype] = useState<string | null>(null)
  const [nieuwDoel, setNieuwDoel] = useState('')
  const [nieuwCustom, setNieuwCustom] = useState(false)
  const [doelWaarde, setDoelWaarde] = useState('')
  const [doelDatum, setDoelDatum] = useState('')
  const [nieuwImportance, setNieuwImportance] = useState<'high' | 'normal' | 'low'>('normal')
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

  function sluitNieuw() {
    setShowNieuw(false)
    setNieuwDoeltype(null)
    setNieuwDoel('')
    setNieuwCustom(false)
    setDoelWaarde('')
    setDoelDatum('')
    setNieuwImportance('normal')
  }

  async function voegToe(titel: string) {
    if (!titel.trim() || !nieuwDoeltype) return
    setToevoegen(true)
    try {
      const goalScope = nieuwDoeltype === 'global' ? 'global' : 'specialist'
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titel.trim(),
          goal_type: 'custom',
          target_value: doelWaarde ? Number(doelWaarde) : null,
          target_date: doelDatum || null,
          goal_scope: goalScope,
          specialist_type: goalScope === 'specialist' ? nieuwDoeltype : undefined,
          importance: nieuwImportance,
        }),
      })
      const data = await res.json()
      if (data.goal) {
        setGoals(g => [...g, data.goal])
        sluitNieuw()
        setMessage('✅ Doel toegevoegd')
        setTimeout(() => setMessage(''), 2000)
      } else {
        setMessage('❌ ' + (data.error || 'Toevoegen mislukt'))
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
          <Link href={'/settings'} className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center active:bg-slate-700">
            <ArrowLeft size={20} className="text-slate-400" />
          </Link>
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
          <Card className="p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Nieuw doel</p>
              <button onClick={sluitNieuw} className="text-xs text-slate-500">Annuleer</button>
            </div>

            {/* Stap 1: doeltype */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Doeltype</label>
              <div className="grid grid-cols-3 gap-2">
                {DOELTYPES.map(dt => (
                  <button key={dt.key} disabled={!dt.beschikbaar}
                    onClick={() => { setNieuwDoeltype(dt.key); setNieuwDoel(''); setNieuwCustom(false) }}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs disabled:opacity-30 ${
                      nieuwDoeltype === dt.key ? 'bg-primary-500/20 border border-primary-500/40 text-primary-400' : 'bg-slate-800 text-slate-300'
                    }`}>
                    <span className="text-lg">{dt.icoon}</span>
                    <span>{dt.label}</span>
                    {!dt.beschikbaar && <span className="text-[9px] text-slate-600">binnenkort</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Stap 2: preset of custom titel, alleen zichtbaar na doeltype-keuze */}
            {nieuwDoeltype && (
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Doel</label>
                {nieuwDoeltype === 'global' ? (
                  <>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {DOEL_SUGGESTIES.filter(s => !actief.find(g => g.title === s)).map(s => (
                        <button key={s} onClick={() => { setNieuwDoel(s); setNieuwCustom(false) }}
                          className={`px-3 py-1.5 rounded-full text-xs ${nieuwDoel === s && !nieuwCustom ? 'bg-primary-500/20 text-primary-400' : 'bg-slate-800 text-slate-300'}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => { setNieuwCustom(true); setNieuwDoel('') }}
                      className={`text-xs mb-2 ${nieuwCustom ? 'text-primary-400' : 'text-slate-500'}`}>+ Eigen omschrijving</button>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(PRESETS[nieuwDoeltype] || []).map(p => (
                        <button key={p.title} onClick={() => { setNieuwDoel(p.title); setNieuwCustom(false) }}
                          className={`px-3 py-1.5 rounded-full text-xs ${nieuwDoel === p.title && !nieuwCustom ? 'bg-primary-500/20 text-primary-400' : 'bg-slate-800 text-slate-300'}`}>
                          {p.title}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => { setNieuwCustom(true); setNieuwDoel('') }}
                      className={`text-xs mb-2 ${nieuwCustom ? 'text-primary-400' : 'text-slate-500'}`}>+ Eigen doel</button>
                  </>
                )}
                {nieuwCustom && (
                  <input value={nieuwDoel} onChange={e => setNieuwDoel(e.target.value)}
                    className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Omschrijf je doel..." />
                )}
              </div>
            )}

            {/* Stap 3: importance + relevante velden, alleen zichtbaar na titelkeuze */}
            {nieuwDoeltype && nieuwDoel && (
              <>
                <div>
                  <label className="text-xs text-slate-400 mb-2 block">Belangrijkheid</label>
                  <div className="flex gap-2">
                    {IMPORTANCE_OPTIES.map(opt => (
                      <button key={opt.key} onClick={() => setNieuwImportance(opt.key)}
                        className={`flex-1 py-2 rounded-xl text-xs font-medium ${nieuwImportance === opt.key ? 'bg-primary-500 text-white' : 'bg-slate-800 text-slate-300'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(() => {
                  const preset = nieuwDoeltype !== 'global' ? (PRESETS[nieuwDoeltype] || []).find(p => p.title === nieuwDoel) : undefined
                  const waardeLabel = preset?.target_value_label || (nieuwDoeltype === 'global' ? 'Doelwaarde (optioneel)' : undefined)
                  const datumLabel = preset?.target_date_label
                  return (
                    <>
                      {(waardeLabel || nieuwDoeltype === 'global') && (
                        <input value={doelWaarde} onChange={e => setDoelWaarde(e.target.value)} type="number"
                          className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder={waardeLabel || 'Doelwaarde (optioneel)'} />
                      )}
                      {datumLabel && (
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">{datumLabel}</label>
                          <input value={doelDatum} onChange={e => setDoelDatum(e.target.value)} type="date"
                            className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                        </div>
                      )}
                    </>
                  )
                })()}

                <Button onClick={() => voegToe(nieuwDoel)} loading={toevoegen} fullWidth size="sm">Toevoegen</Button>
              </>
            )}
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
                      <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center flex-shrink-0 text-base">
                        {goal.goal_scope === 'specialist' ? specialistIcoon(goal.specialist_type) : <Target size={16} className="text-primary-400" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm text-white font-medium">{goal.title}</p>
                          {goal.importance === 'must' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold">MUST</span>}
                          {goal.importance === 'high' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">hoog</span>}
                        </div>
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
