'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Pause, Play, SkipForward, Check, X } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { cn } from '@/utils'
import type {
  LiveSessionState, SessionStatus, TrainingSchema,
  TrainingSegment, KettlebellSegment, SessionResult, TrainingModule
} from '@/types/training-engine'
import { SESSION_STORAGE_KEY } from '@/types/training-engine'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtendedSessionState extends LiveSessionState {
  current_set: number
  workout_phase: 'active' | 'rest' | 'last_rest'
  rest_seconds: number
  paused: boolean
  skipped_segments: number[]
  completed_sets: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function saveSession(state: ExtendedSessionState) {
  try { localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state)) } catch { /* */ }
}

function loadSession(): ExtendedSessionState | null {
  try {
    const s = localStorage.getItem(SESSION_STORAGE_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_STORAGE_KEY) } catch { /* */ }
}

function getSeg(schema: TrainingSchema, index: number): KettlebellSegment {
  return schema.segments[index] as KettlebellSegment
}

// ─── Schema Layer ─────────────────────────────────────────────────────────────

function SchemaLayer({ schema, onStart }: { schema: TrainingSchema; onStart: () => void }) {
  const intensiteitLabel = { light: 'Licht', medium: 'Gemiddeld', heavy: 'Zwaar' }
  return (
    <div className="flex flex-col gap-4 pb-4">
      <Card className="p-5">
        <h2 className="text-xl font-bold text-white mb-2">{schema.title}</h2>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full">{schema.duration} min</span>
          <span className={cn('text-xs px-3 py-1 rounded-full',
            schema.intensity === 'light' ? 'bg-green-500/20 text-green-400' :
            schema.intensity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
            'bg-red-500/20 text-red-400'
          )}>{intensiteitLabel[schema.intensity]}</span>
          <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full">{schema.segments.length} oefeningen</span>
        </div>
        {schema.coach_message && (
          <p className="text-slate-300 text-sm leading-relaxed pt-3 border-t border-coach-border">
            {schema.coach_message}
          </p>
        )}
      </Card>

      <div className="flex flex-col gap-2">
        {schema.segments.map((seg, i) => {
          const kb = seg as KettlebellSegment
          return (
            <Card key={i} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{kb.exercise || kb.type}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {kb.reps ? `${kb.sets} sets × ${kb.reps} herh.` :
                     kb.duration_sec ? `${kb.sets} sets × ${kb.duration_sec}s` : '—'}
                    {kb.rest_sec ? ` · ${kb.rest_sec}s rust` : ''}
                  </p>
                </div>
                <span className="text-xs text-slate-600 font-mono">#{i + 1}</span>
              </div>
            </Card>
          )
        })}
      </div>

      <button onClick={onStart}
        className="w-full py-4 bg-primary-500 text-white rounded-xl font-semibold text-base active:bg-primary-600">
        Training Starten →
      </button>
    </div>
  )
}

// ─── Learning Layer ───────────────────────────────────────────────────────────

function LearningLayer({
  segment, onReady, onBack
}: {
  segment: TrainingSegment
  onReady: () => void
  onBack: () => void
}) {
  const kb = segment as KettlebellSegment
  return (
    <div className="flex flex-col gap-4 pb-4">
      <Card className="p-5">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Eerste oefening</p>
        <h2 className="text-2xl font-bold text-white mb-1">{kb.exercise || kb.type}</h2>
        <p className="text-sm text-primary-400 mt-1">
          {kb.reps ? `${kb.sets} × ${kb.reps} herh.` : `${kb.sets} × ${kb.duration_sec}s`}
          {kb.rest_sec ? ` · ${kb.rest_sec}s rust` : ''}
        </p>
      </Card>

      {kb.instruction && (
        <Card className="p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Uitvoering</p>
          <p className="text-sm text-slate-200 leading-relaxed">{kb.instruction}</p>
        </Card>
      )}

      {kb.cue && (
        <Card className="p-4 bg-primary-500/10 border-primary-500/20">
          <p className="text-xs text-primary-400 font-semibold uppercase tracking-wider mb-1">Coaching tip</p>
          <p className="text-sm text-white">{kb.cue}</p>
        </Card>
      )}

      {kb.common_errors && kb.common_errors.length > 0 && (
        <Card className="p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Veelgemaakte fouten</p>
          <div className="flex flex-col gap-2">
            {kb.common_errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5 flex-shrink-0 text-xs">✕</span>
                <p className="text-sm text-slate-300">{err}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex gap-3">
        <button onClick={onBack}
          className="flex-1 py-3.5 bg-slate-800 text-slate-300 rounded-xl font-semibold active:bg-slate-700">
          ← Terug
        </button>
        <button onClick={onReady}
          className="flex-1 py-3.5 bg-green-500 text-white rounded-xl font-semibold active:bg-green-600">
          Ready →
        </button>
      </div>
    </div>
  )
}

// ─── Workout Engine ───────────────────────────────────────────────────────────

function WorkoutEngine({
  session, onTick, onNextSet, onNextSegment, onComplete, onPause, onSkipConfirm
}: {
  session: ExtendedSessionState
  onTick: () => void
  onNextSet: () => void
  onNextSegment: () => void
  onComplete: () => void
  onPause: () => void
  onSkipConfirm: () => void
}) {
  const seg = getSeg(session.schema, session.current_segment)
  const nextSeg = session.schema.segments[session.current_segment + 1] as KettlebellSegment | undefined
  const totalSets = seg.sets || 1
  const isLastSegment = session.current_segment === session.schema.segments.length - 1
  const restRef = useRef<NodeJS.Timeout | null>(null)
  const tickRef = useRef<NodeJS.Timeout | null>(null)

  // Tick elapsed time
  useEffect(() => {
    if (session.workout_phase === 'active' && !session.paused) {
      tickRef.current = setInterval(onTick, 1000)
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [session.workout_phase, session.paused, onTick])

  // Rest countdown
  useEffect(() => {
    if ((session.workout_phase === 'rest' || session.workout_phase === 'last_rest') && !session.paused && session.rest_seconds > 0) {
      restRef.current = setInterval(() => {
        if (session.rest_seconds <= 1) {
          clearInterval(restRef.current!)
          if (session.workout_phase === 'last_rest') {
            if (isLastSegment) onComplete()
            else onNextSegment()
          } else {
            onNextSet()
          }
        } else {
          onTick()
        }
      }, 1000)
    }
    return () => { if (restRef.current) clearInterval(restRef.current) }
  }, [session.workout_phase, session.paused, session.rest_seconds, isLastSegment, onComplete, onNextSegment, onNextSet, onTick])

  function handleNext() {
    if (restRef.current) clearInterval(restRef.current)
    if (tickRef.current) clearInterval(tickRef.current)
    if (session.workout_phase === 'active') {
      // Skip set → ga naar rust
      onNextSet()
    } else if (session.workout_phase === 'rest') {
      // Skip rust → ga naar volgende set
      onNextSet()
    } else if (session.workout_phase === 'last_rest') {
      // Skip laatste rust → ga naar volgende oefening
      if (isLastSegment) onComplete()
      else onNextSegment()
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Voortgang oefeningen */}
      <div className="flex items-center gap-1.5">
        {session.schema.segments.map((_, i) => (
          <div key={i} className={cn('flex-1 h-1.5 rounded-full transition-all',
            session.completed_segments.includes(i) || session.skipped_segments.includes(i) ? 'bg-green-500' :
            i === session.current_segment ? 'bg-primary-500' : 'bg-slate-700'
          )} />
        ))}
      </div>

      {/* Header info */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">
          {seg.exercise || seg.type}
          <span className="text-slate-500 font-normal ml-2">{session.current_segment + 1}/{session.schema.segments.length}</span>
        </p>
        <p className="text-2xl font-mono font-bold text-white">{formatTime(session.elapsed_seconds)}</p>
      </div>

      {/* ACTIVE fase */}
      {session.workout_phase === 'active' && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Set {session.current_set} van {totalSets}</p>
            <div className="flex gap-1">
              {Array.from({ length: totalSets }, (_, i) => (
                <div key={i} className={cn('w-5 h-1.5 rounded-full',
                  i < session.current_set - 1 ? 'bg-green-500' :
                  i === session.current_set - 1 ? 'bg-primary-500' : 'bg-slate-700'
                )} />
              ))}
            </div>
          </div>
          <p className="text-5xl font-bold text-primary-400 mb-2">
            {seg.reps ? `${seg.reps}` : `${seg.duration_sec}s`}
          </p>
          <p className="text-slate-400 text-sm">{seg.reps ? 'herhalingen' : 'seconden'}</p>
          {seg.cue && (
            <p className="text-sm text-slate-300 mt-3 pt-3 border-t border-coach-border">💡 {seg.cue}</p>
          )}
        </Card>
      )}

      {/* REST fase */}
      {(session.workout_phase === 'rest' || session.workout_phase === 'last_rest') && (
        <>
          <Card className="p-5 text-center bg-amber-500/10 border-amber-500/20">
            <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-2">
              {session.workout_phase === 'last_rest' ? 'Laatste rust' : `Rust · Set ${session.current_set} volgt`}
            </p>
            <p className="text-6xl font-mono font-bold text-amber-400">{session.rest_seconds}s</p>
          </Card>

          {/* Uitleg volgende oefening tijdens laatste rust */}
          {session.workout_phase === 'last_rest' && nextSeg && (
            <Card className="p-5 border-primary-500/20 bg-primary-500/5">
              <p className="text-xs text-primary-400 font-semibold uppercase tracking-wider mb-2">Volgende oefening</p>
              <h3 className="text-lg font-bold text-white mb-1">{nextSeg.exercise}</h3>
              <p className="text-sm text-primary-400 mb-2">
                {nextSeg.reps ? `${nextSeg.sets} × ${nextSeg.reps} herh.` : `${nextSeg.sets} × ${nextSeg.duration_sec}s`}
              </p>
              {nextSeg.instruction && <p className="text-sm text-slate-300 leading-relaxed">{nextSeg.instruction}</p>}
              {nextSeg.cue && <p className="text-xs text-primary-400 mt-2">💡 {nextSeg.cue}</p>}
            </Card>
          )}
        </>
      )}

      {/* Controls */}
      <div className="flex gap-3">
        <button onClick={onPause}
          className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center active:bg-slate-700 flex-shrink-0">
          <Pause size={20} className="text-white" />
        </button>
        <button onClick={handleNext}
          className="flex-1 py-3.5 bg-slate-700 text-slate-300 rounded-xl font-semibold active:bg-slate-600 flex items-center justify-center gap-2">
          <SkipForward size={16} />
          <span className="text-sm">Next</span>
        </button>
        <button onClick={onSkipConfirm}
          className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center active:bg-slate-700 flex-shrink-0">
          <X size={18} className="text-slate-400" />
        </button>
      </div>
      <p className="text-xs text-slate-600 text-center">Pause · Next (stap over) · ✕ (oefening overslaan)</p>
    </div>
  )
}

// ─── Voltooid Scherm ──────────────────────────────────────────────────────────

function VoltooïdScherm({
  session, onEvaluatie
}: {
  session: ExtendedSessionState
  onEvaluatie: () => void
}) {
  const voltooid = session.completed_segments.length
  const overgeslagen = session.skipped_segments.length
  const totalSets = session.schema.segments.reduce((a, seg) => a + ((seg as KettlebellSegment).sets || 0), 0)

  return (
    <div className="flex flex-col gap-4 pb-4">
      <Card className="p-6 text-center">
        <p className="text-5xl mb-3">🎉</p>
        <h2 className="text-2xl font-bold text-white mb-1">Training Voltooid!</h2>
        <p className="text-slate-400 text-sm">{formatTime(session.elapsed_seconds)}</p>
      </Card>

      <Card className="p-5">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Statistieken</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold text-green-400">{voltooid}</p>
            <p className="text-xs text-slate-400 mt-0.5">Oefeningen voltooid</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-400">{overgeslagen}</p>
            <p className="text-xs text-slate-400 mt-0.5">Overgeslagen</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary-400">{session.completed_sets}</p>
            <p className="text-xs text-slate-400 mt-0.5">Sets voltooid</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{totalSets}</p>
            <p className="text-xs text-slate-400 mt-0.5">Totaal sets</p>
          </div>
        </div>
      </Card>

      <button onClick={onEvaluatie}
        className="w-full py-4 bg-primary-500 text-white rounded-xl font-semibold active:bg-primary-600">
        Evaluatie Starten →
      </button>
    </div>
  )
}

// ─── Evaluatie Layer ──────────────────────────────────────────────────────────

function EvaluatieLayer({
  actualDuration, onSave, onSkip, saving
}: {
  actualDuration: number
  onSave: (result: SessionResult) => void
  onSkip: () => void
  saving: boolean
}) {
  const [rating, setRating] = useState<number | null>(null)
  const [effort, setEffort] = useState<number | null>(null)
  const [techniek, setTechniek] = useState<number | null>(null)
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
    <div className="flex flex-col gap-5 pb-4">
      <Card className="p-5 flex flex-col gap-5">
        <ScoreRij label="Hoe zwaar was de training?" value={rating} onChange={setRating} kleur="text-primary-400" />
        <ScoreRij label="Energie niveau" value={effort} onChange={setEffort} kleur="text-orange-400" />
        <ScoreRij label="Techniek gevoel" value={techniek} onChange={setTechniek} kleur="text-green-400" />
        <div>
          <p className="text-sm text-slate-300 mb-2">Opmerkingen</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Hoe ging het?"
            rows={3}
            className="w-full bg-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </Card>

      <div className="flex gap-3">
        <button onClick={onSkip}
          className="flex-1 py-3.5 bg-slate-800 text-slate-300 rounded-xl font-semibold active:bg-slate-700">
          Overslaan
        </button>
        <button
          onClick={() => onSave({
            rating, perceived_effort: effort, fatigue_after: null,
            soreness: null, notes: notes.trim() || null,
            actual_duration: actualDuration, completed: true,
          })}
          disabled={saving || !rating}
          className="flex-1 py-3.5 bg-primary-500 text-white rounded-xl font-semibold active:bg-primary-600 disabled:opacity-40"
        >
          {saving ? 'Opslaan...' : 'Opslaan'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Session Page ────────────────────────────────────────────────────────

export default function SessionPage() {
  const params = useParams()
  const router = useRouter()
  const module = params.module as TrainingModule

  const [session, setSession] = useState<ExtendedSessionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Overlays
  const [showPause, setShowPause] = useState(false)
  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)
  const [showResumeDialog, setShowResumeDialog] = useState(false)
  const [pendingSession, setPendingSession] = useState<ExtendedSessionState | null>(null)

  // Laad sessie
  useEffect(() => {
    const existing = loadSession()
    const hasSegments = existing?.schema?.segments && existing.schema.segments.length > 0
    if (existing && existing.module === module && existing.status !== 'completed' && hasSegments) {
      setPendingSession(existing)
      setShowResumeDialog(true)
      setLoading(false)
      return
    }
    clearSession()
    const run = async () => {
      try {
        const cached = localStorage.getItem('training_instructie_data')
        if (cached) {
          const instruction = JSON.parse(cached)
          if (instruction?.segments?.length > 0) {
            buildAndSetSession(instruction)
            return
          }
        }
        const res = await fetch('/api/training/today', { method: 'POST', credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          const instruction = data.instruction || data
          if (instruction?.training_type || instruction?.segments) {
            localStorage.setItem('training_instructie_data', JSON.stringify(instruction))
            buildAndSetSession(instruction)
          } else {
            setError('Geen geldig schema ontvangen.')
          }
        } else {
          setError(`Fout ${res.status}: schema generatie mislukt`)
        }
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [module])

  function buildAndSetSession(instruction: Record<string, unknown>) {
    const schema: TrainingSchema = {
      module,
      title: (instruction.title as string) || `${module.charAt(0).toUpperCase() + module.slice(1)} sessie`,
      duration: (instruction.duration as number) || 30,
      intensity: (instruction.intensity as 'light' | 'medium' | 'heavy') || 'medium',
      segments: ((instruction.segments || instruction.exercises || []) as TrainingSegment[]),
      coach_message: (instruction.coach_message as string) || (instruction.reason as string) || '',
    }
    const newSession: ExtendedSessionState = {
      session_id: generateSessionId(),
      module,
      status: 'schema',
      schema,
      started_at: new Date().toISOString(),
      current_segment: 0,
      completed_segments: [],
      elapsed_seconds: 0,
      current_set: 1,
      workout_phase: 'active',
      rest_seconds: 0,
      paused: false,
      skipped_segments: [],
      completed_sets: 0,
    }
    saveSession(newSession)
    setSession(newSession)
  }

  // Auto-save
  useEffect(() => {
    if (session) saveSession(session)
  }, [session])

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleTick = useCallback(() => {
    setSession(prev => {
      if (!prev || prev.paused) return prev
      if (prev.workout_phase === 'active') {
        return { ...prev, elapsed_seconds: prev.elapsed_seconds + 1 }
      } else {
        // Rest countdown
        const newRest = prev.rest_seconds - 1
        return { ...prev, rest_seconds: newRest }
      }
    })
  }, [])

  function updateStatus(status: SessionStatus) {
    setSession(prev => prev ? { ...prev, status } : prev)
  }

  function handleNextSet() {
    setSession(prev => {
      if (!prev) return prev
      const seg = getSeg(prev.schema, prev.current_segment)
      const totalSets = seg.sets || 1
      const restSec = seg.rest_sec || 60

      if (prev.workout_phase === 'active') {
        // Set klaar → rust
        const isLastSet = prev.current_set >= totalSets
        return {
          ...prev,
          workout_phase: isLastSet ? 'last_rest' : 'rest',
          rest_seconds: restSec,
          completed_sets: prev.completed_sets + 1,
        }
      } else {
        // Rust voorbij → volgende set
        const nextSet = prev.current_set + 1
        return {
          ...prev,
          workout_phase: 'active',
          current_set: nextSet,
          rest_seconds: 0,
        }
      }
    })
  }

  function handleNextSegment() {
    setSession(prev => {
      if (!prev) return prev
      const next = prev.current_segment + 1
      const nextSeg = getSeg(prev.schema, next)
      const nextRestSec = nextSeg.rest_sec || 60
      return {
        ...prev,
        current_segment: next,
        completed_segments: [...prev.completed_segments, prev.current_segment],
        current_set: 1,
        workout_phase: 'active',
        rest_seconds: 0,
        elapsed_seconds: prev.elapsed_seconds,
      }
      void nextRestSec
    })
  }

  function handleComplete() {
    updateStatus('voltooid' as SessionStatus)
  }

  function handlePause() {
    setSession(prev => prev ? { ...prev, paused: true } : prev)
    setShowPause(true)
  }

  function handleResume() {
    setShowPause(false)
    setSession(prev => prev ? { ...prev, paused: false } : prev)
  }

  function handleSkipSegment() {
    setShowSkipConfirm(false)
    setSession(prev => {
      if (!prev) return prev
      const next = prev.current_segment + 1
      const isLast = prev.current_segment === prev.schema.segments.length - 1
      if (isLast) return { ...prev, status: 'voltooid' as SessionStatus }
      return {
        ...prev,
        current_segment: next,
        skipped_segments: [...prev.skipped_segments, prev.current_segment],
        current_set: 1,
        workout_phase: 'active',
        rest_seconds: 0,
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
        body: JSON.stringify({ module, ...result, training_type: module }),
      })
      clearSession()
      setSession(prev => prev ? { ...prev, status: 'completed' } : prev)
      setTimeout(() => router.push('/training'), 1500)
    } catch { /* */ }
    finally { setSaving(false) }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppShell>
        <div className="px-5 py-6">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-800 rounded-2xl animate-pulse mb-3" />)}
        </div>
      </AppShell>
    )
  }

  if (!session && !showResumeDialog) {
    return (
      <AppShell>
        <div className="px-5 py-6 text-center">
          <p className="text-slate-400 mb-2">Kon geen sessie laden.</p>
          {error && <p className="text-red-400 text-xs mb-4 px-4">{error}</p>}
          <button onClick={() => { clearSession(); window.location.reload() }}
            className="px-5 py-2.5 bg-primary-500 text-white rounded-xl text-sm mb-3 block mx-auto">
            Opnieuw proberen
          </button>
          <button onClick={() => router.push('/training')}
            className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-sm block mx-auto">
            Terug naar Training
          </button>
        </div>
      </AppShell>
    )
  }

  const moduleLabel: Record<TrainingModule, string> = {
    kettlebell: 'Kettlebell', rowing: 'Roeien', running: 'Hardlopen',
    cycling: 'Fietsen', strength: 'Kracht', bodyweight: 'Bodyweight',
  }

  const isWorkout = session?.status === 'workout'

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (isWorkout) {
                handlePause()
              } else if (session?.status === 'learning') {
                updateStatus('schema')
              } else {
                clearSession()
                router.push('/training')
              }
            }}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10"
          >
            <ArrowLeft size={18} className="text-slate-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">{moduleLabel[module]}</h1>
            <p className="text-xs text-slate-500 capitalize">{session?.status || 'laden'}</p>
          </div>
        </div>

        {/* Sessie herstel dialog */}
        {showResumeDialog && pendingSession && (
          <Card className="p-5">
            <p className="text-sm font-semibold text-white mb-1">Actieve training gevonden</p>
            <p className="text-xs text-slate-400 mb-4">
              {pendingSession.schema.title} · {formatTime(pendingSession.elapsed_seconds)} bezig
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setSession(pendingSession); setShowResumeDialog(false) }}
                className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-semibold text-sm active:bg-primary-600">
                Hervatten
              </button>
              <button onClick={() => { clearSession(); setPendingSession(null); setShowResumeDialog(false); window.location.reload() }}
                className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-semibold text-sm active:bg-slate-700">
                Verwijderen
              </button>
            </div>
          </Card>
        )}

        {/* Layers */}
        {session && !showResumeDialog && (
          <>
            {session.status === 'schema' && (
              <SchemaLayer schema={session.schema} onStart={() => updateStatus('learning')} />
            )}

            {session.status === 'learning' && (
              <LearningLayer
                segment={session.schema.segments[0]}
                onReady={() => {
                  setSession(prev => prev ? { ...prev, status: 'workout', workout_phase: 'active', current_set: 1 } : prev)
                }}
                onBack={() => updateStatus('schema')}
              />
            )}

            {session.status === 'workout' && (
              <WorkoutEngine
                session={session}
                onTick={handleTick}
                onNextSet={handleNextSet}
                onNextSegment={handleNextSegment}
                onComplete={handleComplete}
                onPause={handlePause}
                onSkipConfirm={() => setShowSkipConfirm(true)}
              />
            )}

            {(session.status as string) === 'voltooid' && (
              <VoltooïdScherm
                session={session}
                onEvaluatie={() => updateStatus('evaluation')}
              />
            )}

            {session.status === 'evaluation' && (
              <EvaluatieLayer
                actualDuration={Math.round(session.elapsed_seconds / 60)}
                onSave={handleSave}
                onSkip={() => {
                  clearSession()
                  router.push('/training')
                }}
                saving={saving}
              />
            )}

            {session.status === 'completed' && (
              <Card className="p-8 text-center">
                <Check size={40} className="text-green-400 mx-auto mb-3" />
                <p className="text-white font-semibold">Opgeslagen!</p>
              </Card>
            )}
          </>
        )}

        {/* Pause Overlay */}
        {showPause && (
          <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 px-8">
            <p className="text-white text-2xl font-bold mb-2">TRAINING GEPAUZEERD</p>
            <p className="text-slate-400 text-sm mb-8">{session && formatTime(session.elapsed_seconds)}</p>
            <button onClick={handleResume}
              className="w-full py-4 bg-primary-500 text-white rounded-xl font-semibold mb-3 active:bg-primary-600 flex items-center justify-center gap-2">
              <Play size={18} /> Hervatten
            </button>
            <button onClick={() => { setShowPause(false); setShowStopConfirm(true) }}
              className="w-full py-3.5 bg-slate-800 text-slate-300 rounded-xl font-semibold active:bg-slate-700">
              Stop Training
            </button>
          </div>
        )}

        {/* Stop bevestiging */}
        {showStopConfirm && (
          <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 px-8">
            <Card className="p-6 w-full">
              <p className="text-white font-semibold text-center mb-2">Weet je zeker dat je wilt stoppen?</p>
              <p className="text-slate-400 text-sm text-center mb-6">Je voortgang wordt niet opgeslagen.</p>
              <div className="flex gap-3">
                <button onClick={() => { setShowStopConfirm(false); setShowPause(false); clearSession(); router.push('/training') }}
                  className="flex-1 py-3 bg-red-500/20 text-red-400 rounded-xl font-semibold active:bg-red-500/30">
                  Ja, stop
                </button>
                <button onClick={() => { setShowStopConfirm(false); setShowPause(true) }}
                  className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-semibold active:bg-slate-700">
                  Nee
                </button>
              </div>
            </Card>
          </div>
        )}

        {/* Oefening overslaan bevestiging */}
        {showSkipConfirm && (
          <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 px-8">
            <Card className="p-6 w-full">
              <p className="text-white font-semibold text-center mb-2">Oefening overslaan?</p>
              <p className="text-slate-400 text-sm text-center mb-6">
                {session && getSeg(session.schema, session.current_segment).exercise}
              </p>
              <div className="flex gap-3">
                <button onClick={handleSkipSegment}
                  className="flex-1 py-3 bg-amber-500/20 text-amber-400 rounded-xl font-semibold active:bg-amber-500/30">
                  Ja, overslaan
                </button>
                <button onClick={() => setShowSkipConfirm(false)}
                  className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-semibold active:bg-slate-700">
                  Nee
                </button>
              </div>
            </Card>
          </div>
        )}

      </div>
    </AppShell>
  )
}
