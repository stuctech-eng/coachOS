'use client'
import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Minus, Dumbbell, Clock, Star, Zap, Battery, Moon, Trophy, Flame, BarChart2 } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { cn } from '@/utils'
import { createBrowserClient } from '@supabase/ssr'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrainingResult {
  id: string
  rating: number | null
  actual_duration: number | null
  completed: boolean
  completed_at: string
  notes: string | null
}

interface GarminData {
  resting_hr: number | null
  body_battery: { current: number | null }
  sleep: { score: number | null; duration_minutes: number | null }
  hrv: { avg_7d_ms: number | null; status: string | null }
}

interface DagStatus {
  coach_score: number | null
  recovery_score: number | null
  status_color: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function herstelKleur(score: number | null): string {
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

function berekenStreak(resultaten: TrainingResult[]): number {
  if (resultaten.length === 0) return 0
  const datums = [...new Set(
    resultaten
      .filter(r => r.completed)
      .map(r => r.completed_at.split('T')[0])
  )].sort().reverse()

  let streak = 0
  const vandaag = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
  let check = vandaag

  for (const datum of datums) {
    if (datum === check) {
      streak++
      const d = new Date(check)
      d.setDate(d.getDate() - 1)
      check = d.toLocaleDateString('en-CA')
    } else {
      break
    }
  }
  return streak
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProgressiePage() {
  const [loading, setLoading] = useState(true)
  const [performance, setPerformance] = useState<{
    progressie_trend: string
    consistentie: string
    herstel_na_training: string
    niveau_gereed: boolean
    gem_rating: number | null
    trainingen_per_week: number | null
    samenvatting: string
  } | null>(null)
  const [garmin, setGarmin] = useState<GarminData | null>(null)
  const [dagStatus, setDagStatus] = useState<DagStatus | null>(null)
  const [weekResultaten, setWeekResultaten] = useState<TrainingResult[]>([])
  const [maandResultaten, setMaandResultaten] = useState<TrainingResult[]>([])
  const [alleResultaten, setAlleResultaten] = useState<TrainingResult[]>([])
  const [weekGrafiek, setWeekGrafiek] = useState<Array<{ week: string; minuten: number; trainingen: number }>>([])

  const laadData = useCallback(async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )

    const vandaag = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
    const maandGeleden = new Date()
    maandGeleden.setDate(maandGeleden.getDate() - 30)

    const [garminRes, statusRes, weekRes, maandRes, alleRes, performanceRes] = await Promise.all([
      supabase.from('garmin_imports').select('parsed_data').eq('status', 'confirmed').order('date', { ascending: false }).limit(1).single(),
      supabase.from('daily_status').select('coach_score, recovery_score, status_color').eq('date', vandaag).single(),
      supabase.from('training_results').select('*').eq('completed', true).gte('completed_at', weekStart(0)).order('completed_at', { ascending: false }),
      supabase.from('training_results').select('*').eq('completed', true).gte('completed_at', maandGeleden.toISOString()).order('completed_at', { ascending: false }),
      supabase.from('training_results').select('*').eq('completed', true).order('completed_at', { ascending: false }),
      supabase.from('coach_recommendations').select('recommendation').eq('type', 'performance_ai').order('created_at', { ascending: false }).limit(1).single(),
    ])

    setGarmin(garminRes.data?.parsed_data || null)
    try {
      const rec = performanceRes.data?.recommendation
      if (rec) setPerformance(JSON.parse(rec))
    } catch { /* */ }
    setDagStatus(statusRes.data || null)
    setWeekResultaten(weekRes.data || [])
    setMaandResultaten(maandRes.data || [])
    setAlleResultaten(alleRes.data || [])

    // Bouw week grafiek (laatste 8 weken)
    const grafiekData = []
    for (let i = 7; i >= 0; i--) {
      const start = new Date(weekStart(-i))
      const end = new Date(start)
      end.setDate(end.getDate() + 7)
      const weekData = (alleRes.data || []).filter(r => {
        const d = new Date(r.completed_at)
        return d >= start && d < end
      })
      const weekLabel = start.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
      grafiekData.push({
        week: weekLabel,
        minuten: weekData.reduce((a, r) => a + (r.actual_duration || 0), 0),
        trainingen: weekData.length,
      })
    }
    setWeekGrafiek(grafiekData)
    setLoading(false)
  }, [])

  useEffect(() => { laadData() }, [laadData])

  // Berekeningen
  const weekGemRating = weekResultaten.filter(r => r.rating).length > 0
    ? Math.round(weekResultaten.filter(r => r.rating).reduce((a, r) => a + (r.rating || 0), 0) / weekResultaten.filter(r => r.rating).length * 10) / 10
    : null

  const weekTotaalMin = weekResultaten.reduce((a, r) => a + (r.actual_duration || 0), 0)

  const maandGemRating = maandResultaten.filter(r => r.rating).length > 0
    ? Math.round(maandResultaten.filter(r => r.rating).reduce((a, r) => a + (r.rating || 0), 0) / maandResultaten.filter(r => r.rating).length * 10) / 10
    : null

  const maandTotaalMin = maandResultaten.reduce((a, r) => a + (r.actual_duration || 0), 0)

  // Records
  const streak = berekenStreak(alleResultaten)
  const hoogsteRating = alleResultaten.filter(r => r.rating).length > 0
    ? Math.max(...alleResultaten.filter(r => r.rating).map(r => r.rating || 0))
    : null
  const totaalMinuten = alleResultaten.reduce((a, r) => a + (r.actual_duration || 0), 0)

  // Beste week
  const besteWeek = weekGrafiek.reduce((best, w) => w.trainingen > best ? w.trainingen : best, 0)

  // Trend (vergelijk deze week met vorige week)
  const vorigeWeekMin = weekGrafiek[weekGrafiek.length - 2]?.minuten || 0
  const dezeWeekMin = weekGrafiek[weekGrafiek.length - 1]?.minuten || weekTotaalMin
  const trend = dezeWeekMin > vorigeWeekMin * 1.1 ? 'stijgend' : dezeWeekMin < vorigeWeekMin * 0.9 ? 'dalend' : 'stabiel'

  // Rating grafiek data
  const ratingGrafiek = alleResultaten
    .filter(r => r.rating)
    .slice(-10)
    .reverse()
    .map((r, i) => ({
      sessie: `#${i + 1}`,
      rating: r.rating,
    }))

  if (loading) {
    return (
      <AppShell>
        <div className="px-5 py-6 flex flex-col gap-4">
          <h1 className="text-2xl font-bold text-white">Progressie</h1>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-coach-card animate-pulse" />
          ))}
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5 pb-8">

        <h1 className="text-2xl font-bold text-white">Progressie</h1>

        {/* ── Vandaag ──────────────────────────────────────────────────── */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Vandaag</p>
          <Card className="p-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Battery size={14} className={bbKleur(garmin?.body_battery?.current ?? null)} />
                  <p className="text-xs text-slate-400">Body Battery</p>
                </div>
                <p className={cn('text-2xl font-bold', bbKleur(garmin?.body_battery?.current ?? null))}>
                  {garmin?.body_battery?.current ?? '—'}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Zap size={14} className={herstelKleur(dagStatus?.recovery_score ?? null)} />
                  <p className="text-xs text-slate-400">Herstel</p>
                </div>
                <p className={cn('text-sm font-semibold mt-1', herstelKleur(dagStatus?.recovery_score ?? null))}>
                  {herstelLabel(dagStatus?.recovery_score ?? null)}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Moon size={14} className="text-purple-400" />
                  <p className="text-xs text-slate-400">Slaap</p>
                </div>
                <p className="text-2xl font-bold text-purple-400">
                  {garmin?.sleep?.score ?? '—'}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Deze week ─────────────────────────────────────────────────── */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Deze week</p>
          <Card className="p-5">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">Trainingen</p>
                <p className="text-3xl font-bold text-white">{weekResultaten.length}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Gem. rating</p>
                <p className="text-3xl font-bold text-primary-400">{weekGemRating ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Totale tijd</p>
                <p className="text-2xl font-bold text-white">{formatDuur(weekTotaalMin)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Trend</p>
                <div className="flex items-center gap-1.5 mt-1">
                  {trend === 'stijgend' && <TrendingUp size={18} className="text-green-400" />}
                  {trend === 'dalend' && <TrendingDown size={18} className="text-red-400" />}
                  {trend === 'stabiel' && <Minus size={18} className="text-slate-400" />}
                  <p className={cn('text-sm font-semibold capitalize',
                    trend === 'stijgend' ? 'text-green-400' :
                    trend === 'dalend' ? 'text-red-400' : 'text-slate-400'
                  )}>{trend}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Deze maand ────────────────────────────────────────────────── */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Deze maand</p>
          <Card className="p-5">
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
                <p className="text-xs text-slate-400 mb-1">Totale tijd</p>
                <p className="text-xl font-bold text-white">{formatDuur(maandTotaalMin)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Persoonlijke records ──────────────────────────────────────── */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Persoonlijke records</p>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Flame size={16} className="text-orange-400" />
                <p className="text-xs text-slate-400">Huidige streak</p>
              </div>
              <p className="text-3xl font-bold text-orange-400">{streak}</p>
              <p className="text-xs text-slate-500 mt-0.5">dagen actief</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={16} className="text-yellow-400" />
                <p className="text-xs text-slate-400">Beste week</p>
              </div>
              <p className="text-3xl font-bold text-yellow-400">{besteWeek}</p>
              <p className="text-xs text-slate-500 mt-0.5">trainingen</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star size={16} className="text-primary-400" />
                <p className="text-xs text-slate-400">Hoogste rating</p>
              </div>
              <p className="text-3xl font-bold text-primary-400">{hoogsteRating ?? '—'}</p>
              <p className="text-xs text-slate-500 mt-0.5">van de 10</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-green-400" />
                <p className="text-xs text-slate-400">Totale tijd</p>
              </div>
              <p className="text-2xl font-bold text-green-400">{formatDuur(totaalMinuten)}</p>
              <p className="text-xs text-slate-500 mt-0.5">all-time</p>
            </Card>
          </div>
        </div>

        {/* ── Trainingstijd per week ────────────────────────────────────── */}
        {weekGrafiek.some(w => w.minuten > 0) && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Trainingstijd per week</p>
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

        {/* ── Rating trend ──────────────────────────────────────────────── */}
        {ratingGrafiek.length >= 3 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Rating trend</p>
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

        {/* ── Performance AI ──────────────────────────────────────── */}
        {performance && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Performance AI</p>
            <Card className="p-5">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Progressie trend</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {performance.progressie_trend === 'stijgend' && <TrendingUp size={16} className="text-green-400" />}
                    {performance.progressie_trend === 'dalend' && <TrendingDown size={16} className="text-red-400" />}
                    {performance.progressie_trend === 'stabiel' && <Minus size={16} className="text-slate-400" />}
                    {performance.progressie_trend === 'onvoldoende_data' && <Minus size={16} className="text-slate-500" />}
                    <p className={cn('text-sm font-semibold capitalize',
                      performance.progressie_trend === 'stijgend' ? 'text-green-400' :
                      performance.progressie_trend === 'dalend' ? 'text-red-400' : 'text-slate-400'
                    )}>{performance.progressie_trend.replace('_', ' ')}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Consistentie</p>
                  <p className={cn('text-sm font-semibold capitalize mt-1',
                    performance.consistentie === 'hoog' ? 'text-green-400' :
                    performance.consistentie === 'laag' ? 'text-red-400' : 'text-slate-400'
                  )}>{performance.consistentie.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Herstel na training</p>
                  <p className={cn('text-sm font-semibold capitalize mt-1',
                    performance.herstel_na_training === 'goed' ? 'text-green-400' :
                    performance.herstel_na_training === 'slecht' ? 'text-red-400' : 'text-slate-400'
                  )}>{performance.herstel_na_training.replace('_', ' ')}</p>
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
        )}

        {/* Lege staat */}
        {alleResultaten.length === 0 && (
          <Card className="p-8 text-center">
            <Dumbbell size={40} className="text-slate-600 mx-auto mb-3" />
            <p className="text-white font-semibold">Nog geen trainingen</p>
            <p className="text-slate-400 text-sm mt-1 leading-relaxed">
              Voltooi je eerste kettlebell training om hier progressie te zien.
            </p>
          </Card>
        )}

      </div>
    </AppShell>
  )
}
