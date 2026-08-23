'use client'
import { useState, useEffect } from 'react'
import { ArrowLeft, Settings, Plus } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import Link from 'next/link'

// ── Kettlebell Coach — Fase 0 + MVP1 (basisstructuur) ────────────────────
// Bron: Kettlebell Specialist Master Plan + architectuurvoorstel v1
// (22 augustus 2026). Zelfde eerlijke-lege-staat-principe als Rowing
// Fase 1: geen Coach Layer/AI-advies tonen die nog niet bestaat — puur
// sessieregistratie, PR's en volume. Federatie/classificatie komen in
// MVP2 (WKSF eerst), Trainer AI-koppeling (specialistische trainings-
// parameters → concrete sessie) volgt in een latere fase — zie
// architectuurdoc §Kettlebell Trainer AI-brug.

const DISCIPLINE_LABEL: Record<string, string> = {
  jerk: 'Jerk', snatch: 'Snatch', long_cycle: 'Long Cycle', biathlon: 'Biathlon',
}

interface KettlebellSessie {
  id: string
  discipline: string
  bell_weight_kg: number
  duration_sec: number
  reps: number
  rpm_avg: number | null
  performed_at: string
}

interface PersoonlijkRecord {
  discipline: string
  bell_weight_kg: number
  reps: number
  rpm_avg: number | null
  behaald_op: string
}

interface AnalyseResponse {
  resultaat: {
    volume: { aantal_sessies: number; totale_reps: number; totale_duur_sec: number; gemiddelde_rpm: number | null }
    persoonlijke_records: PersoonlijkRecord[]
  }
}

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export default function KettlebellPage() {
  const [laden, setLaden] = useState(true)
  const [sessies, setSessies] = useState<KettlebellSessie[]>([])
  const [analyse, setAnalyse] = useState<AnalyseResponse['resultaat'] | null>(null)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/specialists/kettlebell/sessions?limit=10').then(r => r.json()),
      fetch('/api/specialists/kettlebell/analyse').then(r => r.json()),
    ])
      .then(([sessiesData, analyseData]) => {
        if (sessiesData.error) setFout(sessiesData.error)
        else setSessies(sessiesData.sessies || [])
        if (!analyseData.error) setAnalyse(analyseData.resultaat)
      })
      .catch(() => setFout('Kon Kettlebell-data niet ophalen'))
      .finally(() => setLaden(false))
  }, [])

  const heeftData = sessies.length > 0

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href="/specialisten" className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
            <ArrowLeft size={20} className="text-slate-400" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Kettlebell Coach</h1>
            <p className="text-xs text-slate-500">Girevoy Sport &middot; sessies &amp; records</p>
          </div>
          <Link href="/settings/kettlebell-profile" className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
            <Settings size={18} className="text-slate-400" />
          </Link>
        </div>

        {laden && <div className="h-40 bg-slate-800/50 rounded-2xl animate-pulse" />}

        {fout && (
          <Card className="p-3 text-sm bg-red-500/10 text-red-400 border-red-500/20">{fout}</Card>
        )}

        <Link href="/coach/kettlebell/sessie/nieuw">
          <Card className="p-4 flex items-center justify-center gap-2 bg-primary-600 border-primary-500">
            <Plus size={18} className="text-white" />
            <span className="text-sm font-semibold text-white">Sessie loggen</span>
          </Card>
        </Link>

        <Link href="/coach/kettlebell/beat-my-class">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-white block">Beat My Class</span>
              <span className="text-xs text-slate-500">WKSF-classificatie &amp; promotiestatus</span>
            </div>
          </Card>
        </Link>

        {!laden && analyse && analyse.volume.aantal_sessies > 0 && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Volume (90 dagen)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Sessies</p>
                <p className="text-2xl font-bold text-white">{analyse.volume.aantal_sessies}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Totale reps</p>
                <p className="text-2xl font-bold text-white">{analyse.volume.totale_reps}</p>
              </div>
            </div>
            {analyse.volume.gemiddelde_rpm !== null && (
              <p className="text-xs text-slate-500 mt-3">Gemiddelde RPM: {analyse.volume.gemiddelde_rpm}</p>
            )}
          </Card>
        )}

        {!laden && analyse && analyse.persoonlijke_records.length > 0 && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Persoonlijke records</p>
            <div className="flex flex-col gap-3">
              {analyse.persoonlijke_records.map(pr => (
                <div key={`${pr.discipline}-${pr.bell_weight_kg}`} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{DISCIPLINE_LABEL[pr.discipline] || pr.discipline}</p>
                    <p className="text-xs text-slate-500">{pr.bell_weight_kg} kg</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{pr.reps} reps</p>
                    {pr.rpm_avg !== null && <p className="text-xs text-slate-500">{pr.rpm_avg} RPM</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {!laden && heeftData && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Recente sessies</p>
            <div className="flex flex-col gap-3">
              {sessies.map(s => (
                <div key={s.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{DISCIPLINE_LABEL[s.discipline] || s.discipline}</p>
                    <p className="text-xs text-slate-500">{formatDatum(s.performed_at)} &middot; {s.bell_weight_kg} kg</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white">{s.reps} reps</p>
                    <p className="text-xs text-slate-500">{Math.round(s.duration_sec / 60)} min</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {!laden && !heeftData && !fout && (
          <Card className="p-5 text-center">
            <p className="text-sm text-slate-400">Nog geen kettlebell-sessies gelogd.</p>
            <p className="text-xs text-slate-500 mt-1">Log je eerste Jerk-, Snatch-, Long Cycle- of Biathlon-sessie om records en trends te zien.</p>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
