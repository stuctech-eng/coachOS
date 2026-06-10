'use client'
import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Dumbbell, Clock, Star, Battery, Moon, Trophy, Flame, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { cn } from '@/utils'
import { createBrowserClient } from '@supabase/ssr'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface TrainingResult {
  id: string
  rating: number | null
  actual_duration: number | null
  completed: boolean
  completed_at: string
  notes: string | null
}

interface GarminData {
  body_battery: { current: number | null }
  sleep: { score: number | null }
}

interface DagStatus {
  recovery_score: number | null
}

interface PerformanceData {
  progressie_trend: string
  consistentie: string
  herstel_na_training: string
  niveau_gereed: boolean
  samenvatting: string
}

interface LoadData {
  cardio_load_7d: number
  strength_load_7d: number
  recovery_load_7d: number
  total_load_7d: number
  today_intensity: string
  load_trend: string
  load_trend_pct: number | null
  last_heavy_session_days: number | null
}

interface Prediction {
  titel: string
  voorspelling: string
  kans: number
  actie: string
  type: 'positief' | 'waarschuwing'
}

interface Inzicht {
  content: string
  observation?: string
}

function weekStart(offset = 0): string {
  const d = new Date()
  const dag = d.getDay()
  const maandag = new Date(d)
  maandag.setDate(d.getDate() - ((dag + 6) % 7) + offset * 7)
  maandag.setHours(0, 0, 0, 0)
  return maandag.toISOString()
}

function formatDuur(min: number | null): string {
  if (!min) return '—'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}u ${m}m` : `${h}u`
}

function herstelLabel(score: number | null): string {
  if (!score) return '—'
  if (score >= 75) return 'Uitstekend'
  if (score >= 60) return 'Goed'
  if (score >= 40) return 'Matig'
  return 'Laag'
}

function kleurScore(score: number | null): string {
  if (!score) return 'text-slate-400'
  if (score >= 75) return 'text-green-400'
  if (score >= 60) return 'text-blue-400'
  if (score >= 40) return 'text-amber-400'
  return 'text-red-400'
}

function bbKleur(bb: number | null): string {
  if (!bb) return 'text-slate-400'
  if (bb >= 70) return 'text-green-400'
  if (bb >= 40) return 'text-amber-400'
  return 'text-red-400'
}

function trendKleur(trend: string): string {
  if (trend === 'stijgend') return 'text-green-400'
  if (trend === 'dalend') return 'text-red-400'
  return 'text-slate-400'
}

function berekenStreak(resultaten: TrainingResult[]): number {
  if (resultaten.length === 0) return 0
  const datums = [...new Set(
    resultaten.filter(r => r.completed).map(r => r.completed_at.split('T')[0])
  )].sort().reverse()
  let streak = 0
  let check = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
  for (const datum of datums) {
    if (datum === check) {
      streak++
      const d = new Date(check)
      d.setDate(d.getDate() - 1)
      check = d.toLocaleDateString('en-CA')
    } else break
  }
  return streak
}

function gemRating(resultaten: TrainingResult[]): number | null {
  const metRating = resultaten.filter(r => r.rating)
  if (metRating.length === 0) return null
  return Math.round(metRating.reduce((a, r) => a + (r.rating || 0), 0) / metRating.length * 10) / 10
}

export default function ProgressiePage() {
  const [loading, setLoading] = useState(true)
  const [historischOpen, setHistorischOpen] = useState(false)

  const [garmin, setGarmin] = useState<GarminData | null>(null)
  const [dagStatus, setDagStatus] = useState<DagStatus | null>(null)
  const [weekResultaten, setWeekResultaten] = useState<TrainingResult[]>([])
  const [maandResultaten, setMaandResultaten] = useState<TrainingResult[]>([])
  const [alleResultaten, setAlleResultaten] = useState<TrainingResult[]>([])
  const [weekGrafiek, setWeekGrafiek] = useState<Array<{ week: string; minuten: number }>>([])

  const [performance, setPerformance] = useState<PerformanceData | null>(null)
  const [loadData, setLoadData] = useState<LoadData | null>(null)
  const [inzichten, setInzichten] = useState<Inzicht[] | null>(null)
  const [predictions, setPredictions] = useState<Prediction[] | null>(null)

  const laadData = useCallback(async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
    const vandaag = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    const maandGeleden = new Date()
    maandGeleden.setDate(maandGeleden.getDate() - 30)

    const [garminRes, statusRes, weekRes, maandRes, alleRes, performanceRes, memoryRes, _predictionsRes, loadRes] = await Promise.all([
      supabase.from('garmin_imports').select('parsed_data').eq('status', 'confirmed').order('date', { ascending: false }).limit(1).single(),
      supabase.from('daily_status').select('recovery_score').eq('date', vandaag).single(),
      supabase.from('training_results').select('*').eq('completed', true).gte('completed_at', weekStart(0)).order('completed_at', { ascending: false }),
      supabase.from('training_results').select('*').eq('completed', true).gte('completed_at', maandGeleden.toISOString()).order('completed_at', { ascending: false }),
      supabase.from('training_results').select('*').eq('completed', true).order('completed_at', { ascending: false }),
      fetch('/api/performance', { credentials: 'include' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/memory', { credentials: 'include' }).then(r => r.ok ? r.json() : null).catch(() => null),
      Promise.resolve(null), // predictions laden apart
      fetch('/api/training-load', { credentials: 'include' }).then(r => r.ok ? r.json() : null).catch(() => null),
    ])

    setGarmin(garminRes.data?.parsed_data || null)
    setDagStatus(statusRes.data || null)
    setWeekResultaten(weekRes.data || [])
    setMaandResultaten(maandRes.data || [])
    setAlleResultaten(alleRes.data || [])

    if (performanceRes && !performanceRes.error) setPerformance(performanceRes)
    if (Array.isArray(memoryRes) && memoryRes.length > 0) setInzichten(memoryRes.slice(0, 5))
    if (loadRes && !loadRes.error) setLoadData(loadRes)

    const grafiekData = []
    for (let i = 7; i >= 0; i--) {
      const start = new Date(weekStart(-i))
      const end = new Date(start)
      end.setDate(end.getDate() + 7)
      const weekData = (alleRes.data || []).filter(r => {
        const d = new Date(r.completed_at)
        return d >= start && d < end
      })
      grafiekData.push({
        week: start.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
        minuten: weekData.reduce((a, r) => a + (r.actual_duration || 0), 0),
      })
    }
    setWeekGrafiek(grafiekData)
    setLoading(false)

    // Laad voorspellingen apart zodat pagina niet blokkeert
    try {
      const predRes = await fetch('/api/predictions', { credentials: 'include' })
      const predData = predRes.ok ? await predRes.json() : null
      if (predData?.predictions) {
        setPredictions(predData.predictions)
      } else {
        // Geen cache — genereer op achtergrond
        fetch('/api/predictions', { method: 'POST', credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data?.predictions) setPredictions(data.predictions) })
          .catch(() => {})
      }
    } catch { /* */ }
  }, [])

  useEffect(() => { laadData() }, [laadData])

  const weekGemRating = gemRating(weekResultaten)
  const weekTotaalMin = weekResultaten.reduce((a, r) => a + (r.actual_duration || 0), 0)
  const maandGemRating = gemRating(maandResultaten)
  const maandTotaalMin = maandResultaten.reduce((a, r) => a + (r.actual_duration || 0), 0)
  const streak = berekenStreak(alleResultaten)
  const hoogsteRating = alleResultaten.filter(r => r.rating).length > 0
    ? Math.max(...alleResultaten.filter(r => r.rating).map(r => r.rating || 0))
    : null
  const totaalMinuten = alleResultaten.reduce((a, r) => a + (r.actual_duration || 0), 0)
  const besteWeek = weekGrafiek.reduce((best, w) => w.minuten > best ? w.minuten : best, 0)

  const ratingGrafiek = alleResultaten
    .filter(r => r.rating).slice(-10).reverse()
    .map((r, i) => ({ sessie: `#${i + 1}`, rating: r.rating }))

  if (loading) {
    return (
      <AppShell>
        <div className="px-5 py-6 flex flex-col gap-4">
          <h1 className="text-2xl font-bold text-white">Progressie</h1>
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 rounded-2xl bg-coach-card animate-pulse" />)}
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5 pb-8">
        <h1 className="text-2xl font-bold text-white">Progressie</h1>

        {/* 1. Performance AI */}
        {performance ? (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Performance AI</p>
            <Card className="p-5">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Progressie trend</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {performance.progressie_trend === 'stijgend' && <TrendingUp size={16} className="text-green-400" />}
                    {performance.progressie_trend === 'dalend' && <TrendingDown size={16} className="text-red-400" />}
                    {(performance.progressie_trend === 'stabiel' || performance.progressie_trend === 'onvoldoende_data') && <Minus size={16} className="text-slate-400" />}
                    <p className={cn('text-sm font-semibold capitalize', trendKleur(performance.progressie_trend))}>
                      {performance.progressie_trend.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Consistentie</p>
                  <p className={cn('text-sm font-semibold capitalize mt-1',
                    performance.consistentie === 'hoog' ? 'text-green-400' :
                    performance.consistentie === 'laag' ? 'text-red-400' : 'text-slate-400'
                  )}>{performance.consistentie.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Herstel na training</p>
                  <p className={cn('text-sm font-semibold capitalize mt-1',
                    performance.herstel_na_training === 'goed' ? 'text-green-400' :
                    performance.herstel_na_training === 'slecht' ? 'text-red-400' : 'text-slate-400'
                  )}>{performance.herstel_na_training.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Niveau gereed</p>
                  <p className={cn('text-sm font-semibold mt-1',
                    performance.niveau_gereed ? 'text-green-400' : 'text-slate-400'
                  )}>{performance.niveau_gereed ? 'Ja ✓' : 'Nog niet'}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-coach-border">
                <p className="text-xs text-slate-400 leading-relaxed">{performance.samenvatting}</p>
              </div>
            </Card>
          </div>
        ) : (
          <Card className="p-5 text-center">
            <BarChart2 size={28} className="text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">Performance AI heeft meer trainingen nodig</p>
          </Card>
        )}

        {/* 2. Trainingsbelasting */}
        {loadData && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Trainingsbelasting</p>
            <Card className="p-5">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-400">{loadData.cardio_load_7d}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Cardio</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-orange-400">{loadData.strength_load_7d}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Kracht</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-green-400">{loadData.recovery_load_7d}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Herstel</p>
                </div>
              </div>
              <div className="pt-3 border-t border-coach-border flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">Totaal 7 dagen</p>
                  <p className="text-sm font-bold text-white">{loadData.total_load_7d}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">Trend</p>
                  <div className="flex items-center gap-1">
                    {loadData.load_trend === 'stijgend' && <TrendingUp size={12} className="text-green-400" />}
                    {loadData.load_trend === 'dalend' && <TrendingDown size={12} className="text-red-400" />}
                    {loadData.load_trend === 'stabiel' && <Minus size={12} className="text-slate-400" />}
                    <p className={cn('text-sm font-semibold capitalize', trendKleur(loadData.load_trend))}>
                      {loadData.load_trend}{loadData.load_trend_pct !== null ? ` (${loadData.load_trend_pct > 0 ? '+' : ''}${loadData.load_trend_pct}%)` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">Vandaag</p>
                  <p className={cn('text-sm font-semibold capitalize',
                    loadData.today_intensity === 'hoog' || loadData.today_intensity === 'zeer hoog' ? 'text-orange-400' :
                    loadData.today_intensity === 'gemiddeld' ? 'text-yellow-400' : 'text-green-400'
                  )}>{loadData.today_intensity}</p>
                </div>
                {loadData.last_heavy_session_days !== null && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400">Laatste zware sessie</p>
                    <p className="text-sm text-slate-300">{loadData.last_heavy_session_days}d geleden</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* 3. Coach Inzichten */}
        {inzichten && inzichten.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Coach Inzichten</p>
            <Card className="p-5">
              <div className="flex flex-col gap-3">
                {inzichten.map((ins, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-2 flex-shrink-0" />
                    <p className="text-sm text-slate-300 leading-relaxed">{ins.content || ins.observation}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* 4. Voorspellingen */}
        {predictions && predictions.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Voorspellingen</p>
            <div className="flex flex-col gap-2">
              {predictions.map((p, i) => (
                <div key={i} className={cn(
                  'rounded-xl px-4 py-3 border',
                  p.type === 'positief' ? 'bg-green-500/8 border-green-500/20' : 'bg-orange-500/8 border-orange-500/20'
                )}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {p.type === 'positief'
                        ? <TrendingUp size={14} className="text-green-400" />
                        : <AlertTriangle size={14} className="text-orange-400" />}
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
          </div>
        )}

        {/* 5. Historisch (inklapbaar) */}
        <div>
          <button onClick={() => setHistorischOpen(!historischOpen)} className="w-full">
            <Card className="p-4 active:bg-slate-800/80 transition-colors">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">Historisch</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-xs text-slate-400">{maandResultaten.length} trainingen deze maand</p>
                    {maandGemRating && <p className="text-xs text-slate-400">gem. {maandGemRating}/10</p>}
                    {streak > 0 && <p className="text-xs text-slate-400">streak {streak}d</p>}
                  </div>
                </div>
                {historischOpen
                  ? <ChevronUp size={18} className="text-slate-400 flex-shrink-0" />
                  : <ChevronDown size={18} className="text-slate-400 flex-shrink-0" />
                }
              </div>
            </Card>
          </button>

          {historischOpen && (
            <div className="flex flex-col gap-4 mt-3">

              {/* Vandaag */}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Vandaag</p>
                <Card className="p-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Battery size={12} className={bbKleur(garmin?.body_battery?.current ?? null)} />
                        <p className="text-xs text-slate-400">BB</p>
                      </div>
                      <p className={cn('text-xl font-bold', bbKleur(garmin?.body_battery?.current ?? null))}>
                        {garmin?.body_battery?.current ?? '—'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-1">Herstel</p>
                      <p className={cn('text-sm font-semibold mt-1', kleurScore(dagStatus?.recovery_score ?? null))}>
                        {herstelLabel(dagStatus?.recovery_score ?? null)}
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Moon size={12} className="text-purple-400" />
                        <p className="text-xs text-slate-400">Slaap</p>
                      </div>
                      <p className="text-xl font-bold text-purple-400">
                        {garmin?.sleep?.score ?? '—'}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Week & Maand */}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Deze week</p>
                <Card className="p-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-1">Trainingen</p>
                      <p className="text-2xl font-bold text-white">{weekResultaten.length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-1">Gem. rating</p>
                      <p className="text-2xl font-bold text-primary-400">{weekGemRating ?? '—'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-1">Tijd</p>
                      <p className="text-xl font-bold text-white">{formatDuur(weekTotaalMin)}</p>
                    </div>
                  </div>
                </Card>
              </div>

              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Deze maand</p>
                <Card className="p-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-1">Trainingen</p>
                      <p className="text-2xl font-bold text-white">{maandResultaten.length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-1">Gem. rating</p>
                      <p className="text-2xl font-bold text-primary-400">{maandGemRating ?? '—'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-1">Tijd</p>
                      <p className="text-xl font-bold text-white">{formatDuur(maandTotaalMin)}</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Records */}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Persoonlijke records</p>
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Flame size={14} className="text-orange-400" />
                      <p className="text-xs text-slate-400">Streak</p>
                    </div>
                    <p className="text-2xl font-bold text-orange-400">{streak}</p>
                    <p className="text-xs text-slate-500">dagen actief</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Trophy size={14} className="text-yellow-400" />
                      <p className="text-xs text-slate-400">Beste week</p>
                    </div>
                    <p className="text-2xl font-bold text-yellow-400">{besteWeek}</p>
                    <p className="text-xs text-slate-500">minuten</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Star size={14} className="text-primary-400" />
                      <p className="text-xs text-slate-400">Hoogste rating</p>
                    </div>
                    <p className="text-2xl font-bold text-primary-400">{hoogsteRating ?? '—'}</p>
                    <p className="text-xs text-slate-500">van de 10</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock size={14} className="text-green-400" />
                      <p className="text-xs text-slate-400">Totale tijd</p>
                    </div>
                    <p className="text-xl font-bold text-green-400">{formatDuur(totaalMinuten)}</p>
                    <p className="text-xs text-slate-500">all-time</p>
                  </Card>
                </div>
              </div>

              {/* Grafieken */}
              {weekGrafiek.some(w => w.minuten > 0) && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Trainingstijd per week</p>
                  <Card className="p-4">
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={weekGrafiek} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2d333b" vertical={false} />
                        <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} width={30} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1c2128', border: '1px solid #2d333b', borderRadius: 8, fontSize: 11 }}
                          formatter={(v: number) => [`${v} min`, 'Tijd']}
                        />
                        <Bar dataKey="minuten" fill="#818cf8" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
              )}

              {ratingGrafiek.length >= 3 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Rating trend</p>
                  <Card className="p-4">
                    <ResponsiveContainer width="100%" height={100}>
                      <LineChart data={ratingGrafiek} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2d333b" vertical={false} />
                        <XAxis dataKey="sessie" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 10]} tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} width={20} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1c2128', border: '1px solid #2d333b', borderRadius: 8, fontSize: 11 }}
                          formatter={(v: number) => [`${v}/10`, 'Rating']}
                        />
                        <Line type="monotone" dataKey="rating" stroke="#4ade80" strokeWidth={2} dot={{ r: 3, fill: '#4ade80' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Lege staat */}
        {alleResultaten.length === 0 && !performance && (
          <Card className="p-8 text-center">
            <Dumbbell size={40} className="text-slate-600 mx-auto mb-3" />
            <p className="text-white font-semibold">Nog geen trainingen</p>
            <p className="text-slate-400 text-sm mt-1 leading-relaxed">
              Voltooi je eerste training om hier progressie te zien.
            </p>
          </Card>
        )}

      </div>
    </AppShell>
  )
}
