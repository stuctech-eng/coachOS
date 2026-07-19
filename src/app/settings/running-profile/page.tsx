'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Zap, Heart } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'
import { berekenVDOT, berekenPaceZones, formatteerPace, type PaceZone } from '@/lib/specialists/running-zones'
import { berekenHartslagZones } from '@/lib/specialists/cycling-zones'

// ── Running Profile-instellingen — Roadmap v1.0, Fase 1 ─────────────────
// Bron: overleg 19 juli 2026. Toont berekende zones live (client-side
// herberekening bij elke wijziging, exact dezelfde functies als de
// server — running-zones.ts + cycling-zones.ts, dus geen risico op
// afwijkende uitkomsten tussen client en server). Spiegelbeeld van
// settings/cycling-profile/page.tsx, met één inhoudelijk verschil:
// VDOT komt uit een recente wedstrijdprestatie (afstand + tijd), niet
// uit één los ingevoerd getal — dat is hoe de Daniels-methode werkt.

interface HartslagZone { zone: number; naam: string; van_pct: number; tot_pct: number; van_bpm: number; tot_bpm: number }

const DAGEN = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']
const DAGEN_KORT: Record<string, string> = { maandag: 'Ma', dinsdag: 'Di', woensdag: 'Wo', donderdag: 'Do', vrijdag: 'Vr', zaterdag: 'Za', zondag: 'Zo' }

const VOORINGESTELDE_AFSTANDEN = [
  { label: '5 km', meter: 5000 },
  { label: '10 km', meter: 10000 },
  { label: 'Halve marathon', meter: 21097 },
  { label: 'Marathon', meter: 42195 },
]

export default function RunningProfielPage() {
  const [laden, setLaden] = useState(true)
  const [opslaan, setOpslaan] = useState(false)
  const [message, setMessage] = useState('')

  const [raceAfstandM, setRaceAfstandM] = useState<number>(5000)
  const [raceUren, setRaceUren] = useState('')
  const [raceMinuten, setRaceMinuten] = useState('')
  const [raceSeconden, setRaceSeconden] = useState('')
  const [raceDatum, setRaceDatum] = useState('')
  const [maxHartslag, setMaxHartslag] = useState('')
  const [heeftHartslagmeter, setHeeftHartslagmeter] = useState(false)
  const [heeftCadanssensor, setHeeftCadanssensor] = useState(false)
  const [heeftVermogensmeter, setHeeftVermogensmeter] = useState(false)
  const [trainingsdagen, setTrainingsdagen] = useState<string[]>([])
  const [beschikbareUren, setBeschikbareUren] = useState('')

  const [hartslagzones, setHartslagzones] = useState<HartslagZone[] | null>(null)

  useEffect(() => { laadProfiel() }, [])

  async function laadProfiel() {
    setLaden(true)
    try {
      const res = await fetch('/api/specialists/running/profile', { credentials: 'include' })
      const data = await res.json()
      const p = data.profiel || {}
      if (p.laatste_race_afstand_m) setRaceAfstandM(p.laatste_race_afstand_m)
      if (p.laatste_race_tijd_sec) {
        const t = p.laatste_race_tijd_sec
        setRaceUren(t >= 3600 ? String(Math.floor(t / 3600)) : '')
        setRaceMinuten(String(Math.floor((t % 3600) / 60)))
        setRaceSeconden(String(Math.round(t % 60)))
      }
      if (p.laatste_race_datum) setRaceDatum(p.laatste_race_datum)
      if (p.max_hartslag) setMaxHartslag(String(p.max_hartslag))
      setHeeftHartslagmeter(!!p.heeft_hartslagmeter)
      setHeeftCadanssensor(!!p.heeft_cadanssensor)
      setHeeftVermogensmeter(!!p.heeft_hardloop_vermogensmeter)
      if (p.trainingsdagen) setTrainingsdagen(p.trainingsdagen)
      if (p.beschikbare_uren_per_week !== undefined) setBeschikbareUren(String(p.beschikbare_uren_per_week))
      setHartslagzones(data.hartslagzones)
    } catch {
      setMessage('❌ Laden mislukt')
    } finally {
      setLaden(false)
    }
  }

  function toggleDag(dag: string) {
    setTrainingsdagen(prev => prev.includes(dag) ? prev.filter(d => d !== dag) : [...prev, dag])
  }

  const raceTijdSec = (parseInt(raceUren || '0', 10) * 3600) + (parseInt(raceMinuten || '0', 10) * 60) + parseInt(raceSeconden || '0', 10)
  const heeftGeldigeRace = raceTijdSec > 0 && raceAfstandM > 0

  // Live client-side preview — exact dezelfde functies als de server
  const vdotPreview = heeftGeldigeRace ? berekenVDOT(raceAfstandM, raceTijdSec) : null
  const pacezonesPreview: PaceZone[] | null = vdotPreview !== null ? berekenPaceZones(vdotPreview) : null

  async function slaOp() {
    setOpslaan(true)
    setMessage('')
    try {
      const body: Record<string, unknown> = {
        heeft_hartslagmeter: heeftHartslagmeter,
        heeft_cadanssensor: heeftCadanssensor,
        heeft_hardloop_vermogensmeter: heeftVermogensmeter,
        trainingsdagen,
      }
      if (heeftGeldigeRace) {
        body.laatste_race_afstand_m = raceAfstandM
        body.laatste_race_tijd_sec = raceTijdSec
      }
      if (raceDatum) body.laatste_race_datum = raceDatum
      if (maxHartslag) body.max_hartslag = Number(maxHartslag)
      if (beschikbareUren) body.beschikbare_uren_per_week = Number(beschikbareUren)

      const res = await fetch('/api/specialists/running/profile', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) {
        setMessage('❌ ' + data.error)
      } else {
        setHartslagzones(data.hartslagzones)
        setMessage('✅ Running Profile opgeslagen')
        setTimeout(() => setMessage(''), 2500)
      }
    } catch {
      setMessage('❌ Opslaan mislukt')
    } finally {
      setOpslaan(false)
    }
  }

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href="/coach/running" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Running Profile</h1>
            <p className="text-xs text-slate-500">Race-resultaat, hartslag &amp; sensoren</p>
          </div>
        </div>

        {laden && <div className="h-64 bg-slate-800/50 rounded-2xl animate-pulse" />}

        {!laden && (
          <>
            <Card className="p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-primary-400" />
                <p className="text-sm font-semibold text-white">Recent race-resultaat</p>
              </div>
              <p className="text-[11px] text-slate-500 -mt-2">
                Voor je beste, eerlijke pace zones: gebruik een recente wedstrijd of maximale tijdrit (laatste 4-6 weken), geen rustige duurloop.
              </p>

              <div>
                <p className="text-xs text-slate-500 mb-2">Afstand</p>
                <div className="grid grid-cols-4 gap-2">
                  {VOORINGESTELDE_AFSTANDEN.map(a => (
                    <button key={a.meter} onClick={() => setRaceAfstandM(a.meter)}
                      className={`py-2 rounded-lg text-xs font-medium ${raceAfstandM === a.meter ? 'bg-primary-500 text-white' : 'bg-white/5 text-slate-400'}`}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-2">Tijd</p>
                <div className="flex items-center gap-2">
                  <input type="number" inputMode="numeric" placeholder="u" value={raceUren} onChange={e => setRaceUren(e.target.value)}
                    className="w-16 bg-coach-card border border-coach-border rounded-xl px-3 py-2.5 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-primary-500" />
                  <span className="text-slate-500">:</span>
                  <input type="number" inputMode="numeric" placeholder="min" value={raceMinuten} onChange={e => setRaceMinuten(e.target.value)}
                    className="w-16 bg-coach-card border border-coach-border rounded-xl px-3 py-2.5 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-primary-500" />
                  <span className="text-slate-500">:</span>
                  <input type="number" inputMode="numeric" placeholder="sec" value={raceSeconden} onChange={e => setRaceSeconden(e.target.value)}
                    className="w-16 bg-coach-card border border-coach-border rounded-xl px-3 py-2.5 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-2">Datum (optioneel)</p>
                <input type="date" value={raceDatum} onChange={e => setRaceDatum(e.target.value)}
                  className="w-full bg-coach-card border border-coach-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>

              {vdotPreview !== null && (
                <div className="p-3 bg-primary-500/5 border border-primary-500/20 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1">VDOT (live berekend)</p>
                  <p className="text-2xl font-bold text-white">{Math.round(vdotPreview * 10) / 10}</p>
                </div>
              )}
            </Card>

            {pacezonesPreview && (
              <Card className="p-5">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Pace Zones</p>
                <p className="text-[10px] text-slate-600 mb-3">Daniels/Gilbert VDOT-model — herberekend zodra je een nieuw race-resultaat invult.</p>
                <div className="flex flex-col gap-2.5">
                  {pacezonesPreview.map(zone => (
                    <div key={zone.naam} className="flex items-start justify-between gap-3">
                      <span className="text-sm text-slate-300 flex-1 min-w-0">{zone.naam}</span>
                      <span className="text-sm font-semibold text-white whitespace-nowrap flex-shrink-0">
                        {formatteerPace(zone.pace_van_sec_per_km)}–{formatteerPace(zone.pace_tot_sec_per_km)} /km
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Heart size={16} className="text-red-400" />
                <p className="text-sm font-semibold text-white">Hartslag &amp; sensoren</p>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Max hartslag (bpm)</label>
                <input type="number" inputMode="numeric" value={maxHartslag} onChange={e => setMaxHartslag(e.target.value)}
                  placeholder="bijv. 185"
                  className="w-full bg-coach-card border border-coach-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
              {[
                { label: 'Hartslagmeter', value: heeftHartslagmeter, set: setHeeftHartslagmeter },
                { label: 'Cadanssensor', value: heeftCadanssensor, set: setHeeftCadanssensor },
                { label: 'Hardloop-vermogensmeter', value: heeftVermogensmeter, set: setHeeftVermogensmeter },
              ].map(s => (
                <button key={s.label} onClick={() => s.set(!s.value)} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{s.label}</span>
                  <div className={`w-11 h-6 rounded-full transition-colors ${s.value ? 'bg-primary-500' : 'bg-slate-700'} relative`}>
                    <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${s.value ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              ))}
            </Card>

            {hartslagzones && (
              <Card className="p-5">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Hartslagzones</p>
                {hartslagzones.map(z => (
                  <div key={z.zone} className="flex items-start justify-between gap-2 text-xs mb-2">
                    <span className="text-slate-400 flex-1 min-w-0">Z{z.zone} · {z.naam}</span>
                    <span className="text-white font-medium whitespace-nowrap flex-shrink-0">{z.van_bpm}–{z.tot_bpm} bpm</span>
                  </div>
                ))}
              </Card>
            )}

            <Card className="p-5 flex flex-col gap-3">
              <p className="text-sm font-semibold text-white">Trainingsdagen</p>
              <p className="text-[11px] text-slate-500 -mt-2">Apart van je Cycling-trainingsdagen — je kunt andere dagen hardlopen dan fietsen.</p>
              <div className="flex gap-2">
                {DAGEN.map(dag => (
                  <button key={dag} onClick={() => toggleDag(dag)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium ${trainingsdagen.includes(dag) ? 'bg-primary-500 text-white' : 'bg-white/5 text-slate-400'}`}>
                    {DAGEN_KORT[dag]}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Beschikbare uren per week</label>
                <input type="number" inputMode="numeric" value={beschikbareUren} onChange={e => setBeschikbareUren(e.target.value)}
                  className="w-full bg-coach-card border border-coach-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
            </Card>

            {message && <p className={`text-sm text-center ${message.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>{message}</p>}

            <Button onClick={slaOp} loading={opslaan} fullWidth size="lg">Opslaan</Button>
          </>
        )}
      </div>
    </AppShell>
  )
}
