'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCoach } from '@/hooks/useCoach'
import { AppShell } from '@/components/layout/AppShell'
import { RecoveryStatus } from '@/components/coach/RecoveryStatus'
import { DailyAdvice } from '@/components/coach/DailyAdvice'
import { Card } from '@/components/ui'
import { getGreeting, formatDate, getStatusLabel } from '@/utils'

export default function HomePage() {
  const { profile } = useAuth()
  const { recommendation, checkin, status, isGenerating, generateAdvice, hasCheckin } = useCoach()

  const today = new Date()
  const greeting = getGreeting(profile?.display_name || profile?.first_name)

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-slate-400 text-sm capitalize">{formatDate(today)}</p>
            <h1 className="text-2xl font-bold text-white mt-0.5">{greeting}</h1>
          </div>
          <button className="w-11 h-11 rounded-xl bg-coach-card flex items-center justify-center text-slate-400 active:bg-slate-700 transition-colors">
            <Bell size={20} />
          </button>
        </div>

        {/* Recovery Status */}
        <RecoveryStatus
          color={status?.status_color || null}
          score={status?.recovery_score || null}
          label={getStatusLabel(status?.status_color || null)}
        />

        {/* Energy bar */}
        {status?.energy_score && (
          <Card className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-slate-400">Energie</span>
            <div className="flex items-center gap-3">
              <div className="w-32 h-2 bg-coach-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-500"
                  style={{ width: `${status.energy_score}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-white w-8 text-right">{status.energy_score}</span>
            </div>
          </Card>
        )}

        {/* Daily Advice */}
        <DailyAdvice
          recommendation={recommendation}
          isGenerating={isGenerating}
          onGenerate={generateAdvice}
          hasCheckin={hasCheckin}
        />

        {/* Check-in CTA */}
        {!hasCheckin && (
          <Link href="/checkin">
            <Card className="px-5 py-4 border border-primary-500/30 bg-primary-500/5 active:bg-primary-500/10 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold text-sm">Ochtend check-in</p>
                  <p className="text-slate-400 text-xs mt-0.5">Hoe voel je je vandaag?</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
                  <span className="text-primary-400 text-lg">→</span>
                </div>
              </div>
            </Card>
          </Link>
        )}

        {/* Check-in summary */}
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
                <p className="text-2xl font-bold text-white">{checkin.has_pain ? '⚠️' : '✓'}</p>
                <p className="text-xs text-slate-400 mt-0.5">Klachten</p>
              </div>
            </div>
          </Card>
        )}

      </div>
    </AppShell>
  )
}
