'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

// ── Recovery Debug Dashboard ─────────────────────────────────────────────
// Bron: overleg 20 juli 2026, op voorstel van de gebruiker. Laat exact
// zien welke factoren vandaag meetellen in de Coach Score en CoachPolicy,
// en wat elke factor bijdraagt — voor controle of alle Garmin-data
// daadwerkelijk aankomt en of de berekening logisch voelt. Bedoeld als
// hulpmiddel voor toekomstige Niveau 2-uitbreidingen (nieuwe factoren
// toevoegen), niet als eindgebruikersscherm.

interface RecoveryFactorBreakdown { factor: string; ruwe_waarde: string; bijdrage_score: number }
interface Recovery { score: number; status: string; color: 'green' | 'orange' | 'red'; breakdown: RecoveryFactorBreakdown[] }
interface Policy {
  recoveryState: string; maxIntensity: string; volumeAdjustmentPct: number; priority: string
  allowedTrainingTypes: string[]; forbiddenTrainingTypes: string[]; reasons: string[]
}

const KLEUR_MAP: Record<string, string> = { green: 'text-green-400 bg-green-500/10 border-green-500/20', orange: 'text-amber-400 bg-amber-500/10 border-amber-500/20', red: 'text-red-400 bg-red-500/10 border-red-500/20' }

export default function RecoveryDebugPage() {
  const [laden, setLaden] = useState(true)
  const [heeftCheckin, setHeeftCheckin] = useState(false)
  const [heeftHealthMetrics, setHeeftHealthMetrics] = useState(false)
  const [recovery, setRecovery] = useState<Recovery | null>(null)
  const [policy, setPolicy] = useState<Policy | null>(null)

  useEffect(() => {
    async function laad() {
      setLaden(true)
      try {
        const res = await fetch('/api/debug/recovery', { credentials: 'include' })
        const data = await res.json()
        setHeeftCheckin(data.heeft_checkin)
        setHeeftHealthMetrics(data.heeft_health_metrics)
        setRecovery(data.recovery)
        setPolicy(data.policy)
      } catch {
        // stil falen — dit is een debug-scherm
      } finally {
        setLaden(false)
      }
    }
    laad()
  }, [])

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href="/debug" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Recovery Debug</h1>
            <p className="text-xs text-slate-500">Welke factoren tellen vandaag mee?</p>
          </div>
        </div>

        {laden && <div className="h-64 bg-slate-800/50 rounded-2xl animate-pulse" />}

        {!laden && (
          <div className="flex gap-2">
            <div className={`flex-1 px-3 py-2 rounded-lg text-xs text-center ${heeftCheckin ? 'bg-green-500/10 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
              Check-in {heeftCheckin ? '✓' : '✗'}
            </div>
            <div className={`flex-1 px-3 py-2 rounded-lg text-xs text-center ${heeftHealthMetrics ? 'bg-green-500/10 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
              health_metrics {heeftHealthMetrics ? '✓' : '✗'}
            </div>
          </div>
        )}

        {!laden && recovery && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Recovery Score</p>
              <div className={`px-3 py-1 rounded-full text-sm font-bold border ${KLEUR_MAP[recovery.color]}`}>
                {recovery.score}/100 — {recovery.status}
              </div>
            </div>
            {recovery.breakdown.length === 0 ? (
              <p className="text-sm text-slate-500">Geen factoren beschikbaar vandaag — score valt terug op de standaardwaarde (50).</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] text-slate-500 uppercase">
                    <th className="pb-2 font-normal">Factor</th>
                    <th className="pb-2 font-normal">Waarde</th>
                    <th className="pb-2 font-normal text-right">Bijdrage</th>
                  </tr>
                </thead>
                <tbody>
                  {recovery.breakdown.map((f, i) => (
                    <tr key={i} className="border-t border-coach-border">
                      <td className="py-2 text-slate-300">{f.factor}</td>
                      <td className="py-2 text-slate-400">{f.ruwe_waarde}</td>
                      <td className={`py-2 text-right font-semibold ${f.bijdrage_score >= 0 ? 'text-slate-200' : 'text-red-400'}`}>
                        {f.bijdrage_score >= 0 ? '+' : ''}{f.bijdrage_score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="text-[9px] text-slate-600 mt-3">Eindscore is het gemiddelde van alle bijdragen hierboven (behalve pijn/levensgebeurtenis-correcties, die trekken direct af van het totaal).</p>
          </Card>
        )}

        {!laden && policy && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">CoachPolicy (afgeleid van bovenstaande score)</p>
            <div className="flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Recovery state</span><span className="text-white font-medium">{policy.recoveryState}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Max intensiteit</span><span className="text-white font-medium">{policy.maxIntensity}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Volume-aanpassing</span><span className="text-white font-medium">{policy.volumeAdjustmentPct}%</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Prioriteit</span><span className="text-white font-medium">{policy.priority}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Toegestaan</span><span className="text-white font-medium text-right">{policy.allowedTrainingTypes.join(', ')}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Verboden</span><span className="text-white font-medium text-right">{policy.forbiddenTrainingTypes.join(', ') || 'geen'}</span></div>
            </div>
            <div className="mt-3 pt-3 border-t border-coach-border">
              {policy.reasons.map((r, i) => <p key={i} className="text-[11px] text-slate-500">{r}</p>)}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
