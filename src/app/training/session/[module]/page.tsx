'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Play, Pause, ChevronLeft, Check, RotateCcw } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { cn } from '@/utils'
import type {
  LiveSessionState, SessionStatus, TrainingSchema,
  TrainingSegment, KettlebellSegment, SessionResult, TrainingModule
} from '@/types/training-engine'
import { SESSION_STORAGE_KEY } from '@/types/training-engine'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function saveSession(state: LiveSessionState) {
  try { localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state)) } catch { /* */ }
}

function loadSession(): LiveSessionState | null {
  try {
    const s = localStorage.getItem(SESSION_STORAGE_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_STORAGE_KEY) } catch { /* */ }
}

// ─── Schema Layer ─────────────────────────────────────────────────────────────

function SchemaLayer({ schema, onStart }: { schema: TrainingSchema; onStart: () => void }) {
  const intensiteitLabel = { light: 'Licht', medium: 'Gemiddeld', heavy: 'Zwaar' }
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Vandaag</p>
        <h2 className="text-xl font-bold text-white mb-1">{schema.title}</h2>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full">{schema.duration} min</span>
          <span className={cn('text-xs px-3 py-1 rounded-full',
            schema.intensity === 'light' ? 'bg-green-500/20 text-green-400' :
            schema.intensity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
            'bg-red-500/20 text-red-400'
          )}>{intensiteitLabel[schema.intensity]}</span>
        </div>
        {schema.coach_message && (
          <p className="text-slate-300 text-sm leading-relaxed mt-3 pt-3 border-t border-coach-border">
            {schema.coach_message}
          </p>
        )}
      </Card>

      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">
          Schema — {schema.segments.length} oefeningen
        </p>
        <div className="flex flex-col gap-2">
          {schema.segments.map((seg, i) => (
            <Card key={i} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {(seg as KettlebellSegment).exercise || seg.type}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {(seg as KettlebellSegment).sets && (seg as KettlebellSegment).reps
                      ? `${(seg as KettlebellSegment).sets} sets × ${(seg as KettlebellSegment).reps} herh.`
                      : (seg as KettlebellSegment).sets && (seg as KettlebellSegment).duration_sec
                      ? `${(seg as KettlebellSegment).sets} sets × ${(seg as KettlebellSegment).duration_sec}s`
                      : `${(seg as { duration_min?: number }).duration_min ?? '—'} min`
                    }
                  </p>
                </div>
                <span className="text-xs text-slate-500">#{i + 1}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <button
        onClick={onStart}
        className="w-full py-4 bg-primary-500 text-white rounded-xl font-semibold active:bg-primary-600"
      >
        Start Training →
      </button>
    </div>
  )
}

// ─── Learning Layer ───────────────────────────────────────────────────────────

function LearningLayer({
  segment, index, total, onNext, onBack
}: {
  segment: TrainingSegment
  index: number
  total: number
  onNext: () => void
  onBack: () => void
}) {
  const kb = segment as KettlebellSegment
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{index + 1} / {total}</p>
        <div className="flex gap-1">
          {Array.from({ length: total }, (_, i) => (
            <div key={i} className={cn('h-1 rounded-full transition-all',
              i < index ? 'bg-primary-500 w-4' :
              i === index ? 'bg-white w-6' : 'bg-slate-700 w-4'
            )} />
          ))}
        </div>
      </div>

      <Card className="p-5">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Oefening {index + 1}</p>
        <h2 className="text-xl font-bold text-white mb-1">{kb.exercise || segment.type}</h2>
        {kb.sets && (
          <p className="text-sm text-primary-400 mt-1">
            {kb.reps ? `${kb.sets} × ${kb.reps} herh.` : `${kb.sets} × ${kb.duration_sec}s`}
            {kb.rest_sec ? ` — ${kb.rest_sec}s rust` : ''}
          </p>
        )}
      </Card>

      {kb.instruction && (
        <Card className="p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Techniek</p>
          <p className="text-sm text-slate-200 leading-relaxed">{kb.instruction}</p>
        </Card>
      )}

      {kb.cue && (
        <Card className="p-4 bg-primary-500/10 border-primary-500/20">
          <p className="text-xs text-primary-400 font-semibold uppercase tracking-wider mb-1">Focuspunt</p>
          <p className="text-sm text-white">{kb.cue}</p>
        </Card>
      )}

      {kb.common_errors && kb.common_errors.length > 0 && (
        <Card className="p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Veelgemaakte fouten</p>
          <div className="flex flex-col gap-2">
            {kb.common_errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5 flex-shrink-0">✕</span>
                <p className="text-sm text-slate-300">{err}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex gap-3">
        {index > 0 && (
          <button onClick={onBack}
            className="flex-1 py-3.5 bg-slate-800 text-slate-300 rounded-xl font-semibold active:bg-slate-700">
            <ChevronLeft size={16} className="inline mr-1" />Vorige
          </button>
        )}
        <button onClick={onNext}
          className="flex-1 py-3.5 bg-primary-500 text-white rounded-xl font-semibold active:bg-primary-600">
          {index === total - 1 ? 'Start Workout →' : 'Volgende →'}
        </button>
      </div>
    </div>
  )
}

// ─── Workout Engine ───────────────────────────────────────────────────────────

function WorkoutEngine({
  schema, currentSegment, completedSegments, elapsedSeconds,
  onComplete, onNextSegment, onTick
}: {
  schema: TrainingSchema
  currentSegment: number
  completedSegments: number[]
  elapsedSeconds: number
  onComplete: () => void
  onNextSegment: () => void
  onTick: () => void
}) {
  const [running, setRunning] = useState(true)
  const [restTimer, setRestTimer] = useState<number | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const restRef = useRef<NodeJS.Timeout | null>(null)

  const seg = schema.segments[currentSegment] as KettlebellSegment
  const isLast = currentSegment === schema.segments.length - 1

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(onTick, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, onTick])

  function handleSegmentDone() {
    if (restRef.current) clearTimeout(restRef.current)
    const restSec = seg.rest_sec || 60
    setRestTimer(restSec)
    setRunning(false)
    let t = restSec
    restRef.current = setInterval(() => {
      t--
      setRestTimer(t)
      if (t <= 0) {
        clearInterval(restRef.current!)
        setRestTimer(null)
        setRunning(true)
        if (isLast) onComplete()
        else onNextSegment()
      }
    }, 1000)
  }

  useEffect(() => {
    return () => {
      if (restRef.current) clearInterval(restRef.current)
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      {/* Voortgang */}
      <div className="flex items-center gap-2">
        {schema.segments.map((_, i) => (
          <div key={i} className={cn('flex-1 h-1.5 rounded-full transition-all',
            completedSegments.includes(i) ? 'bg-green-500' :
            i === currentSegment ? 'bg-primary-500' : 'bg-slate-700'
          )} />
        ))}
      </div>

      {/* Elapsed timer */}
      <div className="text-center">
        <p className="text-3xl font-mono font-bold text-white">{formatTime(elapsedSeconds)}</p>
        <p className="text-xs text-slate-500 mt-1">{currentSegment + 1} / {schema.segments.length} oefeningen</p>
      </div>

      {/* Rust timer */}
      {restTimer !== null && (
        <Card className="p-5 text-center bg-amber-500/10 border-amber-500/20">
          <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-2">Rust</p>
          <p className="text-5xl font-mono font-bold text-amber-400">{restTimer}s</p>
          <p className="text-slate-400 text-sm mt-2">Volgende: {(schema.segments[currentSegment + 1] as KettlebellSegment)?.exercise || '—'}</p>
        </Card>
      )}

      {/* Huidige oefening */}
      {restTimer === null && (
        <Card className="p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Nu</p>
          <h2 className="text-2xl font-bold text-white mb-2">{seg.exercise || seg.type}</h2>
          {seg.reps && <p className="text-4xl font-bold text-primary-400">{seg.sets} × {seg.reps}</p>}
          {!seg.reps && seg.duration_sec && (
            <p className="text-4xl font-bold text-primary-400">{seg.sets} × {seg.duration_sec}s</p>
          )}
          {seg.cue && (
            <p className="text-sm text-slate-300 mt-3 pt-3 border-t border-coach-border">{seg.cue}</p>
          )}
        </Card>
      )}

      {/* Controls */}
      {restTimer === null && (
        <div className="flex gap-3">
          <button
            onClick={() => setRunning(!running)}
            className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center active:bg-slate-700"
          >
            {running ? <Pause size={20} className="text-white" /> : <Play size={20} className="text-white" />}
          </button>
          <button
            onClick={handleSegmentDone}
            className="flex-1 py-3.5 bg-primary-500 text-white rounded-xl font-semibold active:bg-primary-600"
          >
            {isLast ? 'Klaar ✓' : 'Volgende →'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Evaluatie Layer ──────────────────────────────────────────────────────────

function EvaluatieLayer({
  actualDuration, onSave, saving
}: {
  actualDuration: number
  onSave: (result: SessionResult) => void
  saving: boolean
}) {
  const [rating, setRating] = useState<number | null>(null)
  const [effort, setEffort] = useState<number | null>(null)
  const [fatigue, setFatigue] = useState<number | null>(null)
  const [soreness, setSoreness] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  function ScoreRij({ label, value, onChange, kleur }: {
    label: string; value: number | null; onChange: (v: number) => void; kleur: string
  }) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-slate-300">{label}</p>
          {value && <p className={cn('text-sm font-bold', kleur)}>{value}/10</p>}
        </div>
        <div className="flex gap-1">
          {[1,2,3,4,5,6,7,8,9,10].map(n => (
            <button key={n} onClick={() => onChange(n)}
              className={cn('flex-1 h-9 rounded-lg text-xs font-semibold transition-colors',
                value === n ? 'bg-primary-500 text-white' : 'bg-slate-800 text-slate-400'
              )}>{n}</button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5 text-center">
        <p className="text-4xl mb-2">🎉</p>
        <h2 className="text-xl font-bold text-white">Training voltooid!</h2>
        <p className="text-slate-400 text-sm mt-1">{formatTime(actualDuration * 60)}</p>
      </Card>

      <Card className="p-5 flex flex-col gap-5">
        <ScoreRij label="Rating" value={rating} onChange={setRating} kleur="text-primary-400" />
        <ScoreRij label="Hoe zwaar voelde het?" value={effort} onChange={setEffort} kleur="text-orange-400" />
        <ScoreRij label="Vermoeidheid achteraf" value={fatigue} onChange={setFatigue} kleur="text-red-400" />
        <ScoreRij label="Spierpijn" value={soreness} onChange={setSoreness} kleur="text-purple-400" />

        <div>
          <p className="text-sm text-slate-300 mb-2">Opmerkingen</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Hoe ging het? Wat voelde goed of zwaar?"
            rows={3}
            className="w-full bg-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </Card>

      <button
        onClick={() => onSave({
          rating, perceived_effort: effort, fatigue_after: fatigue,
          soreness, notes: notes.trim() || null,
          actual_duration: actualDuration, completed: true,
        })}
        disabled={saving || !rating}
        className="w-full py-4 bg-primary-500 text-white rounded-xl font-semibold active:bg-primary-600 disabled:opacity-40"
      >
        {saving ? 'Opslaan...' : 'Opslaan & afsluiten'}
      </button>
    </div>
  )
}

// ─── Main Session Page ────────────────────────────────────────────────────────

export default function SessionPage() {
  const params = useParams()
  const router = useRouter()
  const module = params.module as TrainingModule

  const [session, setSession] = useState<LiveSessionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [learningIndex, setLearningIndex] = useState(0)

  // Laad sessie — herstel of genereer nieuw
  useEffect(() => {
    const existing = loadSession()
    if (existing && existing.module === module && existing.status !== 'completed') {
      setSession(existing)
      setLoading(false)
      return
    }
    // Genereer nieuw schema via training/today
    fetch('/api/training/today', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          const instruction = data.instruction || data
          const schema: TrainingSchema = {
            module,
            title: instruction.title || `${module.charAt(0).toUpperCase() + module.slice(1)} sessie`,
            duration: instruction.duration || 30,
            intensity: instruction.intensity || 'medium',
            segments: instruction.segments || instruction.exercises || [],
            coach_message: instruction.coach_message || instruction.reason || '',
          }
          const newSession: LiveSessionState = {
            session_id: generateSessionId(),
            module,
            status: 'schema',
            schema,
            started_at: new Date().toISOString(),
            current_segment: 0,
            completed_segments: [],
            elapsed_seconds: 0,
          }
          saveSession(newSession)
          setSession(newSession)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [module])

  // Auto-save op state changes
  useEffect(() => {
    if (session) saveSession(session)
  }, [session])

  const handleTick = useCallback(() => {
    setSession(prev => {
      if (!prev) return prev
      return { ...prev, elapsed_seconds: prev.elapsed_seconds + 1 }
    })
  }, [])

  function updateStatus(status: SessionStatus) {
    setSession(prev => prev ? { ...prev, status } : prev)
  }

  function handleNextSegment() {
    setSession(prev => {
      if (!prev) return prev
      const next = prev.current_segment + 1
      return {
        ...prev,
        current_segment: next,
        completed_segments: [...prev.completed_segments, prev.current_segment],
      }
    })
  }

  async function handleSave(result: SessionResult) {
    if (!session) return
    setSaving(true)
    try {
      await fetch('/api/training/complete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module,
          ...result,
          training_type: module,
        }),
      })
      clearSession()
      setSession(prev => prev ? { ...prev, status: 'completed', result } : prev)
      setTimeout(() => router.push('/training'), 1500)
    } catch { /* */ }
    finally { setSaving(false) }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="px-5 py-6">
          <div className="h-8 bg-slate-800 rounded-xl animate-pulse mb-4 w-48" />
          {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-800 rounded-2xl animate-pulse mb-3" />)}
        </div>
      </AppShell>
    )
  }

  if (!session) {
    return (
      <AppShell>
        <div className="px-5 py-6 text-center">
          <p className="text-slate-400">Kon geen sessie laden. Probeer opnieuw.</p>
          <button onClick={() => router.push('/training')}
            className="mt-4 px-5 py-2.5 bg-slate-800 text-white rounded-xl text-sm">
            Terug
          </button>
        </div>
      </AppShell>
    )
  }

  const moduleLabel: Record<TrainingModule, string> = {
    kettlebell: 'Kettlebell', rowing: 'Roeien', running: 'Hardlopen',
    cycling: 'Fietsen', strength: 'Kracht', bodyweight: 'Bodyweight',
  }

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (session.status === 'workout') return // geen back tijdens workout
              clearSession()
              router.push('/training')
            }}
            className={cn('w-9 h-9 flex items-center justify-center rounded-xl',
              session.status === 'workout' ? 'bg-slate-800/30' : 'bg-white/5'
            )}
            disabled={session.status === 'workout'}
          >
            <ArrowLeft size={18} className={session.status === 'workout' ? 'text-slate-600' : 'text-slate-400'} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">{moduleLabel[module]}</h1>
            <p className="text-xs text-slate-500 capitalize">{session.status}</p>
          </div>
          {session.status === 'workout' && (
            <button
              onClick={() => { clearSession(); router.push('/training') }}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800"
            >
              <RotateCcw size={16} className="text-slate-400" />
            </button>
          )}
        </div>

        {/* Status indicator */}
        <div className="flex gap-2">
          {(['schema', 'learning', 'workout', 'evaluation'] as SessionStatus[]).map((s, i) => (
            <div key={s} className={cn('flex-1 h-1 rounded-full',
              session.status === s ? 'bg-primary-500' :
              ['schema','learning','workout','evaluation'].indexOf(session.status) > i ? 'bg-green-500' :
              'bg-slate-700'
            )} />
          ))}
        </div>

        {/* Layers */}
        {session.status === 'schema' && (
          <SchemaLayer
            schema={session.schema}
            onStart={() => {
              setLearningIndex(0)
              updateStatus(session.schema.segments.length > 0 ? 'learning' : 'workout')
            }}
          />
        )}

        {session.status === 'learning' && (
          <LearningLayer
            segment={session.schema.segments[learningIndex]}
            index={learningIndex}
            total={session.schema.segments.length}
            onNext={() => {
              if (learningIndex < session.schema.segments.length - 1) {
                setLearningIndex(i => i + 1)
              } else {
                updateStatus('workout')
              }
            }}
            onBack={() => {
              if (learningIndex > 0) setLearningIndex(i => i - 1)
              else updateStatus('schema')
            }}
          />
        )}

        {session.status === 'workout' && (
          <WorkoutEngine
            schema={session.schema}
            currentSegment={session.current_segment}
            completedSegments={session.completed_segments}
            elapsedSeconds={session.elapsed_seconds}
            onTick={handleTick}
            onNextSegment={handleNextSegment}
            onComplete={() => updateStatus('evaluation')}
          />
        )}

        {session.status === 'evaluation' && (
          <EvaluatieLayer
            actualDuration={Math.round(session.elapsed_seconds / 60)}
            onSave={handleSave}
            saving={saving}
          />
        )}

        {session.status === 'completed' && (
          <Card className="p-8 text-center">
            <Check size={40} className="text-green-400 mx-auto mb-3" />
            <p className="text-white font-semibold">Opgeslagen!</p>
          </Card>
        )}

      </div>
    </AppShell>
  )
}
