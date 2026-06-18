'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Play, Pause, ChevronRight, CheckCircle, X, Dumbbell, Clock, BookOpen } from 'lucide-react'
import { cn } from '@/utils'
import { zoekOefeningOpNaam } from '@/lib/exercises'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Oefening {
  exercise: string
  sets?: number
  reps?: number
  duration?: number
  rest?: number
  coaching_cue: string
}

interface TrainingSession {
  warmup: Oefening[]
  blocks: Oefening[]
  cooldown: Oefening[]
}

type Fase = 'warmup' | 'blocks' | 'cooldown'
type SchermFase = 'laden' | 'genereren' | 'overzicht' | 'uitleg' | 'training' | 'rust' | 'klaar' | 'error'

interface Stap {
  fase: Fase
  faseLabel: string
  oefening: Oefening
  setNummer: number
  totaalSets: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bouwStappen(session: TrainingSession): Stap[] {
  const stappen: Stap[] = []
  const voegToe = (oefeningen: Oefening[], fase: Fase, faseLabel: string) => {
    for (const oef of oefeningen) {
      const aantalSets = oef.sets || 1
      for (let s = 1; s <= aantalSets; s++) {
        stappen.push({ fase, faseLabel, oefening: oef, setNummer: s, totaalSets: aantalSets })
      }
    }
  }
  voegToe(session.warmup, 'warmup', 'Warming-up')
  voegToe(session.blocks, 'blocks', 'Training')
  voegToe(session.cooldown, 'cooldown', 'Cool-down')
  return stappen
}

function formatTijd(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

function faseKleur(fase: Fase): string {
  if (fase === 'warmup') return 'text-orange-400'
  if (fase === 'blocks') return 'text-primary-400'
  return 'text-green-400'
}

function faseBg(fase: Fase): string {
  if (fase === 'warmup') return 'bg-orange-500/10 border-orange-500/20'
  if (fase === 'blocks') return 'bg-primary-500/10 border-primary-500/20'
  return 'bg-green-500/10 border-green-500/20'
}

// ─── Timer ─────────────────────────────────────────────────────────────────

function Timer({ seconden, onKlaar }: { seconden: number; onKlaar: () => void }) {
  const [resterend, setResterend] = useState(seconden)
  const [actief, setActief] = useState(true)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (actief && resterend > 0) {
      ref.current = setInterval(() => {
        setResterend(r => {
          if (r <= 1) { clearInterval(ref.current!); onKlaar(); return 0 }
          return r - 1
        })
      }, 1000)
    }
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [actief])

  const progress = ((seconden - resterend) / seconden) * 100

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#1e293b" strokeWidth="8" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="#818cf8" strokeWidth="8"
            strokeDasharray={`${2 * Math.PI * 44}`}
            strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
            strokeLinecap="round" className="transition-all duration-1000" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-4xl font-bold text-white tabular-nums">{formatTijd(resterend)}</p>
        </div>
      </div>
      <button onClick={() => setActief(a => !a)}
        className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20">
        {actief ? <Pause size={24} className="text-white" /> : <Play size={24} className="text-white" fill="white" />}
      </button>
    </div>
  )
}

// ─── Uitleg scherm ────────────────────────────────────────────────────────────

function UitlegScherm({
  oefening,
  faseLabel,
  setNummer,
  totaalSets,
  onReady,
  onTerug,
}: {
  oefening: Oefening
  faseLabel: string
  setNummer: number
  totaalSets: number
  onReady: () => void
  onTerug: () => void
}) {
  const lib = zoekOefeningOpNaam(oefening.exercise)

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white flex flex-col">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{faseLabel}</p>
        <h1 className="text-3xl font-bold tracking-tight">{oefening.exercise}</h1>
        <p className="text-primary-400 text-sm mt-1 font-medium">
          {totaalSets > 1 ? `Set ${setNummer} van ${totaalSets} · ` : ''}
          {oefening.sets && oefening.reps ? `${oefening.sets} × ${oefening.reps} herh.` : ''}
          {oefening.duration ? formatTijd(oefening.duration) : ''}
          {oefening.rest ? ` · ${oefening.rest}s rust` : ''}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 flex flex-col gap-4">
        {/* Afbeelding */}
        {lib?.afbeelding && (
          <div className="bg-[#111827] rounded-2xl overflow-hidden border border-[#1C2333]">
            <img
              src={lib.afbeelding}
              alt={oefening.exercise}
              className="w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            {lib.fases && (
              <div className="flex px-2 py-3 gap-1">
                {lib.fases.map((fase, i) => (
                  <div key={i} className="flex-1 text-center">
                    <div className="w-5 h-5 rounded-full border border-green-400 text-green-400 text-[10px] font-bold flex items-center justify-center mx-auto mb-1">
                      {i + 1}
                    </div>
                    <p className="text-[8px] text-slate-500 leading-tight">{fase.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Uitvoering */}
        <div className="bg-[#111827] rounded-2xl border border-[#1C2333] p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Uitvoering</p>
          <p className="text-sm text-slate-200 leading-relaxed">
            {lib?.beschrijving || oefening.coaching_cue}
          </p>
        </div>

        {/* Coaching tip */}
        <div className="bg-primary-500/10 border border-primary-500/20 rounded-2xl p-4">
          <p className="text-xs text-primary-400 font-semibold uppercase tracking-wider mb-1">Coaching tip</p>
          <p className="text-sm text-white">{oefening.coaching_cue}</p>
        </div>

        {/* Fouten */}
        {lib?.fouten && lib.fouten.length > 0 && (
          <div className="bg-[#111827] rounded-2xl border border-[#1C2333] p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Veelgemaakte fouten</p>
            {lib.fouten.map((fout, i) => (
              <div key={i} className="flex items-start gap-2 py-1.5">
                <span className="text-red-400 text-sm font-bold flex-shrink-0">✗</span>
                <p className="text-sm text-slate-400">{fout}</p>
              </div>
            ))}
          </div>
        )}

        {/* Link naar volledige uitleg */}
        {lib && (
          <button
            onClick={() => window.open(`/oefening/${lib.id}`, '_blank')}
            className="flex items-center gap-2 text-sm text-slate-500 active:opacity-70"
          >
            <BookOpen size={14} />
            Volledige uitleg bekijken
          </button>
        )}
      </div>

      {/* Knoppen */}
      <div className="px-5 pb-10 pt-4 flex gap-3">
        <button
          onClick={onTerug}
          className="flex-1 py-4 bg-[#1C2333] rounded-2xl font-semibold text-slate-300 active:opacity-70"
        >
          ← Terug
        </button>
        <button
          onClick={onReady}
          className="flex-1 py-4 bg-green-500 rounded-2xl font-semibold text-white active:bg-green-600"
        >
          Ready →
        </button>
      </div>
    </div>
  )
}

// ─── Hoofd pagina ─────────────────────────────────────────────────────────────

function KettlebellInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const intensityParam = searchParams.get('intensity') || 'medium'
  const durationParam = parseInt(searchParams.get('duration') || '30')
  const sessionIdParam = searchParams.get('session_id') || null

  const [scherm, setScherm] = useState<SchermFase>(sessionIdParam ? 'laden' : 'genereren')
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(sessionIdParam)
  const [stappen, setStappen] = useState<Stap[]>([])
  const [huidigIndex, setHuidigIndex] = useState(0)
  const [startTijd, setStartTijd] = useState<Date | null>(null)
  const [aangepast, setAangepast] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState<string>('')
  const [opgeslagen, setOpgeslagen] = useState(false)

  useEffect(() => {
    if (scherm === 'laden' && sessionIdParam) {
      fetch('/api/training/session', { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (data?.session) {
            setSession(data.session)
            setSessionId(data.id)
            setStappen(bouwStappen(data.session))
            setScherm('overzicht')
          } else { setScherm('genereren') }
        })
        .catch(() => setScherm('genereren'))
    } else if (scherm === 'genereren') {
      genereerSessie()
    }
  }, [])

  async function genereerSessie() {
    setScherm('genereren')
    try {
      const res = await fetch('/api/training/session', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intensity: intensityParam, duration: durationParam }),
      })
      const data = await res.json()
      if (!res.ok || !data.session) { setScherm('error'); return }
      setSession(data.session)
      setSessionId(data.session_id)
      setAangepast(data.adjusted || false)
      setStappen(bouwStappen(data.session))
      setScherm('overzicht')
    } catch { setScherm('error') }
  }

  function startTraining() {
    setStartTijd(new Date())
    setHuidigIndex(0)
    setScherm('uitleg') // Toon eerst uitleg van eerste oefening
  }

  function volgende() {
    const huidige = stappen[huidigIndex]
    const rustSec = huidige.oefening.rest || 0
    if (huidigIndex >= stappen.length - 1) { setScherm('klaar'); return }
    if (rustSec > 0 && huidige.fase === 'blocks') {
      setScherm('rust')
    } else {
      setHuidigIndex(i => i + 1)
      setScherm('uitleg') // Toon uitleg volgende oefening
    }
  }

  function naRust() {
    setHuidigIndex(i => i + 1)
    setScherm('uitleg') // Toon uitleg na rust
  }

  async function slaOp(completed: boolean) {
    if (!sessionId || opgeslagen) return
    const duurMinuten = startTijd ? Math.round((Date.now() - startTijd.getTime()) / 60000) : null
    setOpgeslagen(true)
    await fetch('/api/training/complete', {
      credentials: 'include', method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, completed, duration_minutes: duurMinuten, rating, notes: notes.trim() || null }),
    })
  }

  const huidige = stappen[huidigIndex]
  const totaalStappen = stappen.length
  const voortgang = totaalStappen > 0 ? (huidigIndex / totaalStappen) * 100 : 0

  // ── Laden ──────────────────────────────────────────────────────────────────
  if (scherm === 'laden' || scherm === 'genereren') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center gap-6 px-6">
        <div className="w-16 h-16 rounded-2xl bg-primary-500/20 flex items-center justify-center">
          <Dumbbell size={32} className="text-primary-400" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">Trainer AI aan het werk</p>
          <p className="text-slate-400 text-sm mt-1">Sessie op maat genereren…</p>
        </div>
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (scherm === 'error') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="text-lg font-semibold">Kon geen sessie genereren</p>
        <button onClick={genereerSessie} className="px-6 py-3 bg-primary-600 rounded-xl text-sm font-medium">Opnieuw</button>
        <button onClick={() => router.push('/training')} className="text-sm text-slate-500">Terug</button>
      </div>
    )
  }

  // ── Overzicht ──────────────────────────────────────────────────────────────
  if (scherm === 'overzicht' && session) {
    const totaleOefeningen = session.warmup.length + session.blocks.length + session.cooldown.length
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="flex items-center gap-3 px-4 pt-14 pb-4">
          <button onClick={() => router.push('/training')}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5">
            <X size={18} className="text-slate-400" />
          </button>
          <div>
            <h1 className="text-lg font-semibold">Kettlebell Training</h1>
            <p className="text-xs text-slate-400 mt-0.5 capitalize">{intensityParam} · {durationParam} min</p>
          </div>
        </div>

        <div className="px-4 space-y-4 pb-8">
          {aangepast && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
              <p className="text-xs text-amber-400">Trainer AI heeft de intensiteit aangepast op basis van je Garmin data.</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Oefeningen', value: totaleOefeningen },
              { label: 'Sets', value: stappen.length },
              { label: 'Minuten', value: durationParam },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl bg-white/5 p-3 text-center">
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <SectieBlok titel="Warming-up" oefeningen={session.warmup} fase="warmup" onOefeningTik={(naam) => router.push(`/oefening/${zoekOefeningOpNaam(naam)?.id || naam.toLowerCase().replace(/\s+/g, '-')}`)} />
          <SectieBlok titel="Training" oefeningen={session.blocks} fase="blocks" onOefeningTik={(naam) => router.push(`/oefening/${zoekOefeningOpNaam(naam)?.id || naam.toLowerCase().replace(/\s+/g, '-')}`)} />
          <SectieBlok titel="Cool-down" oefeningen={session.cooldown} fase="cooldown" onOefeningTik={(naam) => router.push(`/oefening/${zoekOefeningOpNaam(naam)?.id || naam.toLowerCase().replace(/\s+/g, '-')}`)} />

          <button onClick={startTraining}
            className="w-full py-4 bg-primary-600 rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 active:bg-primary-700">
            <Play size={22} fill="white" />
            Training Starten →
          </button>
        </div>
      </div>
    )
  }

  // ── Uitleg ─────────────────────────────────────────────────────────────────
  if (scherm === 'uitleg' && huidige) {
    return (
      <UitlegScherm
        oefening={huidige.oefening}
        faseLabel={huidige.faseLabel}
        setNummer={huidige.setNummer}
        totaalSets={huidige.totaalSets}
        onReady={() => setScherm('training')}
        onTerug={() => {
          if (huidigIndex === 0) {
            setScherm('overzicht')
          } else {
            setHuidigIndex(i => i - 1)
            setScherm('uitleg')
          }
        }}
      />
    )
  }

  // ── Training ───────────────────────────────────────────────────────────────
  if (scherm === 'training' && huidige) {
    const isDuration = !!huidige.oefening.duration
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
        <div className="h-1 bg-white/10">
          <div className="h-full bg-primary-500 transition-all duration-500" style={{ width: `${voortgang}%` }} />
        </div>

        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className={cn('text-xs font-semibold uppercase tracking-wider', faseKleur(huidige.fase))}>
            {huidige.faseLabel}
          </span>
          <span className="text-xs text-slate-500">{huidigIndex + 1} / {totaalStappen}</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-white tracking-tight">{huidige.oefening.exercise}</h2>
            {huidige.totaalSets > 1 && (
              <p className="text-slate-400 mt-2 text-lg">Set {huidige.setNummer} van {huidige.totaalSets}</p>
            )}
          </div>

          {isDuration ? (
            <Timer seconden={huidige.oefening.duration!} onKlaar={volgende} />
          ) : (
            <div className={cn('rounded-2xl border px-10 py-6 text-center', faseBg(huidige.fase))}>
              <p className="text-6xl font-bold text-white">{huidige.oefening.reps}</p>
              <p className="text-slate-400 mt-1">herhalingen</p>
            </div>
          )}

          <div className="bg-white/5 rounded-xl px-5 py-3 text-center max-w-xs">
            <p className="text-sm text-slate-300 leading-relaxed">{huidige.oefening.coaching_cue}</p>
          </div>
        </div>

        <div className="px-4 pb-10 pt-4">
          <button onClick={volgende}
            className="w-full py-4 bg-primary-600 rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 active:bg-primary-700">
            {huidigIndex >= stappen.length - 1
              ? <><CheckCircle size={22} /> Afronden</>
              : <>Volgende <ChevronRight size={22} /></>}
          </button>
          <button onClick={() => { slaOp(false); router.push('/training') }}
            className="w-full mt-3 py-3 text-sm text-slate-500">
            Training stoppen
          </button>
        </div>
      </div>
    )
  }

  // ── Rust ───────────────────────────────────────────────────────────────────
  if (scherm === 'rust' && huidige) {
    const rustSec = huidige.oefening.rest || 60
    const volgendeStap = stappen[huidigIndex + 1]
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center gap-8 px-6">
        <p className="text-slate-400 text-sm uppercase tracking-wider">Rust</p>
        <Timer seconden={rustSec} onKlaar={naRust} />
        {volgendeStap && (
          <div className="text-center">
            <p className="text-xs text-slate-500 mb-1">Volgende</p>
            <p className="text-white font-semibold">{volgendeStap.oefening.exercise}</p>
          </div>
        )}
        <button onClick={naRust} className="text-sm text-primary-400">Rust overslaan</button>
      </div>
    )
  }

  // ── Klaar ──────────────────────────────────────────────────────────────────
  if (scherm === 'klaar') {
    const duurMinuten = startTijd ? Math.round((Date.now() - startTijd.getTime()) / 60000) : durationParam
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center px-6 gap-8">
        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle size={40} className="text-green-400" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold">Training voltooid!</h2>
          <div className="flex items-center justify-center gap-2 mt-2 text-slate-400">
            <Clock size={14} />
            <p className="text-sm">{duurMinuten} minuten</p>
          </div>
        </div>

        <div className="w-full max-w-xs">
          <p className="text-sm text-slate-400 text-center mb-3">Hoe voelde de training?</p>
          <div className="flex justify-center gap-2">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <button key={n} onClick={() => setRating(n)}
                className={cn('w-7 h-7 rounded-lg text-xs font-semibold transition-colors',
                  rating === n ? 'bg-primary-500 text-white' : 'bg-white/5 text-slate-400')}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full max-w-xs">
          <p className="text-sm text-slate-400 mb-2">Opmerkingen (optioneel)</p>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Bijv. schouders voelden zwaar..." rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none" />
        </div>

        <button onClick={async () => { await slaOp(true); router.push('/home') }}
          className="w-full max-w-xs py-4 bg-primary-600 rounded-2xl font-semibold active:bg-primary-700">
          Opslaan & terug naar Home
        </button>
        <button onClick={() => router.push('/training')} className="text-sm text-slate-500">Terug naar Training</button>
      </div>
    )
  }

  return null
}

export default function KettlebellPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <KettlebellInner />
    </Suspense>
  )
}

// ── SectieBlok ────────────────────────────────────────────────────────────────

function SectieBlok({ titel, oefeningen, fase, onOefeningTik }: {
  titel: string
  oefeningen: Oefening[]
  fase: Fase
  onOefeningTik: (naam: string) => void
}) {
  if (oefeningen.length === 0) return null
  return (
    <div className="rounded-2xl bg-white/5 border border-white/8 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <p className={cn('text-xs font-semibold uppercase tracking-wider', faseKleur(fase))}>{titel}</p>
      </div>
      <div className="divide-y divide-white/5">
        {oefeningen.map((oef, i) => {
          const lib = zoekOefeningOpNaam(oef.exercise)
          return (
            <button key={i} onClick={() => onOefeningTik(oef.exercise)}
              className="px-4 py-3 w-full text-left active:bg-white/5 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">{oef.exercise}</p>
                  {lib && <BookOpen size={12} className="text-slate-600" />}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {oef.sets && oef.reps ? `${oef.sets} sets × ${oef.reps} herh.` : ''}
                  {oef.duration ? formatTijd(oef.duration) : ''}
                  {oef.rest ? ` · ${oef.rest}s rust` : ''}
                </p>
              </div>
              <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
