'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { X, Pause, Play } from 'lucide-react'
import { Suspense } from 'react'

interface Fase {
  label: string
  duur: number
  schaal: number
  kleur: string
}

const SCHEMAS: Record<string, { naam: string; fases: Fase[]; beschrijving: string }> = {
  box_breathing: {
    naam: 'Box Breathing',
    beschrijving: '4-4-4-4 ritme voor kalmte en focus',
    fases: [
      { label: 'Inademen', duur: 4, schaal: 1.3, kleur: '#60a5fa' },
      { label: 'Vasthouden', duur: 4, schaal: 1.3, kleur: '#a78bfa' },
      { label: 'Uitademen', duur: 4, schaal: 0.7, kleur: '#34d399' },
      { label: 'Vasthouden', duur: 4, schaal: 0.7, kleur: '#a78bfa' },
    ],
  },
  breathing_478: {
    naam: '4-7-8 Ademhaling',
    beschrijving: 'Diepe ontspanning en slaap voorbereiding',
    fases: [
      { label: 'Inademen', duur: 4, schaal: 1.3, kleur: '#60a5fa' },
      { label: 'Vasthouden', duur: 7, schaal: 1.3, kleur: '#a78bfa' },
      { label: 'Uitademen', duur: 8, schaal: 0.7, kleur: '#34d399' },
    ],
  },
  coherent_breathing: {
    naam: 'Coherent Breathing',
    beschrijving: 'HRV verbetering, 5 seconden per fase',
    fases: [
      { label: 'Inademen', duur: 5, schaal: 1.3, kleur: '#60a5fa' },
      { label: 'Uitademen', duur: 5, schaal: 0.7, kleur: '#34d399' },
    ],
  },
  stress_reset: {
    naam: 'Stress Reset',
    beschrijving: 'Snel kalmeren, verlengde uitademing',
    fases: [
      { label: 'Inademen', duur: 4, schaal: 1.3, kleur: '#60a5fa' },
      { label: 'Uitademen', duur: 8, schaal: 0.7, kleur: '#34d399' },
    ],
  },
}

function BreathingSession() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const subtype = searchParams.get('subtype') || 'box_breathing'
  const duurMinuten = parseInt(searchParams.get('duration') || '6')
  const label = searchParams.get('label') || 'Ademhaling'

  const schema = SCHEMAS[subtype] || SCHEMAS.box_breathing
  const totaleSec = duurMinuten * 60
  const faseDuur = schema.fases.reduce((s, f) => s + f.duur, 0)
  const totaalRondes = Math.ceil(totaleSec / faseDuur)

  const [gestart, setGestart] = useState(false)
  const [gepauzeerd, setGepauzeerd] = useState(false)
  const [klaar, setKlaar] = useState(false)
  const [faseIndex, setFaseIndex] = useState(0)
  const [faseTeller, setFaseTeller] = useState(0)
  const [ronde, setRonde] = useState(1)
  const [verlopenSec, setVerlopenSec] = useState(0)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTijdRef = useRef<number>(0)
  const gepauzeerRef = useRef(false)

  const huidigeFase = schema.fases[faseIndex]

  const slaOpResultaat = useCallback(async () => {
    try {
      await fetch('/api/recovery/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'breathing',
          module: subtype,
          duration: Math.round(verlopenSec / 60),
          completion_status: 'completed',
          recovery_impact: 'medium',
        }),
      })
    } catch { /* */ }
  }, [subtype, verlopenSec])

  useEffect(() => {
    if (!gestart || gepauzeerd || klaar) return

    intervalRef.current = setInterval(() => {
      if (gepauzeerRef.current) return

      setVerlopenSec(prev => prev + 1)
      setFaseTeller(prev => {
        const volgende = prev + 1
        if (volgende >= huidigeFase.duur) {
          setFaseIndex(fi => {
            const volgendeIndex = (fi + 1) % schema.fases.length
            if (volgendeIndex === 0) {
              setRonde(r => {
                const nieuweRonde = r + 1
                if (nieuweRonde > totaalRondes) {
                  setKlaar(true)
                  slaOpResultaat()
                }
                return nieuweRonde
              })
            }
            return volgendeIndex
          })
          return 0
        }
        return volgende
      })
    }, 1000)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [gestart, gepauzeerd, klaar, huidigeFase, schema.fases, totaalRondes, slaOpResultaat])

  function togglePauze() {
    gepauzeerRef.current = !gepauzeerRef.current
    setGepauzeerd(prev => !prev)
  }

  function stop() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    slaOpResultaat()
    router.push('/training')
  }

  const voortgang = Math.min(verlopenSec / totaleSec, 1)
  const restSec = Math.max(totaleSec - verlopenSec, 0)
  const restMin = Math.floor(restSec / 60)
  const restSecRest = restSec % 60

  // Cirkel animatie
  const cirkelSchaal = huidigeFase?.schaal || 1
  const cirkelKleur = huidigeFase?.kleur || '#60a5fa'
  // Ring toont voortgang van de HELE ronde (cumulatief over alle fases), niet
  // per fase. Per-fase progress gaf bij elke fase-overgang een "rewind" van
  // de ring (bijv. 100% -> 25%), wat extra opvalt bij lange fases zoals
  // Uitademen (8 sec). Cumulatief vult de ring soepel over de hele ronde en
  // reset maar één keer per ronde — synchroon met "Ronde X van Y".
  const faseStartOffset = schema.fases.slice(0, faseIndex).reduce((s, f) => s + f.duur, 0)
  const faseVoortgang = Math.min((faseStartOffset + faseTeller + 1) / faseDuur, 1)

  if (klaar) {
    return (
      <div className="fixed inset-0 bg-coach-dark flex flex-col items-center justify-center px-8 text-center">
        <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
          <span className="text-5xl">✓</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Goed gedaan!</h1>
        <p className="text-slate-400 mb-1">{schema.naam}</p>
        <p className="text-slate-500 text-sm mb-8">{totaalRondes} rondes · {duurMinuten} minuten</p>
        <button onClick={() => router.push('/training')}
          className="w-full py-4 bg-primary-600 text-white rounded-2xl font-semibold text-lg active:bg-primary-700">
          Terug naar Training
        </button>
      </div>
    )
  }

  if (!gestart) {
    return (
      <div className="fixed inset-0 bg-coach-dark flex flex-col px-6">
        <div className="flex items-center justify-between pt-14 pb-8">
          <button onClick={() => router.push('/training')}
            className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-32 h-32 rounded-full mb-8 flex items-center justify-center"
            style={{ background: `${cirkelKleur}15`, border: `2px solid ${cirkelKleur}40` }}>
            <span className="text-5xl">🌬️</span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">{schema.naam}</h1>
          <p className="text-slate-400 text-sm mb-8">{schema.beschrijving}</p>

          <div className="w-full bg-slate-800/50 rounded-2xl p-5 mb-8">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Patroon</p>
            <div className="flex justify-center gap-3 flex-wrap">
              {schema.fases.map((fase, i) => (
                <div key={i} className="text-center">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-1 mx-auto"
                    style={{ background: `${fase.kleur}20` }}>
                    <span className="text-lg font-bold" style={{ color: fase.kleur }}>{fase.duur}</span>
                  </div>
                  <p className="text-xs text-slate-500">{fase.label.split(' ')[0]}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-4 text-center">{totaalRondes} rondes · {duurMinuten} minuten</p>
          </div>
        </div>

        <div className="pb-12">
          <button onClick={() => setGestart(true)}
            className="w-full py-4 bg-primary-600 text-white rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 active:bg-primary-700">
            <Play size={22} fill="white" />
            Start sessie
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-coach-dark flex flex-col items-center" style={{ background: '#0a0f1a' }}>

      {/* Stop knop */}
      <div className="flex justify-end w-full px-6 pt-14">
        <button onClick={stop}
          className="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center">
          <X size={20} className="text-slate-400" />
        </button>
      </div>

      {/* Ronde info */}
      <div className="mt-6 text-center">
        <p className="text-slate-500 text-sm">Ronde {Math.min(ronde, totaalRondes)} van {totaalRondes}</p>
        <p className="text-slate-600 text-xs mt-1">
          {restMin}:{String(restSecRest).padStart(2, '0')} resterend
        </p>
      </div>

      {/* Animatie cirkel */}
      <div className="flex-1 flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          {/* Buitenste ring — voortgang fase */}
          <svg width="280" height="280" className="absolute">
            <circle cx="140" cy="140" r="130" fill="none" stroke="#1e293b" strokeWidth="3" />
            <circle cx="140" cy="140" r="130" fill="none"
              stroke={cirkelKleur} strokeWidth="3" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 130}`}
              strokeDashoffset={`${2 * Math.PI * 130 * (1 - faseVoortgang)}`}
              transform="rotate(-90 140 140)"
              style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.5s ease' }} />
          </svg>

          {/* Ademhalingscirkel */}
          <div className="w-48 h-48 rounded-full flex items-center justify-center"
            style={{
              background: `radial-gradient(circle, ${cirkelKleur}30 0%, ${cirkelKleur}08 70%)`,
              border: `2px solid ${cirkelKleur}40`,
              transform: `scale(${cirkelSchaal})`,
              transition: `transform ${huidigeFase?.duur || 4}s ease-in-out, border-color 0.5s ease, background 0.5s ease`,
            }}>
            <div className="text-center">
              <p className="text-white text-xl font-semibold">{huidigeFase?.label}</p>
              <p className="text-4xl font-bold mt-1" style={{ color: cirkelKleur }}>
                {Math.max(huidigeFase?.duur - faseTeller, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Voortgangsbalk */}
      <div className="w-full px-8 mb-8">
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${voortgang * 100}%`, background: cirkelKleur }} />
        </div>
      </div>

      {/* Pauze knop */}
      <div className="pb-16">
        <button onClick={togglePauze}
          className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center active:bg-slate-700">
          {gepauzeerd
            ? <Play size={24} className="text-white" fill="white" />
            : <Pause size={24} className="text-white" />
          }
        </button>
        {gepauzeerd && <p className="text-slate-500 text-xs text-center mt-3">Gepauzeerd</p>}
      </div>
    </div>
  )
}

export default function BreathingPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-coach-dark flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
      </div>
    }>
      <BreathingSession />
    </Suspense>
  )
}
