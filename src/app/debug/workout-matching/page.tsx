'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

// ── Workout Matching Debug Dashboard ─────────────────────────────────────
// Bron: docs/workout-completion-platform-adr-v1.md, Fase 1. Toont
// geplande Rowing-sessies en al-geïmporteerde Rowing-activiteiten naast
// elkaar, met per activiteit een knop om de matcher handmatig (opnieuw)
// te laten draaien — zodat dit in-app getest kan worden zonder een
// nieuwe ErgData-sessie nodig te hebben. Puur diagnose-scherm, geen
// eindgebruikersfunctie.

interface PlanSessie {
  id: string; date: string; type: string; duration: number; status: string
  completed_activity_id: string | null; match_confidence: number | null; match_reden: string | null
}
interface Activiteit {
  id: string; date: string; duration: number; source: string; notes: string | null
}
interface TestResultaat { gematcht: boolean; planSessieId: string | null; confidence: number | null; reden: string }

const STATUS_KLEUR: Record<string, string> = {
  completed: 'text-green-400 bg-green-500/10 border-green-500/20',
  scheduled: 'text-slate-300 bg-white/5 border-coach-border',
  planned: 'text-slate-300 bg-white/5 border-coach-border',
  skipped: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  adjusted: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  cancelled: 'text-slate-600 bg-white/5 border-coach-border',
}

export default function WorkoutMatchingDebugPage() {
  const [laden, setLaden] = useState(true)
  const [heeftActiefPlan, setHeeftActiefPlan] = useState(false)
  const [sessies, setSessies] = useState<PlanSessie[]>([])
  const [activiteiten, setActiviteiten] = useState<Activiteit[]>([])
  const [testBezig, setTestBezig] = useState<string | null>(null)
  const [testResultaten, setTestResultaten] = useState<Record<string, TestResultaat>>({})

  const laadData = useCallback(async () => {
    setLaden(true)
    try {
      const res = await fetch('/api/debug/workout-matching', { credentials: 'include' })
      const data = await res.json()
      setHeeftActiefPlan(!!data.heeftActiefPlan)
      setSessies(data.geplandeSessies || [])
      setActiviteiten(data.activiteiten || [])
    } catch {
      // stil falen — dit is een debug-scherm
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => { laadData() }, [laadData])

  async function testMatching(activiteitId: string) {
    setTestBezig(activiteitId)
    try {
      const res = await fetch('/api/debug/workout-matching', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activiteitId }),
      })
      const data = await res.json()
      if (data.resultaat) setTestResultaten(prev => ({ ...prev, [activiteitId]: data.resultaat }))
      await laadData() // herlaadt zodat een geslaagde match direct zichtbaar wordt in de sessielijst hierboven
    } catch {
      // stil falen — dit is een debug-scherm
    } finally {
      setTestBezig(null)
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
            <h1 className="text-lg font-bold text-white">Workout Matching Debug</h1>
            <p className="text-xs text-slate-500">Rowing — sessies: laatste 21 dagen + komende 7 · activiteiten: laatste 30</p>
          </div>
        </div>

        {laden && <div className="h-64 bg-slate-800/50 rounded-2xl animate-pulse" />}

        {!laden && !heeftActiefPlan && (
          <Card className="p-5"><p className="text-sm text-slate-400">Geen actief Rowing-trainingsplan gevonden.</p></Card>
        )}

        {!laden && heeftActiefPlan && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Geplande sessies</p>
            {sessies.length === 0 ? (
              <p className="text-sm text-slate-500">Geen sessies in dit venster.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {sessies.map(s => (
                  <div key={s.id} className={`px-3 py-2.5 rounded-lg border text-sm ${STATUS_KLEUR[s.status] || 'text-slate-300 bg-white/5 border-coach-border'}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{s.date} · {s.type} · {s.duration} min</span>
                      <span className="text-xs uppercase">{s.status}</span>
                    </div>
                    {s.completed_activity_id && (
                      <p className="text-[11px] opacity-80 mt-1">
                        gekoppeld aan activiteit {s.completed_activity_id.slice(0, 8)}…
                        {s.match_confidence != null && ` · confidence ${(s.match_confidence * 100).toFixed(0)}%`}
                      </p>
                    )}
                    {s.match_reden && <p className="text-[11px] opacity-70 mt-0.5">{s.match_reden}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {!laden && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Geïmporteerde activiteiten</p>
            {activiteiten.length === 0 ? (
              <p className="text-sm text-slate-500">Geen Rowing-activiteiten in dit venster.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {activiteiten.map(a => {
                  const testResultaat = testResultaten[a.id]
                  return (
                    <div key={a.id} className="border-t border-coach-border pt-3 first:border-t-0 first:pt-0">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-200">{a.date} · {a.duration} min · {a.source}</span>
                        <button
                          onClick={() => testMatching(a.id)}
                          disabled={testBezig === a.id}
                          className="text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white active:bg-primary-700 disabled:opacity-50"
                        >
                          {testBezig === a.id ? '⏳' : '▶ Test matching'}
                        </button>
                      </div>
                      {testResultaat && (
                        <div className={`mt-2 px-3 py-2 rounded-lg text-xs ${testResultaat.gematcht ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          <p className="font-medium">{testResultaat.gematcht ? '✓ Gekoppeld' : '✗ Niet gekoppeld'}{testResultaat.confidence != null && ` — confidence ${(testResultaat.confidence * 100).toFixed(0)}%`}</p>
                          <p className="opacity-80 mt-0.5">{testResultaat.reden}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )}

        <p className="text-[10px] text-slate-600">
          &quot;Test matching&quot; roept exact dezelfde functie aan als de echte Concept2-sync
          (matchActiviteitAanPlan) — geen aparte testlogica. Een geslaagde match hier is dus
          gegarandeerd hetzelfde gedrag als in productie. Drempel: confidence ≥ 70%.
        </p>
      </div>
    </AppShell>
  )
}
