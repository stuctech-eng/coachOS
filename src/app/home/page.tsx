'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Sparkles, Bell, Calendar, RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCoach } from '@/hooks/useCoach'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'
import { getGreeting, formatDate, getStatusLabel } from '@/utils'
import { cn } from '@/utils'
import { StatusColor } from '@/types'

const statusColors: Record<StatusColor, { dot: string; text: string; bg: string }> = {
  green: { dot: 'bg-coach-green', text: 'text-coach-green', bg: 'bg-coach-green/10' },
  orange: { dot: 'bg-coach-orange', text: 'text-coach-orange', bg: 'bg-coach-orange/10' },
  red: { dot: 'bg-coach-red', text: 'text-coach-red', bg: 'bg-coach-red/10' },
}

interface CoachStatus {
  coach_score: number | null
  recovery_score: number | null
  training_score: number | null
  lifestyle_score: number | null
  risk_flags: string[]
  status_color: string
}

export default function HomePage() {
  const { profile } = useAuth()
  const { recommendation, checkin, isGenerating, generateAdvice, hasCheckin } = useCoach()
  const [showReasoning, setShowReasoning] = useState(false)
  const [coachStatus, setCoachStatus] = useState<CoachStatus | null>(null)
  const [berekenend, setBerekenend] = useState(false)
  const [laden, setLaden] = useState(true)

  const greeting = getGreeting(profile?.display_name || profile?.first_name)
  const statusColor: StatusColor = checkin
    ? (checkin.feeling_score || 0) >= 7 && (checkin.energy_score || 0) >= 7 ? 'green'
      : (checkin.feeling_score || 0) >= 4 ? 'orange' : 'red'
    : 'orange'
  const colors = statusColors[statusColor]

  // Laad bestaande score bij openen — herbereken automatisch als ontbreekt
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
        }
      })
      .catch(() => setLaden(false))
  }, [])

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

  const scoreKleur = (score: number | null) => {
    if (!score) return 'text-slate-400'
    if (score >= 75) return 'text-green-400'
    if (score >= 50) return 'text-orange-400'
    return 'text-red-400'
  }

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-slate-400 text-sm capitalize">{formatDate(new Date())}</p>
            <h1 className="text-2xl font-bold text-white mt-0.5">{greeting}</h1>
          </div>
          <button className="w-11 h-11 rounded-xl bg-coach-card flex items-center justify-center text-slate-400">
            <Bell size={20} />
          </button>
        </div>

        <div className={cn('flex items-center gap-3 rounded-xl px-4 py-3', colors.bg)}>
          <div className={cn('w-3 h-3 rounded-full flex-shrink-0 animate-pulse-slow', colors.dot)} />
          <p className={cn('text-sm font-semibold flex-1', colors.text)}>{getStatusLabel(statusColor)}</p>
        </div>

        {/* Coach Score */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">Coach Score</p>
            <button
              onClick={berekenCoachScore}
              disabled={berekenend}
              className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center active:bg-slate-700 disabled:opacity-50"
            >
              <RefreshCw size={14} className={cn('text-slate-400', berekenend && 'animate-spin')} />
            </button>
          </div>

          {laden ? (
            <div className="h-16 bg-slate-800 rounded-xl animate-pulse" />
          ) : coachStatus ? (
            <>
              <div className="flex items-end gap-2 mb-3">
                <p className={cn('text-5xl font-bold', scoreKleur(coachStatus.coach_score))}>
                  {coachStatus.coach_score ?? '—'}
                </p>
                <p className="text-slate-500 text-sm mb-1">/100</p>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-slate-800 rounded-xl p-2 text-center">
                  <p className="text-xs text-slate-500">Herstel</p>
                  <p className={cn('text-lg font-bold', scoreKleur(coachStatus.recovery_score))}>
                    {coachStatus.recovery_score ?? '—'}
                  </p>
                </div>
                <div className="bg-slate-800 rounded-xl p-2 text-center">
                  <p className="text-xs text-slate-500">Training</p>
                  <p className={cn('text-lg font-bold', scoreKleur(coachStatus.training_score))}>
                    {coachStatus.training_score ?? '—'}
                  </p>
                </div>
                <div className="bg-slate-800 rounded-xl p-2 text-center">
                  <p className="text-xs text-slate-500">Leefstijl</p>
                  <p className={cn('text-lg font-bold', scoreKleur(coachStatus.lifestyle_score))}>
                    {coachStatus.lifestyle_score ?? '—'}
                  </p>
                </div>
              </div>
              {coachStatus.risk_flags && coachStatus.risk_flags.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  <p className="text-xs text-red-400 font-semibold mb-1">⚠️ Risico&apos;s</p>
                  {coachStatus.risk_flags.map((flag, i) => (
                    <p key={i} className="text-xs text-red-300">• {flag}</p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-3">
              <p className="text-slate-400 text-sm mb-3">Bereken je dagelijkse Coach Score</p>
              <Button onClick={berekenCoachScore} loading={berekenend} fullWidth>
                {berekenend ? 'Berekenen...' : 'Bereken Coach Score'}
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-primary-400">
              <Sparkles size={18} />
              <span className="text-sm font-medium">{recommendation ? 'Advies voor vandaag' : 'Coaching advies'}</span>
            </div>
            {recommendation ? (
              <>
                <p className="text-xl font-semibold text-white leading-snug">{recommendation.recommendation}</p>
                <button onClick={() => setShowReasoning(!showReasoning)} className="flex items-center gap-2 text-sm text-primary-400 self-start">
                  {showReasoning ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  Waarom?
                </button>
                {showReasoning && recommendation.reasoning && (
                  <div className="bg-slate-800/50 rounded-xl p-4 animate-fade-in">
                    <p className="text-slate-300 text-sm leading-relaxed">{recommendation.reasoning}</p>
                  </div>
                )}
              </>
            ) : !hasCheckin ? (
              <p className="text-slate-300 text-sm">Doe eerst je ochtend check-in voor een persoonlijk advies.</p>
            ) : (
              <Button onClick={generateAdvice} loading={isGenerating} fullWidth>
                {isGenerating ? 'Coach denkt na...' : 'Genereer advies'}
              </Button>
            )}
          </div>
        </Card>

        {!hasCheckin && (
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
        )}

        {hasCheckin && checkin && (
          <Card className="px-4 py-3">
            <p className="text-xs text-slate-500 mb-3">Vandaag ingevuld</p>
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

        {/* Weekoverzicht */}
        <Link href="/weekly">
          <Card className="px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary-500/20 flex items-center justify-center">
                  <Calendar size={18} className="text-primary-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Weekoverzicht</p>
                  <p className="text-slate-400 text-xs mt-0.5">Hoe was je week?</p>
                </div>
              </div>
              <ChevronDown size={16} className="text-slate-600 -rotate-90" />
            </div>
          </Card>
        </Link>

      </div>
    </AppShell>
  )
}
