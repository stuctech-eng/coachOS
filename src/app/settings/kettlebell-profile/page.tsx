'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'

// ── Kettlebell Profiel-instellingen — Fase 0 + MVP1 ──────────────────────
// 'modus' bepaalt welk systeem de gebruiker primair gebruikt: 'fitness'
// (bestaande Trainer AI + kettlebell-exercises.ts, ongewijzigd) of
// 'sport' (deze nieuwe Kettlebell Specialist). federatie_voorkeur is een
// naam-voorkeur, GEEN regelset — classificatie tegen die federatie volgt
// pas in MVP2 zodra het officiële reglement is aangeleverd.

const DISCIPLINES = [
  { waarde: 'jerk', label: 'Jerk' },
  { waarde: 'snatch', label: 'Snatch' },
  { waarde: 'long_cycle', label: 'Long Cycle' },
  { waarde: 'biathlon', label: 'Biathlon' },
  { waarde: 'one_arm_long_cycle', label: 'One Arm Long Cycle' },
]

const FEDERATIES = [
  { waarde: 'wksf', label: 'WKSF' },
  { waarde: 'iukl', label: 'IUKL' },
  { waarde: 'gsu', label: 'GSU' },
  { waarde: 'geen', label: 'Geen voorkeur' },
]

export default function KettlebellProfielPage() {
  const [laden, setLaden] = useState(true)
  const [opslaan, setOpslaan] = useState(false)
  const [message, setMessage] = useState('')
  const [modus, setModus] = useState<'fitness' | 'sport'>('fitness')
  const [primaireDiscipline, setPrimaireDiscipline] = useState<string>('')
  const [federatieVoorkeur, setFederatieVoorkeur] = useState('geen')

  useEffect(() => {
    fetch('/api/specialists/kettlebell/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.preferences?.modus) setModus(d.preferences.modus)
        if (d.preferences?.primaire_discipline) setPrimaireDiscipline(d.preferences.primaire_discipline)
        if (d.preferences?.federatie_voorkeur) setFederatieVoorkeur(d.preferences.federatie_voorkeur)
      })
      .finally(() => setLaden(false))
  }, [])

  async function opslaanKlik() {
    setOpslaan(true)
    try {
      const res = await fetch('/api/specialists/kettlebell/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modus,
          primaire_discipline: primaireDiscipline || undefined,
          federatie_voorkeur: federatieVoorkeur,
        }),
      })
      if (res.ok) { setMessage('Opgeslagen'); setTimeout(() => setMessage(''), 2000) }
      else setMessage('Mislukt')
    } catch { setMessage('Mislukt') } finally { setOpslaan(false) }
  }

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href="/coach/kettlebell" className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
            <ArrowLeft size={20} className="text-slate-400" />
          </Link>
          <h1 className="text-xl font-bold text-white">Kettlebell Profiel</h1>
        </div>

        {laden && <div className="h-40 bg-slate-800/50 rounded-2xl animate-pulse" />}

        {!laden && (
          <Card className="p-5 flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-white mb-2">Trainingsmodus</p>
              <p className="text-xs text-slate-500 mb-3">
                Fitness gebruikt de bestaande kettlebell-oefenbibliotheek (kracht/conditie/mobiliteit). Sport is voor Girevoy Sport-training en wedstrijdvoorbereiding.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setModus('fitness')}
                  className={`py-2.5 rounded-lg text-sm font-medium ${modus === 'fitness' ? 'bg-primary-500 text-white' : 'bg-white/5 text-slate-400'}`}>
                  Kettlebell Fitness
                </button>
                <button onClick={() => setModus('sport')}
                  className={`py-2.5 rounded-lg text-sm font-medium ${modus === 'sport' ? 'bg-primary-500 text-white' : 'bg-white/5 text-slate-400'}`}>
                  Kettlebell Sport
                </button>
              </div>
            </div>

            {modus === 'sport' && (
              <>
                <div className="pt-2 border-t border-coach-border">
                  <p className="text-sm font-medium text-white mb-2">Primaire discipline</p>
                  <div className="grid grid-cols-2 gap-2">
                    {DISCIPLINES.map(d => (
                      <button key={d.waarde} onClick={() => setPrimaireDiscipline(d.waarde)}
                        className={`py-2.5 rounded-lg text-sm font-medium ${primaireDiscipline === d.waarde ? 'bg-primary-500 text-white' : 'bg-white/5 text-slate-400'}`}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-white mb-2">Federatievoorkeur</p>
                  <p className="text-xs text-slate-500 mb-3">
                    Bepaalt straks welke officiële regelset gebruikt wordt voor classificatie en promotie (MVP2, nog niet actief).
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {FEDERATIES.map(f => (
                      <button key={f.waarde} onClick={() => setFederatieVoorkeur(f.waarde)}
                        className={`py-2.5 rounded-lg text-sm font-medium ${federatieVoorkeur === f.waarde ? 'bg-primary-500 text-white' : 'bg-white/5 text-slate-400'}`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Button onClick={opslaanKlik} disabled={opslaan}>
              {opslaan ? 'Bezig...' : 'Opslaan'}
            </Button>
            {message && <p className="text-xs text-center text-slate-400">{message}</p>}
          </Card>
        )}
      </div>
    </AppShell>
  )
}
