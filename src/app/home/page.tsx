'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Sparkles, Bell, Calendar } from 'lucide-react'
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

export default function HomePage() {
  const { profile } = useAuth()
  const { recommendation, checkin, isGenerating, generateAdvice, hasCheckin } = useCoach()
  const [showReasoning, setShowReasoning] = useState(false)

  const greeting = getGreeting(profile?.display_name || profile?.first_name)
  const statusColor: StatusColor = checkin
    ? (checkin.feeling_score || 0) >= 7 && (checkin.energy_score || 0) >= 7 ? 'green'
      : (checkin.feeling_score || 0) >= 4 ? 'orange' : 'red'
    : 'orange'
  const colors = statusColors[statusColor]

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

        {/* Weekoverzicht knop */}
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
