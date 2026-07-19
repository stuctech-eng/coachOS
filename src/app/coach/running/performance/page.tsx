'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'

// ── Running Performance Center — Roadmap v1.0, Fase 2, eerste levering ──
// Bron: overleg 19 juli 2026. BEWUST GEEN nieuwe SQL, nieuwe API-routes
// of nieuwe berekeningen — dit is uitsluitend een samenvoeging van twee
// al-bestaande endpoints tot één analysecentrum, zelfde aanpak als
// Cycling's Power Center (v2.4.118):
//   - /api/specialists/running/profile   → VDOT, Pace Zones, Hartslagzones
//   - /api/specialists/running/dashboard → Dashboard-kengetallen + Records
//
// Pace Curve is GEEN nieuwe data — het is de Records-data (afstandscurve,
// v2.4.128) als grafiek getoond i.p.v. een lijst. "Persoonlijke records"
// en "Pace Curve" uit de Master Spec zijn dezelfde onderliggende data,
// twee weergaven.
//
// FUNDAMENT, GEEN EINDPUNT: Trainingsbelasting, Progressie en andere
// Fase 2/3-onderdelen krijgen later een eigen sectie hier.

interface PaceZone {
  naam: string
  pct_van: number
  pct_tot: number | null
  pace_van_sec_per_km: number
  pace_tot_sec_per_km: number
}
interface HartslagZone { zone: number; naam: string; van_pct: number; tot_pct: number; van_bpm: number; tot_bpm: number }
interface AfstandRecord { afstand_m: number; tijd_sec: number; datum: string }
interface RunningDashboard {
  gemiddelde_pace_sec_per_km: number | null
  gemiddelde_hartslag: number | null
  gemiddelde_cadans: number | null
  hoogtemeters: number
}

const AFSTAND_LABELS: Record<number, string> = {
  100: '100m', 200: '200m', 400: '400m', 800: '800m', 1000: '1km',
  1609: '1mi', 3000: '3km', 5000: '5km', 10000: '10km', 15000: '15km',
  16093: '10mi', 21097: 'Halve', 25000: '25km', 30000: '30km', 42195: 'Marathon',
}

function formatteerPace(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${min}:${String(sec).padStart(2, '0')}`
}

function formatteerTijd(sec: number): string {
  const uren = Math.floor(sec / 3600)
  const minuten = Math.floor((sec % 3600) / 60)
  const seconden = Math.round(sec % 60)
  if (uren > 0) return `${uren}:${String(minuten).padStart(2, '0')}:${String(seconden).padStart(2, '0')}`
  return `${minuten}:${String(seconden).padStart(2, '0')}`
}

export default function RunningPerformanceCenterPage() {
  const [laden, setLaden] = useState(true)
  const [vdot, setVdot] = useState<number | null>(null)
  const [pacezones, setPacezones] = useState<PaceZone[] | null>(null)
  const [hartslagzones, setHartslagzones] = useState<HartslagZone[] | null>(null)
  const [records, setRecords] = useState<AfstandRecord[]>([])
  const [dashboard, setDashboard] = useState<RunningDashboard | null>(null)

  useEffect(() => {
    async function laadAlles() {
      setLaden(true)
      try {
        const [profielRes, dashboardRes] = await Promise.all([
          fetch('/api/specialists/running/profile', { credentials: 'include' }),
          fetch('/api/specialists/running/dashboard', { credentials: 'include' }),
        ])
        const profielData = await profielRes.json()
        const dashboardData = await dashboardRes.json()

        setVdot(profielData?.vdot ?? null)
        setPacezones(profielData?.pacezones || null)
        setHartslagzones(profielData?.hartslagzones || null)
        setRecords(dashboardData?.records || [])
        setDashboard(dashboardData?.dashboard || null)
      } catch {
        // Elke sectie checkt zelf op aanwezige data — geen aparte
        // globale foutstaat nodig
      } finally {
        setLaden(false)
      }
    }
    laadAlles()
  }, [])

  // Pace Curve: snelheid (m/s) als basis voor bar-hoogte — zelfde
  // visuele taal als de Cycling-vermogenscurve (korte afstand = hoge
  // snelheid = hoge balk)
  const curvePunten = records.map(r => ({ ...r, snelheidMps: r.afstand_m / r.tijd_sec }))
  const maxSnelheid = curvePunten.length > 0 ? Math.max(...curvePunten.map(p => p.snelheidMps)) : 1

  const geenDataHelemaal = !laden && !vdot && records.length === 0 && !dashboard

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href="/coach/running" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Performance Center</h1>
            <p className="text-xs text-slate-500">VDOT, Pace Curve, records &amp; zones</p>
          </div>
        </div>

        {laden && (
          <div className="flex flex-col gap-3">
            <div className="h-24 bg-slate-800/50 rounded-2xl animate-pulse" />
            <div className="h-40 bg-slate-800/50 rounded-2xl animate-pulse" />
            <div className="h-32 bg-slate-800/50 rounded-2xl animate-pulse" />
          </div>
        )}

        {geenDataHelemaal && (
          <Card className="p-6 text-center">
            <p className="text-sm text-slate-400 mb-4">Nog geen race-resultaat ingevuld en geen hardloopdata beschikbaar.</p>
            <Link href="/settings/running-profile"
              className="inline-block px-5 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold">
              Running Profile instellen
            </Link>
          </Card>
        )}

        {/* 1. Overzicht */}
        {!laden && (vdot || dashboard) && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Overzicht</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">VDOT</p>
                <p className="text-2xl font-bold text-white">{vdot ?? '–'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Gem. pace</p>
                <p className="text-2xl font-bold text-white">
                  {dashboard?.gemiddelde_pace_sec_per_km ? `${formatteerPace(dashboard.gemiddelde_pace_sec_per_km)}` : '–'}
                  <span className="text-xs text-slate-500 font-normal"> /km</span>
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* 2. Pace Curve */}
        {!laden && curvePunten.length > 0 && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Pace Curve</p>
            <p className="text-[10px] text-slate-600 mb-4">All-time snelste tijd per afstand, over al je Garmin-geïmporteerde runs sinds v2.4.128.</p>
            <div className="flex items-end gap-1" style={{ height: 110 }}>
              {curvePunten.map(punt => {
                const barHoogtePx = Math.max(4, Math.round((punt.snelheidMps / maxSnelheid) * 90))
                const paceSecPerKm = punt.tijd_sec / (punt.afstand_m / 1000)
                return (
                  <div key={punt.afstand_m} className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: 110 }}>
                    <span className="text-[8px] text-slate-400 font-medium">{formatteerPace(paceSecPerKm)}</span>
                    <div className="w-full bg-amber-500/70 rounded-t-sm" style={{ height: barHoogtePx }} />
                    <span className="text-[8px] text-slate-600">{AFSTAND_LABELS[punt.afstand_m] || `${punt.afstand_m}m`}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* 3. Persoonlijke records */}
        {!laden && records.length > 0 && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Persoonlijke records</p>
            <div className="flex flex-col gap-2.5">
              {records.map(r => (
                <div key={r.afstand_m} className="flex items-start justify-between gap-3">
                  <span className="text-sm text-slate-300 flex-1 min-w-0">{AFSTAND_LABELS[r.afstand_m] || `${r.afstand_m} m`}</span>
                  <span className="text-sm font-semibold text-white whitespace-nowrap flex-shrink-0">{formatteerTijd(r.tijd_sec)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 4. Pace Zones */}
        {!laden && pacezones && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Pace Zones</p>
            <p className="text-[10px] text-slate-600 mb-3">Daniels/Gilbert VDOT-model.</p>
            <div className="flex flex-col gap-2.5">
              {pacezones.map(zone => (
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

        {/* 5. Hartslagzones */}
        {!laden && hartslagzones && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Hartslagzones</p>
            <div className="flex flex-col gap-2.5">
              {hartslagzones.map(z => (
                <div key={z.zone} className="flex items-start justify-between gap-3">
                  <span className="text-sm text-slate-300 flex-1 min-w-0">Z{z.zone} — {z.naam}</span>
                  <span className="text-sm font-semibold text-white whitespace-nowrap flex-shrink-0">{z.van_bpm}–{z.tot_bpm} bpm</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 6. Cadans & hoogte — hergebruikt uit het Dashboard, geen
            nieuwe berekening */}
        {!laden && dashboard && (dashboard.gemiddelde_cadans || dashboard.hoogtemeters > 0) && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Cadans &amp; hoogte</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Gem. cadans</p>
                <p className="text-lg font-bold text-white">{dashboard.gemiddelde_cadans ? `${dashboard.gemiddelde_cadans}` : '–'}<span className="text-xs text-slate-500 font-normal"> spm</span></p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Hoogtemeters (jaar)</p>
                <p className="text-lg font-bold text-white">{dashboard.hoogtemeters}<span className="text-xs text-slate-500 font-normal"> m</span></p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
