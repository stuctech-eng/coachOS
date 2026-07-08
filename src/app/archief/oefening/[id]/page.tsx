'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Minus, Plus, Play, Pause, Check, ChevronRight } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { cn } from '@/utils'
import { createBrowserClient } from '@supabase/ssr'
import { ontgrendelAudio, speelTick, speelEindsignaal, speelStarttoon } from '@/lib/workout-sound'

import { KETTLEBELL_OEFENINGEN } from '@/lib/kettlebell-exercises'
import { BODYWEIGHT_OEFENINGEN } from '@/lib/bodyweight-exercises'
import { STRENGTH_OEFENINGEN } from '@/lib/strength-exercises'
import { MOBILITY_OEFENINGEN } from '@/lib/mobility-exercises'

// Gewicht-stappen voor kettlebell — later uitbreidbaar tot 32kg in stappen van 4
const KETTLEBELL_GEWICHTEN = [14, 16, 20]
// Toekomstige uitbreiding: const KETTLEBELL_GEWICHTEN = [14, 16, 20, 24, 28, 32]

// v2.4.30 — TIMER ENGINE REBUILD voor Archief (zelfde techniek als
// training/session/[module]/page.tsx v2.4.29, maar met eigen flowregels
// omdat de gebruikssituatie anders is: één losse oefening met herhaalde
// sets, geen opeenvolging van meerdere verschillende oefeningen.
//
// Archief-flow (bewust anders dan Coach AI-trainingen):
// - 5 sec countdown ALLEEN vóór de allereerste set
// - Bij elke volgende set: GEEN countdown — rust loopt af, dan direct door
//   naar de volgende set. De rust zelf is de voorbereiding.
// - Zelfde onderliggende engine: phase_end_at (vast tijdstip), geen los
//   aftellend getal, drift-vrij bij lockscreen/achtergrond via
//   visibilitychange-herstel.
const EERSTE_SET_COUNTDOWN_SEC = 5

interface OefeningData {
  id: string
  naam: string
  beschrijving: string
  uitleg?: string
  tips: string[]
  fouten: string[]
  primaireSpieren: string[]
  secundaireSpieren: string[]
  illustratie?: string
  herhalingen?: string
  duur?: number
  isKettlebell: boolean
}

function vindOefening(id: string): { oefening: OefeningData; module: string } | null {
  const kb = KETTLEBELL_OEFENINGEN.find(o => o.id === id)
  if (kb) return {
    module: 'kettlebell',
    oefening: { ...kb, isKettlebell: true },
  }
  const bw = BODYWEIGHT_OEFENINGEN.find(o => o.id === id)
  if (bw) return {
    module: 'bodyweight',
    oefening: { ...bw, isKettlebell: false } as unknown as OefeningData,
  }
  const st = STRENGTH_OEFENINGEN.find(o => o.id === id)
  if (st) return {
    module: 'strength',
    oefening: { ...st, isKettlebell: false } as unknown as OefeningData,
  }
  const mb = MOBILITY_OEFENINGEN.find(o => o.id === id)
  if (mb) return {
    module: 'mobility',
    oefening: { ...mb, isKettlebell: false } as unknown as OefeningData,
  }
  return null
}

// Parse "8-12" of "15-20" naar een gemiddeld getal
function gemiddeldeReps(herhalingen?: string): number {
  if (!herhalingen) return 10
  const matches = herhalingen.match(/\d+/g)
  if (!matches) return 10
  const nums = matches.map(Number)
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

interface VorigeSessie {
  gewicht: number | null
  reps: number | null
  sets: number | null
  duur_sec: number | null
  datum: string
}

export default function ArchiefOefeningPage() {
  const params = useParams()
  const router = useRouter()
  const oefeningId = params.id as string

  const [laden, setLaden] = useState(true)
  const [data, setData] = useState<{ oefening: OefeningData; module: string } | null>(null)
  const [vorigeSessie, setVorigeSessie] = useState<VorigeSessie | null>(null)

  // Instelbare waarden
  const [sets, setSets] = useState(3)
  const [reps, setReps] = useState(10)
  const [duurSec, setDuurSec] = useState(30)
  const [rustSec, setRustSec] = useState(60)
  const [gewicht, setGewicht] = useState<number | null>(null)

  // Workout state
  const [fase, setFase] = useState<'instellen' | 'countdown' | 'actief' | 'rust' | 'voltooid' | 'evaluatie' | 'opgeslagen'>('instellen')
  const [huidigeSet, setHuidigeSet] = useState(1)
  const [gepauzeerd, setGepauzeerd] = useState(false)
  // v2.4.30: vervangt tellerSec — vast eindtijdstip i.p.v. los aftellend getal
  const [phaseEndAt, setPhaseEndAt] = useState<number | null>(null)
  const [pausedRemainingMs, setPausedRemainingMs] = useState<number | null>(null)
  const [, setTick] = useState(0)
  const advancingRef = useRef(false)

  // Evaluatie state
  const [rating, setRating] = useState<number | null>(null)
  const [opslaan, setOpslaan] = useState(false)

  // Reps worden omgezet naar tijdseenheid via tempo (3 sec/rep) zodat er
  // altijd een aftellende timer getoond kan worden — ook bij rep-oefeningen.
  const isTijdGebaseerd = data?.oefening.duur !== undefined && !data?.oefening.herhalingen
  const TEMPO_SEC_PER_REP = 3
  const effectieveDuurSec = isTijdGebaseerd ? duurSec : reps * TEMPO_SEC_PER_REP

  useEffect(() => {
    const gevonden = vindOefening(oefeningId)
    setData(gevonden)
    if (gevonden) {
      const gemReps = gemiddeldeReps(gevonden.oefening.herhalingen)
      setReps(gemReps)
      if (gevonden.oefening.duur) setDuurSec(gevonden.oefening.duur)
      if (gevonden.oefening.isKettlebell) setGewicht(KETTLEBELL_GEWICHTEN[0])
    }
    setLaden(false)
  }, [oefeningId])

  // Laad vorige sessie uit exercise_records
  useEffect(() => {
    if (!data) return
    const laadVorige = async () => {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
        )
        const { data: records } = await supabase
          .from('exercise_records')
          .select('weight_kg, reps, sets, duration_sec, performed_at')
          .eq('exercise_name', data.oefening.naam)
          .order('performed_at', { ascending: false })
          .limit(1)
          .single()

        if (records) {
          setVorigeSessie({
            gewicht: records.weight_kg,
            reps: records.reps,
            sets: records.sets,
            duur_sec: records.duration_sec,
            datum: records.performed_at,
          })
          if (records.sets) setSets(records.sets)
          if (records.reps) setReps(records.reps)
          if (records.weight_kg) setGewicht(records.weight_kg)
          if (records.duration_sec) setDuurSec(records.duration_sec)
        }
      } catch { /* geen vorige sessie, geen probleem */ }
    }
    laadVorige()
  }, [data])

  const slaOpResultaat = useCallback(async (finalRating: number) => {
    if (!data) return
    setOpslaan(true)
    try {
      const segment = {
        type: data.module,
        exercise: data.oefening.naam,
        sets,
        reps: isTijdGebaseerd ? null : reps,
        duration_sec: isTijdGebaseerd ? duurSec : null,
        weight_kg: gewicht,
      }

      await fetch('/api/training/complete', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: data.module,
          training_type: data.module,
          training_source: 'library',
          completed: true,
          rating: finalRating,
          actual_duration: Math.round((sets * (isTijdGebaseerd ? duurSec : reps * 3) + (sets - 1) * rustSec) / 60),
          segments: [segment],
        }),
      })
      setFase('opgeslagen')
      setTimeout(() => router.replace('/archief'), 1500)
    } catch { /* */ }
    finally { setOpslaan(false) }
  }, [data, sets, reps, duurSec, gewicht, isTijdGebaseerd, rustSec, router])

  // v2.4.30: centrale ticking-loop — zelfde patroon als v2.4.29. Forceert
  // een re-render elke 250ms zodat de afgeleide resterende tijd zichtbaar
  // bijwerkt, en herstelt direct bij terugkeer uit de achtergrond.
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 250)
    const onVisible = () => { if (document.visibilityState === 'visible') setTick(t => t + 1) }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  // v2.4.32 FIX: tijdens pauze moet het getoonde cijfer BEVRIEZEN, niet
  // doortellen. phase_end_at verandert bewust niet tijdens pauze (dat was
  // correct, voor de fase-overgang-guard), maar Date.now() loopt gewoon
  // door — dus remaining bleef live doortellen naar 0 en bleef daar
  // hangen, ook al vuurde advancePhase() terecht niet af. Zag eruit als
  // "pauze doet niets". Nu: tijdens pauze komt remaining uit de bevroren
  // paused_remaining_ms, niet meer uit phase_end_at.
  const remaining = gepauzeerd
    ? (pausedRemainingMs !== null ? Math.max(0, Math.ceil(pausedRemainingMs / 1000)) : 0)
    : (phaseEndAt ? Math.max(0, Math.ceil((phaseEndAt - Date.now()) / 1000)) : 0)

  // v2.4.30 FIX: fase-overgang volgens de Archief-eigen flowregels — GEEN
  // countdown tussen sets (in tegenstelling tot vóór deze rebuild, waar
  // elke set opnieuw een 5-sec countdown kreeg). Alleen de allereerste set
  // krijgt een countdown; daarna gaat rust direct door naar de volgende set.
  const advancePhase = useCallback(() => {
    if (gepauzeerd) return
    if (fase === 'countdown') {
      speelStarttoon()
      setFase('actief')
      setPhaseEndAt(Date.now() + effectieveDuurSec * 1000)
      return
    }
    if (fase === 'actief') {
      if (huidigeSet >= sets) {
        setFase('voltooid')
        setPhaseEndAt(null)
      } else {
        speelEindsignaal()
        setFase('rust')
        setPhaseEndAt(Date.now() + rustSec * 1000)
      }
      return
    }
    if (fase === 'rust') {
      // Direct door naar de volgende set — geen countdown-tussenstap
      speelStarttoon()
      setHuidigeSet(s => s + 1)
      setFase('actief')
      setPhaseEndAt(Date.now() + effectieveDuurSec * 1000)
      return
    }
  }, [fase, gepauzeerd, huidigeSet, sets, rustSec, effectieveDuurSec])

  useEffect(() => {
    if (gepauzeerd) return
    if (fase !== 'countdown' && fase !== 'actief' && fase !== 'rust') return
    if (!phaseEndAt) return
    if (remaining <= 0 && !advancingRef.current) {
      advancingRef.current = true
      advancePhase()
      setTimeout(() => { advancingRef.current = false }, 300)
    }
  }, [remaining, fase, phaseEndAt, gepauzeerd, advancePhase])

  // v2.4.34: tick-geluid tijdens de laatste 3 sec van countdown/rust.
  // Losse effect (niet in advancePhase, want dit triggert NIET op een
  // fase-overgang maar op elke seconde-verandering binnen dezelfde fase).
  // Guard via laatsteTickRef voorkomt herhaald afspelen binnen dezelfde
  // seconde door de 250ms-ticking-loop.
  const laatsteTickRef = useRef<number | null>(null)
  useEffect(() => {
    if (gepauzeerd) { laatsteTickRef.current = null; return }
    if (fase !== 'countdown' && fase !== 'rust') { laatsteTickRef.current = null; return }
    if (remaining > 0 && remaining <= 3 && laatsteTickRef.current !== remaining) {
      speelTick()
      laatsteTickRef.current = remaining
    }
  }, [remaining, fase, gepauzeerd])

  function startWorkout() {
    ontgrendelAudio() // v2.4.34: echte gebruikersactie — hier audio ontgrendelen, niet eerder
    setFase('countdown')
    setHuidigeSet(1)
    setPhaseEndAt(Date.now() + EERSTE_SET_COUNTDOWN_SEC * 1000)
  }

  // "Volgende set"-knop (handmatig): forceert dezelfde overgang als
  // advancePhase() zou doen — geen aparte, afwijkende logica.
  function volgendeSet() {
    setPhaseEndAt(Date.now())
  }

  function togglePauze() {
    if (!gepauzeerd) {
      // Pauzeren: bewaar resterende tijd, zodat hervatten geen tijd wint/verliest
      if (phaseEndAt) setPausedRemainingMs(phaseEndAt - Date.now())
      setGepauzeerd(true)
    } else {
      if (pausedRemainingMs !== null) setPhaseEndAt(Date.now() + pausedRemainingMs)
      setPausedRemainingMs(null)
      setGepauzeerd(false)
    }
  }

  // v2.4.30: gebruikt router.back() i.p.v. router.push('/archief') —
  // behoudt de v2.4.17-navigatiefix (voorkomt dubbele geschiedenis-entries)
  function handleTerug() {
    if (fase === 'instellen') {
      router.back()
    } else {
      setFase('instellen')
      setPhaseEndAt(null)
      setGepauzeerd(false)
      setPausedRemainingMs(null)
    }
  }

  if (laden) {
    return (
      <AppShell>
        <div className="px-5 py-6">
          <div className="h-24 bg-slate-800 rounded-2xl animate-pulse" />
        </div>
      </AppShell>
    )
  }

  if (!data) {
    return (
      <AppShell>
        <div className="px-5 py-6 text-center">
          <p className="text-slate-400">Oefening niet gevonden.</p>
          <button onClick={() => router.replace('/archief')} className="mt-4 px-5 py-2.5 bg-slate-800 text-white rounded-xl text-sm">
            Terug naar Archief
          </button>
        </div>
      </AppShell>
    )
  }

  const { oefening } = data

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={handleTerug}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">{oefening.naam}</h1>
            <p className="text-xs text-slate-500">Archief · los van coach</p>
          </div>
        </div>

        {fase === 'instellen' && (
          <>
            {oefening.illustratie && (
              <div className="bg-white rounded-2xl p-2">
                <img src={`/exercises/${oefening.illustratie}`} alt={oefening.naam} className="w-full rounded-xl"
                  onError={(e) => { (e.target as HTMLImageElement).closest('div')!.style.display = 'none' }} />
              </div>
            )}

            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Uitvoering</p>
              <p className="text-sm text-slate-200 leading-relaxed">{oefening.beschrijving}</p>
            </Card>

            {oefening.tips.length > 0 && (
              <Card className="p-5">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Tips</p>
                <div className="flex flex-col gap-2">
                  {oefening.tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-green-400 mt-0.5 flex-shrink-0 text-xs">✓</span>
                      <p className="text-sm text-slate-300">{tip}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {oefening.fouten.length > 0 && (
              <Card className="p-5">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Veelgemaakte fouten</p>
                <div className="flex flex-col gap-2">
                  {oefening.fouten.map((f, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5 flex-shrink-0 text-xs">✕</span>
                      <p className="text-sm text-slate-300">{f}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Instellingen</p>
              {vorigeSessie && (
                <p className="text-xs text-primary-400 mb-4">
                  Vorige keer: {vorigeSessie.sets}×{vorigeSessie.reps || `${vorigeSessie.duur_sec}s`}
                  {vorigeSessie.gewicht ? `, ${vorigeSessie.gewicht}kg` : ''} · {new Date(vorigeSessie.datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                </p>
              )}

              <div className="flex flex-col gap-4 mt-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-300">Sets</p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSets(s => Math.max(1, s - 1))}
                      className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center active:bg-slate-700">
                      <Minus size={14} className="text-white" />
                    </button>
                    <span className="text-white font-bold w-6 text-center">{sets}</span>
                    <button onClick={() => setSets(s => Math.min(10, s + 1))}
                      className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center active:bg-slate-700">
                      <Plus size={14} className="text-white" />
                    </button>
                  </div>
                </div>

                {isTijdGebaseerd ? (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-300">Duur per set</p>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setDuurSec(d => Math.max(10, d - 10))}
                        className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center active:bg-slate-700">
                        <Minus size={14} className="text-white" />
                      </button>
                      <span className="text-white font-bold w-12 text-center">{duurSec}s</span>
                      <button onClick={() => setDuurSec(d => Math.min(300, d + 10))}
                        className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center active:bg-slate-700">
                        <Plus size={14} className="text-white" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-300">Herhalingen</p>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setReps(r => Math.max(1, r - 1))}
                        className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center active:bg-slate-700">
                        <Minus size={14} className="text-white" />
                      </button>
                      <span className="text-white font-bold w-6 text-center">{reps}</span>
                      <button onClick={() => setReps(r => Math.min(50, r + 1))}
                        className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center active:bg-slate-700">
                        <Plus size={14} className="text-white" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-300">Rust tussen sets</p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setRustSec(r => Math.max(15, r - 15))}
                      className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center active:bg-slate-700">
                      <Minus size={14} className="text-white" />
                    </button>
                    <span className="text-white font-bold w-12 text-center">{rustSec}s</span>
                    <button onClick={() => setRustSec(r => Math.min(180, r + 15))}
                      className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center active:bg-slate-700">
                      <Plus size={14} className="text-white" />
                    </button>
                  </div>
                </div>

                {oefening.isKettlebell && (
                  <div>
                    <p className="text-sm text-slate-300 mb-2">Kettlebell gewicht</p>
                    <div className="flex gap-2">
                      {KETTLEBELL_GEWICHTEN.map(g => (
                        <button key={g} onClick={() => setGewicht(g)}
                          className={cn('flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                            gewicht === g ? 'bg-primary-500 text-white' : 'bg-slate-800 text-slate-400'
                          )}>
                          {g}kg
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
              <p className="text-xs text-blue-400">
                Dit gaat buiten je coach advies om. Je coach ziet deze training en kan erop reageren.
              </p>
            </div>

            <button onClick={startWorkout}
              className="w-full py-4 bg-primary-500 text-white rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 active:bg-primary-600">
              <Play size={22} fill="white" />
              Start oefening
            </button>
          </>
        )}

        {fase === 'countdown' && (
          <Card className="p-8 text-center bg-primary-500/10 border-primary-500/30">
            <p className="text-xs text-primary-400 font-semibold uppercase tracking-wider mb-4">Klaarmaken</p>
            <p className="text-sm text-slate-300 mb-6">{oefening.naam} · Set {huidigeSet} van {sets}</p>
            <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
              <svg width="128" height="128" className="absolute -rotate-90">
                <circle cx="64" cy="64" r="58" fill="none" stroke="#1e293b" strokeWidth="6" />
                <circle cx="64" cy="64" r="58" fill="none"
                  stroke="#818cf8" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 58}`}
                  strokeDashoffset={`${2 * Math.PI * 58 * (1 - remaining / EERSTE_SET_COUNTDOWN_SEC)}`}
                  style={{ transition: 'stroke-dashoffset 1s linear' }} />
              </svg>
              <p className={cn('text-6xl font-bold', remaining <= 3 ? 'text-red-400' : 'text-white')}>{remaining}</p>
            </div>
            <button onClick={() => setPhaseEndAt(Date.now())}
              className="mt-6 w-full py-3 bg-slate-800 text-slate-300 rounded-xl font-semibold">
              Skip countdown
            </button>
          </Card>
        )}

        {fase === 'actief' && (
          <Card className="p-6 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Set {huidigeSet} van {sets}</p>
            <p className="text-5xl font-bold text-primary-400 mb-2">
              {remaining}s
            </p>
            {!isTijdGebaseerd && (
              <p className="text-slate-500 text-xs mb-1">{reps} herhalingen op eigen tempo</p>
            )}
            <p className="text-slate-400 text-sm mb-1">
              {oefening.naam}{gewicht ? ` · ${gewicht}kg` : ''}
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={togglePauze}
                className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-semibold flex items-center justify-center gap-2">
                {gepauzeerd ? <Play size={16} /> : <Pause size={16} />}
                {gepauzeerd ? 'Hervat' : 'Pauze'}
              </button>
              <button onClick={volgendeSet}
                className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
                {huidigeSet >= sets ? 'Afronden' : 'Volgende set'}
                <ChevronRight size={16} />
              </button>
            </div>
          </Card>
        )}

        {fase === 'rust' && (
          <Card className="p-6 text-center bg-amber-500/10 border-amber-500/20">
            <p className="text-xs text-amber-400 uppercase tracking-wider mb-3">Rust · Set {huidigeSet + 1} volgt</p>
            <p className={cn('text-6xl font-mono font-bold', remaining <= 3 ? 'text-red-400' : 'text-amber-400')}>{remaining}s</p>
            <button onClick={() => setPhaseEndAt(Date.now())}
              className="mt-6 w-full py-3 bg-slate-800 text-slate-300 rounded-xl font-semibold">
              Skip rust
            </button>
          </Card>
        )}

        {fase === 'voltooid' && (
          <>
            <Card className="p-6 text-center">
              <p className="text-5xl mb-3">🎉</p>
              <h2 className="text-xl font-bold text-white mb-1">Oefening voltooid!</h2>
              <p className="text-slate-400 text-sm">{oefening.naam} · {sets} sets</p>
            </Card>
            <button onClick={() => setFase('evaluatie')}
              className="w-full py-4 bg-primary-500 text-white rounded-2xl font-semibold active:bg-primary-600">
              Evaluatie starten →
            </button>
          </>
        )}

        {fase === 'evaluatie' && (
          <Card className="p-5">
            <p className="text-sm text-slate-300 mb-4">Hoe zwaar was deze oefening?</p>
            <div className="flex gap-1 mb-6">
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button key={n} onClick={() => setRating(n)}
                  className={cn('flex-1 h-10 rounded-lg text-xs font-semibold',
                    rating === n ? 'bg-primary-500 text-white' : 'bg-slate-800 text-slate-400'
                  )}>{n}</button>
              ))}
            </div>
            <button onClick={() => rating && slaOpResultaat(rating)} disabled={!rating || opslaan}
              className="w-full py-3.5 bg-primary-500 text-white rounded-xl font-semibold active:bg-primary-600 disabled:opacity-40">
              {opslaan ? 'Opslaan...' : 'Opslaan'}
            </button>
          </Card>
        )}

        {fase === 'opgeslagen' && (
          <Card className="p-8 text-center">
            <Check size={40} className="text-green-400 mx-auto mb-3" />
            <p className="text-white font-semibold">Opgeslagen!</p>
            <p className="text-slate-500 text-xs mt-1">Je coach ziet deze training terug.</p>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
