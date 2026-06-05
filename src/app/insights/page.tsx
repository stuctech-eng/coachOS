'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, Star, RefreshCw, Heart, Activity, Moon, Footprints, ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'
import { cn } from '@/utils'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface MemoryItem {
  id: string
  memory_type: string
  content: string
  confidence: number | null
  created_at: string
}

interface HealthMetric {
  date: string
  resting_hr: number | null
  hrv: number | null
  steps: number | null
  sleep_duration: number | null
  weight: number | null
  calories_burned: number | null
}

interface TrendItem {
  gemiddelde: number
  laatste: number
  richting: 'stijgend' | 'dalend' | 'stabiel' | 'onvoldoende data'
  beschrijving: string
  aantalDagen: number
}

interface Trends {
  hrv: TrendItem | null
  resting_hr: TrendItem | null
  slaap: TrendItem | null
  stappen: TrendItem | null
  coach_score: TrendItem | null
  samenvatting: string[]
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pattern: { icon: TrendingUp, color: 'text-primary-400', label: 'Patroon' },
  warning: { icon: AlertTriangle, color: 'text-coach-orange', label: 'Aandachtspunt' },
  achievement: { icon: Star, color: 'text-coach-green', label: 'Prestatie' },
  preference: { icon: Brain, color: 'text-purple-400', label: 'Voorkeur' },
}

function formatDatum(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

function getStrokeColor(kleur: string): string {
  if (kleur.includes('red'))    return '#f87171'
  if (kleur.includes('blue'))   return '#60a5fa'
  if (kleur.includes('green'))  return '#4ade80'
  if (kleur.includes('purple')) return '#a78bfa'
  return '#818cf8'
}

function GrafiekKaart({
  titel, icoon: Icoon, kleur, data, dataKey, eenheid, leeg,
}: {
  titel: string
  icoon: React.ElementType
  kleur: string
  data: HealthMetric[]
  dataKey: keyof HealthMetric
  eenheid: string
  leeg: string
}) {
  const gefilterd = data.filter(d => d[dataKey] !== null && d[dataKey] !== undefined)

  if (gefilterd.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icoon size={16} className={kleur} />
          <p className="text-sm font-semibold text-white">{titel}</p>
        </div>
        <p className="text-xs text-slate-500">{leeg}</p>
      </Card>
    )
  }

  const chartData = gefilterd.map(d => ({ datum: formatDatum(d.date), waarde: d[dataKey] as number }))
  const waarden = chartData.map(d => d.waarde)
  const gemiddeld = Math.round(waarden.reduce((a, b) => a + b, 0) / waarden.length * 10) / 10
  const laatste = waarden[waarden.length - 1]
  const stroke = getStrokeColor(kleur)

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icoon size={16} className={kleur} />
          <p className="text-sm font-semibold text-white">{titel}</p>
        </div>
        <p className={cn('text-lg font-bold', kleur)}>
          {laatste} <span className="text-xs font-normal text-slate-400">{eenheid}</span>
        </p>
      </div>
      <p className="text-xs text-slate-500 mb-3">gemiddeld {gemiddeld} {eenheid}</p>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2d333b" vertical={false} />
          <XAxis dataKey="datum" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} width={30} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1c2128', border: '1px solid #2d333b', borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(value: number) => [`${value} ${eenheid}`, titel]}
          />
          <Line type="monotone" dataKey="waarde" stroke={stroke} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}

export default function InsightsPage() {
  const router = useRouter()
  const [insights, setInsights] = useState<MemoryItem[]>([])
  const [metrics, setMetrics] = useState<HealthMetric[]>([])
  const [trends, setTrends] = useState<Trends | null>(null)
  const [loading, setLoading] = useState(true)
  const [analysing, setAnalysing] = useState(false)
  const [message, setMessage] = useState('')

  const laadInsights = useCallback(async () => {
    const data = await fetch('/api/memory').then(r => r.json())
    const lijst: MemoryItem[] = data || []
    setInsights(lijst)
    return lijst
  }, [])

  const runAnalysis = useCallback(async (silent = false) => {
    if (!silent) setAnalysing(true)
    setMessage('')
    try {
      await fetch('/api/memory', { method: 'POST' })
      // Altijd opnieuw laden na analyse — ook als er geen nieuwe zijn
      await laadInsights()
      if (!silent) setMessage('Analyse klaar')
    } catch {
      if (!silent) setMessage('Analyse mislukt')
    } finally {
      if (!silent) setAnalysing(false)
    }
  }, [laadInsights])

  useEffect(() => {
    Promise.all([
      laadInsights(),
      fetch('/api/health/metrics').then(r => r.json()),
      fetch('/api/trends').then(r => r.json()),
    ]).then(([insightsData, healthData, trendsData]) => {
      setMetrics(healthData.metrics || [])
      setTrends(trendsData)
      setLoading(false)

      // Stil analyseren als laatste analyse niet van vandaag is
      const vandaag = new Date().toISOString().split('T')[0]
      const laatsteAnalyse = insightsData[0]?.created_at?.split('T')[0]
      if (laatsteAnalyse !== vandaag) {
        runAnalysis(true)
      }
    }).catch(() => setLoading(false))
  }, [laadInsights, runAnalysis])

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-5">

        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/settings')} className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center active:bg-slate-700">
            <ArrowLeft size={20} className="text-slate-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Inzichten</h1>
            <p className="text-slate-400 text-xs">Gezondheid & coach analyse</p>
          </div>
          <button
            onClick={() => runAnalysis(false)}
            disabled={analysing}
            className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center text-slate-400 active:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw size={18} className={cn(analysing && 'animate-spin')} />
          </button>
        </div>

        {message && (
          <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-3">
            <p className="text-primary-400 text-sm">{message}</p>
          </div>
        )}

        {trends && trends.samenvatting && trends.samenvatting.length > 0 && (
          <div className="flex flex-col gap-2">
            {trends.samenvatting.map((s, i) => (
              <div key={i} className="flex items-start gap-3 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3">
                <AlertTriangle size={16} className="text-orange-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-orange-300">{s}</p>
              </div>
            ))}
          </div>
        )}

        {trends && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Trends</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'HRV', trend: trends.hrv },
                { label: 'Hartslag', trend: trends.resting_hr },
                { label: 'Slaap', trend: trends.slaap },
                { label: 'Coach Score', trend: trends.coach_score },
              ].map(({ label, trend }) => (
                trend && (
                  <Card key={label} className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-slate-400">{label}</p>
                      {trend.richting === 'stijgend' && <TrendingUp size={14} className="text-green-400" />}
                      {trend.richting === 'dalend' && <TrendingDown size={14} className="text-red-400" />}
                      {trend.richting === 'stabiel' && <Minus size={14} className="text-slate-400" />}
                    </div>
                    <p className={cn('text-lg font-bold',
                      trend.richting === 'stijgend' ? 'text-green-400' :
                      trend.richting === 'dalend' ? 'text-red-400' : 'text-slate-300'
                    )}>{trend.laatste}</p>
                    <p className="text-xs text-slate-500 mt-0.5">gem. {trend.gemiddelde} · {trend.aantalDagen}d</p>
                  </Card>
                )
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Gezondheid — 14 dagen</p>
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-32 rounded-2xl bg-coach-card animate-pulse" />)}
            </div>
          ) : metrics.length === 0 ? (
            <Card className="p-4 text-center">
              <Heart size={32} className="text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Nog geen health data</p>
              <p className="text-xs text-slate-500 mt-1">Voer de CoachOS Sync opdracht uit</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              <GrafiekKaart titel="HRV" icoon={Activity} kleur="text-purple-400" data={metrics} dataKey="hrv" eenheid="ms" leeg="Nog geen HRV data" />
              <GrafiekKaart titel="Hartslag" icoon={Heart} kleur="text-red-400" data={metrics} dataKey="resting_hr" eenheid="bpm" leeg="Nog geen hartslag data" />
              <GrafiekKaart titel="Stappen" icoon={Footprints} kleur="text-green-400" data={metrics} dataKey="steps" eenheid="stappen" leeg="Nog geen stappen data" />
              <GrafiekKaart titel="Slaap" icoon={Moon} kleur="text-blue-400" data={metrics} dataKey="sleep_duration" eenheid="uur" leeg="Nog geen slaap data" />
            </div>
          )}
        </div>

        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Coach inzichten</p>
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-coach-card animate-pulse" />)}
            </div>
          ) : insights.length === 0 ? (
            <Card className="p-6 text-center">
              <Brain size={40} className="text-slate-600 mx-auto mb-3" />
              <p className="text-white font-semibold">Nog geen inzichten</p>
              <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                Doe minimaal 3 check-ins en tik op vernieuwen om je eerste inzichten te genereren.
              </p>
              <Button onClick={() => runAnalysis(false)} loading={analysing} className="mt-4 mx-auto">
                Analyseer nu
              </Button>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {insights.map(insight => {
                const config = typeConfig[insight.memory_type] || typeConfig.pattern
                const Icon = config.icon
                return (
                  <Card key={insight.id} className="p-4">
                    <div className="flex gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <Icon size={18} className={config.color} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn('text-xs font-semibold', config.color)}>{config.label}</span>
                          {insight.confidence && (
                            <span className="text-xs text-slate-500">{insight.confidence}% zekerheid</span>
                          )}
                        </div>
                        <p className="text-slate-200 text-sm leading-relaxed">{insight.content}</p>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </AppShell>
  )
}
