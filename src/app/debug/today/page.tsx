'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

// ── Today Engine Debug ───────────────────────────────────────────────
// Bron: overleg 22 juli 2026. Toont de ruwe /api/today-respons, los van
// hoe Home 'm weergeeft — bevestigt of de Today Engine zelf (incl. de
// interne server-naar-server-aanroep naar api/training/today met
// doorgegeven sessie-cookie) technisch werkt, ongeacht welk scenario
// (specialist/trainer/rust) zich vandaag toevallig voordoet.

interface TodayPlan {
  source: string
  title: string
  duration: number | null
  intensity: string | null
  reason: string
  coachMessage: string
  actionHref: string
  actionLabel: string
}

export default function TodayDebugPage() {
  const [laden, setLaden] = useState(true)
  const [plan, setPlan] = useState<TodayPlan | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [ruweRespons, setRuweRespons] = useState<unknown>(null)

  async function laad() {
    setLaden(true)
    setFout(null)
    try {
      const res = await fetch('/api/today', { credentials: 'include' })
      const data = await res.json()
      setRuweRespons(data)
      if (data.error) setFout(data.error)
      else setPlan(data.plan)
    } catch (e) {
      setFout((e as Error).message)
    } finally {
      setLaden(false)
    }
  }

  useEffect(() => { laad() }, [])

  const bronKleur: Record<string, string> = {
    cycling: 'text-primary-400 bg-primary-500/10 border-primary-500/20',
    running: 'text-green-400 bg-green-500/10 border-green-500/20',
    trainer: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    rust: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  }

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link href="/debug" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">Today Engine Debug</h1>
            <p className="text-xs text-slate-500">Ruwe /api/today-respons</p>
          </div>
          <button onClick={laad} disabled={laden} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10 disabled:opacity-50">
            <RefreshCw size={16} className={`text-slate-400 ${laden ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {laden && <div className="h-48 bg-slate-800/50 rounded-2xl animate-pulse" />}
        {fout && <Card className="p-5 bg-red-500/5 border-red-500/20"><p className="text-sm text-red-400">{fout}</p></Card>}

        {!laden && plan && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Bron (source)</p>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${bronKleur[plan.source] || bronKleur.rust}`}>
                {plan.source}
              </span>
            </div>
            <p className="text-xl font-bold text-white mb-1">{plan.title}</p>
            <div className="flex gap-3 text-xs text-slate-400 mb-3">
              {plan.duration !== null && <span>{plan.duration} min</span>}
              {plan.intensity && <span>intensiteit: {plan.intensity}</span>}
            </div>
            <div className="flex flex-col gap-2 text-xs">
              <div><span className="text-slate-500">reason: </span><span className="text-slate-300">{plan.reason}</span></div>
              <div><span className="text-slate-500">coachMessage: </span><span className="text-slate-300">{plan.coachMessage}</span></div>
              <div><span className="text-slate-500">actionHref: </span><span className="text-slate-300 font-mono">{plan.actionHref}</span></div>
              <div><span className="text-slate-500">actionLabel: </span><span className="text-slate-300">{plan.actionLabel}</span></div>
            </div>
          </Card>
        )}

        <Card className="p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Ruwe JSON-respons</p>
          <pre className="text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(ruweRespons, null, 2)}</pre>
        </Card>

        <p className="text-[10px] text-slate-600 text-center px-4">
          Dit scherm toont exact wat de Today Engine bepaalt, ongeacht
          welk scenario (specialist/trainer/rust) vandaag toevallig van
          toepassing is — puur voor technische verificatie.
        </p>
      </div>
    </AppShell>
  )
}
