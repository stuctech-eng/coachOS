'use client'
import { useEffect, useState, useCallback } from 'react'
import { Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, Star, RefreshCw, Activity, Moon, Footprints, ArrowLeft, Heart, Zap, Battery, ChevronDown } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'
import { cn } from '@/utils'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

interface MemoryItem {
  id: string
  memory_type: string
  content: string
  confidence: number | null
  created_at: string
}

interface GarminImport {
  date: string
  parsed_data: {
    resting_hr: number | null
    body_battery: { current: number | null; charged: number | null; spent: number | null }
    sleep: { score: number | null; duration_minutes: number | null }
    hrv: { avg_7d_ms: number | null; status: string | null }
    stress: number | null
    breathing: { current_brpm: number | null; avg_awake_brpm: number | null; avg_sleep_brpm: number | null }
  }
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

// Sectie header — duidelijker, meer aanwezig
function SectieHeader({
  titel, open, onToggle, badge, badgeKleur = 'bg-slate-700 text-slate-300',
}: {
  titel: string
  open: boolean
  onToggle: () => void
  badge?: number
  badgeKleur?: string
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex items-center justify-between w-full px-4 py-3.5 rounded-2xl transition-colors',
        open ? 'bg-white/8' : 'bg-white/5 hover:bg-white/7'
      )}
    >
      <div className="flex items-center gap-3">
        <ChevronDown
          size={16}
          className={cn('text-slate-400 transition-transform duration-200 flex-shrink-0', open && 'rotate-180')}
        />
        <span className="text-sm font-semibold text-white tracking-tight">{titel}</span>
        {badge !== undefined && badge > 0 && (
          <span className={cn('text-xs rounded-full px-2 py-0.5 font-medium tabular-nums', badgeKleur)}>
            {badge}
          </span>
        )}
      </div>
    </button>
  )
}

function GarminGrafiek({
  titel, icoon: Icoon, kleur, data, eenheid, leeg,
}: {
  titel: string
  icoon: React.ElementType
  kleur: string
  data: Array<{ datum: string; waarde: number | null }>
  eenheid: string
  leeg: string
}) {
  const gefilterd = data.filter(d => d.waarde !== null && d.waarde !== undefined) as Array<{ datum: string; waarde: number }>

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

  const waarden = gefilterd.map(d => d.waarde)
  const gemiddeld = Math.round(waarden.reduce((a, b) => a + b, 0) / waarden.length * 10) / 10
  const laatste = waarden[waarden.length - 1]

  const strokeColors: Record<string, string> = {
    'text-purple-400': '#a78bfa',
    'text-red-400': '#f87171',
    'text-blue-400': '#60a5fa',
    'text-green-400': '#4ade80',
    'text-orange-400': '#fb923c',
  }
  const stroke = strokeColors[kleur] || '#818cf8'

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icoon size={16} className={kleur} />
          <p className="text-sm font-semibold text-white">{titel}</p>
        </div>
        <p className={cn('text-lg font-bold', kleur)}>
          {laatste}<span className="text-xs font-normal text-slate-400 ml-1">{eenheid}</span>
        </p>
      </div>
      <p className="text-xs text-slate-500 mb-3">gem. {gemiddeld} {eenheid} · {gefilterd.length} dagen</p>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={gefilterd} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
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
  const [insights, setInsights] = useState<MemoryItem[]>([])
  const [garminData, setGarminData] = useState<GarminImport[]>([])
  const [trends, setTrends] = useState<Trends | null>(null)
  const [loading, setLoading] = useState(true)
  const [analysing, setAnalysing] = useState(false)
  const [message, setMessage] = useState('')

  const [garminOpen, setGarminOpen] = useState(false)
  const [inzichtenOpen, setInzichtenOpen] = useState(false)
  const [trendsOpen, setTrendsOpen] = useState(false)

  const laadInsights = useCallback(async () => {
    const data = await fetch('/api/memory').then(r => r.json())
    const lijst: MemoryItem[] = data || []
    setInsights(lijst)
    return lijst
  }, [])

  const laadGarminData = useCallback(async () => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      )
      const veertienDagenGeleden = new Date()
      veertienDagenGeleden.setDate(veertienDagenGeleden.getDate() - 14)
      const vanDatum = veertienDagenGeleden.toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
      const { data } = await supabase
        .from('garmin_imports')
        .select('date, parsed_data')
        .eq('status', 'confirmed')
        .gte('date', vanDatum)
        .order('date', { ascending: true })
      setGarminData(data || [])
    } catch {
      setGarminData([])
    }
  }, [])

  const runAnalysis = useCallback(async (silent = false) => {
    if (!silent) setAnalysing(true)
    setMessage('')
    try {
      await fetch('/api/memory', { method: 'POST' })
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
      laadGarminData(),
      fetch('/api/trends').then(r => r.json()),
    ]).then(([insightsData, , trendsData]) => {
      setTrends(trendsData)
      setLoading(false)
      const vandaag = new Date().toISOString().split('T')[0]
      const laatsteAnalyse = insightsData[0]?.created_at?.split('T')[0]
      if (laatsteAnalyse !== vandaag) runAnalysis(true)
    }).catch(() => setLoading(false))
  }, [laadInsights, laadGarminData, runAnalysis])

  const hartslag = garminData.map(g => ({ datum: formatDatum(g.date), waarde: g.parsed_data?.resting_hr ?? null }))
  const bodyBattery = garminData.map(g => ({ datum: formatDatum(g.date), waarde: g.parsed_data?.body_battery?.current ?? null }))
  const slaapscore = garminData.map(g => ({ datum: formatDatum(g.date), waarde: g.parsed_data?.sleep?.score ?? null }))
  const slaapDuur = garminData.map(g => ({
    datum: formatDatum(g.date),
    waarde: g.parsed_data?.sleep?.duration_minutes ? Math.round(g.parsed_data.sleep.duration_minutes / 60 * 10) / 10 : null
  }))
  const hrv = garminData.map(g => ({ datum: formatDatum(g.date), waarde: g.parsed_data?.hrv?.avg_7d_ms ?? null }))
  const stress = garminData.map(g => ({ datum: formatDatum(g.date), waarde: g.parsed_data?.stress ?? null }))
  const ademhaling = garminData.map(g => ({ datum: formatDatum(g.date), waarde: g.parsed_data?.breathing?.avg_sleep_brpm ?? null }))

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-3">

        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <Link href={'/settings'} className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center active:bg-slate-700">
            <ArrowLeft size={20} className="text-slate-400" />
          </Link>
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

        {/* Waarschuwingen altijd zichtbaar */}
        {trends && trends.samenvatting && trends.samenvatting.length > 0 && (
          <div className="flex flex-col gap-2 mb-1">
            {trends.samenvatting.map((s, i) => (
              <div key={i} className="flex items-start gap-3 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3">
                <AlertTriangle size={16} className="text-orange-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-orange-300">{s}</p>
              </div>
            ))}
          </div>
        )}

        {/* Trends sectie */}
        <div className="flex flex-col gap-3">
          <SectieHeader
            titel="Trends"
            open={trendsOpen}
            onToggle={() => setTrendsOpen(v => !v)}
          />
          {trendsOpen && trends && (
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
          )}
        </div>

        {/* Garmin sectie */}
        <div className="flex flex-col gap-3">
          <SectieHeader
            titel="Garmin — 14 dagen"
            open={garminOpen}
            onToggle={() => setGarminOpen(v => !v)}
            badge={garminData.length}
            badgeKleur="bg-blue-500/20 text-blue-400"
          />
          {garminOpen && (
            loading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-2xl bg-coach-card animate-pulse" />)}
              </div>
            ) : garminData.length === 0 ? (
              <Card className="p-5 text-center">
                <Zap size={32} className="text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Nog geen Garmin data</p>
                <p className="text-xs text-slate-500 mt-1 mb-4">Importeer dagelijks via Instellingen → Garmin Import</p>
                <Link href={'/settings/garmin-import'}
                  className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-xl text-sm border border-blue-500/20"
                >
                  Garmin Import →
                </Link>
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                <GarminGrafiek titel="Rusthartslag" icoon={Heart} kleur="text-red-400" data={hartslag} eenheid="bpm" leeg="Nog geen hartslag data" />
                <GarminGrafiek titel="Body Battery" icoon={Battery} kleur="text-blue-400" data={bodyBattery} eenheid="" leeg="Nog geen Body Battery data" />
                <GarminGrafiek titel="Slaapscore" icoon={Moon} kleur="text-purple-400" data={slaapscore} eenheid="/100" leeg="Nog geen slaapscore data" />
                <GarminGrafiek titel="Slaapduur" icoon={Moon} kleur="text-blue-400" data={slaapDuur} eenheid="uur" leeg="Nog geen slaapduur data" />
                <GarminGrafiek titel="HRV (7d gem.)" icoon={Activity} kleur="text-green-400" data={hrv} eenheid="ms" leeg="Nog geen HRV data" />
                <GarminGrafiek titel="Stress" icoon={Zap} kleur="text-orange-400" data={stress} eenheid="" leeg="Nog geen stress data" />
                <GarminGrafiek titel="Ademhaling (slaap)" icoon={Activity} kleur="text-teal-400" data={ademhaling} eenheid="brpm" leeg="Nog geen ademhaling data" />
              </div>
            )
          )}
        </div>

        {/* Coach inzichten sectie */}
        <div className="flex flex-col gap-3">
          <SectieHeader
            titel="Coach inzichten"
            open={inzichtenOpen}
            onToggle={() => setInzichtenOpen(v => !v)}
            badge={insights.length}
            badgeKleur="bg-primary-500/20 text-primary-400"
          />
          {inzichtenOpen && (
            loading ? (
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
            )
          )}
        </div>

      </div>
    </AppShell>
  )
}
