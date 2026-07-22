'use client'
import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { isoDatum } from '@/utils'
import Link from 'next/link'

// ── Running Trainingskalender — Roadmap v1.0, laatste openstaande punt ──
// Bron: overleg 21 juli 2026. Exact spiegelbeeld van
// coach/cycling/kalender/page.tsx — hergebruikt dezelfde
// GET /api/specialists/running/training-plan als het planningsscherm,
// alleen Running-sessietypen/-kleuren en de juiste route.
//
// Bewust EERLIJK over de rolling horizon: weken buiten de komende 1-2
// weken tonen gewoon lege dagen — geen nepdata.

interface Sessie {
  id: string
  date: string
  type: string
  duration: number
  status: 'planned' | 'scheduled' | 'completed' | 'skipped' | 'adjusted' | 'cancelled'
  adjustment_reason: string | null
}

const TYPE_LABEL: Record<string, string> = {
  easy_run: 'Easy Run',
  lange_duurloop: 'Lange duurloop',
  interval: 'Interval',
  herstel: 'Herstel',
  tempo: 'Tempo',
}

const TYPE_KLEUR: Record<string, string> = {
  easy_run: 'bg-primary-500',
  lange_duurloop: 'bg-blue-500',
  interval: 'bg-red-500',
  herstel: 'bg-green-500',
  tempo: 'bg-amber-500',
}

const MAAND_NAMEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
const DAG_LETTERS = ['M', 'D', 'W', 'D', 'V', 'Z', 'Z']


export default function RunningTrainingsKalenderPage() {
  const [laden, setLaden] = useState(true)
  const [sessies, setSessies] = useState<Sessie[]>([])
  const [huidigeMaand, setHuidigeMaand] = useState(() => {
    const nu = new Date()
    return { jaar: nu.getFullYear(), maand: nu.getMonth() }
  })
  const [geselecteerdeDag, setGeselecteerdeDag] = useState<string | null>(isoDatum(new Date()))

  useEffect(() => {
    fetch('/api/specialists/running/training-plan', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setSessies(data.sessies || []))
      .catch(() => setSessies([]))
      .finally(() => setLaden(false))
  }, [])

  const sessiesPerDag = useMemo(() => {
    const map: Record<string, Sessie> = {}
    for (const s of sessies) map[s.date] = s
    return map
  }, [sessies])

  // ── Maandgrid opbouwen, weken beginnen op maandag ──────────────────
  const dagenInGrid = useMemo(() => {
    const eersteVanMaand = new Date(huidigeMaand.jaar, huidigeMaand.maand, 1)
    const laatsteVanMaand = new Date(huidigeMaand.jaar, huidigeMaand.maand + 1, 0)
    const startWeekdag = (eersteVanMaand.getDay() + 6) % 7 // maandag=0

    const dagen: Array<{ datum: Date; inMaand: boolean }> = []
    for (let i = 0; i < startWeekdag; i++) {
      const d = new Date(eersteVanMaand)
      d.setDate(d.getDate() - (startWeekdag - i))
      dagen.push({ datum: d, inMaand: false })
    }
    for (let dag = 1; dag <= laatsteVanMaand.getDate(); dag++) {
      dagen.push({ datum: new Date(huidigeMaand.jaar, huidigeMaand.maand, dag), inMaand: true })
    }
    while (dagen.length % 7 !== 0) {
      const laatste = dagen[dagen.length - 1].datum
      const d = new Date(laatste)
      d.setDate(d.getDate() + 1)
      dagen.push({ datum: d, inMaand: false })
    }
    return dagen
  }, [huidigeMaand])

  function vorigeMaand() {
    setHuidigeMaand(m => m.maand === 0 ? { jaar: m.jaar - 1, maand: 11 } : { jaar: m.jaar, maand: m.maand - 1 })
  }
  function volgendeMaand() {
    setHuidigeMaand(m => m.maand === 11 ? { jaar: m.jaar + 1, maand: 0 } : { jaar: m.jaar, maand: m.maand + 1 })
  }

  const vandaag = isoDatum(new Date())
  const geselecteerdeSessie = geselecteerdeDag ? sessiesPerDag[geselecteerdeDag] : null

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link href={'/coach/running/trainingsplan'} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Trainingskalender</h1>
            <p className="text-xs text-slate-500">Hardlopen · Running Coach</p>
          </div>
        </div>

        {laden && <div className="h-80 bg-slate-800/50 rounded-2xl animate-pulse" />}

        {!laden && (
          <>
            <div className="flex items-center justify-between">
              <button onClick={vorigeMaand} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 text-slate-400">
                <ChevronLeft size={16} />
              </button>
              <p className="text-sm font-semibold text-white capitalize">{MAAND_NAMEN[huidigeMaand.maand]} {huidigeMaand.jaar}</p>
              <button onClick={volgendeMaand} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 text-slate-400">
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {DAG_LETTERS.map((l, i) => (
                <p key={i} className="text-center text-[10px] text-slate-600 font-medium pb-1">{l}</p>
              ))}
              {dagenInGrid.map(({ datum, inMaand }) => {
                const dagStr = isoDatum(datum)
                const sessie = sessiesPerDag[dagStr]
                const isVandaag = dagStr === vandaag
                const isGeselecteerd = dagStr === geselecteerdeDag

                return (
                  <button key={dagStr} onClick={() => setGeselecteerdeDag(dagStr)}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 relative ${
                      isGeselecteerd ? 'bg-primary-500/20 ring-1 ring-primary-500' : inMaand ? 'bg-slate-800/50' : 'bg-transparent'
                    }`}>
                    <span className={`text-xs ${inMaand ? (isVandaag ? 'text-primary-400 font-bold' : 'text-slate-300') : 'text-slate-700'}`}>
                      {datum.getDate()}
                    </span>
                    {sessie && sessie.status !== 'cancelled' && (
                      <div className={`w-1.5 h-1.5 rounded-full ${TYPE_KLEUR[sessie.type] || 'bg-slate-500'} ${sessie.status === 'completed' ? 'opacity-100' : sessie.status === 'skipped' ? 'opacity-30' : 'opacity-70'}`} />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legenda */}
            <div className="flex flex-wrap gap-3">
              {Object.entries(TYPE_LABEL).map(([key, label]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${TYPE_KLEUR[key]}`} />
                  <span className="text-[10px] text-slate-500">{label}</span>
                </div>
              ))}
            </div>

            {/* Dag-detail */}
            {geselecteerdeDag && (
              <Card className="p-4">
                <p className="text-xs text-slate-500 mb-2">
                  {new Date(geselecteerdeDag).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                {geselecteerdeSessie && geselecteerdeSessie.status !== 'cancelled' ? (
                  <>
                    <p className="text-sm font-semibold text-white">{TYPE_LABEL[geselecteerdeSessie.type] || geselecteerdeSessie.type}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{geselecteerdeSessie.duration} minuten</p>
                    {geselecteerdeSessie.status === 'completed' && <p className="text-xs text-green-400 mt-2">✓ Afgerond</p>}
                    {geselecteerdeSessie.status === 'skipped' && <p className="text-xs text-slate-500 mt-2">Overgeslagen</p>}
                    {geselecteerdeSessie.adjustment_reason && (
                      <p className="text-xs text-amber-400 mt-2">Aangepast — zie trainingsplan voor de uitleg</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    {geselecteerdeDag > vandaag ? 'Nog geen concrete training gepland — dit volgt zodra deze week dichterbij komt.' : 'Geen training gepland op deze dag.'}
                  </p>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
