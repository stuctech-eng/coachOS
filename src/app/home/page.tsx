'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Sparkles, Bell, Calendar, RefreshCw, MessageCircle, AlertTriangle, Clock, TrendingUp, TrendingDown, Zap, Camera } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCoach } from '@/hooks/useCoach'
import { useCoachStore } from '@/store'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'
import { getGreeting, formatDate } from '@/utils'
import { cn } from '@/utils'
import { createBrowserClient } from '@supabase/ssr'

interface Prediction {
  titel: string
  voorspelling: string
  kans: number
  actie: string
  type: 'positief' | 'waarschuwing'
}

function getScoreLabel(score: number | null): string {
  if (!score) return '—'
  if (score >= 90) return 'Elite Readiness'
  if (score >= 75) return 'Klaar'
  if (score >= 60) return 'Voorzichtig'
  if (score >= 40) return 'Herstel nodig'
  return 'Hoog Risico'
}

function getScoreKleur(score: number | null): string {
  if (!score) return 'text-slate-400'
  if (score >= 75) return 'text-green-400'
  if (score >= 50) return 'text-orange-400'
  return 'text-red-400'
}

function getScoreBg(score: number | null): string {
  if (!score) return 'bg-slate-800'
  if (score >= 75) return 'bg-green-500/10 border border-green-500/20'
  if (score >= 50) return 'bg-orange-500/10 border border-orange-500/20'
  return 'bg-red-500/10 border border-red-500/20'
}

function getRisicoKleur(): string {
  return 'bg-orange-500/10 border-orange-500/30 text-orange-400'
}

export default function HomePage() {
  const { profile } = useAuth()
  const { recommendation, checkin, isGenerating, generateAdvice, hasCheckin } = useCoach()
  const { coachStatus, setCoachStatus, actionPlan, actionPlanDatum, setActionPlan } = useCoachStore()
  const router = useRouter()

  const [showReasoning, setShowReasoning] = useState(false)
  const [berekenend, setBerekenend] = useState(false)
  const [laden, setLaden] = useState(true)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [predictions, setPredictions] = useState<Prediction[] | null>(null)
  const [generatingPredictions, setGeneratingPredictions] = useState(false)
  const [garminImported, setGarminImported] = useState(true) // default true = geen banner
  const [garminDatum, setGarminDatum] = useState<string | null>(null)

  const greeting = getGreeting(profile?.display_name || profile?.first_name)
  const score = coachStatus?.coach_score ?? null
  const vandaag = new Date().toISOString().split('T')[0]
  const heeftRisicos = coachStatus?.risk_flags && coachStatus.risk_flags.length > 0

  // Check Garmin import vandaag
  useEffect(() => {
    const checkGarmin = async () => {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
        )
        const vandaagAms = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
        const gisterenAms = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
        // Check vandaag
        const { data: vandaagData } = await supabase
          .from('garmin_imports')
          .select('id, date')
          .eq('status', 'confirmed')
          .gte('date', gisterenAms)
          .order('date', { ascending: false })
          .limit(1)
          .single()
        const isVandaag = vandaagData?.date === vandaagAms
        setGarminImported(isVandaag)
        setGarminDatum(vandaagData?.date ?? null)

        // Als Garmin van vandaag is, check of Coach Score ook van vandaag is
        // Zo niet — herbereken stilletjes op de achtergrond
        if (isVandaag) {
          const scoreDatum = window.localStorage.getItem('coach_status_datum')
          if (scoreDatum !== vandaagAms) {
            fetch('/api/status', { method: 'POST', credentials: 'include' })
              .then(r => r.json())
              .then(data => {
                if (data?.score !== undefined) {
                  window.localStorage.setItem('coach_status_datum', vandaagAms)
                  window.localStorage.setItem('coach_status_data', JSON.stringify(data))
                  setCoachStatus({ ...data, date: vandaagAms })
                }
              })
              .catch(() => {})
          }
        }
      } catch {
        setGarminImported(true)
        setGarminDatum(null)
      }
    }
    checkGarmin()
  }, [])

  // Laad coach status
  useEffect(() => {
    if (coachStatus && coachStatus.date === vandaag) {
      setLaden(false)
      return
    }
    if (typeof window !== 'undefined') {
      try {
        const opgeslaanDatum = window.localStorage.getItem('coach_status_datum')
        const opgeslaanStatus = window.localStorage.getItem('coach_status_data')
        if (opgeslaanDatum === vandaag && opgeslaanStatus) {
          const parsed = JSON.parse(opgeslaanStatus)
          setCoachStatus(parsed)
          setLaden(false)
          return
        }
      } catch { /* */ }
    }
    setLaden(false)
    setBerekenend(true)
    fetch('/api/status', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        setCoachStatus(data)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('coach_status_data', JSON.stringify(data))
          window.localStorage.setItem('coach_status_datum', vandaag)
        }
      })
      .catch(() => {})
      .finally(() => setBerekenend(false))
  }, [])

  // Laad dagplan
  useEffect(() => {
    if (actionPlan && actionPlanDatum === vandaag) return
    if (typeof window !== 'undefined') {
      try {
        const opgeslaanDatum = window.localStorage.getItem('dagplan_datum')
        const opgeslaanPlan = window.localStorage.getItem('dagplan_data')
        if (opgeslaanDatum === vandaag && opgeslaanPlan) {
          const parsed = JSON.parse(opgeslaanPlan)
          setActionPlan(parsed, vandaag)
        }
      } catch { /* */ }
    }
  }, [])

  // Laad voorspellingen
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const opgeslaanDatum = window.localStorage.getItem('predictions_datum')
        const opgeslaanPredictions = window.localStorage.getItem('predictions_data')
        if (opgeslaanDatum === vandaag && opgeslaanPredictions) {
          setPredictions(JSON.parse(opgeslaanPredictions))
          return
        }
      } catch { /* */ }
    }
    fetch('/api/predictions')
      .then(r => r.json())
      .then(data => {
        if (data.predictions) {
          setPredictions(data.predictions)
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('predictions_data', JSON.stringify(data.predictions))
            window.localStorage.setItem('predictions_datum', vandaag)
          }
        }
      })
      .catch(() => {})
  }, [])

  const berekenCoachScore = async () => {
    setBerekenend(true)
    try {
      const res = await fetch('/api/status', { method: 'POST' })
      const data = await res.json()
      setCoachStatus(data)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('coach_status_data', JSON.stringify(data))
        window.localStorage.setItem('coach_status_datum', vandaag)
      }
    } catch { /* */ }
    finally { setBerekenend(false) }
  }

  const genereerDagplan = async () => {
    setGeneratingPlan(true)
    try {
      const res = await fetch('/api/action-plan', { method: 'POST' })
      const data = await res.json()
      if (data.plan) {
        setActionPlan(data.plan, vandaag)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('dagplan_data', JSON.stringify(data.plan))
          window.localStorage.setItem('dagplan_datum', vandaag)
        }
      }
    } catch { /* */ }
    finally { setGeneratingPlan(false) }
  }

  const genereerVoorspellingen = async () => {
    setGeneratingPredictions(true)
    try {
      const res = await fetch('/api/predictions', { method: 'POST' })
      const data = await res.json()
      if (data.predictions) {
        setPredictions(data.predictions)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('predictions_data', JSON.stringify(data.predictions))
          window.localStorage.setItem('predictions_datum', vandaag)
        }
      }
    } catch { /* */ }
    finally { setGeneratingPredictions(false) }
  }

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-slate-400 text-sm capitalize">{formatDate(new Date())}</p>
            <h1 className="text-2xl font-bold text-white mt-0.5">{greeting}</h1>
          </div>
          <button className="w-11 h-11 rounded-xl bg-coach-card flex items-center justify-center text-slate-400">
            <Bell size={20} />
          </button>
        </div>

        {/* Garmin reminder banner */}
        {!garminImported && (
          <button
            onClick={() => router.push('/settings/garmin-import')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-left active:bg-blue-500/15 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Camera size={16} className="text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-400">Garmin data importeren</p>
              <p className="text-xs text-slate-500 mt-0.5">Vandaag nog geen screenshot geüpload</p>
            </div>
            <ChevronDown size={16} className="text-blue-400/50 -rotate-90 flex-shrink-0" />
          </button>
        )}

        {/* Coach Score */}
        <Card className={cn('p-5', getScoreBg(score))}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Coach Score</p>
                {(() => {
                  // Garmin import indicator
                  const vandaagAms = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
                  const gisterenAms = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
                  // garminImported = vandaag bevestigd
                  // We need to also check if it was yesterday
                  const vandaagAms2 = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
                  const gisterenAms2 = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
                  if (garminDatum === vandaagAms2) {
                    return <div className="w-2 h-2 rounded-full bg-green-400" title="Garmin import vandaag ✓" />
                  }
                  if (garminDatum === gisterenAms2) {
                    return <div className="w-2 h-2 rounded-full bg-amber-400" title="Garmin import van gisteren" />
                  }
                  return <div className="w-2 h-2 rounded-full bg-slate-500" title="Geen recente Garmin data" />
                })()}
              </div>
              <div className="flex items-end gap-2">
                {laden || berekenend ? (
                  <div className="h-12 w-20 bg-slate-700 rounded-xl animate-pulse" />
                ) : (
                  <>
                    <p className={cn('text-5xl font-bold leading-none', getScoreKleur(score))}>
                      {score ?? '—'}
                    </p>
                    <p className="text-slate-500 text-sm mb-1">/100</p>
                  </>
                )}
              </div>
              {!laden && !berekenend && score && (
                <p className={cn('text-sm font-semibold mt-1', getScoreKleur(score))}>
                  {getScoreLabel(score)}
                </p>
              )}
            </div>
            <button onClick={berekenCoachScore} disabled={berekenend}
              className="w-9 h-9 rounded-xl bg-slate-800/50 flex items-center justify-center active:bg-slate-700 disabled:opacity-50">
              <RefreshCw size={16} className={cn('text-slate-400', berekenend && 'animate-spin')} />
            </button>
          </div>
          {coachStatus && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Herstel', score: coachStatus.recovery_score },
                { label: 'Training', score: coachStatus.training_score },
                { label: 'Leefstijl', score: coachStatus.lifestyle_score },
              ].map(({ label, score: s }) => (
                <div key={label} className="bg-slate-800/60 rounded-xl p-2 text-center">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={cn('text-lg font-bold', getScoreKleur(s))}>{s ?? '—'}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Risico's */}
        {heeftRisicos && (
          <div className={cn('rounded-xl px-4 py-3 border flex items-start gap-3', getRisicoKleur())}>
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold mb-1">Aandachtspunten</p>
              {coachStatus!.risk_flags.map((flag, i) => (
                <p key={i} className="text-xs opacity-80">• {flag}</p>
              ))}
            </div>
          </div>
        )}

        {/* Coach Advies */}
        <Card className="p-5">
          <div className="flex items-center gap-2 text-primary-400 mb-3">
            <Sparkles size={18} />
            <span className="text-sm font-medium">Advies voor vandaag</span>
          </div>
          {recommendation ? (
            <>
              <p className="text-lg font-semibold text-white leading-snug mb-3">
                {recommendation.recommendation}
              </p>
              <button onClick={() => setShowReasoning(!showReasoning)}
                className="flex items-center gap-2 text-sm text-primary-400">
                {showReasoning ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                Waarom?
              </button>
              {showReasoning && recommendation.reasoning && (
                <div className="bg-slate-800/50 rounded-xl p-4 mt-3">
                  <p className="text-slate-300 text-sm leading-relaxed">{recommendation.reasoning}</p>
                </div>
              )}
            </>
          ) : !hasCheckin ? (
            <p className="text-slate-400 text-sm">Doe eerst je ochtend check-in voor persoonlijk advies.</p>
          ) : (
            <Button onClick={generateAdvice} loading={isGenerating} fullWidth>
              {isGenerating ? 'Coach denkt na...' : 'Genereer advies'}
            </Button>
          )}
        </Card>

        {/* Check-in */}
        {!hasCheckin ? (
          <Link href="/checkin">
            <Card className="px-5 py-4 border border-primary-500/30 bg-primary-500/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold text-sm">Ochtend check-in</p>
                  <p className="text-slate-400 text-xs mt-0.5">Hoe voel je je vandaag?</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center text-primary-400">
                  <ChevronDown size={16} className="-rotate-90" />
                </div>
              </div>
            </Card>
          </Link>
        ) : checkin && (
          <Card className="px-4 py-3">
            <p className="text-xs text-slate-500 mb-3">Check-in vandaag</p>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{checkin.feeling_score}</p>
                <p className="text-xs text-slate-400 mt-0.5">Gevoel</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{checkin.energy_score}</p>
                <p className="text-xs text-slate-400 mt-0.5">Energie</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{checkin.has_pain ? 'ja' : 'nee'}</p>
                <p className="text-xs text-slate-400 mt-0.5">Pijn</p>
              </div>
            </div>
            {((checkin as {stress_score?: number}).stress_score || (checkin as {motivation_score?: number}).motivation_score || (checkin as {soreness_score?: number}).soreness_score) && (
              <>
                <div className="h-px bg-coach-border my-2" />
                <div className="grid grid-cols-3 gap-2">
                  {(checkin as {stress_score?: number}).stress_score && (
                    <div className="text-center">
                      <p className="text-lg font-bold text-orange-400">{(checkin as {stress_score?: number}).stress_score}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Stress</p>
                    </div>
                  )}
                  {(checkin as {motivation_score?: number}).motivation_score && (
                    <div className="text-center">
                      <p className="text-lg font-bold text-green-400">{(checkin as {motivation_score?: number}).motivation_score}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Motivatie</p>
                    </div>
                  )}
                  {(checkin as {soreness_score?: number}).soreness_score && (
                    <div className="text-center">
                      <p className="text-lg font-bold text-red-400">{(checkin as {soreness_score?: number}).soreness_score}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Spierpijn</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>
        )}

        {/* Voorspellingen */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-primary-400">
              <Zap size={18} />
              <span className="text-sm font-medium">Voorspellingen</span>
            </div>
            <button onClick={genereerVoorspellingen} disabled={generatingPredictions}
              className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center active:bg-slate-700 disabled:opacity-50">
              <RefreshCw size={14} className={cn('text-slate-400', generatingPredictions && 'animate-spin')} />
            </button>
          </div>
          {generatingPredictions ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-800 rounded-xl animate-pulse" />)}
            </div>
          ) : predictions && predictions.length > 0 ? (
            <div className="flex flex-col gap-2">
              {predictions.map((p, i) => (
                <div key={i} className={cn(
                  'rounded-xl px-4 py-3 border',
                  p.type === 'positief'
                    ? 'bg-green-500/8 border-green-500/20'
                    : 'bg-orange-500/8 border-orange-500/20'
                )}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {p.type === 'positief'
                        ? <TrendingUp size={14} className="text-green-400" />
                        : <AlertTriangle size={14} className="text-orange-400" />
                      }
                      <p className={cn('text-sm font-semibold',
                        p.type === 'positief' ? 'text-green-400' : 'text-orange-400'
                      )}>{p.titel}</p>
                    </div>
                    <span className={cn('text-xs font-mono',
                      p.type === 'positief' ? 'text-green-500' : 'text-orange-500'
                    )}>{p.kans}%</span>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed mb-1">{p.voorspelling}</p>
                  <p className="text-slate-500 text-xs">{p.actie}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="text-slate-400 text-sm mb-3">Voorspellingen op basis van jouw trends</p>
              <button onClick={genereerVoorspellingen} disabled={generatingPredictions}
                className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm active:bg-primary-700 disabled:opacity-50">
                {generatingPredictions ? 'Bezig...' : 'Genereer voorspellingen'}
              </button>
            </div>
          )}
        </Card>

        {/* Dagplan */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-primary-400">
              <Clock size={18} />
              <span className="text-sm font-medium">Dagplan</span>
            </div>
            <button onClick={genereerDagplan} disabled={generatingPlan}
              className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center active:bg-slate-700 disabled:opacity-50">
              <RefreshCw size={14} className={cn('text-slate-400', generatingPlan && 'animate-spin')} />
            </button>
          </div>
          {generatingPlan ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-800 rounded-xl animate-pulse" />)}
            </div>
          ) : actionPlan && actionPlan.length > 0 ? (
            <div className="flex flex-col gap-2">
              {actionPlan.map((item, i) => (
                <div key={i} className="flex items-start gap-3 bg-slate-800/50 rounded-xl px-3 py-2.5">
                  <span className="text-xs text-primary-400 font-mono font-semibold flex-shrink-0 mt-0.5 w-10">{item.tijd}</span>
                  <p className="text-sm text-slate-200 leading-snug">{item.actie}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="text-slate-400 text-sm mb-3">Genereer je dagplan op basis van je data</p>
              <button onClick={genereerDagplan} disabled={generatingPlan}
                className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm active:bg-primary-700 disabled:opacity-50">
                {generatingPlan ? 'Bezig...' : 'Maak dagplan'}
              </button>
            </div>
          )}
        </Card>

        {/* Snelle links */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/chat">
            <Card className="px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
                  <MessageCircle size={16} className="text-primary-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Coach Chat</p>
                  <p className="text-slate-500 text-xs">Stel een vraag</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link href="/weekly">
            <Card className="px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
                  <Calendar size={16} className="text-primary-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Week</p>
                  <p className="text-slate-500 text-xs">Overzicht</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>

      </div>
    </AppShell>
  )
}
