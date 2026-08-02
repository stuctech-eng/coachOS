'use client'
import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { useRouter } from 'next/navigation'

// ── Universal Athlete Platform — weergavepagina ──────────────────────────
// Bron: overleg 2 augustus 2026, eerste UI-koppeling. Exact het format
// dat in het ontwerpoverleg is vastgelegd: kwalitatief label + expliciete
// confidence, NOOIT een los getal ("Cardio +65") rechtstreeks tonen —
// dat was de kritieke correctie tijdens het ontwerp zelf.

interface UniverseleWaarde {
  niveau: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; confidence_score: number; toelichting?: string
}
interface AthleteState {
  laatst_bijgewerkt: string
  cardiovasculair: Record<string, UniverseleWaarde>
  spieren: Record<string, UniverseleWaarde>
  mechanisch: Record<string, UniverseleWaarde>
  neurologisch: Record<string, UniverseleWaarde>
  herstel: Record<string, UniverseleWaarde>
  mentaal: Record<string, UniverseleWaarde>
  training: Record<string, UniverseleWaarde>
  omgeving: Record<string, UniverseleWaarde>
}

const NIVEAU_LABEL: Record<string, string> = {
  zeer_laag: 'Zeer laag', laag: 'Laag', gemiddeld: 'Gemiddeld', hoog: 'Hoog', zeer_hoog: 'Zeer hoog',
}
const NIVEAU_BALKEN: Record<string, number> = {
  zeer_laag: 1, laag: 2, gemiddeld: 3, hoog: 4, zeer_hoog: 5,
}
const VELD_LABEL: Record<string, string> = {
  aerobic_load: 'Aerobe belasting', anaerobic_load: 'Anaerobe belasting', vo2_adaptatie: 'VO2-adaptatie', cardio_vermoeidheid: 'Cardio-vermoeidheid',
  been_vermoeidheid: 'Beenvermoeidheid', core_vermoeidheid: 'Core-vermoeidheid', bovenlichaam_vermoeidheid: 'Bovenlichaam-vermoeidheid', onderrug_vermoeidheid: 'Onderrug-vermoeidheid', grip_vermoeidheid: 'Grip-vermoeidheid',
  gewricht_impact: 'Gewricht-impact', pees_belasting: 'Pees-belasting', bot_stress: 'Bot-stress', spierschade: 'Spierschade',
  neuromusculaire_vermoeidheid: 'Neuromusculaire vermoeidheid', coordinatie: 'Coördinatie', motorische_controle: 'Motorische controle', explosiviteit: 'Explosiviteit',
  herstel: 'Herstel', slaap_tekort: 'Slaaptekort', hrv_trend: 'HRV-trend', rust_hartslag: 'Rust-hartslag', body_battery: 'Body Battery', herstel_capaciteit: 'Herstelcapaciteit',
  stress: 'Stress', motivatie: 'Motivatie', focus: 'Focus', cognitieve_vermoeidheid: 'Cognitieve vermoeidheid',
  acute_belasting: 'Acute belasting', chronische_belasting: 'Chronische belasting', acwr: 'ACWR', consistentie: 'Consistentie', trainingsmonotonie: 'Trainingsmonotonie', trainingsspanning: 'Trainingsspanning',
  hitte_adaptatie: 'Hitte-adaptatie', koude_adaptatie: 'Koude-adaptatie', hoogte_adaptatie: 'Hoogte-adaptatie', hydratatie_status: 'Hydratatie', energie_beschikbaarheid: 'Energie-beschikbaarheid',
}
const CATEGORIE_LABEL: Record<string, string> = {
  cardiovasculair: 'Cardiovasculair', spieren: 'Spieren', mechanisch: 'Mechanisch', neurologisch: 'Neurologisch',
  herstel: 'Herstel', mentaal: 'Mentaal', training: 'Training', omgeving: 'Omgeving',
}

function ConfidenceKleur({ confidence }: { confidence: string }) {
  const kleur = confidence === 'HIGH' ? 'text-green-400' : confidence === 'MEDIUM' ? 'text-amber-400' : 'text-slate-500'
  return <span className={kleur}>{confidence}</span>
}

function WaardeRij({ veld, waarde }: { veld: string; waarde: UniverseleWaarde }) {
  const balken = NIVEAU_BALKEN[waarde.niveau] || 3
  return (
    <div className="flex items-center justify-between py-2 border-b border-coach-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">{VELD_LABEL[veld] || veld}</p>
        <div className="flex gap-0.5 mt-1">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className={`h-1.5 w-4 rounded-full ${i <= balken ? 'bg-primary-500' : 'bg-slate-700'}`} />
          ))}
        </div>
      </div>
      <div className="text-right ml-3">
        <p className="text-sm text-white">{NIVEAU_LABEL[waarde.niveau] || waarde.niveau}</p>
        <p className="text-[10px]"><ConfidenceKleur confidence={waarde.confidence} /> · {waarde.confidence_score}%</p>
        {waarde.toelichting && <p className="text-[10px] text-slate-600">{waarde.toelichting}</p>}
      </div>
    </div>
  )
}

export default function AthletePlatformPage() {
  const router = useRouter()
  const [laden, setLaden] = useState(true)
  const [state, setState] = useState<AthleteState | null>(null)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/athlete-platform/state')
      .then(r => r.json())
      .then(d => { if (d.error) setFout(d.error); else setState(d.state) })
      .catch(() => setFout('Kon niet laden'))
      .finally(() => setLaden(false))
  }, [])

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
            <ArrowLeft size={20} className="text-slate-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Jouw digitale model</h1>
            <p className="text-xs text-slate-500">Universal Athlete Platform — experimenteel</p>
          </div>
        </div>

        {laden && <div className="h-40 bg-slate-800/50 rounded-2xl animate-pulse" />}
        {fout && <Card className="p-4 text-sm text-red-400">{fout}</Card>}

        {!laden && state && (
          <>
            <Card className="p-3 text-xs text-slate-400">
              Dit is een vroege, experimentele weergave van hoe CoachOS je lichaam over alle sporten heen modelleert — sport-onafhankelijk. Hoe meer sessies, hoe hoger de confidence.
            </Card>
            {Object.entries(CATEGORIE_LABEL).map(([categorie, label]) => (
              <Card key={categorie} className="p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{label}</p>
                {Object.entries(state[categorie as keyof AthleteState] as Record<string, UniverseleWaarde>).map(([veld, waarde]) => (
                  <WaardeRij key={veld} veld={veld} waarde={waarde} />
                ))}
              </Card>
            ))}
          </>
        )}
      </div>
    </AppShell>
  )
}
