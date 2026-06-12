'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, SkipForward, Check, ChevronRight, Pause as PauseIcon, Play } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { cn } from '@/utils'
import type {
  LiveSessionState, SessionStatus, TrainingSchema,
  TrainingSegment, KettlebellSegment, SessionResult, TrainingModule
} from '@/types/training-engine'
import { SESSION_STORAGE_KEY } from '@/types/training-engine'

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkoutPhase = 'active' | 'rest' | 'last_rest' | 'uitleg'

interface ExtendedSessionState extends LiveSessionState {
  current_set: number
  workout_phase: WorkoutPhase
  rest_seconds: number
  active_seconds_left: number  // resterende tijd voor huidige actieve set
  auto_running: boolean       // automatische flow aan of uit
  skipped_segments: number[]
  completed_sets: number
  uitleg_index: number        // welke oefening wordt uitgelegd
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

// ─── Tempo per oefening (reps → tijd) ────────────────────────────────────────

type Tempo = 'slow' | 'normal' | 'fast'

const TEMPO_SEC_PER_REP: Record<Tempo, number> = { slow: 4, normal: 3, fast: 2 }
const TEMPO_STORAGE_KEY = 'coachos_exercise_tempo'

function getTempoMap(): Record<string, Tempo> {
  try {
    const raw = localStorage.getItem(TEMPO_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function getTempo(exercise: string): Tempo {
  const map = getTempoMap()
  return map[exercise] || 'normal'
}

function setTempo(exercise: string, tempo: Tempo) {
  try {
    const map = getTempoMap()
    map[exercise] = tempo
    localStorage.setItem(TEMPO_STORAGE_KEY, JSON.stringify(map))
  } catch { /* */ }
}

function getActiveDuration(seg: KettlebellSegment): number {
  if (seg.duration_sec) return seg.duration_sec
  if (seg.reps) return seg.reps * TEMPO_SEC_PER_REP[getTempo(seg.exercise)]
  return 30
}

// ─── Schema Layer ─────────────────────────────────────────────────────────────

function SchemaLayer({ schema, onStart }: { schema: TrainingSchema; onStart: () => void }) {
  const intensiteitLabel = { light: 'Licht', medium: 'Gemiddeld', heavy: 'Zwaar' }
  return (
    <div className="flex flex-col gap-4 pb-4">
      <Card className="p-5">
        <h2 className="text-xl font-bold text-white mb-2">{schema.title}</h2>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full">{schema.duration} min</span>
          <span className={cn('text-xs px-3 py-1 rounded-full',
            schema.intensity === 'light' ? 'bg-green-500/20 text-green-400' :
            schema.intensity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
            'bg-red-500/20 text-red-400'
          )}>{intensiteitLabel[schema.intensity]}</span>
          <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full">{schema.segments.length} oefeningen</span>
        </div>
        {schema.coach_message && (
          <p className="text-slate-300 text-sm leading-relaxed pt-3 border-t border-coach-border">{schema.coach_message}</p>
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
                    {kb.reps ? `${kb.sets} sets × ${kb.reps} herh.` : kb.duration_sec ? `${kb.sets} sets × ${kb.duration_sec}s` : '—'}
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

// ─── Uitleg Scherm ────────────────────────────────────────────────────────────
// Gebruikt voor: eerste oefening, Back/Volgend navigatie, laatste rust

function UitlegScherm({
  segment, segmentIndex, totalSegments, elapsedSeconds,
  restSeconds, onReady, onBack, showBack,
}: {
  segment: TrainingSegment
  segmentIndex: number
  totalSegments: number
  elapsedSeconds: number
  restSeconds?: number        // alleen tijdens automatische laatste rust
  onReady: () => void
  onBack?: () => void
  showBack: boolean
}) {
  const kb = segment as KettlebellSegment
  const isFirst = segmentIndex === 0
  const showTimer = restSeconds !== undefined
  const isPulsing = restSeconds !== undefined && restSeconds <= 3 && restSeconds > 0

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 pr-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
            {isFirst ? 'Eerste oefening' : `Oefening ${segmentIndex + 1} van ${totalSegments}`}
          </p>
          <h2 className="text-2xl font-bold text-white">{kb.exercise || kb.type}</h2>
          <p className="text-sm text-primary-400 mt-1">
            {kb.reps ? `${kb.sets} × ${kb.reps} herh.` : `${kb.sets} × ${kb.duration_sec}s`}
            {kb.rest_sec ? ` · ${kb.rest_sec}s rust` : ''}
          </p>
        </div>
        {showTimer && (
          <div className="text-right flex-shrink-0">
            <p className={cn('text-3xl font-mono font-bold',
              restSeconds! <= 3 ? 'text-red-400' : 'text-amber-400'
            )}>{restSeconds}s</p>
            <p className="text-xs text-slate-500 mt-0.5">{formatTime(elapsedSeconds)}</p>
          </div>
        )}
      </div>

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
        {showBack && onBack && (
          <button onClick={onBack}
            className="flex-1 py-3.5 bg-slate-800 text-slate-300 rounded-xl font-semibold text-sm active:bg-slate-700">
            ← Terug
          </button>
        )}
        <button onClick={onReady}
          className={cn('flex-1 py-3.5 rounded-xl font-semibold text-sm text-white',
            isPulsing ? 'bg-green-500 animate-pulse' : 'bg-green-500 active:bg-green-600'
          )}>
          {showTimer ? (isPulsing ? `Start in ${restSeconds}s` : 'Ready →') : (isFirst ? 'Ready →' : 'Ready — Start →')}
        </button>
      </div>
    </div>
  )
}

// ─── Workout Engine ───────────────────────────────────────────────────────────

function WorkoutEngine({
  session, onTick, onRestTick, onNextSet, onNextSegment,
  onComplete, onBackOefening, onVolgendOefening, onNext, onPause, onTempoChange,
}: {
  session: ExtendedSessionState
  onTick: () => void
  onRestTick: () => void
  onNextSet: () => void
  onNextSegment: () => void
  onComplete: () => void
  onBackOefening: () => void
  onVolgendOefening: () => void
  onNext: () => void
  onPause: () => void
  onTempoChange: (exercise: string, tempo: Tempo) => void
}) {
  const seg = getSeg(session.schema, session.current_segment)
  const totalSets = seg.sets || 1
  const isLastSegment = session.current_segment === session.schema.segments.length - 1
  const tickRef = useRef<NodeJS.Timeout | null>(null)
  const restRef = useRef<NodeJS.Timeout | null>(null)
  const [currentTempo, setCurrentTempo] = useState<Tempo>(getTempo(seg.exercise))

  useEffect(() => { setCurrentTempo(getTempo(seg.exercise)) }, [seg.exercise])

  // Elapsed tick + actieve set countdown
  useEffect(() => {
    if (session.workout_phase === 'active' && session.auto_running) {
      tickRef.current = setInterval(() => {
        if (session.active_seconds_left <= 1) {
          // Tijd voor deze set is voorbij → automatisch naar rust
          onTick() // elapsed +1
          onNextSet()
        } else {
          onTick()
        }
      }, 1000)
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [session.workout_phase, session.auto_running, session.active_seconds_left, onTick, onNextSet])

  // Rest countdown
  useEffect(() => {
    if ((session.workout_phase === 'rest' || session.workout_phase === 'last_rest') && session.auto_running && session.rest_seconds > 0) {
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
          onRestTick()
        }
      }, 1000)
    }
    return () => { if (restRef.current) clearInterval(restRef.current) }
  }, [session.workout_phase, session.auto_running, session.rest_seconds, isLastSegment, onComplete, onNextSegment, onNextSet, onRestTick])

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Voortgang */}
      <div className="flex items-center gap-1.5">
        {session.schema.segments.map((_, i) => (
          <div key={i} className={cn('flex-1 h-1.5 rounded-full transition-all',
            session.completed_segments.includes(i) || session.skipped_segments.includes(i) ? 'bg-green-500' :
            i === session.current_segment ? 'bg-primary-500' : 'bg-slate-700'
          )} />
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">
          {seg.exercise}
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
          <div className="flex items-end justify-between mb-1">
            <div>
              <p className="text-5xl font-bold text-primary-400">
                {seg.reps ? `${seg.reps}` : `${seg.duration_sec}s`}
              </p>
              <p className="text-slate-400 text-sm">{seg.reps ? 'herhalingen' : 'seconden'}</p>
            </div>
            <p className={cn('text-3xl font-mono font-bold',
              session.active_seconds_left <= 3 ? 'text-red-400' : 'text-white'
            )}>{session.active_seconds_left}s</p>
          </div>
          {seg.cue && <p className="text-sm text-slate-300 pt-3 mt-2 border-t border-coach-border">💡 {seg.cue}</p>}

          {/* Tempo selector — alleen bij rep-based oefeningen */}
          {seg.reps && !seg.duration_sec && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-coach-border">
              {(['slow', 'normal', 'fast'] as Tempo[]).map(t => (
                <button key={t} onClick={() => onTempoChange(seg.exercise, t)}
                  className={cn('flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-colors',
                    currentTempo === t ? 'bg-primary-500 text-white' : 'bg-slate-800 text-slate-400'
                  )}>
                  {t === 'slow' ? 'Slow' : t === 'normal' ? 'Normaal' : 'Fast'}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* REST fase */}
      {session.workout_phase === 'rest' && (
        <Card className="p-5 text-center bg-amber-500/10 border-amber-500/20">
          <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-2">
            Rust · Set {session.current_set} volgt
          </p>
          <p className={cn('text-6xl font-mono font-bold',
            session.rest_seconds <= 3 ? 'text-red-400' : 'text-amber-400'
          )}>{session.rest_seconds}s</p>
        </Card>
      )}

      {/* LAST_REST fase — uitleg volgende oefening */}
      {session.workout_phase === 'last_rest' && (() => {
        const nextSeg = session.schema.segments[session.current_segment + 1] as KettlebellSegment | undefined
        return nextSeg ? (
          <UitlegScherm
            segment={nextSeg}
            segmentIndex={session.current_segment + 1}
            totalSegments={session.schema.segments.length}
            elapsedSeconds={session.elapsed_seconds}
            restSeconds={session.rest_seconds}
            onReady={onNextSegment}
            showBack={false}
          />
        ) : (
          <Card className="p-5 text-center bg-amber-500/10 border-amber-500/20">
            <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-2">Laatste rust</p>
            <p className="text-6xl font-mono font-bold text-amber-400">{session.rest_seconds}s</p>
          </Card>
        )
      })()}

      {/* 3 knoppen — alleen tijdens active en rest (niet tijdens last_rest uitleg) */}
      {session.workout_phase !== 'last_rest' && (
        <div className="flex gap-2">
          <button onClick={onBackOefening}
            disabled={session.current_segment === 0 && session.current_set === 1 && session.workout_phase === 'active'}
            className="flex-1 py-3.5 bg-slate-800 text-slate-300 rounded-xl font-semibold text-sm active:bg-slate-700 disabled:opacity-30">
            ← Back
          </button>
          <button onClick={onNext}
            className="flex-1 py-3.5 bg-slate-700 text-slate-300 rounded-xl font-semibold text-sm active:bg-slate-600 flex items-center justify-center gap-1">
            <SkipForward size={14} /> Next
          </button>
          <button onClick={onVolgendOefening}
            disabled={isLastSegment}
            className="flex-1 py-3.5 bg-slate-800 text-slate-300 rounded-xl font-semibold text-sm active:bg-slate-700 disabled:opacity-30 flex items-center justify-center gap-1">
            Volgend <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Pause knop */}
      <button onClick={onPause}
        className="w-full py-3.5 bg-slate-800/60 text-slate-300 rounded-xl text-sm font-semibold active:bg-slate-700 flex items-center justify-center gap-2">
        <PauseIcon size={16} /> Pause
      </button>
    </div>
  )
}

// ─── Voltooid Scherm ──────────────────────────────────────────────────────────

function VoltooïdScherm({ session, onEvaluatie }: { session: ExtendedSessionState; onEvaluatie: () => void }) {
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
            <p className="text-2xl font-bold text-green-400">{session.completed_segments.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Oefeningen voltooid</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-400">{session.skipped_segments.length}</p>
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

function EvaluatieLayer({ actualDuration, onSave, onSkip, saving }: {
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
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Hoe ging het?" rows={3}
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
          onClick={() => onSave({ rating, perceived_effort: effort, fatigue_after: null, soreness: null, notes: notes.trim() || null, actual_duration: actualDuration, completed: true })}
          disabled={saving || !rating}
          className="flex-1 py-3.5 bg-primary-500 text-white rounded-xl font-semibold active:bg-primary-600 disabled:opacity-40">
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
  const [showPause, setShowPause] = useState(false)
  const [showStopConfirm, setShowStopConfirm] = useState(false)
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
          if (instruction?.segments?.length > 0) { buildAndSetSession(instruction); return }
        }
        const res = await fetch('/api/training/today', { method: 'POST', credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          const instruction = data.instruction || data
          if (instruction?.training_type || instruction?.segments) {
            localStorage.setItem('training_instructie_data', JSON.stringify(instruction))
            buildAndSetSession(instruction)
          } else setError('Geen geldig schema ontvangen.')
        } else setError(`Fout ${res.status}: schema generatie mislukt`)
      } catch (e) { setError(String(e)) }
      finally { setLoading(false) }
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
    const firstSeg = schema.segments[0] as KettlebellSegment
    const newSession: ExtendedSessionState = {
      session_id: generateSessionId(), module, status: 'schema', schema,
      started_at: new Date().toISOString(), current_segment: 0, completed_segments: [],
      elapsed_seconds: 0, current_set: 1, workout_phase: 'active', rest_seconds: 0,
      active_seconds_left: firstSeg ? getActiveDuration(firstSeg) : 30,
      auto_running: false, skipped_segments: [], completed_sets: 0, uitleg_index: 0,
    }
    saveSession(newSession)
    setSession(newSession)
    setLoading(false)
  }

  useEffect(() => { if (session) saveSession(session) }, [session])

  // ─── Tick handlers ──────────────────────────────────────────────────────────

  const handleTick = useCallback(() => {
    setSession(prev => prev && prev.auto_running ? {
      ...prev,
      elapsed_seconds: prev.elapsed_seconds + 1,
      active_seconds_left: Math.max(0, prev.active_seconds_left - 1),
    } : prev)
  }, [])

  const handleRestTick = useCallback(() => {
    setSession(prev => prev && prev.auto_running ? { ...prev, rest_seconds: Math.max(0, prev.rest_seconds - 1) } : prev)
  }, [])

  // ─── Status ─────────────────────────────────────────────────────────────────

  function updateStatus(status: SessionStatus) {
    setSession(prev => prev ? { ...prev, status } : prev)
  }

  // ─── Automatische flow ──────────────────────────────────────────────────────

  function handleNextSet() {
    setSession(prev => {
      if (!prev) return prev
      const seg = getSeg(prev.schema, prev.current_segment)
      const totalSets = seg.sets || 1
      const restSec = seg.rest_sec || 60
      if (prev.workout_phase === 'active') {
        const isLastSet = prev.current_set >= totalSets
        return { ...prev, workout_phase: isLastSet ? 'last_rest' : 'rest', rest_seconds: restSec, completed_sets: prev.completed_sets + 1 }
      } else {
        const seg2 = getSeg(prev.schema, prev.current_segment)
        return { ...prev, workout_phase: 'active', current_set: prev.current_set + 1, rest_seconds: 0, active_seconds_left: getActiveDuration(seg2) }
      }
    })
  }

  function handleNextSegment() {
    setSession(prev => {
      if (!prev) return prev
      const next = prev.current_segment + 1
      const nextSeg = getSeg(prev.schema, next)
      return {
        ...prev, current_segment: next,
        completed_segments: [...prev.completed_segments, prev.current_segment],
        current_set: 1, workout_phase: 'active', rest_seconds: 0, auto_running: true,
        active_seconds_left: getActiveDuration(nextSeg),
      }
    })
  }

  function handleComplete() {
    setSession(prev => prev ? { ...prev, status: 'voltooid' as SessionStatus, auto_running: false } : prev)
  }

  // ─── Next — slaat huidige stap over, auto blijft aan ────────────────────────

  function handleNext() {
    setSession(prev => {
      if (!prev) return prev
      const seg = getSeg(prev.schema, prev.current_segment)
      const totalSets = seg.sets || 1
      const restSec = seg.rest_sec || 60
      const isLastSegment = prev.current_segment === prev.schema.segments.length - 1
      if (prev.workout_phase === 'active') {
        const isLastSet = prev.current_set >= totalSets
        return { ...prev, workout_phase: isLastSet ? 'last_rest' : 'rest', rest_seconds: restSec, completed_sets: prev.completed_sets + 1 }
      } else if (prev.workout_phase === 'rest') {
        return { ...prev, workout_phase: 'active', current_set: prev.current_set + 1, rest_seconds: 0, active_seconds_left: getActiveDuration(seg) }
      } else if (prev.workout_phase === 'last_rest') {
        if (isLastSegment) return { ...prev, status: 'voltooid' as SessionStatus, auto_running: false }
        const nextSeg3 = getSeg(prev.schema, prev.current_segment + 1)
        return { ...prev, current_segment: prev.current_segment + 1, completed_segments: [...prev.completed_segments, prev.current_segment], current_set: 1, workout_phase: 'active', rest_seconds: 0, active_seconds_left: getActiveDuration(nextSeg3) }
      }
      return prev
    })
  }

  // ─── Back/Volgend — stopt auto, reset, naar uitleg ──────────────────────────

  function handleBackOefening() {
    setSession(prev => {
      if (!prev) return prev
      const targetIndex = prev.workout_phase === 'active' && prev.current_set === 1 && prev.current_segment > 0
        ? prev.current_segment - 1
        : prev.current_segment
      return {
        ...prev,
        auto_running: false,
        workout_phase: 'uitleg',
        uitleg_index: targetIndex,
        current_segment: targetIndex,
        current_set: 1,
        rest_seconds: 0,
        elapsed_seconds: 0,
      }
    })
  }

  function handleVolgendOefening() {
    setSession(prev => {
      if (!prev) return prev
      const next = Math.min(prev.current_segment + 1, prev.schema.segments.length - 1)
      return {
        ...prev,
        auto_running: false,
        workout_phase: 'uitleg',
        uitleg_index: next,
        current_segment: next,
        current_set: 1,
        rest_seconds: 0,
        elapsed_seconds: 0,
      }
    })
  }

  // Back linksboven — stopt auto, uitleg huidige oefening OF pagina terug
  function handleHeaderBack() {
    if (!session) { router.push('/training'); return }
    if (session.status === 'workout') {
      setSession(prev => {
        if (!prev) return prev
        return {
          ...prev,
          auto_running: false,
          workout_phase: 'uitleg',
          uitleg_index: prev.current_segment,
          current_set: 1,
          rest_seconds: 0,
          elapsed_seconds: 0,
        }
      })
    } else if (session.status === 'learning') {
      updateStatus('schema')
    } else {
      clearSession()
      router.push('/training')
    }
  }

  // Ready vanuit uitleg — start auto run
  function handleReadyFromUitleg() {
    setSession(prev => {
      if (!prev) return prev
      const seg = getSeg(prev.schema, prev.current_segment)
      return {
        ...prev,
        status: 'workout',
        workout_phase: 'active',
        auto_running: true,
        current_set: 1,
        rest_seconds: 0,
        active_seconds_left: getActiveDuration(seg),
      }
    })
  }

  // ─── Skip oefening ──────────────────────────────────────────────────────────

  // ─── Opslaan ────────────────────────────────────────────────────────────────

  async function handleSave(result: SessionResult) {
    if (!session) return
    setSaving(true)
    try {
      await fetch('/api/training/complete', {
        method: 'POST', credentials: 'include',
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
          <button onClick={handleHeaderBack}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">{moduleLabel[module]}</h1>
            <p className="text-xs text-slate-500 capitalize">{session?.status || 'laden'}</p>
          </div>
        </div>

        {/* Sessie herstel */}
        {showResumeDialog && pendingSession && (
          <Card className="p-5">
            <p className="text-sm font-semibold text-white mb-1">Actieve training gevonden</p>
            <p className="text-xs text-slate-400 mb-4">{pendingSession.schema.title} · {formatTime(pendingSession.elapsed_seconds)} bezig</p>
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
              <UitlegScherm
                segment={session.schema.segments[0]}
                segmentIndex={0}
                totalSegments={session.schema.segments.length}
                elapsedSeconds={0}
                showBack={true}
                onReady={handleReadyFromUitleg}
                onBack={() => updateStatus('schema')}
              />
            )}

            {session.status === 'workout' && session.workout_phase !== 'uitleg' && (
              <WorkoutEngine
                session={session}
                onTick={handleTick}
                onRestTick={handleRestTick}
                onNextSet={handleNextSet}
                onNextSegment={handleNextSegment}
                onComplete={handleComplete}
                onBackOefening={handleBackOefening}
                onVolgendOefening={handleVolgendOefening}
                onNext={handleNext}
                onPause={() => { setSession(prev => prev ? { ...prev, auto_running: false } : prev); setShowPause(true) }}
                onTempoChange={(exercise, tempo) => {
                  setTempo(exercise, tempo)
                  setSession(prev => {
                    if (!prev) return prev
                    const seg = getSeg(prev.schema, prev.current_segment)
                    if (seg.exercise !== exercise || prev.workout_phase !== 'active') return prev
                    return { ...prev, active_seconds_left: getActiveDuration(seg) }
                  })
                }}
              />
            )}

            {session.status === 'workout' && session.workout_phase === 'uitleg' && (
              <UitlegScherm
                segment={session.schema.segments[session.uitleg_index]}
                segmentIndex={session.uitleg_index}
                totalSegments={session.schema.segments.length}
                elapsedSeconds={session.elapsed_seconds}
                showBack={session.uitleg_index > 0}
                onReady={handleReadyFromUitleg}
                onBack={() => setSession(prev => prev ? { ...prev, uitleg_index: Math.max(0, prev.uitleg_index - 1), current_segment: Math.max(0, prev.uitleg_index - 1) } : prev)}
              />
            )}

            {(session.status as string) === 'voltooid' && (
              <VoltooïdScherm session={session} onEvaluatie={() => updateStatus('evaluation')} />
            )}

            {session.status === 'evaluation' && (
              <EvaluatieLayer
                actualDuration={Math.round(session.elapsed_seconds / 60)}
                onSave={handleSave}
                onSkip={() => { clearSession(); router.push('/training') }}
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

        {/* Pause overlay */}
        {showPause && session && (
          <div className="fixed inset-0 bg-black/85 flex flex-col items-center justify-center z-50 px-8">
            <Card className="p-6 w-full text-center">
              <p className="text-white text-xl font-bold mb-1">⏸ Training Gepauzeerd</p>
              <p className="text-slate-400 text-sm mb-1">{getSeg(session.schema, session.current_segment).exercise}</p>
              <p className="text-slate-500 text-xs mb-6">
                Set {session.current_set} · {formatTime(session.elapsed_seconds)}
              </p>
              <button onClick={() => { setShowPause(false); setSession(prev => prev ? { ...prev, auto_running: true } : prev) }}
                className="w-full py-3.5 bg-primary-500 text-white rounded-xl font-semibold active:bg-primary-600 mb-3 flex items-center justify-center gap-2">
                <Play size={18} /> Hervatten
              </button>
              <button onClick={() => { setShowPause(false); setShowStopConfirm(true) }}
                className="w-full py-3 bg-slate-800 text-slate-300 rounded-xl font-semibold active:bg-slate-700">
                Stop Training
              </button>
            </Card>
          </div>
        )}

        {/* Stop bevestiging */}
        {showStopConfirm && (
          <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 px-8">
            <Card className="p-6 w-full">
              <p className="text-white font-semibold text-center mb-2">Weet je zeker dat je wilt stoppen?</p>
              <p className="text-slate-400 text-sm text-center mb-6">Je voortgang wordt niet opgeslagen.</p>
              <div className="flex gap-3">
                <button onClick={() => { setShowStopConfirm(false); clearSession(); router.push('/training') }}
                  className="flex-1 py-3 bg-red-500/20 text-red-400 rounded-xl font-semibold active:bg-red-500/30">
                  Ja, stop
                </button>
                <button onClick={() => setShowStopConfirm(false)}
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
