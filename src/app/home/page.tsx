'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Sparkles, Bell, Calendar, RefreshCw, MessageCircle, AlertTriangle, Clock, ChevronRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCoach } from '@/hooks/useCoach'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'
import { getGreeting, formatDate } from '@/utils'
import { cn } from '@/utils'

interface CoachStatus {
  coach_score: number | null
  recovery_score: number | null
  training_score: number | null
  lifestyle_score: number | null
  risk_flags: string[]
  status_color: string
  date: string
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

function getRisicoKleur(urgentie: string): string {
  if (urgentie === 'hoog') return 'bg-red-500/10 border-red-500/30 text-red-400'
  if (urgentie === 'gemiddeld') return 'bg-orange-500/10 border-orange-500/30 text-orange-400'
  return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
}

export default function HomePage() {
  const { profile } = useAuth()
  const { recommendation, checkin, isGenerating, generateAdvice, hasCheckin } = useCoach()
  const [showReasoning, setShowReasoning] = useState(false)
  const [coachStatus, setCoachStatus] = useState<CoachStatus | null>(null)
  const [berekenend, setBerekenend] = useState(false)
  const [laden, setLaden] = useState(true)
  const [actionPlan, setActionPlan] = useState<Array<{tijd: string; actie: string}> | null>(null)
  const [generatingPlan, setGeneratingPlan] = useState(false)

  const greeting = getGreeting(profile?.display_name || profile?.first_name)

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    fetch('/api/status')
      .then(r => r.json())
      .then(data => {
        if (data && data.coach_score !== null && data.date === today) {
          setCoachStatus(data)
          setLaden(false)
        } else {
          setLaden(false)
          setBerekenend(true)
          fetch('/api/status', { method: 'POST' })
            .then(r => r.json())
            .then(nieuw => setCoachStatus(nieuw))
            .catch(() => {})
            .finally(() => setBerekenend(false))

          // Laad ook action plan
          fetch('/api/action-plan')
            .then(r => r.json())
            .then(d => { if (d.plan) setActionPlan(d.plan) })
            .catch(() => {})
        }
      })
      .catch(() => setLaden(false))
  }, [])

  const genereerDagplan = async () => {
    setGeneratingPlan(true)
    try {
      const res = await fetch('/api/action-plan', { method: 'POST' })
      const data = await res.json()
      if (data.plan) setActionPlan(data.plan)
    } catch {
      //
    } finally {
      setGeneratingPlan(false)
    }
  }

  const berekenCoachScore = async () => {
    setBerekenend(true)
    try {
      const res = await fetch('/api/status', { method: 'POST' })
      const data = await res.json()
      setCoachStatus(data)
    } catch {
      //
    } finally {
      setBerekenend(false)
    }
  }

  const score = coachStatus?.coach_score ?? null
  const heeftRisicos = coachStatus?.risk_flags && coachStatus.risk_flags.length > 0

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

        {/* Daily Briefing — Coach Score */}
        <Card className={cn('p-5', getScoreBg(score))}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Coach Score</p>
                {coachStatus && (
                  <div className={`w-2 h-2 rounded-full ${coachStatus.date === new Date().toISOString().split('T')[0] ? 'bg-green-400' : 'bg-red-400'}`} />
                )}
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
            <button
              onClick={berekenCoachScore}
              disabled={berekenend}
              className="w-9 h-9 rounded-xl bg-slate-800/50 flex items-center justify-center active:bg-slate-700 disabled:opacity-50"
            >
              <RefreshCw size={16} className={cn('text-slate-400', berekenend && 'animate-spin')} />
            </button>
          </div>

          {/* Sub scores */}
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
          <div className={cn('rounded-xl px-4 py-3 border flex items-start gap-3', getRisicoKleur('gemiddeld'))}>
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
              <button
                onClick={() => setShowReasoning(!showReasoning)}
                className="flex items-center gap-2 text-sm text-primary-400"
              >
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
            <div className="flex gap-4">
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-white">{checkin.feeling_score}</p>
                <p className="text-xs text-slate-400 mt-0.5">Gevoel</p>
              </div>
              <div className="w-px bg-coach-border" />
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-white">{checkin.energy_score}</p>
                <p className="text-xs text-slate-400 mt-0.5">Energie</p>
              </div>
              <div className="w-px bg-coach-border" />
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-white">{checkin.has_pain ? 'ja' : 'nee'}</p>
                <p className="text-xs text-slate-400 mt-0.5">Pijn</p>
              </div>
            </div>
          </Card>
        )}

        {/* Daily Action Plan */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-primary-400">
              <Clock size={18} />
              <span className="text-sm font-medium">Dagplan</span>
            </div>
            <button
              onClick={genereerDagplan}
              disabled={generatingPlan}
              className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center active:bg-slate-700 disabled:opacity-50"
            >
              <RefreshCw size={14} className={cn('text-slate-400', generatingPlan && 'animate-spin')} />
            </button>
          </div>
          {generatingPlan ? (
            <div className="flex flex-col gap-2">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-800 rounded-xl animate-pulse" />)}
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
              <button
                onClick={genereerDagplan}
                disabled={generatingPlan}
                className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm active:bg-primary-700 disabled:opacity-50"
              >
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
