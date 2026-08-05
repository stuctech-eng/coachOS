'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

// ── Activity Bridge Debug Dashboard ──────────────────────────────────────
// Bron: v2.4.278/279. Zelfde opzet als /debug/workout-matching, maar
// zonder historische data om tegenaan te testen — hier vul je zelf een
// sport + duur in en de Bridge draait exact zoals in productie
// (overwegActiviteitUitTrainingResultaat), met een synthetisch
// training_result-id zodat er geen echte training_results-rij nodig is.

interface Activiteit {
  id: string; date: string; duration: number; source: string; notes: string | null
}
interface BridgeResultaat { aangemaakt: boolean; reden: string; activiteitId?: string }

const SPORT_OPTIES = [
  { waarde: 'running', label: 'Running' },
  { waarde: 'cycling', label: 'Cycling' },
  { waarde: 'rowing', label: 'Rowing' },
  { waarde: 'walking', label: 'Walking' },
  { waarde: 'swimming', label: 'Swimming' },
]

export default function ActivityBridgeDebugPage() {
  const [laden, setLaden] = useState(true)
  const [activiteiten, setActiviteiten] = useState<Activiteit[]>([])
  const [sport, setSport] = useState('running')
  const [duur, setDuur] = useState('45')
  const [datum, setDatum] = useState('')
  const [bezig, setBezig] = useState(false)
  const [resultaat, setResultaat] = useState<BridgeResultaat | null>(null)
  const [resetBezig, setResetBezig] = useState<string | null>(null)

  const laadData = useCallback(async () => {
    setLaden(true)
    try {
      const res = await fetch('/api/debug/activity-bridge', { credentials: 'include' })
      const data = await res.json()
      setActiviteiten(data.activiteiten || [])
    } catch {
      // stil falen — dit is een debug-scherm
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => { laadData() }, [laadData])

  async function testBridge() {
    setBezig(true)
    setResultaat(null)
    try {
      const res = await fetch('/api/debug/activity-bridge', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actie: 'test',
          trainingType: sport,
          actualDuration: parseInt(duur, 10),
          date: datum || undefined,
        }),
      })
      const data = await res.json()
      if (data.resultaat) setResultaat(data.resultaat)
      else if (data.error) setResultaat({ aangemaakt: false, reden: `Fout: ${data.error}` })
      await laadData()
    } catch {
      // stil falen
    } finally {
      setBezig(false)
    }
  }

  async function resetActiviteit(id: string) {
    setResetBezig(id)
    try {
      await fetch('/api/debug/activity-bridge', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actie: 'reset', activiteitId: id }),
      })
      await laadData()
    } catch {
      // stil falen
    } finally {
      setResetBezig(null)
    }
  }

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href="/debug" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Activity Bridge Debug</h1>
            <p className="text-xs text-slate-500">training_results → activity_sessions</p>
          </div>
        </div>

        <Card className="p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Test de Bridge</p>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Sport</label>
              <select
                value={sport}
                onChange={e => setSport(e.target.value)}
                className="w-full text-sm bg-slate-800 text-slate-200 rounded-lg px-3 py-2 border border-coach-border"
              >
                {SPORT_OPTIES.map(o => <option key={o.waarde} value={o.waarde}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-slate-500 block mb-1">Duur (min)</label>
                <input
                  type="number"
                  value={duur}
                  onChange={e => setDuur(e.target.value)}
                  className="w-full text-sm bg-slate-800 text-slate-200 rounded-lg px-3 py-2 border border-coach-border"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-500 block mb-1">Datum (leeg = vandaag)</label>
                <input
                  type="date"
                  value={datum}
                  onChange={e => setDatum(e.target.value)}
                  className="w-full text-sm bg-slate-800 text-slate-200 rounded-lg px-3 py-2 border border-coach-border"
                />
              </div>
            </div>
            <button
              onClick={testBridge}
              disabled={bezig}
              className="w-full py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium active:bg-primary-700 disabled:opacity-50"
            >
              {bezig ? '⏳ Bezig...' : '▶ Test Activity Bridge'}
            </button>
          </div>

          {resultaat && (
            <div className={`mt-4 px-3 py-2.5 rounded-lg text-sm ${resultaat.aangemaakt ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
              <p className="font-medium">{resultaat.aangemaakt ? '✓ activity_session aangemaakt' : '✗ Niet aangemaakt'}</p>
              <p className="opacity-80 mt-0.5 text-xs">{resultaat.reden}</p>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Activiteiten — laatste 14 dagen</p>
          {laden ? (
            <div className="h-32 bg-slate-800/50 rounded-xl animate-pulse" />
          ) : activiteiten.length === 0 ? (
            <p className="text-sm text-slate-500">Geen activiteiten in dit venster.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {activiteiten.map(a => {
                const isDebugRij = a.source === 'trainer_ai' && !!a.notes?.includes('training_result:debug-')
                return (
                  <div key={a.id} className="px-3 py-2.5 rounded-lg border border-coach-border bg-white/5 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-200">{a.date} · {a.duration} min · <span className="text-slate-400">{a.source}</span></span>
                      {isDebugRij && (
                        <button
                          onClick={() => resetActiviteit(a.id)}
                          disabled={resetBezig === a.id}
                          className="text-[11px] px-2.5 py-1 rounded-md bg-white/10 text-slate-300 active:bg-white/20 disabled:opacity-50"
                        >
                          {resetBezig === a.id ? '⏳' : '🔄 Verwijderen'}
                        </button>
                      )}
                    </div>
                    {isDebugRij && <p className="text-[11px] text-amber-400 mt-1">debug-testrij (Activity Bridge)</p>}
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <p className="text-[10px] text-slate-600">
          &quot;Test Activity Bridge&quot; roept exact dezelfde functie aan als productie
          (overwegActiviteitUitTrainingResultaat), met een synthetisch training_result-id —
          er wordt geen echte training_results-rij aangemaakt. Alleen debug-testrijen
          (herkenbaar aan het label) kunnen hier verwijderd worden.
        </p>
      </div>
    </AppShell>
  )
}
