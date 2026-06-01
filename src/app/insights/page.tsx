'use client'
import { useEffect, useState } from 'react'
import { Brain, TrendingUp, AlertTriangle, Star, RefreshCw } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'
import { cn } from '@/utils'

interface MemoryItem {
  id: string
  memory_type: string
  content: string
  confidence: number | null
  created_at: string
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pattern: { icon: TrendingUp, color: 'text-primary-400', label: 'Patroon' },
  warning: { icon: AlertTriangle, color: 'text-coach-orange', label: 'Aandachtspunt' },
  achievement: { icon: Star, color: 'text-coach-green', label: 'Prestatie' },
  preference: { icon: Brain, color: 'text-purple-400', label: 'Voorkeur' },
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<MemoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [analysing, setAnalysing] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/memory')
      .then(r => r.json())
      .then(data => { setInsights(data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const runAnalysis = async () => {
    setAnalysing(true)
    setMessage('')
    try {
      const res = await fetch('/api/memory', { method: 'POST' })
      const data = await res.json()
      setMessage(data.message || 'Analyse klaar')
      // Herlaad inzichten
      const updated = await fetch('/api/memory').then(r => r.json())
      setInsights(updated || [])
    } catch {
      setMessage('Analyse mislukt')
    } finally {
      setAnalysing(false)
    }
  }

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Coach inzichten</h1>
            <p className="text-slate-400 text-sm mt-0.5">Wat je coach over je heeft geleerd</p>
          </div>
          <button
            onClick={runAnalysis}
            disabled={analysing}
            className="w-11 h-11 rounded-xl bg-coach-card flex items-center justify-center text-slate-400 active:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw size={18} className={cn(analysing && 'animate-spin')} />
          </button>
        </div>

        {message && (
          <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-3">
            <p className="text-primary-400 text-sm">{message}</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1,2,3].map(i => (
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
    </AppShell>
  )
}
