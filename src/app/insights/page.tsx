'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Brain, TrendingUp, AlertTriangle, Star, RefreshCw, Heart, Activity, Moon, Footprints, ArrowLeft } from 'lucide-react'
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

type StrokeColor = string

function getStrokeColor(kleur: string): StrokeColor {
  if (kleur.includes('red'))    return '#f87171'
  if (kleur.includes('blue'))   return '#60a5fa'
  if (kleur.includes('green'))  return '#4ade80'
  if (kleur.includes('purple')) return '#a78bfa'
  return '#818cf8'
}

function GrafiekKaart({
  titel,
  icoon: Icoon,
  kleur,
  data,
  dataKey,
  eenheid,
  leeg,
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

  const chartData = gefilterd.map(d => ({
    datum: formatDatum(d.date),
    waarde: d[dataKey] as number,
  }))

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
          <XAxis
            dataKey="datum"
            tick={{ fontSize: 9, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fontSize: 9, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1c2128', border: '1px solid #2d333b', borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(value: number) => [`${value} ${eenheid}`, titel]}
          />
          <Line
            type="monotone"
            dataKey="waarde"
            stroke={stroke}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}

export default function InsightsPage() {
  const router = useRouter()
  const [insights, setInsights] = useState<MemoryItem[]>([])
  const [metrics, setMetrics] = useState<HealthMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [analysing, setAnalysing] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/memory').then(r => r.json()),
      fetch('/api/health/metrics').then(r => r.json()),
    ]).then(([memoryData, healthData]) => {
      setInsights(memoryData || [])
      setMetrics(healthData.metrics || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const runAnalysis = async () => {
    setAnalysing(true)
    setMessage('')
    try {
      const res = await fetch('/api/memory', { method: 'POST' })
      const data = await res.json()
      setMessage(data.message || 'Analyse klaar')
      const updated = await fetch('/api/memory').then(r => r.json())
      setInsights(updated || [])
    } catch {
      setMessage('Analyse mislukt')
    } finally {
      setAnalysing(false)
    }
  }

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
            onClick={runAnalysis}
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

        {/* Gezondheid grafieken */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Gezondheid — 14 dagen</p>
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 rounded-2xl bg-coach-card animate-pulse" />
              ))}
            </div>
          ) : metrics.length === 0 ? (
            <Card className="p-4 text-center">
              <Heart size={32} className="text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Nog geen health data</p>
              <p className="text-xs text-slate-500 mt-1">Voer de CoachOS Sync opdracht uit</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              <GrafiekKaart
                titel="HRV"
                icoon={Activity}
                kleur="text-purple-400"
                data={metrics}
                dataKey="hrv"
                eenheid="ms"
                leeg="Nog geen HRV data"
              />
              <GrafiekKaart
                titel="Hartslag"
                icoon={Heart}
                kleur="text-red-400"
                data={metrics}
                dataKey="resting_hr"
                eenheid="bpm"
                leeg="Nog geen hartslag data"
              />
              <GrafiekKaart
                titel="Stappen"
                icoon={Footprints}
                kleur="text-green-400"
                data={metrics}
                dataKey="steps"
                eenheid="stappen"
                leeg="Nog geen stappen data"
              />
              <GrafiekKaart
                titel="Slaap"
                icoon={Moon}
                kleur="text-blue-400"
                data={metrics}
                dataKey="sleep_duration"
                eenheid="uur"
                leeg="Nog geen slaap data"
              />
            </div>
          )}
        </div>

        {/* Coach memory */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-1">Coach inzichten</p>
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 rounded-2xl bg-coach-card animate-pulse" />
              ))}
            </div>
          ) : insights.length === 0 ? (
            <Card className="p-6 text-center">
              <Brain size={40} className="text-slate-600 mx-auto mb-3" />
              <p className="text-white font-semibold">Nog geen inzichten</p>
              <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                Doe minimaal 3 check-ins en tik op vernieuwen om je eerste inzichten te genereren.
              </p>
              <Button onClick={runAnalysis} loading={analysing} className="mt-4 mx-auto">
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
