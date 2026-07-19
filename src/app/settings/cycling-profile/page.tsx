'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Zap, Heart } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card, Button } from '@/components/ui'

// ── Cycling Profile-instellingen — Fase 1, Cycling Foundation ──────────
// Bron: docs/cycling-specialist-roadmap-v1.md. Toont berekende zones
// live (client-side herberekening bij elke wijziging, exact dezelfde
// formules als de server — beide gebruiken cycling-zones.ts, dus geen
// risico op afwijkende uitkomsten tussen client en server).

interface VermogensZone { zone: number; naam: string; van_pct: number; tot_pct: number | null; van_watt: number; tot_watt: number | null }
interface HartslagZone { zone: number; naam: string; van_pct: number; tot_pct: number; van_bpm: number; tot_bpm: number }

const DAGEN = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']
const DAGEN_KORT: Record<string, string> = { maandag: 'Ma', dinsdag: 'Di', woensdag: 'Wo', donderdag: 'Do', vrijdag: 'Vr', zaterdag: 'Za', zondag: 'Zo' }

export default function CyclingProfielPage() {
  const router = useRouter()
  const [laden, setLaden] = useState(true)
  const [opslaan, setOpslaan] = useState(false)
  const [message, setMessage] = useState('')

  const [ftp, setFtp] = useState('')
  const [maxHartslag, setMaxHartslag] = useState('')
  const [heeftVermogensmeter, setHeeftVermogensmeter] = useState(false)
  const [heeftHartslagmeter, setHeeftHartslagmeter] = useState(false)
  const [heeftCadanssensor, setHeeftCadanssensor] = useState(false)
  const [heeftSmarttrainer, setHeeftSmarttrainer] = useState(false)
  const [heeftZwift, setHeeftZwift] = useState(false)
  const [trainingsdagen, setTrainingsdagen] = useState<string[]>([])
  const [beschikbareUren, setBeschikbareUren] = useState('')

  const [vermogenszones, setVermogenszones] = useState<VermogensZone[] | null>(null)
  const [hartslagzones, setHartslagzones] = useState<HartslagZone[] | null>(null)

  useEffect(() => { laadProfiel() }, [])

  async function laadProfiel() {
    setLaden(true)
    try {
      const res = await fetch('/api/specialists/cycling/profile', { credentials: 'include' })
      const data = await res.json()
      const p = data.profiel || {}
      if (p.ftp) setFtp(String(p.ftp))
      if (p.max_hartslag) setMaxHartslag(String(p.max_hartslag))
      setHeeftVermogensmeter(!!p.heeft_vermogensmeter)
      setHeeftHartslagmeter(!!p.heeft_hartslagmeter)
      setHeeftCadanssensor(!!p.heeft_cadanssensor)
      setHeeftSmarttrainer(!!p.heeft_smarttrainer)
      setHeeftZwift(!!p.heeft_zwift)
      if (p.trainingsdagen) setTrainingsdagen(p.trainingsdagen)
      if (p.beschikbare_uren_per_week !== undefined) setBeschikbareUren(String(p.beschikbare_uren_per_week))
      setVermogenszones(data.vermogenszones)
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

  async function slaOp() {
    setOpslaan(true)
    setMessage('')
    try {
      const body: Record<string, unknown> = {
        heeft_vermogensmeter: heeftVermogensmeter,
        heeft_hartslagmeter: heeftHartslagmeter,
        heeft_cadanssensor: heeftCadanssensor,
        heeft_smarttrainer: heeftSmarttrainer,
        heeft_zwift: heeftZwift,
        trainingsdagen,
      }
      if (ftp) body.ftp = Number(ftp)
      if (maxHartslag) body.max_hartslag = Number(maxHartslag)
      if (beschikbareUren) body.beschikbare_uren_per_week = Number(beschikbareUren)

      const res = await fetch('/api/specialists/cycling/profile', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) {
        setMessage('❌ ' + data.error)
      } else {
        setVermogenszones(data.vermogenszones)
        setHartslagzones(data.hartslagzones)
        setMessage('✅ Cycling Profile opgeslagen')
        setTimeout(() => setMessage(''), 2500)
      }
    } catch {
      setMessage('❌ Opslaan mislukt')
    } finally {
      setOpslaan(false)
    }
  }

  if (laden) {
    return (
      <AppShell showNav={false}>
        <div className="px-5 py-6 flex flex-col gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-coach-card animate-pulse" />)}
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center active:bg-slate-700">
            <ArrowLeft size={20} className="text-slate-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Cycling Profile</h1>
            <p className="text-xs text-slate-500">Basis voor je zones en trainingsplan</p>
          </div>
        </div>

        {message && <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-3"><p className="text-primary-400 text-sm">{message}</p></div>}

        <Card className="p-4 flex flex-col gap-4">
          <p className="text-sm font-semibold text-white">Vermogen &amp; hartslag</p>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">FTP (watt)</label>
            <input value={ftp} onChange={e => setFtp(e.target.value)} type="number"
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Bijv. 250" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Max hartslag (bpm)</label>
            <input value={maxHartslag} onChange={e => setMaxHartslag(e.target.value)} type="number"
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Bijv. 185" />
          </div>
          <p className="text-[11px] text-slate-600">
            Gewicht, lengte en rusthartslag beheer je via je algemene profiel — die worden hier niet dubbel bijgehouden.
          </p>
        </Card>

        {vermogenszones && (
          <Card className="p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={14} className="text-primary-400" />
              <p className="text-sm font-semibold text-white">Vermogenszones</p>
            </div>
            {vermogenszones.map(z => (
              <div key={z.zone} className="flex items-start justify-between gap-2 text-xs">
                <span className="text-slate-400 flex-1 min-w-0">Z{z.zone} · {z.naam}</span>
                <span className="text-white font-medium whitespace-nowrap flex-shrink-0">{z.van_watt}{z.tot_watt !== null ? `–${z.tot_watt}` : '+'}W</span>
              </div>
            ))}
          </Card>
        )}

        {hartslagzones && (
          <Card className="p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <Heart size={14} className="text-red-400" />
              <p className="text-sm font-semibold text-white">Hartslagzones</p>
            </div>
            {hartslagzones.map(z => (
              <div key={z.zone} className="flex items-start justify-between gap-2 text-xs">
                <span className="text-slate-400 flex-1 min-w-0">Z{z.zone} · {z.naam}</span>
                <span className="text-white font-medium whitespace-nowrap flex-shrink-0">{z.van_bpm}–{z.tot_bpm} bpm</span>
              </div>
            ))}
          </Card>
        )}

        <Card className="p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-white">Materiaal</p>
          {[
            { label: 'Vermogensmeter', waarde: heeftVermogensmeter, set: setHeeftVermogensmeter },
            { label: 'Hartslagmeter', waarde: heeftHartslagmeter, set: setHeeftHartslagmeter },
            { label: 'Cadanssensor', waarde: heeftCadanssensor, set: setHeeftCadanssensor },
            { label: 'Smarttrainer', waarde: heeftSmarttrainer, set: setHeeftSmarttrainer },
            { label: 'Zwift', waarde: heeftZwift, set: setHeeftZwift },
          ].map(item => (
            <button key={item.label} onClick={() => item.set(!item.waarde)}
              className="flex items-center justify-between py-1">
              <span className="text-sm text-slate-300">{item.label}</span>
              <div className={`w-11 h-6 rounded-full transition-colors ${item.waarde ? 'bg-primary-500' : 'bg-slate-700'} relative`}>
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${item.waarde ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </button>
          ))}
        </Card>

        <Card className="p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-white">Trainingsdagen</p>
          <div className="flex gap-2 flex-wrap">
            {DAGEN.map(dag => (
              <button key={dag} onClick={() => toggleDag(dag)}
                className={`w-11 h-11 rounded-xl text-xs font-medium ${trainingsdagen.includes(dag) ? 'bg-primary-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                {DAGEN_KORT[dag]}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Beschikbare uren per week</label>
            <input value={beschikbareUren} onChange={e => setBeschikbareUren(e.target.value)} type="number"
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Bijv. 8" />
          </div>
        </Card>

        <Button onClick={slaOp} loading={opslaan} fullWidth>Opslaan</Button>
      </div>
    </AppShell>
  )
}
