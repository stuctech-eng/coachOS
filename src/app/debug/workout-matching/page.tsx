'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

// ── Workout Matching Debug Dashboard ─────────────────────────────────────
// Bron: docs/workout-completion-platform-adr-v1.md.
//
// v2.4.269: naast de originele, datum-gebaseerde "Test matching"-knop
// (echte flow, matchActiviteitAanPlan) nu ook een handmatige route: kies
// zelf een activiteit + een sessie (ongeacht datum), zie de confidence-
// berekening (dry-run) of forceer een testkoppeling. Reden: met alleen
// historische data en toekomstige geplande sessies was er geen enkele
// datum-match te produceren om de matcher live te zien werken.
// Geforceerde testkoppelingen zijn altijd herkenbaar aan een
// "[TEST]"-label in de reden, en alleen zulke sessies zijn terug te
// zetten via de reset-knop.
//
// v2.4.270 (Fase 2 — Running Matcher): sport-selector toegevoegd. Dit
// scherm was hardcoded op Rowing — met een tweede Sport Matcher zou dat
// een aparte kopie van dit hele scherm betekenen. `sport` gaat nu mee
// in zowel de GET (?sport=) als de POST (body.sport); de registry aan
// de API-kant (route.ts) bepaalt welke matcher/activiteitnamen daarbij
// horen. Nieuwe sporten toevoegen raakt dit bestand niet meer.

interface PlanSessie {
  id: string; date: string; type: string; duration: number; status: string
  completed_activity_id: string | null; match_confidence: number | null; match_reden: string | null
}
interface Activiteit {
  id: string; date: string; duration: number; source: string; notes: string | null
}
interface TestResultaat { gematcht: boolean; planSessieId: string | null; confidence: number | null; reden: string; dryRun?: boolean }

const STATUS_KLEUR: Record<string, string> = {
  completed: 'text-green-400 bg-green-500/10 border-green-500/20',
  scheduled: 'text-slate-300 bg-white/5 border-coach-border',
  planned: 'text-slate-300 bg-white/5 border-coach-border',
  skipped: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  adjusted: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  cancelled: 'text-slate-600 bg-white/5 border-coach-border',
}

const SPORT_LABEL: Record<string, string> = { rowing: 'Rowing', running: 'Running' }

export default function WorkoutMatchingDebugPage() {
  const [sport, setSport] = useState('rowing')
  const [beschikbareSporten, setBeschikbareSporten] = useState<string[]>(['rowing'])
  const [laden, setLaden] = useState(true)
  const [heeftActiefPlan, setHeeftActiefPlan] = useState(false)
  const [sessies, setSessies] = useState<PlanSessie[]>([])
  const [activiteiten, setActiviteiten] = useState<Activiteit[]>([])
  const [bezig, setBezig] = useState<string | null>(null)
  const [testResultaten, setTestResultaten] = useState<Record<string, TestResultaat>>({})
  const [gekozenSessie, setGekozenSessie] = useState<Record<string, string>>({})

  const laadData = useCallback(async () => {
    setLaden(true)
    try {
      const res = await fetch(`/api/debug/workout-matching?sport=${sport}`, { credentials: 'include' })
      const data = await res.json()
      setBeschikbareSporten(data.beschikbareSporten || ['rowing'])
      setHeeftActiefPlan(!!data.heeftActiefPlan)
      setSessies(data.geplandeSessies || [])
      setActiviteiten(data.activiteiten || [])
    } catch {
      // stil falen — dit is een debug-scherm
    } finally {
      setLaden(false)
    }
  }, [sport])

  useEffect(() => { laadData() }, [laadData])

  async function roepAan(actie: string, activiteitId: string | undefined, planSessieId: string | undefined, sleutel: string) {
    setBezig(sleutel)
    try {
      const res = await fetch('/api/debug/workout-matching', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actie, sport, activiteitId, planSessieId }),
      })
      const data = await res.json()
      if (data.resultaat) setTestResultaten(prev => ({ ...prev, [sleutel]: data.resultaat }))
      else if (data.error) setTestResultaten(prev => ({ ...prev, [sleutel]: { gematcht: false, planSessieId: null, confidence: null, reden: `Fout: ${data.error}` } }))
      await laadData()
    } catch {
      // stil falen — dit is een debug-scherm
    } finally {
      setBezig(null)
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
            <p className="text-xs text-slate-500">sessies: laatste 21 dagen + komende 7 · activiteiten: laatste 30</p>
          </div>
        </div>

        <div className="flex gap-2">
          {beschikbareSporten.map(s => (
            <button
              key={s}
              onClick={() => setSport(s)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${s === sport ? 'bg-primary-600 text-white' : 'bg-white/5 text-slate-400 active:bg-white/10'}`}
            >
              {SPORT_LABEL[s] || s}
            </button>
          ))}
        </div>

        {laden && <div className="h-64 bg-slate-800/50 rounded-2xl animate-pulse" />}

        {!laden && !heeftActiefPlan && (
          <Card className="p-5"><p className="text-sm text-slate-400">Geen actief {SPORT_LABEL[sport] || sport}-trainingsplan gevonden.</p></Card>
        )}

        {!laden && heeftActiefPlan && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Geplande sessies</p>
            {sessies.length === 0 ? (
              <p className="text-sm text-slate-500">Geen sessies in dit venster.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {sessies.map(s => {
                  const isTestKoppeling = !!s.match_reden?.startsWith('[TEST]')
                  return (
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
                      {isTestKoppeling && (
                        <button
                          onClick={() => roepAan('reset', undefined, s.id, `reset-${s.id}`)}
                          disabled={bezig === `reset-${s.id}`}
                          className="mt-2 text-[11px] px-2.5 py-1 rounded-md bg-white/10 text-slate-300 active:bg-white/20 disabled:opacity-50"
                        >
                          {bezig === `reset-${s.id}` ? '⏳' : '🔄 Ontkoppelen (reset testkoppeling)'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )}

        {!laden && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Geïmporteerde activiteiten</p>
            {activiteiten.length === 0 ? (
              <p className="text-sm text-slate-500">Geen {SPORT_LABEL[sport] || sport}-activiteiten gevonden.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {activiteiten.map(a => {
                  const testResultaat = testResultaten[a.id]
                  const handmatigResultaat = testResultaten[`handmatig-${a.id}`]
                  return (
                    <div key={a.id} className="border-t border-coach-border pt-3 first:border-t-0 first:pt-0">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-200">{a.date} · {a.duration} min · {a.source}</span>
                        <button
                          onClick={() => roepAan('automatisch', a.id, undefined, a.id)}
                          disabled={bezig === a.id}
                          className="text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white active:bg-primary-700 disabled:opacity-50"
                        >
                          {bezig === a.id ? '⏳' : '▶ Test matching (op datum)'}
                        </button>
                      </div>
                      {testResultaat && (
                        <div className={`mt-2 px-3 py-2 rounded-lg text-xs ${testResultaat.gematcht ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          <p className="font-medium">{testResultaat.gematcht ? '✓ Gekoppeld' : '✗ Niet gekoppeld'}{testResultaat.confidence != null && ` — confidence ${(testResultaat.confidence * 100).toFixed(0)}%`}</p>
                          <p className="opacity-80 mt-0.5">{testResultaat.reden}</p>
                        </div>
                      )}

                      {/* v2.4.269: handmatige test tegen een zelf-gekozen sessie, los van datum */}
                      <div className="mt-2.5 flex flex-col gap-1.5">
                        <select
                          value={gekozenSessie[a.id] || ''}
                          onChange={e => setGekozenSessie(prev => ({ ...prev, [a.id]: e.target.value }))}
                          className="text-xs bg-slate-800 text-slate-300 rounded-md px-2 py-1.5 border border-coach-border"
                        >
                          <option value="">— kies een sessie om (ongeacht datum) tegen te testen —</option>
                          {sessies.map(s => (
                            <option key={s.id} value={s.id}>{s.date} · {s.type} · {s.duration} min · {s.status}</option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() => roepAan('handmatig-test', a.id, gekozenSessie[a.id], `handmatig-${a.id}`)}
                            disabled={!gekozenSessie[a.id] || bezig === `handmatig-${a.id}`}
                            className="flex-1 text-[11px] px-2.5 py-1.5 rounded-md bg-white/10 text-slate-300 active:bg-white/20 disabled:opacity-40"
                          >
                            {bezig === `handmatig-${a.id}` ? '⏳' : '🔍 Dry-run (geen schrijving)'}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Dit schrijft écht een testkoppeling weg in training_plan_sessions (duidelijk als [TEST] gelabeld, en terug te draaien via de reset-knop). Doorgaan?')) {
                                roepAan('handmatig-forceer', a.id, gekozenSessie[a.id], `handmatig-${a.id}`)
                              }
                            }}
                            disabled={!gekozenSessie[a.id] || bezig === `handmatig-${a.id}`}
                            className="flex-1 text-[11px] px-2.5 py-1.5 rounded-md bg-amber-500/20 text-amber-400 active:bg-amber-500/30 disabled:opacity-40"
                          >
                            {bezig === `handmatig-${a.id}` ? '⏳' : '⚠ Forceer testkoppeling'}
                          </button>
                        </div>
                      </div>
                      {handmatigResultaat && (
                        <div className={`mt-2 px-3 py-2 rounded-lg text-xs ${handmatigResultaat.dryRun ? 'bg-slate-700/50 text-slate-300' : handmatigResultaat.gematcht ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                          <p className="font-medium">
                            {handmatigResultaat.dryRun ? '🔍 Dry-run resultaat' : handmatigResultaat.gematcht ? '✓ Testkoppeling weggeschreven' : '✗ Mislukt'}
                            {handmatigResultaat.confidence != null && ` — confidence ${(handmatigResultaat.confidence * 100).toFixed(0)}%`}
                          </p>
                          <p className="opacity-80 mt-0.5">{handmatigResultaat.reden}</p>
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
          &quot;Test matching (op datum)&quot; roept exact dezelfde functie aan als de echte
          Concept2-sync (matchActiviteitAanPlan) — geen aparte testlogica, drempel confidence ≥ 70%.
          De handmatige sectie daaronder matcht bewust NIET op datum en is puur om de
          confidence-berekening te kunnen zien zonder te wachten — geforceerde koppelingen
          zijn altijd als [TEST] gelabeld en alleen zo weer terug te draaien.
        </p>
      </div>
    </AppShell>
  )
}
