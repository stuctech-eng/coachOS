'use client'
import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, Sparkles, RefreshCw, Activity, Heart, Moon, Footprints, Clock } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'
import { cn } from '@/utils'

interface WeekStats {
  checkins: number
  gem_gevoel: number | null
  gem_energie: number | null
  gem_hrv: number | null
  totaal_stappen: number
  totaal_minuten: number
  totaal_km: number
  activiteiten: number
}

interface WeekData {
  week: { van: string; tot: string }
  stats: WeekStats
}

interface Analyse {
  samenvatting: string
  positief: string
  aandacht: string
  tip: string
}

function formatWeek(van: string, tot: string): string {
  const v = new Date(van)
  const t = new Date(tot)
  return v.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) +
    ' — ' + t.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

function formatDuur(min: number): string {
  if (min < 60) return min + ' min'
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? h + 'u ' + m + 'm' : h + 'u'
}

function ScoreIndicator({ score }: { score: number | null }) {
  if (!score) return <span className="text-slate-500 text-lg font-bold">—</span>
  const kleur = score >= 7 ? 'text-green-400' : score >= 4 ? 'text-orange-400' : 'text-red-400'
  const Icon = score >= 7 ? TrendingUp : score >= 4 ? Minus : TrendingDown
  return (
    <div className="flex items-center gap-1">
      <span className={cn('text-2xl font-bold', kleur)}>{score}</span>
      <Icon size={16} className={kleur} />
    </div>
  )
}

export default function WeeklyPage() {
  const [weekData, setWeekData] = useState<WeekData | null>(null)
  const [analyse, setAnalyse] = useState<Analyse | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyseren, setAnalyseren] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    laadWeekData()
  }, [])

  async function laadWeekData() {
    setLoading(true)
    try {
      const res = await fetch('/api/weekly')
      const data = await res.json()
      if (data.error) setError(data.error)
      else setWeekData(data)
    } catch {
      setError('Laden mislukt')
    } finally {
      setLoading(false)
    }
  }

  async function genereerAnalyse() {
    setAnalyseren(true)
    setError('')
    try {
      const res = await fetch('/api/weekly', { method: 'POST' })
      const data = await res.json()
      if (data.error) setError(data.error)
      else setAnalyse(data.analyse)
    } catch {
      setError('Analyse mislukt')
    } finally {
      setAnalyseren(false)
    }
  }

  const stats = weekData?.stats

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Weekoverzicht</h1>
            {weekData && (
              <p className="text-slate-400 text-sm mt-0.5">
                {formatWeek(weekData.week.van, weekData.week.tot)}
              </p>
            )}
          </div>
          <button
            onClick={laadWeekData}
            className="w-11 h-11 rounded-xl bg-coach-card flex items-center justify-center text-slate-400 active:bg-slate-700"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-coach-card animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* Gevoel & Energie */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Welzijn</p>
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4">
                  <p className="text-xs text-slate-400 mb-2">Gem. gevoel</p>
                  <ScoreIndicator score={stats?.gem_gevoel || null} />
                  <p className="text-xs text-slate-500 mt-1">van 10</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-slate-400 mb-2">Gem. energie</p>
                  <ScoreIndicator score={stats?.gem_energie || null} />
                  <p className="text-xs text-slate-500 mt-1">van 10</p>
                </Card>
              </div>
            </div>

            {/* Gezondheid */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Gezondheid</p>
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity size={14} className="text-purple-400" />
                    <p className="text-xs text-slate-400">Gem. HRV</p>
                  </div>
                  <p className="text-2xl font-bold text-white">{stats?.gem_hrv || '—'}</p>
                  {stats?.gem_hrv && <p className="text-xs text-slate-500 mt-1">ms</p>}
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Footprints size={14} className="text-green-400" />
                    <p className="text-xs text-slate-400">Stappen</p>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {stats?.totaal_stappen ? Math.round(stats.totaal_stappen / 1000) + 'k' : '—'}
                  </p>
                  {stats?.totaal_stappen ? <p className="text-xs text-slate-500 mt-1">totaal</p> : null}
                </Card>
              </div>
            </div>

            {/* Activiteiten */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Training</p>
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-4">
                  <div className="flex items-center gap-1 mb-2">
                    <Heart size={12} className="text-orange-400" />
                    <p className="text-xs text-slate-400">Sessies</p>
                  </div>
                  <p className="text-2xl font-bold text-white">{stats?.activiteiten || 0}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-1 mb-2">
                    <Clock size={12} className="text-blue-400" />
                    <p className="text-xs text-slate-400">Tijd</p>
                  </div>
                  <p className="text-lg font-bold text-white">
                    {stats?.totaal_minuten ? formatDuur(stats.totaal_minuten) : '—'}
                  </p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-1 mb-2">
                    <TrendingUp size={12} className="text-green-400" />
                    <p className="text-xs text-slate-400">Afstand</p>
                  </div>
                  <p className="text-lg font-bold text-white">
                    {stats?.totaal_km ? stats.totaal_km + ' km' : '—'}
                  </p>
                </Card>
              </div>
            </div>

            {/* Check-ins */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-300">Check-ins deze week</p>
                <div className="flex gap-1">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-6 h-6 rounded-md',
                        i < (stats?.checkins || 0) ? 'bg-primary-500' : 'bg-slate-800'
                      )}
                    />
                  ))}
                </div>
              </div>
            </Card>

            {/* AI Analyse */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Coach analyse</p>
              {analyse ? (
                <div className="flex flex-col gap-3">
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={16} className="text-primary-400" />
                      <p className="text-sm font-semibold text-white">Weekoverzicht</p>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed">{analyse.samenvatting}</p>
                  </Card>
                  <Card className="p-4 border border-green-500/20">
                    <p className="text-xs text-green-400 font-semibold mb-2">✅ Wat ging goed</p>
                    <p className="text-slate-300 text-sm leading-relaxed">{analyse.positief}</p>
                  </Card>
                  <Card className="p-4 border border-orange-500/20">
                    <p className="text-xs text-orange-400 font-semibold mb-2">⚠️ Aandacht</p>
                    <p className="text-slate-300 text-sm leading-relaxed">{analyse.aandacht}</p>
                  </Card>
                  <Card className="p-4 border border-primary-500/20">
                    <p className="text-xs text-primary-400 font-semibold mb-2">💡 Tip volgende week</p>
                    <p className="text-slate-300 text-sm leading-relaxed">{analyse.tip}</p>
                  </Card>
                </div>
              ) : (
                <Card className="p-5 text-center">
                  <Sparkles size={32} className="text-slate-600 mx-auto mb-3" />
                  <p className="text-white font-semibold text-sm mb-1">Coach weekanalyse</p>
                  <p className="text-slate-400 text-xs mb-4">Laat de coach je week analyseren en een tip geven voor volgende week.</p>
                  <Button onClick={genereerAnalyse} loading={analyseren} fullWidth>
                    {analyseren ? 'Analyseren...' : 'Analyseer mijn week'}
                  </Button>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
