'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { X, Pause, Play } from 'lucide-react'
import { Suspense } from 'react'
import Link from 'next/link'

interface Fase { label: string; duur: number; schaal: number; kleur: string }

const SCHEMAS: Record<string, { naam: string; fases: Fase[]; beschrijving: string }> = {
  box_breathing: { naam: 'Box Breathing', beschrijving: '4-4-4-4 ritme voor kalmte en focus', fases: [
    { label: 'Inademen', duur: 4, schaal: 1.3, kleur: '#60a5fa' },
    { label: 'Vasthouden', duur: 4, schaal: 1.3, kleur: '#a78bfa' },
    { label: 'Uitademen', duur: 4, schaal: 0.7, kleur: '#34d399' },
    { label: 'Vasthouden', duur: 4, schaal: 0.7, kleur: '#a78bfa' },
  ]},
  breathing_478: { naam: '4-7-8 Ademhaling', beschrijving: 'Diepe ontspanning en slaap voorbereiding', fases: [
    { label: 'Inademen', duur: 4, schaal: 1.3, kleur: '#60a5fa' },
    { label: 'Vasthouden', duur: 7, schaal: 1.3, kleur: '#a78bfa' },
    { label: 'Uitademen', duur: 8, schaal: 0.7, kleur: '#34d399' },
  ]},
  coherent_breathing: { naam: 'Coherent Breathing', beschrijving: 'HRV verbetering, 5 seconden per fase', fases: [
    { label: 'Inademen', duur: 5, schaal: 1.3, kleur: '#60a5fa' },
    { label: 'Uitademen', duur: 5, schaal: 0.7, kleur: '#34d399' },
  ]},
  stress_reset: { naam: 'Stress Reset', beschrijving: 'Snel kalmeren, verlengde uitademing', fases: [
    { label: 'Inademen', duur: 4, schaal: 1.3, kleur: '#60a5fa' },
    { label: 'Uitademen', duur: 8, schaal: 0.7, kleur: '#34d399' },
  ]},
}

function BreathingSession() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const terug = searchParams.get('terug') || ''
  const terugUrl = terug ? `/training?herstel=1&terug=${terug}` : '/training?herstel=1'
  const subtype = searchParams.get('subtype') || 'box_breathing'
  const duurMinuten = parseInt(searchParams.get('duration') || '6')
  const schema = SCHEMAS[subtype] || SCHEMAS.box_breathing
  const totaleSec = duurMinuten * 60
  const faseDuur = schema.fases.reduce((s, f) => s + f.duur, 0)
  const faseOffsets = schema.fases.reduce<number[]>((acc, f, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + schema.fases[i - 1].duur); return acc
  }, [])
  const [gestart, setGestart] = useState(false)
  const [gepauzeerd, setGepauzeerd] = useState(false)
  const [klaar, setKlaar] = useState(false)
  const [, setTick] = useState(0)
  const startTimeRef = useRef<number>(0)
  const pausedAccumRef = useRef<number>(0)
  const pauseStartRef = useRef<number | null>(null)

  function getElapsedSeconds(): number {
    if (!gestart) return 0
    const now = pauseStartRef.current ?? Date.now()
    return Math.max(0, Math.floor((now - startTimeRef.current - pausedAccumRef.current) / 1000))
  }
  const elapsedSeconds = getElapsedSeconds()
  const secondsInCycle = elapsedSeconds % faseDuur
  const ronde = Math.floor(elapsedSeconds / faseDuur) + 1
  const totaalRondes = Math.ceil(totaleSec / faseDuur)
  let faseIndex = schema.fases.length - 1
  for (let i = 0; i < schema.fases.length; i++) {
    if (secondsInCycle < faseOffsets[i] + schema.fases[i].duur) { faseIndex = i; break }
  }
  const huidigeFase = schema.fases[faseIndex]
  const faseTeller = secondsInCycle - faseOffsets[faseIndex]

  const slaOpResultaat = useCallback(async (duurSec: number) => {
    try { await fetch('/api/recovery/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'breathing', module: subtype, duration: Math.round(duurSec / 60), completion_status: 'completed', recovery_impact: 'medium' }) }) } catch { /* */ }
  }, [subtype])

  useEffect(() => {
    if (!gestart || gepauzeerd || klaar) return
    const interval = setInterval(() => setTick(t => t + 1), 250)
    return () => clearInterval(interval)
  }, [gestart, gepauzeerd, klaar])

  useEffect(() => {
    if (gestart && !klaar && elapsedSeconds >= totaleSec) { setKlaar(true); slaOpResultaat(totaleSec) }
  }, [elapsedSeconds, gestart, klaar, totaleSec, slaOpResultaat])

  function start() { startTimeRef.current = Date.now(); pausedAccumRef.current = 0; pauseStartRef.current = null; setGestart(true) }
  function togglePauze() {
    if (!gepauzeerd) { pauseStartRef.current = Date.now() }
    else if (pauseStartRef.current !== null) { pausedAccumRef.current += Date.now() - pauseStartRef.current; pauseStartRef.current = null }
    setGepauzeerd(prev => !prev)
  }
  function stop() { slaOpResultaat(elapsedSeconds); router.push(terugUrl) }

  const voortgang = Math.min(elapsedSeconds / totaleSec, 1)
  const restSec = Math.max(totaleSec - elapsedSeconds, 0)
  const cirkelSchaal = huidigeFase?.schaal || 1
  const cirkelKleur = huidigeFase?.kleur || '#60a5fa'
  function getElapsedMs() { if (!gestart) return 0; const now = pauseStartRef.current ?? Date.now(); return Math.max(0, now - startTimeRef.current - pausedAccumRef.current) }
  const faseVoortgang = Math.min((getElapsedMs() / 1000) % faseDuur / faseDuur, 1)

  if (klaar) return (
    <div className="fixed inset-0 bg-coach-dark flex flex-col items-center justify-center px-8 text-center">
      <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mb-6"><span className="text-5xl">✓</span></div>
      <h1 className="text-2xl font-bold text-white mb-2">Goed gedaan!</h1>
      <p className="text-slate-400 mb-1">{schema.naam}</p>
      <p className="text-slate-500 text-sm mb-8">{totaalRondes} rondes · {duurMinuten} minuten</p>
      <Link href={terugUrl} className="w-full py-4 bg-primary-600 text-white rounded-2xl font-semibold text-lg active:bg-primary-700">Terug naar Training</Link>
    </div>
  )

  if (!gestart) return (
    <div className="fixed inset-0 bg-coach-dark flex flex-col px-6">
      <div className="flex items-center justify-between pt-14 pb-8">
        <Link href={terugUrl} className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center"><X size={20} className="text-slate-400" /></Link>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-32 h-32 rounded-full mb-8 flex items-center justify-center" style={{ background: `${cirkelKleur}15`, border: `2px solid ${cirkelKleur}40` }}>
          <span className="text-5xl">🌬️</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">{schema.naam}</h1>
        <p className="text-slate-400 text-sm mb-8">{schema.beschrijving}</p>
        <div className="w-full bg-slate-800/50 rounded-2xl p-5 mb-8">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Patroon</p>
          <div className="flex justify-center gap-3 flex-wrap">
            {schema.fases.map((fase, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-1 mx-auto" style={{ background: `${fase.kleur}20` }}>
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
        <button onClick={start} className="w-full py-4 bg-primary-600 text-white rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 active:bg-primary-700">
          <Play size={22} fill="white" /> Start sessie
        </button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-coach-dark flex flex-col items-center" style={{ background: '#0a0f1a' }}>
      <div className="flex justify-end w-full px-6 pt-14">
        <button onClick={stop} className="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center"><X size={20} className="text-slate-400" /></button>
      </div>
      <div className="mt-6 text-center">
        <p className="text-slate-500 text-sm">Ronde {Math.min(ronde, totaalRondes)} van {totaalRondes}</p>
        <p className="text-slate-600 text-xs mt-1">{Math.floor(restSec/60)}:{String(restSec%60).padStart(2,'0')} resterend</p>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          <svg width="280" height="280" className="absolute">
            <circle cx="140" cy="140" r="130" fill="none" stroke="#1e293b" strokeWidth="3" />
            <circle cx="140" cy="140" r="130" fill="none" stroke={cirkelKleur} strokeWidth="3" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 130}`} strokeDashoffset={`${2 * Math.PI * 130 * (1 - faseVoortgang)}`}
              transform="rotate(-90 140 140)" style={{ transition: 'stroke-dashoffset 0.2s linear, stroke 0.5s ease' }} />
          </svg>
          <div className="w-48 h-48 rounded-full flex items-center justify-center" style={{
            background: `radial-gradient(circle, ${cirkelKleur}30 0%, ${cirkelKleur}08 70%)`,
            border: `2px solid ${cirkelKleur}40`, transform: `scale(${cirkelSchaal})`,
            transition: `transform ${huidigeFase?.duur || 4}s ease-in-out, border-color 0.5s ease, background 0.5s ease`,
          }}>
            <div className="text-center">
              <p className="text-white text-xl font-semibold">{huidigeFase?.label}</p>
              <p className="text-4xl font-bold mt-1" style={{ color: cirkelKleur }}>{Math.max(huidigeFase?.duur - faseTeller, 0)}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="w-full px-8 mb-8">
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${voortgang * 100}%`, background: cirkelKleur }} />
        </div>
      </div>
      <div className="pb-16">
        <button onClick={togglePauze} className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center active:bg-slate-700">
          {gepauzeerd ? <Play size={24} className="text-white" fill="white" /> : <Pause size={24} className="text-white" />}
        </button>
        {gepauzeerd && <p className="text-slate-500 text-xs text-center mt-3">Gepauzeerd</p>}
      </div>
    </div>
  )
}

export default function BreathingPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-coach-dark flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" /></div>}>
      <BreathingSession />
    </Suspense>
  )
}
