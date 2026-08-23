'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'

// ── Kettlebell Competities — MVP2 ────────────────────────────────────────
// Wedstrijden zijn zelf-gerapporteerd (geen officiële WKSF-kalender
// geïmporteerd, zie eerdere bronaudits) — puur een organisatorisch anker
// voor je eigen deelnames. Resultaten worden vastgelegd los van
// classificatienormen; een berekende classificatie bij een resultaat is
// altijd voorlopig (zelfde disclaimer als Beat My Class, want gebaseerd
// op strongly_indicated-brondata).

const RANKING_DISCIPLINES = [
  'long_cycle_10', 'biathlon_10', 'snatch_12', 'one_arm_long_cycle_10', 'snatch_10',
  'long_cycle_30', 'jerk_30', 'snatch_30', 'long_cycle_60', 'jerk_60',
]

interface Competitie {
  id: string
  name: string
  event_date: string | null
  location: string | null
}

interface Deelname {
  id: string
  competition_id: string
  discipline: string
  status: string
  reps: number | null
  result_class: string | null
  target_class: string | null
}

export default function KettlebellCompetitiesPage() {
  const [wksfFederationId, setWksfFederationId] = useState('')
  const [competities, setCompeties] = useState<Competitie[]>([])
  const [deelnames, setDeelnames] = useState<Deelname[]>([])
  const [laden, setLaden] = useState(true)
  const [fout, setFout] = useState<string | null>(null)

  const [naam, setNaam] = useState('')
  const [datum, setDatum] = useState('')
  const [locatie, setLocatie] = useState('')

  const [gekozenCompetitieId, setGekozenCompetitieId] = useState('')
  const [discipline, setDiscipline] = useState(RANKING_DISCIPLINES[0])

  const laadAlles = useCallback(() => {
    setLaden(true)
    Promise.all([
      fetch('/api/specialists/kettlebell/federations').then(r => r.json()),
      fetch('/api/specialists/kettlebell/competitions').then(r => r.json()),
      fetch('/api/specialists/kettlebell/competition-entries').then(r => r.json()),
    ])
      .then(([f, c, d]) => {
        if (!f.error) {
          const wksf = (f.federaties || []).find((x: { slug: string }) => x.slug === 'wksf')
          if (wksf) setWksfFederationId(wksf.id)
        }
        if (!c.error) setCompeties(c.competities || [])
        if (!d.error) setDeelnames(d.deelnames || [])
      })
      .catch(() => setFout('Kon competitiedata niet ophalen'))
      .finally(() => setLaden(false))
  }, [])

  useEffect(() => { laadAlles() }, [laadAlles])

  async function competitieToevoegen() {
    if (!naam) { setFout('Vul een naam in'); return }
    if (!wksfFederationId) { setFout('Federatie nog niet geladen, probeer opnieuw'); return }
    setFout(null)
    const res = await fetch('/api/specialists/kettlebell/competitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: naam, federation_id: wksfFederationId, event_date: datum || undefined, location: locatie || undefined }),
    })
    if (!res.ok) { setFout('Wedstrijd toevoegen mislukt'); return }
    setNaam(''); setDatum(''); setLocatie('')
    laadAlles()
  }

  async function deelnameToevoegen() {
    if (!gekozenCompetitieId) { setFout('Kies eerst een wedstrijd'); return }
    if (!wksfFederationId) { setFout('Federatie nog niet geladen, probeer opnieuw'); return }
    setFout(null)
    const res = await fetch('/api/specialists/kettlebell/competition-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competition_id: gekozenCompetitieId, federation_id: wksfFederationId, discipline }),
    })
    if (!res.ok) { setFout('Deelname toevoegen mislukt'); return }
    laadAlles()
  }

  async function resultaatInvoeren(entryId: string, reps: string) {
    if (!reps) return
    setFout(null)
    const res = await fetch('/api/specialists/kettlebell/competition-entries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: entryId, reps: Number(reps) }),
    })
    if (!res.ok) { setFout('Resultaat vastleggen mislukt'); return }
    laadAlles()
  }

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href="/coach/kettlebell" className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
            <ArrowLeft size={20} className="text-slate-400" />
          </Link>
          <h1 className="text-xl font-bold text-white">Competities</h1>
        </div>

        {fout && <Card className="p-3 text-sm bg-red-500/10 text-red-400 border-red-500/20">{fout}</Card>}

        <Card className="p-5 flex flex-col gap-3">
          <p className="text-sm font-medium text-white">Wedstrijd toevoegen</p>
          <p className="text-xs text-slate-500">Zelf-gerapporteerd — geen officiële WKSF-kalender, puur je eigen overzicht.</p>
          <input value={naam} onChange={e => setNaam(e.target.value)} placeholder="Naam wedstrijd"
            className="bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none" />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
              className="bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none" />
            <input value={locatie} onChange={e => setLocatie(e.target.value)} placeholder="Locatie"
              className="bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none" />
          </div>
          <Button onClick={competitieToevoegen}>Toevoegen</Button>
        </Card>

        {!laden && competities.length > 0 && (
          <Card className="p-5 flex flex-col gap-3">
            <p className="text-sm font-medium text-white">Deelname registreren</p>
            <select value={gekozenCompetitieId} onChange={e => setGekozenCompetitieId(e.target.value)}
              className="bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none">
              <option value="">Kies wedstrijd...</option>
              {competities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={discipline} onChange={e => setDiscipline(e.target.value)}
              className="bg-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none">
              {RANKING_DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <Button onClick={deelnameToevoegen}>
              <Plus size={16} className="inline mr-1" /> Deelname toevoegen
            </Button>
          </Card>
        )}

        {!laden && deelnames.length > 0 && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Jouw deelnames</p>
            <div className="flex flex-col gap-3">
              {deelnames.map(d => (
                <div key={d.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{d.discipline}</p>
                    <p className="text-xs text-slate-500">{d.status === 'completed' ? `${d.reps} reps${d.result_class ? ` — ${d.result_class} (voorlopig)` : ''}` : 'Gepland'}</p>
                  </div>
                  {d.status !== 'completed' && (
                    <input type="number" placeholder="reps" onBlur={e => resultaatInvoeren(d.id, e.target.value)}
                      className="w-20 bg-slate-800 text-white rounded-lg px-2 py-1.5 text-sm outline-none" />
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {!laden && competities.length === 0 && (
          <Card className="p-5 text-center">
            <p className="text-sm text-slate-400">Nog geen wedstrijden toegevoegd.</p>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
