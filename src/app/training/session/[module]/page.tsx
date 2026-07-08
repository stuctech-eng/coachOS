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
import { BODYWEIGHT_OEFENINGEN } from '@/lib/bodyweight-exercises'
import { STRENGTH_OEFENINGEN } from '@/lib/strength-exercises'
import { KETTLEBELL_OEFENINGEN } from '@/lib/kettlebell-exercises'
import { ontgrendelAudio, speelTick, speelEindsignaal, speelStarttoon, speelFinishToon } from '@/lib/workout-sound'

// v2.4.29 — TIMER ENGINE REBUILD (Fase 1 + Fase 2 van de Workout Engine
// Master Architecture). Belangrijkste wijzigingen t.o.v. de vorige versie:
//
// FASE 1 — Eén centrale, drift-vrije timer-engine:
// - Elke getimede fase heeft een vast `phase_end_at`-tijdstip (ms sinds
//   epoch), berekend als Date.now() + duur bij het BEGIN van de fase.
// - Resterende tijd wordt NOOIT los bijgehouden/afgeteld — hij wordt bij
//   elke render herberekend uit phase_end_at. Dit voorkomt drift die kan
//   ontstaan doordat setInterval() op iOS vertraagt zodra het scherm uitgaat
//   of de app naar de achtergrond gaat.
// - Eén `visibilitychange`-listener herberekent direct bij terugkeer naar
//   de app, in plaats van te wachten tot de volgende "gewone" tick.
// - WorkoutEngine (het presentatie-component) beheert zelf GEEN timers meer
//   — hij ontvangt alleen `remainingSeconds` als prop en toont dat.
//
// FASE 2 — Vereenvoudigde flow (Workout Engine Master Architecture):
// - Countdown TUSSEN sets van dezelfde oefening is verwijderd. Na rust
//   gaat het direct door naar de volgende set (active), geen tussenstap.
// - 5 sec countdown geldt alleen bij de allereerste oefening van de sessie.
// - 3 sec countdown geldt bij elke overgang naar een NIEUWE oefening
//   (na last_rest).
//
// Nieuwe flow: uitleg → countdown(5s, alleen 1e oefening) → active → rest
// → active → rest → active → last_rest → [nieuwe oefening] → countdown(3s)
// → active → ... → voltooid

type WorkoutPhase = 'countdown' | 'active' | 'rest' | 'last_rest' | 'uitleg'

const EERSTE_COUNTDOWN_SEC = 5
const NIEUWE_OEFENING_COUNTDOWN_SEC = 3

interface ExtendedSessionState extends LiveSessionState {
  current_set: number
  workout_phase: WorkoutPhase
  auto_running: boolean
  skipped_segments: number[]
  completed_sets: number
  uitleg_index: number
  // v2.4.29: vervangt countdown_seconds/active_seconds_left/rest_seconds.
  // Eén vast eindtijdstip (ms) voor de huidige getimede fase. null wanneer
  // de fase geen timer heeft (uitleg) of tijdens pauze (zie paused_remaining_ms).
  phase_end_at: number | null
  // v2.4.29: bij pauzeren wordt de resterende tijd hierin bewaard (ms),
  // zodat hervatten een nieuw phase_end_at kan berekenen vanaf exact waar
  // gebleven was, zonder dat de gepauzeerde tijd meetelt.
  paused_remaining_ms: number | null
}

function generateSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface BibliotheekOefening {
  naam: string
  id: string
  beschrijving: string
  tips: string[]
  fouten: string[]
  primaireSpieren: string[]
  secundaireSpieren: string[]
  illustratie?: string
}

function zoekInBibliotheek(naam: string, moduleType: string): BibliotheekOefening | null {
  if (!naam) return null
  const normNaam = naam.toLowerCase().trim().replace(/[-_]/g, ' ')

  const ALIASSEN: Record<string, string> = {
    'bodyweight squat': 'air squat', 'bodyweight squats': 'air squat', 'squats': 'air squat', 'squat': 'air squat',
    'push ups': 'push-up', 'push-ups': 'push-up', 'pushups': 'push-up', 'pushup': 'push-up',
    'lunges': 'reverse lunge', 'lunge': 'reverse lunge', 'plank hold': 'plank', 'high plank': 'plank',
    'glute bridges': 'glute bridge', 'hip bridges': 'glute bridge', 'mountain climbers': 'mountain climber',
    'jumping jacks': 'jumping jacks', 'burpees': 'burpee', 'dead bugs': 'dead bug', 'bird dogs': 'bird dog',
    'side planks': 'zijplank', 'side plank': 'zijplank', 'hollow body hold': 'hollow hold', 'hollow body': 'hollow hold',
    'v ups': 'v-up', 'v-ups': 'v-up', 'russian twists': 'russian twist', 'bicycle crunches': 'bicycle crunch',
    'leg raises': 'beenheffen', 'reverse crunches': 'reverse crunch', 'flutter kicks': 'flutter kick',
    'hip thrusts': 'hip thrust', 'donkey kicks': 'donkey kick', 'fire hydrants': 'fire hydrant',
    'clamshells': 'clamshell', 'frog pumps': 'frog pump', 'calf raises': 'kuitverheffen', 'step ups': 'step-up',
    'goblet squats': 'goblet squat', 'split squats': 'split squat', 'bulgarian split squats': 'bulgaarse split squat',
    'wall sits': 'wall sit', 'inchworms': 'inchworm', 'world greatest stretch': 'world\'s greatest stretch',
    'worlds greatest stretch': 'world\'s greatest stretch', 'childs pose': 'child\'s pose', 'child pose': 'child\'s pose',
    'cat cow': 'cat-cow', 'cat-cow stretch': 'cat-cow', 'deep squat': 'deep squat hold',
    'thoracic rotations': 'thoracale rotatie', 'thoracic rotation': 'thoracale rotatie',
    'hip flexor stretch': 'heupbuiger stretch', 'shoulder rolls': 'schouderrollen', 'box breathing': 'box breathing',
    'superman hold': 'superman', 'supermans': 'superman', 'toe touches': 'toe touch',
    'knee push ups': 'knie push-up', 'knee push-ups': 'knie push-up', 'incline push ups': 'incline push-up',
    'decline push ups': 'decline push-up', 'wide push ups': 'wide push-up', 'diamond push ups': 'diamond push-up',
    'pike push ups': 'pike push-up', 'skater jumps': 'skater jump', 'skater hops': 'skater jump',
    'high knees': 'high knees', 'butt kicks': 'butt kicks', 'lateral shuffles': 'zijwaartse shuffle',
    'lateral shuffle': 'zijwaartse shuffle', 'plank jacks': 'plank jack', 'tuck jumps': 'tuck jump',
    'broad jumps': 'brede sprong', 'bear crawls': 'bear crawl', 'seal jacks': 'seal jack',
    'speed skaters': 'speed skater', 'shoulder taps': 'shoulder tap', 'reverse snow angels': 'reverse snow angel',
    'cobra pose': 'cobra hold', 'cobra stretch': 'cobra hold',
    'two hand swing': 'kettlebell swing', 'two-hand swing': 'kettlebell swing', 'kb swing': 'kettlebell swing',
    'kb deadlift': 'kettlebell deadlift', 'goblet squat kb': 'goblet squat', 'single arm press': 'strict press',
    'overhead press kb': 'strict press', 'kb press': 'strict press', 'kb row': 'single arm row',
    'kb clean': 'clean', 'kb snatch': 'snatch',
    'dumbbell squats': 'goblet squat', 'db squat': 'goblet squat', 'db press': 'dumbbell bench press',
    'db bench press': 'dumbbell bench press', 'bench press db': 'dumbbell bench press', 'db row': 'dumbbell row',
    'barbell squat': 'back squat', 'back squats': 'back squat', 'deadlifts': 'deadlift',
    'romanian deadlifts': 'romanian deadlift dumbbell', 'rdl': 'romanian deadlift dumbbell',
    'overhead press': 'dumbbell shoulder press', 'shoulder press': 'dumbbell shoulder press',
    'bicep curls': 'dumbbell biceps curl', 'biceps curls': 'dumbbell biceps curl', 'curls': 'dumbbell biceps curl',
    'tricep extensions': 'dumbbell triceps extension', 'triceps extensions': 'dumbbell triceps extension',
    'lateral raises': 'lateral raise', 'farmer carries': 'farmer carry', 'farmer walk': 'farmer carry',
  }

  const genormaliseerd = ALIASSEN[normNaam] || normNaam

  function vind(lijst: BibliotheekOefening[]): BibliotheekOefening | null {
    if (genormaliseerd !== normNaam) {
      const alias = lijst.find(o => o.naam.toLowerCase() === genormaliseerd)
      if (alias) return alias
    }
    const exact = lijst.find(o => o.naam.toLowerCase() === normNaam)
    if (exact) return exact
    const idMatch = lijst.find(o => o.id === normNaam.replace(/\s+/g, '-'))
    if (idMatch) return idMatch
    const bevatBib = lijst.find(o => normNaam.includes(o.naam.toLowerCase()))
    if (bevatBib) return bevatBib
    const bevatAI = lijst.find(o => o.naam.toLowerCase().includes(normNaam))
    if (bevatAI) return bevatAI
    const eersteWoord = normNaam.split(' ')[0]
    if (eersteWoord.length > 3) {
      const woordMatch = lijst.find(o => o.naam.toLowerCase().startsWith(eersteWoord))
      if (woordMatch) return woordMatch
    }
    return null
  }

  if (moduleType === 'bodyweight') return vind(BODYWEIGHT_OEFENINGEN as unknown as BibliotheekOefening[])
  if (moduleType === 'strength') return vind(STRENGTH_OEFENINGEN as unknown as BibliotheekOefening[])
  if (moduleType === 'kettlebell') return vind(KETTLEBELL_OEFENINGEN as unknown as BibliotheekOefening[])
  return null
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

// ─── Presentatie-componenten (grotendeels ongewijzigd qua uiterlijk) ─────────

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
  restSeconds, onReady, onBack, showBack, moduleType,
}: {
  segment: TrainingSegment | undefined
  segmentIndex: number
  totalSegments: number
  elapsedSeconds: number
  restSeconds?: number
  onReady: () => void
  onBack?: () => void
  showBack: boolean
  moduleType?: string
}) {
  const kb = asDisplay(segment)
  const bibliotheekOefening = moduleType ? zoekInBibliotheek(kb.exercise, moduleType) : null
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

      {bibliotheekOefening?.illustratie && (
        <div className="bg-white rounded-2xl p-2">
          <img
            src={`/exercises/${bibliotheekOefening.illustratie}`}
            alt={kb.exercise}
            className="w-full rounded-xl"
            onError={(e) => { (e.target as HTMLImageElement).closest('div')!.style.display = 'none' }}
          />
        </div>
      )}

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

      {(bibliotheekOefening?.beschrijving || kb.instruction) && (
        <Card className="p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Uitvoering</p>
          <p className="text-sm text-slate-200 leading-relaxed">
            {bibliotheekOefening?.beschrijving || kb.instruction}
          </p>
        </Card>
      )}

      {bibliotheekOefening?.primaireSpieren && bibliotheekOefening.primaireSpieren.length > 0 && (
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Spieren</p>
          <p className="text-sm text-slate-300">{bibliotheekOefening.primaireSpieren.join(', ')}</p>
          {bibliotheekOefening.secundaireSpieren && bibliotheekOefening.secundaireSpieren.length > 0 && (
            <p className="text-xs text-slate-500 mt-1">+ {bibliotheekOefening.secundaireSpieren.join(', ')}</p>
          )}
        </Card>
      )}

      {bibliotheekOefening?.tips && bibliotheekOefening.tips.length > 0 && (
        <Card className="p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Tips</p>
          <div className="flex flex-col gap-2">
            {bibliotheekOefening.tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5 flex-shrink-0 text-xs">✓</span>
                <p className="text-sm text-slate-300">{tip}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {((bibliotheekOefening?.fouten && bibliotheekOefening.fouten.length > 0) || kb.common_errors.length > 0) && (
        <Card className="p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Veelgemaakte fouten</p>
          <div className="flex flex-col gap-2">
            {(bibliotheekOefening?.fouten || kb.common_errors).map((err, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5 flex-shrink-0 text-xs">✕</span>
                <p className="text-sm text-slate-300">{err}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {kb.cue && (
        <Card className="p-4 bg-primary-500/10 border-primary-500/20">
          <p className="text-xs text-primary-400 font-semibold uppercase tracking-wider mb-1">Coaching tip</p>
          <p className="text-sm text-white">{kb.cue}</p>
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

function CountdownScherm({ seconds, totaal, exercise }: { seconds: number; totaal: number; exercise: string }) {
  return (
    <div className="flex flex-col gap-4 pb-4">
      <Card className="p-8 text-center bg-primary-500/10 border-primary-500/30">
        <p className="text-xs text-primary-400 font-semibold uppercase tracking-wider mb-4">Klaarmaken</p>
        <p className="text-sm text-slate-300 mb-6">{exercise}</p>
        <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
          <svg width="128" height="128" className="absolute -rotate-90">
            <circle cx="64" cy="64" r="58" fill="none" stroke="#1e293b" strokeWidth="6" />
            <circle cx="64" cy="64" r="58" fill="none"
              stroke="#818cf8" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 58}`}
              strokeDashoffset={`${2 * Math.PI * 58 * (1 - seconds / totaal)}`}
              style={{ transition: 'stroke-dashoffset 1s linear' }} />
          </svg>
          <p key={seconds} className={cn('text-6xl font-bold', seconds <= 3 ? 'text-red-400' : 'text-white')} style={{ animation: 'countdownPulse 1s ease-out' }}>
            {seconds}
          </p>
        </div>
        <p className="text-xs text-slate-500 mt-6">Maak je klaar voor de oefening</p>
      </Card>
      <style>{`
        @keyframes countdownPulse {
          0% { transform: scale(1.4); opacity: 0.3; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// v2.4.29: WorkoutEngine is nu puur presentationeel — geen eigen
// setInterval-effecten meer. Alle timing komt van de ouder (SessionPage)
// via de `remaining`-prop, berekend uit het centrale phase_end_at.
function WorkoutEngine({
  session, remaining, countdownTotaal, onBackOefening, onVolgendOefening, onNext, onPause, onTempoChange,
}: {
  session: ExtendedSessionState
  remaining: number
  countdownTotaal: number
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
  const [currentTempo, setCurrentTempo] = useState<Tempo>(getTempo(seg.exercise))

  useEffect(() => { setCurrentTempo(getTempo(seg.exercise)) }, [seg.exercise])

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

      {session.workout_phase === 'countdown' && (
        <CountdownScherm seconds={remaining} totaal={countdownTotaal} exercise={seg.exercise || 'Oefening'} />
      )}

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
            {/* v2.4.33 FIX: altijd wit tijdens actief, nooit rood — rood
                betekent uitsluitend "maak je klaar om te beginnen"
                (rust/countdown), niet "je huidige oefening loopt af".
                Consistent met Archief (v2.4.31/32), waar actief ook nooit
                rood wordt. */}
            <p className="text-3xl font-mono font-bold text-white">{remaining}s</p>
          </div>
          {seg.cue && <p className="text-sm text-slate-300 pt-3 mt-2 border-t border-coach-border">💡 {seg.cue}</p>}
          {!isRowing && !isRunning && !isCycling && seg.reps && !seg.duration_sec && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-coach-border">
              {(['slow', 'normal', 'fast'] as Tempo[]).map(t => (
                <button key={t} onClick={() => { setCurrentTempo(t); onTempoChange(seg.exercise, t) }}
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
          <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-2">Rust · Set {session.current_set + 1} volgt</p>
          <p className={cn('text-6xl font-mono font-bold', remaining <= 3 ? 'text-red-400' : 'text-amber-400')}>{remaining}s</p>
        </Card>
      )}

      {session.workout_phase === 'last_rest' && (() => {
        const nextSeg = segments[session.current_segment + 1]
        return nextSeg ? (
          <UitlegScherm segment={nextSeg} segmentIndex={session.current_segment + 1} totalSegments={segments.length}
            elapsedSeconds={session.elapsed_seconds} restSeconds={remaining} onReady={onNext} showBack={false} moduleType={session.module} />
        ) : (
          <Card className="p-5 text-center bg-amber-500/10 border-amber-500/20">
            <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-2">Laatste rust</p>
            <p className="text-6xl font-mono font-bold text-amber-400">{remaining}s</p>
          </Card>
        )
      })()}

      {session.workout_phase !== 'last_rest' && session.workout_phase !== 'countdown' && (
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

      {session.workout_phase === 'countdown' && (
        <button onClick={onNext}
          className="w-full py-3.5 bg-slate-800 text-slate-300 rounded-xl font-semibold text-sm active:bg-slate-700 flex items-center justify-center gap-1">
          <SkipForward size={14} /> Skip countdown
        </button>
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

// ─── Hoofd-component: bevat de centrale timer-engine ─────────────────────────

export default function SessionPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const module = params.module as TrainingModule

  const [session, setSession] = useState<ExtendedSessionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPause, setShowPause] = useState(false)
  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [showResumeDialog, setShowResumeDialog] = useState(false)
  const [pendingSession, setPendingSession] = useState<ExtendedSessionState | null>(null)

  // v2.4.29: forceert een re-render elke 250ms zodat de afgeleide
  // resterende tijd (uit phase_end_at) zichtbaar bijwerkt. Dit is de ENIGE
  // interval in de hele engine.
  const [, setTick] = useState(0)
  const advancingRef = useRef(false) // voorkomt dubbele fase-overgangen

  useEffect(() => {
    const vandaagStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    const libPending = localStorage.getItem('library_module_pending')
    const libDatum = localStorage.getItem('library_module_datum')
    const isLibrary = (libPending === module && libDatum === vandaagStr) || searchParams.get('source') === 'library'

    const existing = loadSession()
    const hasSegments = existing?.schema && getSegments(existing.schema).length > 0

    if (!isLibrary && existing && existing.module === module && existing.status !== 'completed' && hasSegments) {
      setPendingSession(existing)
      setShowResumeDialog(true)
      setLoading(false)
      return
    }
    clearSession()
    const run = async () => {
      try {
        if (isLibrary) {
          const vandaag = vandaagStr
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
  }, [module])

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
    const newSession: ExtendedSessionState = {
      session_id: generateSessionId(), module, status: 'schema', schema,
      started_at: new Date().toISOString(), current_segment: 0, completed_segments: [],
      elapsed_seconds: 0, current_set: 1, workout_phase: 'active',
      auto_running: false, skipped_segments: [], completed_sets: 0, uitleg_index: 0,
      phase_end_at: null, paused_remaining_ms: null,
      training_source: source,
    }
    saveSession(newSession)
    setSession(newSession)
    setLoading(false)
  }

  useEffect(() => { if (session) saveSession(session) }, [session])

  // ─── Centrale ticking-loop + visibilitychange-herstel ─────────────────────
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 250)
    const onVisible = () => { if (document.visibilityState === 'visible') setTick(t => t + 1) }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  // Resterende seconden voor de huidige getimede fase, afgeleid uit
  // phase_end_at — NOOIT een losstaand afgeteld getal.
  const remaining = session?.phase_end_at
    ? Math.max(0, Math.ceil((session.phase_end_at - Date.now()) / 1000))
    : 0

  // Duur van de huidige countdown (voor de voortgangsring: 5 of 3 sec)
  const countdownTotaal = session?.current_segment === 0 && session?.completed_segments.length === 0
    ? EERSTE_COUNTDOWN_SEC : NIEUWE_OEFENING_COUNTDOWN_SEC

  // Elapsed-seconds bijhouden (los van phase_end_at — dit is de totale
  // sessieduur, geen aftellende fase-timer)
  useEffect(() => {
    if (!session || !session.auto_running) return
    const int = setInterval(() => {
      setSession(prev => prev && prev.auto_running ? { ...prev, elapsed_seconds: prev.elapsed_seconds + 1 } : prev)
    }, 1000)
    return () => clearInterval(int)
  }, [session?.auto_running])

  // ─── Fase-overgang: de kern van de vereenvoudigde flow ────────────────────
  const advancePhase = useCallback(() => {
    setSession(prev => {
      if (!prev || !prev.auto_running) return prev
      const seg = getSeg(prev.schema, prev.current_segment)
      const totalSets = seg?.sets || 1
      const restSec = seg?.rest_sec || 60
      const segments = getSegments(prev.schema)
      const isLastSegment = prev.current_segment === segments.length - 1

      if (prev.workout_phase === 'countdown') {
        // Countdown afgelopen → start de (eerste) set
        return { ...prev, workout_phase: 'active', phase_end_at: Date.now() + getActiveDuration(seg) * 1000 }
      }

      if (prev.workout_phase === 'active') {
        const isLastSet = prev.current_set >= totalSets
        const nieuweFase = isLastSet ? 'last_rest' : 'rest'
        return {
          ...prev, workout_phase: nieuweFase,
          phase_end_at: Date.now() + restSec * 1000,
          completed_sets: prev.completed_sets + 1,
        }
      }

      if (prev.workout_phase === 'rest') {
        // v2.4.29 FASE 2: GEEN countdown meer tussen sets — direct door
        // naar de volgende set (active).
        return {
          ...prev, workout_phase: 'active', current_set: prev.current_set + 1,
          phase_end_at: Date.now() + getActiveDuration(seg) * 1000,
        }
      }

      if (prev.workout_phase === 'last_rest') {
        if (isLastSegment) {
          return { ...prev, status: 'voltooid' as SessionStatus, auto_running: false, phase_end_at: null }
        }
        // v2.4.29 FASE 2: nieuwe oefening → 3 sec countdown (het
        // starttoon-geluid volgt hierna bij countdown → active, niet hier)
        return {
          ...prev, current_segment: prev.current_segment + 1,
          completed_segments: [...prev.completed_segments, prev.current_segment],
          current_set: 1, workout_phase: 'countdown',
          phase_end_at: Date.now() + NIEUWE_OEFENING_COUNTDOWN_SEC * 1000,
        }
      }

      return prev
    })
  }, [])

  // Trigger advancePhase() zodra remaining 0 bereikt — met guard tegen
  // dubbele triggers binnen dezelfde 250ms-tick.
  useEffect(() => {
    if (!session || !session.auto_running || !session.phase_end_at) return
    if (session.workout_phase !== 'countdown' && session.workout_phase !== 'active' &&
        session.workout_phase !== 'rest' && session.workout_phase !== 'last_rest') return
    if (remaining <= 0 && !advancingRef.current) {
      advancingRef.current = true
      advancePhase()
      setTimeout(() => { advancingRef.current = false }, 300)
    }
  }, [remaining, session, advancePhase])

  // v2.4.34: tick-geluid tijdens de laatste 3 sec van countdown/rest/
  // last_rest. Losse effect — triggert op elke seconde-verandering binnen
  // dezelfde fase, niet op een fase-overgang zelf.
  const laatsteTickRef = useRef<number | null>(null)
  useEffect(() => {
    const tickFasen = ['countdown', 'rest', 'last_rest']
    if (!session || !session.auto_running || !tickFasen.includes(session.workout_phase)) {
      laatsteTickRef.current = null
      return
    }
    if (remaining > 0 && remaining <= 3 && laatsteTickRef.current !== remaining) {
      speelTick()
      laatsteTickRef.current = remaining
    }
  }, [remaining, session])

  // v2.4.45 FIX: starttoon/eindsignaal stonden voorheen als directe
  // aanroepen IN de setSession-functionele-updater (advancePhase). Dat is
  // geen zuivere state-berekening — React-state-updaters horen vrij te
  // zijn van side effects, en zo'n aanroep kan in bepaalde situaties
  // onbetrouwbaar worden uitgevoerd. Gemeld symptoom: eindsignaal (actief
  // → rust) werd gemist, terwijl starttoon/tick wel klonken.
  // Nu: een losse useEffect die reageert op de DAADWERKELIJK gecommitte
  // workout_phase-verandering (vergelijkbaar met het tick-effect
  // hierboven) — puur "luisteren", nooit onderdeel van de state-berekening
  // zelf. Dit is ook preciezer in lijn met de architectuurregel "geluid
  // luistert alleen naar de timer, bestuurt nooit de workout".
  const vorigeFaseRef = useRef<WorkoutPhase | null>(null)
  useEffect(() => {
    if (!session) { vorigeFaseRef.current = null; return }
    const vorige = vorigeFaseRef.current
    const huidige = session.workout_phase

    if (vorige !== null && vorige !== huidige) {
      if (vorige === 'countdown' && huidige === 'active') speelStarttoon()
      else if (vorige === 'active' && (huidige === 'rest' || huidige === 'last_rest')) speelEindsignaal()
      else if (vorige === 'rest' && huidige === 'active') speelStarttoon()
      // last_rest → countdown: bewust stil, zoals in v2.4.29 al vastgelegd
    }

    vorigeFaseRef.current = huidige
  }, [session?.workout_phase])

  // v2.4.46: Finish Tone — nieuw, speelt bij het einde van de VOLLEDIGE
  // training (alle oefeningen klaar), niet per set/oefening. Dit is een
  // apart moment van workout_phase-overgangen: bij de laatste oefening
  // verandert alleen `status` naar 'voltooid', workout_phase zelf blijft
  // ongewijzigd staan op dat moment (zie advancePhase, laatste tak) —
  // vandaar een eigen effect dat specifiek naar `status` luistert.
  const vorigeStatusRef = useRef<string | null>(null)
  useEffect(() => {
    if (!session) { vorigeStatusRef.current = null; return }
    const huidigeStatus = session.status as string
    if (vorigeStatusRef.current !== null && vorigeStatusRef.current !== 'voltooid' && huidigeStatus === 'voltooid') {
      speelFinishToon()
    }
    vorigeStatusRef.current = huidigeStatus
  }, [session?.status])

  function updateStatus(status: SessionStatus) {
    setSession(prev => prev ? { ...prev, status } : prev)
  }

  // "Next"-knop: forceert direct dezelfde overgang als advancePhase() zou
  // doen bij natuurlijk verlopen van de tijd — hergebruikt dezelfde functie
  // zodat er geen tweede, afwijkende transitie-logica ontstaat.
  function handleNext() {
    if (session?.workout_phase === 'countdown' || session?.workout_phase === 'active' ||
        session?.workout_phase === 'rest' || session?.workout_phase === 'last_rest') {
      setSession(prev => prev ? { ...prev, phase_end_at: Date.now() } : prev)
      // De ticking-loop pikt dit binnen 250ms op en triggert advancePhase()
    }
  }

  function handleBackOefening() {
    setSession(prev => {
      if (!prev) return prev
      const targetIndex = (prev.workout_phase === 'active') && prev.current_set === 1 && prev.current_segment > 0
        ? prev.current_segment - 1 : prev.current_segment
      return { ...prev, auto_running: false, workout_phase: 'uitleg', uitleg_index: targetIndex,
        current_segment: targetIndex, current_set: 1, phase_end_at: null }
    })
  }

  function handleVolgendOefening() {
    setSession(prev => {
      if (!prev) return prev
      const segments = getSegments(prev.schema)
      const next = Math.min(prev.current_segment + 1, Math.max(0, segments.length - 1))
      return { ...prev, auto_running: false, workout_phase: 'uitleg', uitleg_index: next,
        current_segment: next, current_set: 1, phase_end_at: null }
    })
  }

  function handleHeaderBack() {
    if (!session) { router.back(); return }
    if (session.status === 'workout' && session.workout_phase === 'uitleg') {
      if (session.uitleg_index === 0) {
        setSession(prev => prev ? { ...prev, status: 'schema', workout_phase: 'active', current_set: 1, phase_end_at: null } : prev)
      } else {
        setSession(prev => {
          if (!prev) return prev
          const vorigeIndex = prev.uitleg_index - 1
          return { ...prev, uitleg_index: vorigeIndex, current_segment: vorigeIndex, current_set: 1, phase_end_at: null }
        })
      }
    } else if (session.status === 'workout') {
      setSession(prev => prev ? { ...prev, auto_running: false, workout_phase: 'uitleg', uitleg_index: prev.current_segment,
        current_set: 1, phase_end_at: null } : prev)
    } else if (session.status === 'learning') {
      updateStatus('schema')
    } else {
      clearSession()
      router.back()
    }
  }

  // v2.4.29 FASE 2: 5 sec countdown alleen bij de allereerste oefening van
  // de sessie (segment 0, nog geen enkele oefening voltooid). Bij elke
  // andere Ready-druk (nieuwe oefening ná last_rest, of terugkeer vanuit
  // handmatige back-navigatie) geldt 3 sec.
  function handleReadyFromUitleg() {
    ontgrendelAudio() // v2.4.34: echte gebruikersactie — hier audio ontgrendelen
    setSession(prev => {
      if (!prev) return prev
      const isEersteOefening = prev.current_segment === 0 && prev.completed_segments.length === 0
      const duurSec = isEersteOefening ? EERSTE_COUNTDOWN_SEC : NIEUWE_OEFENING_COUNTDOWN_SEC
      return {
        ...prev, status: 'workout', workout_phase: 'countdown', auto_running: true,
        current_set: 1, phase_end_at: Date.now() + duurSec * 1000,
      }
    })
  }

  async function handleSave(result: SessionResult) {
    if (!session) return
    setSaving(true)
    try {
      await fetch('/api/training/complete', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module,
          ...result,
          training_type: module,
          training_source: session?.training_source || 'coach_plan',
          segments: session?.schema?.segments || [],
        }),
      })
      clearSession()
      setSession(prev => prev ? { ...prev, status: 'completed' } : prev)
      setTimeout(() => router.replace('/training'), 1500)
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
          <button onClick={() => router.back()}
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
                elapsedSeconds={0} showBack={true} onReady={handleReadyFromUitleg} onBack={() => updateStatus('schema')} moduleType={module} />
            )}

            {session.status === 'workout' && session.workout_phase !== 'uitleg' && (
              <WorkoutEngine session={session} remaining={remaining} countdownTotaal={countdownTotaal}
                onBackOefening={handleBackOefening} onVolgendOefening={handleVolgendOefening} onNext={handleNext}
                onPause={() => {
                  // v2.4.29: pauzeren bewaart de resterende tijd (ms) i.p.v.
                  // een los aftellend getal, zodat hervatten exact vanaf dat
                  // punt verdergaat zonder tijd te verliezen of te winnen.
                  setSession(prev => {
                    if (!prev || !prev.phase_end_at) return prev ? { ...prev, auto_running: false } : prev
                    return { ...prev, auto_running: false, paused_remaining_ms: prev.phase_end_at - Date.now() }
                  })
                  setShowPause(true)
                }}
                onTempoChange={(exercise, tempo) => {
                  setTempo(exercise, tempo)
                  setSession(prev => {
                    if (!prev) return prev
                    const seg = getSeg(prev.schema, prev.current_segment)
                    if (!seg || seg.exercise !== exercise || prev.workout_phase !== 'active') return prev
                    return { ...prev, phase_end_at: Date.now() + getActiveDuration(seg) * 1000 }
                  })
                }} />
            )}

            {session.status === 'workout' && session.workout_phase === 'uitleg' && (
              <UitlegScherm segment={segments[session.uitleg_index]} segmentIndex={session.uitleg_index}
                totalSegments={segments.length} elapsedSeconds={session.elapsed_seconds}
                showBack={session.uitleg_index > 0} onReady={handleReadyFromUitleg}
                onBack={() => setSession(prev => prev ? { ...prev,
                  uitleg_index: Math.max(0, prev.uitleg_index - 1),
                  current_segment: Math.max(0, prev.uitleg_index - 1) } : prev)} moduleType={module} />
            )}

            {(session.status as string) === 'voltooid' && (
              <VoltooïdScherm session={session} onEvaluatie={() => updateStatus('evaluation')} />
            )}

            {session.status === 'evaluation' && (
              <EvaluatieLayer actualDuration={Math.round(session.elapsed_seconds / 60)}
                isRowing={module === 'rowing'} isRunning={module === 'running'} isCycling={module === 'cycling'}
                onSave={handleSave} onSkip={() => { clearSession(); router.back() }} saving={saving} />
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
              <button onClick={() => {
                setShowPause(false)
                // v2.4.29: hervatten berekent een NIEUW phase_end_at vanaf nu,
                // op basis van de bewaarde resterende tijd — geen "verloren"
                // of "extra" tijd door de pauze-duur zelf.
                setSession(prev => {
                  if (!prev) return prev
                  const nieuwEindtijd = prev.paused_remaining_ms !== null
                    ? Date.now() + prev.paused_remaining_ms
                    : prev.phase_end_at
                  return { ...prev, auto_running: true, phase_end_at: nieuwEindtijd, paused_remaining_ms: null }
                })
              }}
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
                <button onClick={() => { setShowStopConfirm(false); clearSession(); router.back() }}
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
