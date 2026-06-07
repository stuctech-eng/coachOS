'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { X, Play, Pause } from 'lucide-react'

function WalkSession() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const duurMinuten = parseInt(searchParams.get('duration') || '20')
  const totaleSec = duurMinuten * 60

  const [gestart, setGestart] = useState(false)
  const [gepauzeerd, setGepauzeerd] = useState(false)
  const [klaar, setKlaar] = useState(false)
  const [verlopenSec, setVerlopenSec] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const klaarRef = useRef(false)

  const slaOpResultaat = useCallback(async (duur: number) => {
    try {
      await fetch('/api/recovery/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'walk',
          module: 'recovery_walk',
          duration: Math.round(duur / 60),
          completion_status: 'completed',
          recovery_impact: 'low',
        }),
      })
    } catch { /* */ }
  }, [])

  useEffect(() => {
    if (!gestart || gepauzeerd || klaar) return

    intervalRef.current = setInterval(() => {
      setVerlopenSec(prev => {
        const nieuw = prev + 1
        if (nieuw >= totaleSec && !klaarRef.current) {
          klaarRef.current = true
          clearInterval(intervalRef.current!)
          setKlaar(true)
          slaOpResultaat(nieuw)
        }
        return nieuw
      })
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [gestart, gepauzeerd, klaar, totaleSec, slaOpResultaat])

  function stopVroeg() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    slaOpResultaat(verlopenSec)
    router.push('/training')
  }

  const restSec = Math.max(totaleSec - verlopenSec, 0)
  const restMin = Math.floor(restSec / 60)
  const restSecRest = restSec % 60
  const voortgang = totaleSec > 0 ? verlopenSec / totaleSec : 0
  const kleur = voortgang < 0.33 ? '#60a5fa' : voortgang < 0.66 ? '#34d399' : '#a78bfa'

  // ── Klaar ──────────────────────────────────────────────────────────────────
  if (klaar) {
    return (
      <div className="fixed inset-0 bg-coach-dark flex flex-col items-center justify-center px-8 text-center">
        <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
          <span className="text-5xl">✓</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Goed gedaan!</h1>
        <p className="text-slate-400 mb-1">Herstelwandeling</p>
        <p className="text-slate-500 text-sm mb-8">{duurMinuten} minuten voltooid</p>
        <button
          onClick={() => router.push('/training')}
          className="w-full py-4 bg-primary-600 text-white rounded-2xl font-semibold text-lg active:bg-primary-700"
        >
          Terug naar Training
        </button>
      </div>
    )
  }

  // ── Start scherm ───────────────────────────────────────────────────────────
  if (!gestart) {
    return (
      <div className="fixed inset-0 bg-coach-dark flex flex-col px-6">
        <div className="flex items-center justify-between pt-14 pb-8">
          <button
            onClick={() => router.push('/training')}
            className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-32 h-32 rounded-full bg-teal-500/15 border border-teal-500/30 mb-8 flex items-center justify-center">
            <span className="text-6xl">🚶</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Herstelwandeling</h1>
          <p className="text-slate-400 text-sm mb-8">Lage intensiteit — laat je lichaam herstellen</p>

          <div className="w-full bg-slate-800/50 rounded-2xl p-6 mb-8">
            <p className="text-5xl font-bold text-white mb-2">{duurMinuten}</p>
            <p className="text-slate-400">minuten</p>
            <div className="mt-4 pt-4 border-t border-slate-700 text-left space-y-2">
              <p className="text-xs text-slate-500">• Wandel in rustig tempo</p>
              <p className="text-xs text-slate-500">• Adem diep en ontspan je schouders</p>
              <p className="text-xs text-slate-500">• Geen haast — herstel staat centraal</p>
            </div>
          </div>
        </div>

        <div className="pb-12">
          <button
            onClick={() => setGestart(true)}
            className="w-full py-4 bg-primary-600 text-white rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 active:bg-primary-700"
          >
            <Play size={22} fill="white" />
            Start wandeling
          </button>
        </div>
      </div>
    )
  }

  // ── Actief ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col items-center" style={{ background: '#0a0f1a' }}>
      <div className="flex justify-end w-full px-6 pt-14">
        <button
          onClick={stopVroeg}
          className="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center"
        >
          <X size={20} className="text-slate-400" />
        </button>
      </div>

      <p className="text-slate-500 text-sm mt-4">Herstelwandeling</p>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative w-64 h-64 flex items-center justify-center mb-8">
          <svg width="256" height="256" className="absolute">
            <circle cx="128" cy="128" r="120" fill="none" stroke="#1e293b" strokeWidth="6" />
            <circle
              cx="128" cy="128" r="120" fill="none"
              stroke={kleur} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 120}`}
              strokeDashoffset={`${2 * Math.PI * 120 * (1 - voortgang)}`}
              transform="rotate(-90 128 128)"
              style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 2s ease' }}
            />
          </svg>
          <div className="text-center">
            <p className="text-6xl font-bold text-white tabular-nums">
              {String(restMin).padStart(2, '0')}:{String(restSecRest).padStart(2, '0')}
            </p>
            <p className="text-slate-500 text-sm mt-2">resterend</p>
          </div>
        </div>
        <p className="text-slate-600 text-xs">🚶 Wandel in rustig tempo</p>
      </div>

      <div className="flex gap-4 pb-16">
        <button
          onClick={() => setGepauzeerd(p => !p)}
          className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center active:bg-slate-700"
        >
          {gepauzeerd
            ? <Play size={24} className="text-white" fill="white" />
            : <Pause size={24} className="text-white" />
          }
        </button>
        <button
          onClick={stopVroeg}
          className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center active:bg-red-500/30"
        >
          <X size={20} className="text-red-400" />
        </button>
      </div>
      {gepauzeerd && <p className="text-slate-600 text-xs pb-4 -mt-8">Gepauzeerd</p>}
    </div>
  )
}

export default function WalkPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-coach-dark flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
      </div>
    }>
      <WalkSession />
    </Suspense>
  )
}
