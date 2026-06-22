'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, SkipForward, Check, ChevronRight, Pause as PauseIcon, Play } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { cn } from '@/utils'
import type {
  LiveSessionState, SessionStatus, TrainingSchema,
  TrainingSegment, KettlebellSegment, RowingSegment, SessionResult, TrainingModule, TrainingSource
} from '@/types/training-engine'
import { SESSION_STORAGE_KEY } from '@/types/training-engine'

type WorkoutPhase = 'active' | 'rest' | 'last_rest' | 'uitleg'

interface ExtendedSessionState extends LiveSessionState {
  current_set: number
  workout_phase: WorkoutPhase
  rest_seconds: number
  active_seconds_left: number
  auto_running: boolean
  skipped_segments: number[]
  completed_sets: number
  uitleg_index: number
}

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

function getSegments(schema: TrainingSchema | undefined | null): TrainingSegment[] {
  return (schema?.segments && Array.isArray(schema.segments)) ? schema.segments : []
}

function getSeg(schema: TrainingSchema, index: number): KettlebellSegment | undefined {
  const segments = getSegments(schema)
  return segments[index] as KettlebellSegment | undefined
}

function getCommonErrors(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter(v => typeof v === 'string')
  if (typeof val === 'string' && val.trim()) return [val]
  return []
}

interface DisplaySegment {
  type: string
  exercise: string
  sets: number
  reps: number | null
  duration_sec: number | null
  rest_sec: number
  cue: string
  instruction: string
  common_errors: string[]
  distance_m?: number
  target_split?: string
  target_spm?: number
  target_hr_zone?: string
  target_pace?: string
  target_speed_kmh?: number
  target_power_w?: number
  target_cadence_rpm?: number
}

function asDisplay(seg: TrainingSegment | undefined | null): DisplaySegment {
  const raw = (seg || {}) as Record<string, unknown>
  return {
    type: typeof raw.type === 'string' ? raw.type : '',
    exercise: typeof raw.exercise === 'string' ? raw.exercise : '',
    sets: typeof raw.sets === 'number' ? raw.sets : 1,
    reps: typeof raw.reps === 'number' ? raw.reps : null,
    duration_sec: typeof raw.duration_sec === 'number' ? raw.duration_sec : null,
    rest_sec: typeof raw.rest_sec === 'number' ? raw.rest_sec : 0,
    cue: typeof raw.cue === 'string' ? raw.cue : '',
    instruction: typeof raw.instruction === 'string' ? raw.instruction : '',
    common_errors: getCommonErrors(raw.common_errors),
    distance_m: typeof raw.distance_m === 'number' ? raw.distance_m : undefined,
    target_split: typeof raw.target_split === 'string' ? raw.target_split : undefined,
    target_spm: typeof raw.target_spm === 'number' ? raw.target_spm : undefined,
    target_hr_zone: typeof raw.target_hr_zone === 'string' ? raw.target_hr_zone : undefined,
    target_pace: typeof raw.target_pace === 'string' ? raw.target_pace : undefined,
    target_speed_kmh: typeof raw.target_speed_kmh === 'number' ? raw.target_speed_kmh : undefined,
    target_power_w: typeof raw.target_power_w === 'number' ? raw.target_power_w : undefined,
    target_cadence_rpm: typeof raw.target_cadence_rpm === 'number' ? raw.target_cadence_rpm : undefined,
  }
}

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

function getActiveDuration(seg: KettlebellSegment | undefined): number {
  if (!seg) return 30
  const d = asDisplay(seg as unknown as TrainingSegment)
  if (d.duration_sec) return d.duration_sec
  if (d.reps) return d.reps * TEMPO_SEC_PER_REP[getTempo(d.exercise)]
  return 30
}

function SchemaLayer({ schema, onStart }: { schema: TrainingSchema; onStart: () => void }) {
  const intensiteitLabel = { light: 'Licht', medium: 'Gemiddeld', heavy: 'Zwaar' }
  const segments = getSegments(schema)
  return (
    <div className="flex flex-col gap-4 pb-4">
      <Card className="p-5">
        <h2 className="text-xl font-bold text-white mb-2">{schema.title || 'Training'}</h2>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full">{schema.duration || 30} min</span>
          <span className={cn('text-xs px-3 py-1 rounded-full',
            schema.intensity === 'light' ? 'bg-green-500/20 text-green-400' :
            schema.intensity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
            'bg-red-500/20 text-red-400'
          )}>{intensiteitLabel[schema.intensity] || 'Gemiddeld'}</span>
          <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full">{segments.length} oefeningen</span>
        </div>
        {schema.coach_message && (
          <p className="text-slate-300 text-sm leading-relaxed pt-3 border-t border-coach-border">{schema.coach_message}</p>
        )}
      </Card>
      <div className="flex flex-col gap-2">
        {segments.map((seg, i) => {
          const kb = asDisplay(seg)
          const isRowing = kb.type === 'rowing'
          const isRunning = kb.type === 'running'
          const isCycling = kb.type === 'cycling'
          return (
            <Card key={i} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{kb.exercise || kb.type || 'Oefening'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isRowing
                      ? (kb.distance_m
                          ? `${kb.sets} × ${kb.distance_m}m${kb.target_split ? ` @ ${kb.target_split}/500m` : ''}`
                          : `${kb.sets > 1 ? `${kb.sets} × ` : ''}${formatTime(kb.duration_sec || 0)}`)
                      : isRunning
                        ? (kb.distance_m
                            ? `${kb.sets > 1 ? `${kb.sets} × ` : ''}${kb.distance_m}m${kb.target_pace ? ` @ ${kb.target_pace}` : ''}`
                            : `${kb.sets > 1 ? `${kb.sets} × ` : ''}${formatTime(kb.duration_sec || 0)}`)
                        : isCycling
                          ? (kb.distance_m
                              ? `${kb.sets > 1 ? `${kb.sets} × ` : ''}${kb.distance_m}m${kb.target_power_w ? ` @ ${kb.target_power_w}W` : ''}`
                              : `${kb.sets > 1 ? `${kb.sets} × ` : ''}${formatTime(kb.duration_sec || 0)}${kb.target_power_w ? ` @ ${kb.target_power_w}W` : ''}`)
                          : (kb.reps ? `${kb.sets} sets × ${kb.reps} herh.` : kb.duration_sec ? `${kb.sets} sets × ${kb.duration_sec}s` : '--')
                    }
                    {kb.rest_sec ? ` · ${kb.rest_sec}s rust` : ''}
                  </p>
                </div>
                <span className="text-xs text-slate-600 font-mono">#{i + 1}</span>
              </div>
            </Card>
          )
        })}
      </div>
      <button onClick={onStart} disabled={segments.length === 0}
        className="w-full py-4 bg-primary-500 text-white rounded-xl font-semibold text-base active:bg-primary-600 disabled:opacity-40">
        Training Starten →
      </button>
    </div>
  )
}

function UitlegScherm({
  segment, segmentIndex, totalSegments, elapsedSeconds,
  restSeconds, onReady, onBack, showBack,
}: {
  segment: TrainingSegment | undefined
  segmentIndex: number
  totalSegments: number
  elapsedSeconds: number
  restSeconds?: number
  onReady: () => void
  onBack?: () => void
  showBack: boolean
}) {
  const kb = asDisplay(segment)
  const isFirst = segmentIndex === 0
  const isPulsing = restSeconds !== undefined && restSeconds <= 3 && restSeconds > 0
  const isRowing = kb.type === 'rowing'
  const isRunning = kb.type === 'running'
  const isCycling = kb.type === 'cycling'
  const hasTargets = (isRowing || isRunning || isCycling) && (
    kb.distance_m || kb.target_split || kb.target_spm || kb.target_hr_zone ||
    kb.target_pace || kb.target_speed_kmh || kb.target_power_w || kb.target_cadence_rpm
  )

  if (!segment) {
    return (
      <div className="flex flex-col gap-4 pb-4">
        <Card className="p-5 text-center">
          <p className="text-slate-400 text-sm">Geen oefening gevonden voor deze stap.</p>
        </Card>
        <button onClick={onReady} className="w-full py-3.5 bg-green-500 text-white rounded-xl font-semibold text-sm active:bg-green-600">
          Verder →
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 pr-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
            {isFirst ? 'Eerste oefening' : `Oefening ${segmentIndex + 1} van ${totalSegments}`}
          </p>
          <h2 className="text-2xl font-bold text-white">{kb.exercise || kb.type || 'Oefening'}</h2>
          <p className="text-sm text-primary-400 mt-1">
            {isRowing
              ? (kb.distance_m
                  ? `${kb.sets} × ${kb.distance_m}m${kb.target_split ? ` @ ${kb.target_split}/500m` : ''}`
                  : `${kb.sets > 1 ? `${kb.sets} × ` : ''}${formatTime(kb.duration_sec || 0)}`)
              : isRunning
                ? (kb.distance_m
                    ? `${kb.sets > 1 ? `${kb.sets} × ` : ''}${kb.distance_m}m${kb.target_pace ? ` @ ${kb.target_pace}` : ''}`
                    : `${kb.sets > 1 ? `${kb.sets} × ` : ''}${formatTime(kb.duration_sec || 0)}`)
                : isCycling
                  ? (kb.distance_m
                      ? `${kb.sets > 1 ? `${kb.sets} × ` : ''}${kb.distance_m}m${kb.target_power_w ? ` @ ${kb.target_power_w}W` : ''}`
                      : `${kb.sets > 1 ? `${kb.sets} × ` : ''}${formatTime(kb.duration_sec || 0)}${kb.target_power_w ? ` @ ${kb.target_power_w}W` : ''}`)
                  : (kb.reps ? `${kb.sets} × ${kb.reps} herh.` : `${kb.sets} × ${kb.duration_sec || 0}s`)
            }
            {kb.rest_sec ? ` · ${kb.rest_sec}s rust` : ''}
          </p>
        </div>
        {restSeconds !== undefined && (
          <div className="text-right flex-shrink-0">
            <p className={cn('text-3xl font-mono font-bold',
              (restSeconds ?? 0) <= 3 ? 'text-red-400' : 'text-amber-400'
            )}>{restSeconds}s</p>
            <p className="text-xs text-slate-500 mt-0.5">{formatTime(elapsedSeconds)}</p>
          </div>
        )}
      </div>

      {hasTargets && (
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Doelwaarden</p>
          <div className="grid grid-cols-2 gap-3">
            {kb.distance_m && <div><p className="text-xs text-slate-500">Afstand</p><p className="text-lg font-bold text-white">{kb.distance_m}m</p></div>}
            {kb.target_split && <div><p className="text-xs text-slate-500">Doelsplit</p><p className="text-lg font-bold text-white">{kb.target_split}</p></div>}
            {kb.target_pace && <div><p className="text-xs text-slate-500">Doeltempo</p><p className="text-lg font-bold text-white">{kb.target_pace}</p></div>}
            {kb.target_speed_kmh && <div><p className="text-xs text-slate-500">Snelheid</p><p className="text-lg font-bold text-white">{kb.target_speed_kmh} km/u</p></div>}
            {kb.target_power_w && <div><p className="text-xs text-slate-500">Vermogen</p><p className="text-lg font-bold text-white">{kb.target_power_w} W</p></div>}
            {kb.target_cadence_rpm && <div><p className="text-xs text-slate-500">Cadans</p><p className="text-lg font-bold text-white">{kb.target_cadence_rpm} rpm</p></div>}
            {kb.target_spm && <div><p className="text-xs text-slate-500">SPM doel</p><p className="text-lg font-bold text-white">{kb.target_spm}</p></div>}
            {kb.target_hr_zone && <div><p className="text-xs text-slate-500">Hartslagzone</p><p className="text-lg font-bold text-white">{kb.target_hr_zone}</p></div>}
          </div>
        </Card>
      )}

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

      {kb.common_errors.length > 0 && (
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
          {restSeconds !== undefined ? (isPulsing ? `Start in ${restSeconds}s` : 'Ready →') : (isFirst ? 'Ready →' : 'Ready -- Start →')}
        </button>
      </div>
    </div>
  )
}

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
  const segments = getSegments(session.schema)
  const seg = asDisplay(getSeg(session.schema, session.current_segment))
  const isRowing = seg.type === 'rowing'
  const isRunning = seg.type === 'running'
  const isCycling = seg.type === 'cycling'
  const totalSets = seg.sets || 1
  const isLastSegment = session.current_segment === segments.length - 1
  const tickRef = useRef<NodeJS.Timeout | null>(null)
  const restRef = useRef<NodeJS.Timeout | null>(null)
  const [currentTempo, setCurrentTempo] = useState<Tempo>(getTempo(seg.exercise))

  useEffect(() => { setCurrentTempo(getTempo(seg.exercise)) }, [seg.exercise])

  useEffect(() => {
    if (session.workout_phase === 'active' && session.auto_running) {
      tickRef.current = setInterval(() => {
        if (session.active_seconds_left <= 1) { onTick(); onNextSet() } else { onTick() }
      }, 1000)
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [session.workout_phase, session.auto_running, session.active_seconds_left, onTick, onNextSet])

  useEffect(() => {
    if ((session.workout_phase === 'rest' || session.workout_phase === 'last_rest') && session.auto_running && session.rest_seconds > 0) {
      restRef.current = setInterval(() => {
        if (session.rest_seconds <= 1) {
          clearInterval(restRef.current!)
          if (session.workout_phase === 'last_rest') { if (isLastSegment) onComplete(); else onNextSegment() } else { onNextSet() }
        } else { onRestTick() }
      }, 1000)
    }
    return () => { if (restRef.current) clearInterval(restRef.current) }
  }, [session.workout_phase, session.auto_running, session.rest_seconds, isLastSegment, onComplete, onNextSegment, onNextSet, onRestTick])

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center gap-1.5">
        {segments.map((_, i) => (
          <div key={i} className={cn('flex-1 h-1.5 rounded-full transition-all',
            session.completed_segments.includes(i) || session.skipped_segments.includes(i) ? 'bg-green-500' :
            i === session.current_segment ? 'bg-primary-500' : 'bg-slate-700'
          )} />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">
          {seg.exercise || 'Oefening'}
          <span className="text-slate-500 font-normal ml-2">{session.current_segment + 1}/{segments.length}</span>
        </p>
        <p className="text-2xl font-mono font-bold text-white">{formatTime(session.elapsed_seconds)}</p>
      </div>

      {session.workout_phase === 'active' && (
        <Card className="p-5">
          {totalSets > 1 && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider">
                {(isRowing || isRunning || isCycling) ? `Interval ${session.current_set} van ${totalSets}` : `Set ${session.current_set} van ${totalSets}`}
              </p>
              <div className="flex gap-1">
                {Array.from({ length: totalSets }, (_, i) => (
                  <div key={i} className={cn('w-5 h-1.5 rounded-full',
                    i < session.current_set - 1 ? 'bg-green-500' :
                    i === session.current_set - 1 ? 'bg-primary-500' : 'bg-slate-700'
                  )} />
                ))}
              </div>
            </div>
          )}
          <div className="flex items-end justify-between mb-1">
            <div>
              {isRowing ? (
                <><p className="text-5xl font-bold text-primary-400">{seg.distance_m ? `${seg.distance_m}m` : formatTime(seg.duration_sec || 0)}</p>
                <p className="text-slate-400 text-sm">{[seg.target_split && `${seg.target_split}/500m`, seg.target_spm && `${seg.target_spm} spm`, seg.target_hr_zone].filter(Boolean).join(' · ') || 'roeien'}</p></>
              ) : isRunning ? (
                <><p className="text-5xl font-bold text-primary-400">{seg.distance_m ? `${seg.distance_m}m` : formatTime(seg.duration_sec || 0)}</p>
                <p className="text-slate-400 text-sm">{[seg.target_pace, seg.target_speed_kmh && `${seg.target_speed_kmh} km/u`, seg.target_hr_zone].filter(Boolean).join(' · ') || 'lopen'}</p></>
              ) : isCycling ? (
                <><p className="text-5xl font-bold text-primary-400">{seg.distance_m ? `${seg.distance_m}m` : formatTime(seg.duration_sec || 0)}</p>
                <p className="text-slate-400 text-sm">{[seg.target_power_w && `${seg.target_power_w}W`, seg.target_cadence_rpm && `${seg.target_cadence_rpm} rpm`, seg.target_hr_zone].filter(Boolean).join(' · ') || 'fietsen'}</p></>
              ) : (
                <><p className="text-5xl font-bold text-primary-400">{seg.reps ? `${seg.reps}` : `${seg.duration_sec || 0}s`}</p>
                <p className="text-slate-400 text-sm">{seg.reps ? 'herhalingen' : 'seconden'}</p></>
              )}
            </div>
            <p className={cn('text-3xl font-mono font-bold', session.active_seconds_left <= 3 ? 'text-red-400' : 'text-white')}>{session.active_seconds_left}s</p>
          </div>
          {seg.cue && <p className="text-sm text-slate-300 pt-3 mt-2 border-t border-coach-border">💡 {seg.cue}</p>}
          {!isRowing && !isRunning && !isCycling && seg.reps && !seg.duration_sec && (
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

      {session.workout_phase === 'rest' && (
        <Card className="p-5 text-center bg-amber-500/10 border-amber-500/20">
          <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-2">Rust · Set {session.current_set} volgt</p>
          <p className={cn('text-6xl font-mono font-bold', session.rest_seconds <= 3 ? 'text-red-400' : 'text-amber-400')}>{session.rest_seconds}s</p>
        </Card>
      )}

      {session.workout_phase === 'last_rest' && (() => {
        const nextSeg = segments[session.current_segment + 1]
        return nextSeg ? (
          <UitlegScherm segment={nextSeg} segmentIndex={session.current_segment + 1} totalSegments={segments.length}
            elapsedSeconds={session.elapsed_seconds} restSeconds={session.rest_seconds} onReady={onNextSegment} showBack={false} />
        ) : (
          <Card className="p-5 text-center bg-amber-500/10 border-amber-500/20">
            <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-2">Laatste rust</p>
            <p className="text-6xl font-mono font-bold text-amber-400">{session.rest_seconds}s</p>
          </Card>
        )
      })()}

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
          <button onClick={onVolgendOefening} disabled={isLastSegment}
            className="flex-1 py-3.5 bg-slate-800 text-slate-300 rounded-xl font-semibold text-sm active:bg-slate-700 disabled:opacity-30 flex items-center justify-center gap-1">
            Volgend <ChevronRight size={14} />
          </button>
        </div>
      )}

      <button onClick={onPause}
        className="w-full py-3.5 bg-slate-800/60 text-slate-300 rounded-xl text-sm font-semibold active:bg-slate-700 flex items-center justify-center gap-2">
        <PauseIcon size={16} /> Pause
      </button>
    </div>
  )
}

function VoltooïdScherm({ session, onEvaluatie }: { session: ExtendedSessionState; onEvaluatie: () => void }) {
  const segments = getSegments(session.schema)
  const totalSets = segments.reduce((a, seg) => a + (asDisplay(seg).sets || 0), 0)
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
          <div><p className="text-2xl font-bold text-green-400">{session.completed_segments.length}</p><p className="text-xs text-slate-400 mt-0.5">Oefeningen voltooid</p></div>
          <div><p className="text-2xl font-bold text-slate-400">{session.skipped_segments.length}</p><p className="text-xs text-slate-400 mt-0.5">Overgeslagen</p></div>
          <div><p className="text-2xl font-bold text-primary-400">{session.completed_sets}</p><p className="text-xs text-slate-400 mt-0.5">Sets voltooid</p></div>
          <div><p className="text-2xl font-bold text-white">{totalSets}</p><p className="text-xs text-slate-400 mt-0.5">Totaal sets</p></div>
        </div>
      </Card>
      <button onClick={onEvaluatie} className="w-full py-4 bg-primary-500 text-white rounded-xl font-semibold active:bg-primary-600">
        Evaluatie Starten →
      </button>
    </div>
  )
}

function EvaluatieLayer({ actualDuration, isRowing, isRunning, isCycling, onSave, onSkip, saving }: {
  actualDuration: number; isRowing: boolean; isRunning: boolean; isCycling: boolean
  onSave: (result: SessionResult) => void; onSkip: () => void; saving: boolean
}) {
  const [rating, setRating] = useState<number | null>(null)
  const [effort, setEffort] = useState<number | null>(null)
  const [techniek, setTechniek] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [rowingTechniek, setRowingTechniek] = useState<number | null>(null)
  const [rowingPacing, setRowingPacing] = useState<number | null>(null)
  const [rowingVermoeidheid, setRowingVermoeidheid] = useState<number | null>(null)
  const [runningTechniek, setRunningTechniek] = useState<number | null>(null)
  const [runningPacing, setRunningPacing] = useState<number | null>(null)
  const [runningVermoeidheid, setRunningVermoeidheid] = useState<number | null>(null)
  const [runningRpe, setRunningRpe] = useState<number | null>(null)
  const [cyclingTechniek, setCyclingTechniek] = useState<number | null>(null)
  const [cyclingPacing, setCyclingPacing] = useState<number | null>(null)
  const [cyclingVermoeidheid, setCyclingVermoeidheid] = useState<number | null>(null)
  const [cyclingRpe, setCyclingRpe] = useState<number | null>(null)

  function ScoreRij({ label, value, onChange, kleur }: { label: string; value: number | null; onChange: (v: number) => void; kleur: string }) {
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
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Hoe ging het?" rows={3}
            className="w-full bg-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-primary-500" />
        </div>
      </Card>

      {isRowing && (
        <Card className="p-5 flex flex-col gap-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider -mb-1">Rowing</p>
          <ScoreRij label="Techniek (haal, timing)" value={rowingTechniek} onChange={setRowingTechniek} kleur="text-blue-400" />
          <ScoreRij label="Tempo controle (split gehouden)" value={rowingPacing} onChange={setRowingPacing} kleur="text-blue-400" />
          <ScoreRij label="Vermoeidheid na sessie" value={rowingVermoeidheid} onChange={setRowingVermoeidheid} kleur="text-blue-400" />
        </Card>
      )}

      {isRunning && (
        <Card className="p-5 flex flex-col gap-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider -mb-1">Running</p>
          <ScoreRij label="Looptechniek" value={runningTechniek} onChange={setRunningTechniek} kleur="text-blue-400" />
          <ScoreRij label="Tempo controle" value={runningPacing} onChange={setRunningPacing} kleur="text-blue-400" />
          <ScoreRij label="Vermoeidheid nu" value={runningVermoeidheid} onChange={setRunningVermoeidheid} kleur="text-blue-400" />
          <ScoreRij label="Hoe zwaar voelde de training (RPE)" value={runningRpe} onChange={setRunningRpe} kleur="text-blue-400" />
        </Card>
      )}

      {isCycling && (
        <Card className="p-5 flex flex-col gap-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider -mb-1">Cycling</p>
          <ScoreRij label="Fietstechniek" value={cyclingTechniek} onChange={setCyclingTechniek} kleur="text-blue-400" />
          <ScoreRij label="Tempo controle" value={cyclingPacing} onChange={setCyclingPacing} kleur="text-blue-400" />
          <ScoreRij label="Vermoeidheid nu" value={cyclingVermoeidheid} onChange={setCyclingVermoeidheid} kleur="text-blue-400" />
          <ScoreRij label="Hoe zwaar voelde de training (RPE)" value={cyclingRpe} onChange={setCyclingRpe} kleur="text-blue-400" />
        </Card>
      )}

      <div className="flex gap-3">
        <button onClick={onSkip} className="flex-1 py-3.5 bg-slate-800 text-slate-300 rounded-xl font-semibold active:bg-slate-700">Overslaan</button>
        <button
          onClick={() => onSave({
            rating, perceived_effort: effort, fatigue_after: null, soreness: null,
            notes: notes.trim() || null, actual_duration: actualDuration, completed: true,
            ...(isRowing ? { rowing_technique_rating: rowingTechniek, rowing_pacing_rating: rowingPacing, rowing_fatigue_rating: rowingVermoeidheid } : {}),
            ...(isRunning ? { running_technique_rating: runningTechniek, running_pacing_rating: runningPacing, running_fatigue_rating: runningVermoeidheid, running_rpe_rating: runningRpe } : {}),
            ...(isCycling ? { cycling_technique_rating: cyclingTechniek, cycling_pacing_rating: cyclingPacing, cycling_fatigue_rating: cyclingVermoeidheid, cycling_rpe_rating: cyclingRpe } : {}),
          })}
          disabled={saving || !rating}
          className="flex-1 py-3.5 bg-primary-500 text-white rounded-xl font-semibold active:bg-primary-600 disabled:opacity-40">
          {saving ? 'Opslaan...' : 'Opslaan'}
        </button>
      </div>
    </div>
  )
}

export default function SessionPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const module = params.module as TrainingModule

  // ── Library detectie via localStorage (PWA-proof) ──────────────────────────
  // searchParams is onbetrouwbaar in PWA op iOS — query params worden soms
  // weggegooid bij navigatie. training/page.tsx slaat de module-keuze op in
  // localStorage vóór navigatie zodat we hier altijd de juiste waarde hebben.
  const vandaagStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
  const libPending = typeof window !== 'undefined' ? localStorage.getItem('library_module_pending') : null
  const libDatum = typeof window !== 'undefined' ? localStorage.getItem('library_module_datum') : null
  const isLibrary = (libPending === module && libDatum === vandaagStr) || searchParams.get('source') === 'library'

  const [session, setSession] = useState<ExtendedSessionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPause, setShowPause] = useState(false)
  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [showResumeDialog, setShowResumeDialog] = useState(false)
  const [pendingSession, setPendingSession] = useState<ExtendedSessionState | null>(null)

  useEffect(() => {
    const existing = loadSession()
    const hasSegments = existing?.schema && getSegments(existing.schema).length > 0
    if (existing && existing.module === module && existing.status !== 'completed' && hasSegments) {
      setPendingSession(existing)
      setShowResumeDialog(true)
      setLoading(false)
      return
    }
    clearSession()
    const run = async () => {
      try {
        if (isLibrary) {
          const vandaag = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
          const libKey = `training_lib_${module}_data`
          const libDatumKey = `training_lib_${module}_datum`
          const cachedDatum = localStorage.getItem(libDatumKey)
          const cachedLib = localStorage.getItem(libKey)
          if (cachedDatum === vandaag && cachedLib) {
            const instruction = JSON.parse(cachedLib)
            if (getSegments({ segments: instruction?.segments } as TrainingSchema).length > 0) {
              buildAndSetSession(instruction, 'library')
              return
            }
          }
          const res = await fetch('/api/training/today', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ module, source: 'library' }),
          })
          if (res.ok) {
            const data = await res.json()
            const instruction = data.instruction || data
            if (instruction?.training_type || instruction?.segments) {
              localStorage.setItem(libKey, JSON.stringify(instruction))
              localStorage.setItem(libDatumKey, vandaag)
              // Wis de pending library-keuze na succesvolle sessie-opbouw
              localStorage.removeItem('library_module_pending')
              localStorage.removeItem('library_module_datum')
              buildAndSetSession(instruction, 'library')
            } else setError('Geen geldig schema ontvangen.')
          } else if (res.status === 403) {
            setError('Deze module is niet beschikbaar -- check je Equipment instellingen.')
          } else setError(`Fout ${res.status}: schema generatie mislukt`)
          return
        }

        const cached = localStorage.getItem('training_instructie_data')
        if (cached) {
          const instruction = JSON.parse(cached)
          if (getSegments({ segments: instruction?.segments } as TrainingSchema).length > 0) {
            buildAndSetSession(instruction, 'coach_plan')
            return
          }
        }
        const res = await fetch('/api/training/today', { method: 'POST', credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          const instruction = data.instruction || data
          if (instruction?.training_type || instruction?.segments) {
            localStorage.setItem('training_instructie_data', JSON.stringify(instruction))
            buildAndSetSession(instruction, 'coach_plan')
          } else setError('Geen geldig schema ontvangen.')
        } else setError(`Fout ${res.status}: schema generatie mislukt`)
      } catch (e) { setError(String(e)) }
      finally { setLoading(false) }
    }
    run()
  }, [module, isLibrary])

  function buildAndSetSession(instruction: Record<string, unknown>, source: TrainingSource) {
    const rawSegments = (instruction.segments || instruction.exercises || []) as unknown[]
    const segments: TrainingSegment[] = Array.isArray(rawSegments)
      ? rawSegments.map(s => asDisplay(s as TrainingSegment) as unknown as TrainingSegment)
      : []
    const schema: TrainingSchema = {
      module,
      title: (instruction.title as string) || `${module.charAt(0).toUpperCase() + module.slice(1)} sessie`,
      duration: (instruction.duration as number) || 30,
      intensity: (instruction.intensity as 'light' | 'medium' | 'heavy') || 'medium',
      segments,
      coach_message: (instruction.coach_message as string) || (instruction.reason as string) || '',
    }
    const firstSeg = segments[0] as KettlebellSegment | undefined
    const newSession: ExtendedSessionState = {
      session_id: generateSessionId(), module, status: 'schema', schema,
      started_at: new Date().toISOString(), current_segment: 0, completed_segments: [],
      elapsed_seconds: 0, current_set: 1, workout_phase: 'active', rest_seconds: 0,
      active_seconds_left: getActiveDuration(firstSeg),
      auto_running: false, skipped_segments: [], completed_sets: 0, uitleg_index: 0,
      training_source: source,
    }
    saveSession(newSession)
    setSession(newSession)
    setLoading(false)
  }

  useEffect(() => { if (session) saveSession(session) }, [session])

  const handleTick = useCallback(() => {
    setSession(prev => prev && prev.auto_running ? {
      ...prev, elapsed_seconds: prev.elapsed_seconds + 1,
      active_seconds_left: Math.max(0, prev.active_seconds_left - 1),
    } : prev)
  }, [])

  const handleRestTick = useCallback(() => {
    setSession(prev => prev && prev.auto_running ? { ...prev, rest_seconds: Math.max(0, prev.rest_seconds - 1) } : prev)
  }, [])

  function updateStatus(status: SessionStatus) {
    setSession(prev => prev ? { ...prev, status } : prev)
  }

  function handleNextSet() {
    setSession(prev => {
      if (!prev) return prev
      const seg = getSeg(prev.schema, prev.current_segment)
      const totalSets = seg?.sets || 1
      const restSec = seg?.rest_sec || 60
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
      return { ...prev, current_segment: next, completed_segments: [...prev.completed_segments, prev.current_segment],
        current_set: 1, workout_phase: 'active', rest_seconds: 0, auto_running: true, active_seconds_left: getActiveDuration(nextSeg) }
    })
  }

  function handleComplete() {
    setSession(prev => prev ? { ...prev, status: 'voltooid' as SessionStatus, auto_running: false } : prev)
  }

  function handleNext() {
    setSession(prev => {
      if (!prev) return prev
      const segments = getSegments(prev.schema)
      const seg = getSeg(prev.schema, prev.current_segment)
      const totalSets = seg?.sets || 1
      const restSec = seg?.rest_sec || 60
      const isLastSegment = prev.current_segment === segments.length - 1
      if (prev.workout_phase === 'active') {
        const isLastSet = prev.current_set >= totalSets
        return { ...prev, workout_phase: isLastSet ? 'last_rest' : 'rest', rest_seconds: restSec, completed_sets: prev.completed_sets + 1 }
      } else if (prev.workout_phase === 'rest') {
        return { ...prev, workout_phase: 'active', current_set: prev.current_set + 1, rest_seconds: 0, active_seconds_left: getActiveDuration(seg) }
      } else if (prev.workout_phase === 'last_rest') {
        if (isLastSegment) return { ...prev, status: 'voltooid' as SessionStatus, auto_running: false }
        const nextSeg3 = getSeg(prev.schema, prev.current_segment + 1)
        return { ...prev, current_segment: prev.current_segment + 1, completed_segments: [...prev.completed_segments, prev.current_segment],
          current_set: 1, workout_phase: 'active', rest_seconds: 0, active_seconds_left: getActiveDuration(nextSeg3) }
      }
      return prev
    })
  }

  function handleBackOefening() {
    setSession(prev => {
      if (!prev) return prev
      const targetIndex = prev.workout_phase === 'active' && prev.current_set === 1 && prev.current_segment > 0
        ? prev.current_segment - 1 : prev.current_segment
      return { ...prev, auto_running: false, workout_phase: 'uitleg', uitleg_index: targetIndex,
        current_segment: targetIndex, current_set: 1, rest_seconds: 0, elapsed_seconds: 0 }
    })
  }

  function handleVolgendOefening() {
    setSession(prev => {
      if (!prev) return prev
      const segments = getSegments(prev.schema)
      const next = Math.min(prev.current_segment + 1, Math.max(0, segments.length - 1))
      return { ...prev, auto_running: false, workout_phase: 'uitleg', uitleg_index: next,
        current_segment: next, current_set: 1, rest_seconds: 0, elapsed_seconds: 0 }
    })
  }

  function handleHeaderBack() {
    if (!session) { router.push('/training'); return }
    if (session.status === 'workout' && session.workout_phase === 'uitleg') {
      if (session.uitleg_index === 0) {
        setSession(prev => prev ? { ...prev, status: 'schema', workout_phase: 'active', current_set: 1, rest_seconds: 0, elapsed_seconds: 0 } : prev)
      } else {
        setSession(prev => {
          if (!prev) return prev
          const vorigeIndex = prev.uitleg_index - 1
          return { ...prev, uitleg_index: vorigeIndex, current_segment: vorigeIndex, current_set: 1, rest_seconds: 0, elapsed_seconds: 0 }
        })
      }
    } else if (session.status === 'workout') {
      setSession(prev => prev ? { ...prev, auto_running: false, workout_phase: 'uitleg', uitleg_index: prev.current_segment,
        current_set: 1, rest_seconds: 0, elapsed_seconds: 0 } : prev)
    } else if (session.status === 'learning') {
      updateStatus('schema')
    } else {
      clearSession()
      router.push('/training')
    }
  }

  function handleReadyFromUitleg() {
    setSession(prev => {
      if (!prev) return prev
      const seg = getSeg(prev.schema, prev.current_segment)
      return { ...prev, status: 'workout', workout_phase: 'active', auto_running: true,
        current_set: 1, rest_seconds: 0, active_seconds_left: getActiveDuration(seg) }
    })
  }

  async function handleSave(result: SessionResult) {
    if (!session) return
    setSaving(true)
    try {
      await fetch('/api/training/complete', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, ...result, training_type: module, training_source: session?.training_source || 'coach_plan' }),
      })
      clearSession()
      setSession(prev => prev ? { ...prev, status: 'completed' } : prev)
      setTimeout(() => router.push('/training'), 1500)
    } catch { /* */ }
    finally { setSaving(false) }
  }

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

  const segments = session ? getSegments(session.schema) : []
  const huidigeSegForPause = session ? getSeg(session.schema, session.current_segment) : undefined

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={handleHeaderBack}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">{moduleLabel[module] || module}</h1>
            <p className="text-xs text-slate-500 capitalize">{session?.status || 'laden'}</p>
          </div>
        </div>

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

        {session && !showResumeDialog && (
          <>
            {session.status === 'schema' && <SchemaLayer schema={session.schema} onStart={() => updateStatus('learning')} />}

            {session.status === 'learning' && (
              <UitlegScherm segment={segments[0]} segmentIndex={0} totalSegments={segments.length}
                elapsedSeconds={0} showBack={true} onReady={handleReadyFromUitleg} onBack={() => updateStatus('schema')} />
            )}

            {session.status === 'workout' && session.workout_phase !== 'uitleg' && (
              <WorkoutEngine session={session} onTick={handleTick} onRestTick={handleRestTick}
                onNextSet={handleNextSet} onNextSegment={handleNextSegment} onComplete={handleComplete}
                onBackOefening={handleBackOefening} onVolgendOefening={handleVolgendOefening} onNext={handleNext}
                onPause={() => { setSession(prev => prev ? { ...prev, auto_running: false } : prev); setShowPause(true) }}
                onTempoChange={(exercise, tempo) => {
                  setTempo(exercise, tempo)
                  setSession(prev => {
                    if (!prev) return prev
                    const seg = getSeg(prev.schema, prev.current_segment)
                    if (!seg || seg.exercise !== exercise || prev.workout_phase !== 'active') return prev
                    return { ...prev, active_seconds_left: getActiveDuration(seg) }
                  })
                }} />
            )}

            {session.status === 'workout' && session.workout_phase === 'uitleg' && (
              <UitlegScherm segment={segments[session.uitleg_index]} segmentIndex={session.uitleg_index}
                totalSegments={segments.length} elapsedSeconds={session.elapsed_seconds}
                showBack={session.uitleg_index > 0} onReady={handleReadyFromUitleg}
                onBack={() => setSession(prev => prev ? { ...prev,
                  uitleg_index: Math.max(0, prev.uitleg_index - 1),
                  current_segment: Math.max(0, prev.uitleg_index - 1) } : prev)} />
            )}

            {(session.status as string) === 'voltooid' && (
              <VoltooïdScherm session={session} onEvaluatie={() => updateStatus('evaluation')} />
            )}

            {session.status === 'evaluation' && (
              <EvaluatieLayer actualDuration={Math.round(session.elapsed_seconds / 60)}
                isRowing={module === 'rowing'} isRunning={module === 'running'} isCycling={module === 'cycling'}
                onSave={handleSave} onSkip={() => { clearSession(); router.push('/training') }} saving={saving} />
            )}

            {session.status === 'completed' && (
              <Card className="p-8 text-center">
                <Check size={40} className="text-green-400 mx-auto mb-3" />
                <p className="text-white font-semibold">Opgeslagen!</p>
              </Card>
            )}
          </>
        )}

        {showPause && session && (
          <div className="fixed inset-0 bg-black/85 flex flex-col items-center justify-center z-50 px-8">
            <Card className="p-6 w-full text-center">
              <p className="text-white text-xl font-bold mb-1">⏸ Training Gepauzeerd</p>
              <p className="text-slate-400 text-sm mb-1">{huidigeSegForPause?.exercise || 'Oefening'}</p>
              <p className="text-slate-500 text-xs mb-6">Set {session.current_set} · {formatTime(session.elapsed_seconds)}</p>
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
