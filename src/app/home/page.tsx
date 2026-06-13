'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Sparkles, Bell, Calendar, RefreshCw, MessageCircle, AlertTriangle, Camera, BookOpen } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCoach } from '@/hooks/useCoach'
import { useCoachStore } from '@/store'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'
import { getGreeting, formatDate } from '@/utils'
import { cn } from '@/utils'
import { createBrowserClient } from '@supabase/ssr'

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
      } catch {
        setGarminImported(true)
        setGarminDatum(null)
      }
    }
    checkGarmin()
  }, [])

  // Coach Score automatisch herberekenen — alleen wanneer ZOWEL Garmin (vandaag)
  // ALS check-in (vandaag) aanwezig zijn. Triggert vanaf welke kant ook compleet
  // wordt (eerst Garmin dan check-in, of omgekeerd). Geen AI-call — /api/status
  // is pure berekening.
  const herberekenIndienCompleet = useCallback(() => {
    const vandaagAms = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    if (garminDatum !== vandaagAms || !hasCheckin) return
    if (typeof window === 'undefined') return
    const scoreDatum = window.localStorage.getItem('coach_status_datum')
    if (scoreDatum === vandaagAms) return // al up-to-date voor vandaag

    fetch('/api/status', { method: 'POST', credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data?.coach_score !== undefined) {
          const statusData = {
            coach_score: data.coach_score ?? null,
            recovery_score: data.recovery_score ?? null,
            training_score: data.training_score ?? null,
            lifestyle_score: data.lifestyle_score ?? null,
            risk_flags: data.risk_flags || [],
            status_color: data.status_color || 'orange',
            date: vandaagAms,
          }
          window.localStorage.setItem('coach_status_datum', vandaagAms)
          window.localStorage.setItem('coach_status_data', JSON.stringify(statusData))
          setCoachStatus(statusData)
        }
      })
      .catch(() => {})
  }, [garminDatum, hasCheckin, setCoachStatus])

  useEffect(() => { herberekenIndienCompleet() }, [herberekenIndienCompleet])

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
          <p className="text-xs text-slate-500 px-1">
            ✓ Check-in voltooid — gevoel {checkin.feeling_score}, energie {checkin.energy_score}
            {(checkin as {stress_score?: number}).stress_score ? `, stress ${(checkin as {stress_score?: number}).stress_score}` : ''}
          </p>
        )}

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
                  // Data-volledigheid indicator: Coach Score is alleen volledig
                  // accuraat als Garmin (vandaag) ÉN check-in (vandaag) aanwezig zijn
                  const vandaagStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
                  const gisterenStr = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
                  const garminVandaag = garminDatum === vandaagStr
                  const garminGisteren = garminDatum === gisterenStr
                  if (garminVandaag && hasCheckin) {
                    return <div className="w-2 h-2 rounded-full bg-green-400" title="Garmin + check-in vandaag ✓" />
                  }
                  if (garminVandaag || garminGisteren || hasCheckin) {
                    return <div className="w-2 h-2 rounded-full bg-amber-400" title="Score gedeeltelijk gebaseerd op actuele data" />
                  }
                  return <div className="w-2 h-2 rounded-full bg-slate-500" title="Geen recente Garmin of check-in data" />
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


        {/* Dagboek knop */}
        <Link href="/dagboek">
          <Card className="px-5 py-4 border border-slate-700/50 active:bg-slate-800/80 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <BookOpen size={16} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Dagboek</p>
                  <p className="text-slate-400 text-xs mt-0.5">Hoe was je dag?</p>
                </div>
              </div>
              <ChevronDown size={16} className="text-slate-500 -rotate-90" />
            </div>
          </Card>
        </Link>



        {/* Vandaag van je Coach */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-primary-400">
              <Sparkles size={18} />
              <span className="text-sm font-medium">Vandaag van je Coach</span>
            </div>
            <button onClick={() => { generateAdvice(); genereerDagplan() }} disabled={isGenerating || generatingPlan}
              className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center active:bg-slate-700 disabled:opacity-50">
              <RefreshCw size={14} className={cn('text-slate-400', (isGenerating || generatingPlan) && 'animate-spin')} />
            </button>
          </div>

          {/* Advies */}
          {recommendation ? (
            <>
              <p className="text-base font-semibold text-white leading-snug mb-3">
                {recommendation.recommendation}
              </p>

              {/* Advice bullets */}
              {(() => {
                const bullets: string[] = (() => {
                  try {
                    const ab = (recommendation as {advice_bullets?: string | string[]}).advice_bullets
                    if (Array.isArray(ab)) return ab
                    if (typeof ab === 'string') return JSON.parse(ab)
                    return []
                  } catch { return [] }
                })()
                return bullets.length > 0 ? (
                  <ul className="mb-3 flex flex-col gap-1">
                    {bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="text-primary-400 mt-0.5 flex-shrink-0">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                ) : null
              })()}

              {/* Actieknop */}
              {(() => {
                const actie = (recommendation as {actie_type?: string}).actie_type || 'herstel'
                const config = {
                  trainen: { label: 'Start Training', kleur: 'bg-green-500 active:bg-green-600', route: '/training' },
                  herstel: { label: 'Start Herstel', kleur: 'bg-blue-500 active:bg-blue-600', route: '/training' },
                  rust: { label: 'Rust vandaag', kleur: 'bg-slate-600 active:bg-slate-700', route: null },
                }[actie] || { label: 'Start', kleur: 'bg-primary-500', route: '/training' }
                return config.route ? (
                  <button
                    onClick={() => router.push(config.route!)}
                    className={`w-full py-3 rounded-xl text-sm font-semibold text-white mb-3 ${config.kleur}`}
                  >
                    {config.label}
                  </button>
                ) : (
                  <div className="w-full py-3 rounded-xl text-sm font-semibold text-slate-400 bg-slate-800 text-center mb-3">
                    {config.label} ✓
                  </div>
                )
              })()}

              <button onClick={() => setShowReasoning(!showReasoning)}
                className="flex items-center gap-2 text-sm text-primary-400 mb-4">
                {showReasoning ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Waarom?
              </button>
              {showReasoning && recommendation.reasoning && (
                <div className="bg-slate-800/50 rounded-xl p-4 mb-4">
                  <p className="text-slate-300 text-sm leading-relaxed">{recommendation.reasoning}</p>
                </div>
              )}
            </>
          ) : !hasCheckin ? (
            <p className="text-slate-400 text-sm mb-4">Doe eerst je check-in voor persoonlijk advies.</p>
          ) : (
            <div className="mb-4">
              <Button onClick={generateAdvice} loading={isGenerating} fullWidth>
                {isGenerating ? 'Coach denkt na...' : 'Genereer advies'}
              </Button>
            </div>
          )}

          {/* Dagplan */}
          <div className="border-t border-coach-border pt-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Dagplan</p>
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
              <button onClick={genereerDagplan} disabled={generatingPlan}
                className="w-full py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm active:bg-slate-700 disabled:opacity-50">
                {generatingPlan ? 'Bezig...' : 'Maak dagplan'}
              </button>
            )}
          </div>
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
