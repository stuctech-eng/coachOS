'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

// ── Kettlebell Athlete Passport — v2.4.360 ──────────────────────────────
// Aggregeert bestaande data — bouwt GEEN nieuwe engine. Expliciet
// onderscheid tussen databronnen (spec-eis §5 van de master-opdracht):
// - TRAINING DATA: kettlebell_gs_sessions / Records Engine (jouw eigen
//   invoer)
// - OFFICIAL DATA: WKSF-classificatie (kettlebell_classifications, via
//   Classification Engine) — altijd met de strongly_indicated-disclaimer
// - COACH INFERENCE: bestaat nog niet (hasCoachLayer: false in de
//   capability-registry) — dus geen sectie hiervoor, geen nep-AI-advies
//   suggereren.

interface Preferences {
  modus?: string
  primaire_discipline?: string
  federatie_voorkeur?: string
  sex?: 'male' | 'female'
  bodyweight_class?: string
  ranking_block_voorkeur?: 'A' | 'B'
}

interface TrainingBest { discipline: string; bell_weight_kg: number; reps: number }
interface CompetitionBest { discipline: string; reps: number; competition_name: string }

interface RecordsResultaat {
  personal_best_training: TrainingBest[]
  personal_best_competition: CompetitionBest[]
  season_best_training: TrainingBest[]
  season_best_competition: CompetitionBest[]
}

const DISCIPLINE_NAAR_RANKING_KEY: Record<string, string> = {
  jerk: 'jerk_30', snatch: 'snatch_10', long_cycle: 'long_cycle_10',
  biathlon: 'biathlon_10', one_arm_long_cycle: 'one_arm_long_cycle_10',
}

export default function AthletePassportPage() {
  const [laden, setLaden] = useState(true)
  const [prefs, setPrefs] = useState<Preferences>({})
  const [records, setRecords] = useState<RecordsResultaat | null>(null)
  const [aantalSessies, setAantalSessies] = useState(0)
  const [classificatie, setClassificatie] = useState<{ status: string; current_class?: string; next_class?: string; gap?: number } | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/specialists/kettlebell/profile').then(r => r.json()),
      fetch('/api/specialists/kettlebell/persoonlijke-records').then(r => r.json()),
      fetch('/api/specialists/kettlebell/analyse').then(r => r.json()),
    ]).then(([p, r, a]) => {
      const preferences: Preferences = p.preferences || {}
      setPrefs(preferences)
      const recordsData: RecordsResultaat | null = r.error ? null : r.resultaat
      if (recordsData) setRecords(recordsData)
      if (!a.error) setAantalSessies(a.resultaat?.volume?.aantal_sessies || 0)

      // Classificatie-snapshot alleen ophalen als (1) het profiel compleet
      // is, EN (2) er een echte, gelogde PR bestaat voor de primaire
      // discipline — nooit een gegokt bell weight gebruiken om de
      // classificatie op te vragen.
      const prBijPrimaireDiscipline = recordsData?.personal_best_training.find(
        t => t.discipline === preferences.primaire_discipline
      )
      if (preferences.primaire_discipline && preferences.sex && preferences.bodyweight_class
          && preferences.ranking_block_voorkeur && prBijPrimaireDiscipline) {
        const rankingDiscipline = DISCIPLINE_NAAR_RANKING_KEY[preferences.primaire_discipline]
        const params = new URLSearchParams({
          ranking_discipline: rankingDiscipline,
          bodyweight_class: preferences.bodyweight_class,
          ranking_block: preferences.ranking_block_voorkeur,
          sex: preferences.sex,
          kettlebell_discipline: preferences.primaire_discipline,
          bell_weight_kg: String(prBijPrimaireDiscipline.bell_weight_kg),
        })
        fetch(`/api/specialists/kettlebell/beat-my-class?${params}`)
          .then(res => res.json())
          .then(d => { if (!d.error) setClassificatie(d.resultaat) })
      }
    }).finally(() => setLaden(false))
  }, [])

  const profielCompleet = !!(prefs.primaire_discipline && prefs.sex && prefs.bodyweight_class && prefs.ranking_block_voorkeur)

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href="/coach/kettlebell" className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
            <ArrowLeft size={20} className="text-slate-400" />
          </Link>
          <h1 className="text-xl font-bold text-white">Athlete Passport</h1>
        </div>

        {laden && <div className="h-40 bg-slate-800/50 rounded-2xl animate-pulse" />}

        {!laden && (
          <>
            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Profiel</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Primaire discipline</p>
                  <p className="text-sm font-semibold text-white">{prefs.primaire_discipline || 'Niet ingesteld'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Federatie</p>
                  <p className="text-sm font-semibold text-white">{(prefs.federatie_voorkeur || 'geen').toUpperCase()}</p>
                </div>
              </div>
              {!profielCompleet && (
                <Link href="/settings/kettlebell-profile" className="text-xs text-primary-400 mt-3 inline-block">
                  Vul geslacht, lichaamsgewichtcategorie en rankingblok aan voor een classificatie-snapshot →
                </Link>
              )}
            </Card>

            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Official Data — WKSF-classificatie</p>
              {!profielCompleet && <p className="text-sm text-slate-400">Profiel nog niet compleet genoeg voor een snapshot (geslacht, lichaamsgewichtcategorie en rankingblok ontbreken).</p>}
              {profielCompleet && !classificatie && <p className="text-sm text-slate-400">Nog geen PR gelogd voor je primaire discipline — log een sessie om een snapshot te krijgen.</p>}
              {profielCompleet && classificatie && classificatie.status === 'classified_provisional' && (
                <>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Huidige klasse</p>
                      <p className="text-lg font-bold text-white">{classificatie.current_class || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Volgende</p>
                      <p className="text-lg font-bold text-white">{classificatie.next_class || '—'}</p>
                    </div>
                  </div>
                  <p className="text-xs text-amber-300 bg-amber-500/10 rounded-lg p-3 mt-3">
                    Voorlopig — bell-weight-mapping (strongly_indicated) nog niet officieel door WKSF bevestigd. Gebaseerd op je eigen PR en het rankingblok dat je zelf koos in je profiel.
                  </p>
                </>
              )}
            </Card>

            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Training Data</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Sessies gelogd</p>
                  <p className="text-lg font-bold text-white">{aantalSessies}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Training Best's</p>
                  <p className="text-lg font-bold text-white">{records?.personal_best_training.length || 0}</p>
                </div>
              </div>
            </Card>

            {records && records.personal_best_competition.length > 0 && (
              <Card className="p-5">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Competition Best</p>
                <div className="flex flex-col gap-2">
                  {records.personal_best_competition.map(c => (
                    <div key={c.discipline} className="flex items-center justify-between">
                      <p className="text-sm text-white">{c.discipline}</p>
                      <p className="text-sm font-bold text-white">{c.reps} reps</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
