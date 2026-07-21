'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

// ── Performance Engine Debug — Fase 1A ──────────────────────────────────
// Bron: overleg 21 juli 2026. Toont de volledige keten: context (wat de
// adapter ophaalde) → Confidence → Recovery (via de wrapper) →
// Explainability. Bedoeld om te bevestigen dat Fase 1A daadwerkelijk
// werkt, niet als eindgebruikersscherm.

export default function PerformanceEngineDebugPage() {
  const [laden, setLaden] = useState(true)
  const [data, setData] = useState<any>(null)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/debug/performance-engine', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.error) setFout(d.error); else setData(d) })
      .catch(e => setFout(String(e)))
      .finally(() => setLaden(false))
  }, [])

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link href="/debug" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Performance Engine (Fase 1A)</h1>
            <p className="text-xs text-slate-500">Context → Confidence → Recovery → Explainability</p>
          </div>
        </div>

        {laden && <div className="h-64 bg-slate-800/50 rounded-2xl animate-pulse" />}
        {fout && <Card className="p-5 bg-red-500/5 border-red-500/20"><p className="text-sm text-red-400">{fout}</p></Card>}

        {!laden && data && (
          <>
            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">PerformanceContext</p>
              <pre className="text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(data.context, null, 2)}</pre>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Recovery Engine</p>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  data.recovery.confidence.level === 'HIGH' ? 'bg-green-500/10 text-green-400' :
                  data.recovery.confidence.level === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-red-500/10 text-red-400'
                }`}>
                  Confidence: {data.recovery.confidence.level} ({data.recovery.confidence.score}%)
                </span>
              </div>
              <p className="text-2xl font-bold text-white mb-1">{data.recovery.value.score}/100 — {data.recovery.value.status}</p>

              {data.recovery.explanation && (
                <div className="mt-3 p-3 bg-primary-500/5 border border-primary-500/20 rounded-xl">
                  <p className="text-sm text-slate-200 mb-1">{data.recovery.explanation.summary}</p>
                  <p className="text-xs text-primary-400 font-medium">{data.recovery.explanation.coachMessage}</p>
                </div>
              )}

              {data.recovery.confidence.limitations.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Beperkingen</p>
                  {data.recovery.confidence.limitations.map((l: string, i: number) => (
                    <p key={i} className="text-xs text-slate-500">• {l}</p>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Engine Registry</p>
              {data.registry.map((e: any) => (
                <div key={e.key} className="flex items-center justify-between py-1.5 border-b border-coach-border last:border-0">
                  <span className="text-sm text-slate-300">{e.naam}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${e.status === 'actief' ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                    {e.status === 'actief' ? `Fase ${e.fase}` : `Fase ${e.fase} — gepland`}
                  </span>
                </div>
              ))}
            </Card>
          </>
        )}
      </div>
    </AppShell>
  )
}
