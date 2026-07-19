'use client'
import { useState, useEffect } from 'react'
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import Link from 'next/link'

// ── Power Center — Cycling Specialist Roadmap v1.0, Fase 1 (v2.4.118) ──
// Bron: overleg 19 juli 2026. BEWUST GEEN nieuwe SQL, nieuwe API-routes,
// nieuwe berekeningen of parser-wijzigingen — dit is uitsluitend een
// samenvoeging van vier al-bestaande endpoints tot één professioneel
// analysecentrum:
//   - /api/specialists/cycling/grafieken   → vermogenscurve + records
//   - /api/specialists/cycling/profile     → FTP + Power Zones (Z1-Z7)
//   - /api/specialists/cycling/ftp-geschiedenis → FTP-trend
//   - /api/profile                         → gewicht (voor W/kg)
//
// FUNDAMENT, GEEN EINDPUNT: toekomstige vermogensanalyses (NP, IF, VI,
// TSS, CTL/ATL/TSB, klim-/sprintanalyse, extra duurpunten 10s/3min/45min)
// krijgen later een eigen sectie hier — geen nieuwe navigatie nodig.
// Zie docs/changelog.md v2.4.118 voor de volledige Fase 2/3-lijst van wat
// hier BEWUST nog niet in zit.

interface VermogensZone {
  zone: number
  naam: string
  van_pct: number
  tot_pct: number | null
  van_watt: number
  tot_watt: number | null
}

interface VermogensCurvePunt {
  duration_sec: number
  watts: number
}

interface CyclingRecords {
  langste_rit_km: { waarde: number; datum: string } | null
  langste_rit_minuten: { waarde: number; datum: string } | null
  meeste_hoogtemeters: { waarde: number; datum: string } | null
  hoogste_vermogen: { waarde: number; datum: string } | null
  hoogste_gem_snelheid: { waarde: number; datum: string } | null
  grootste_week_km: { waarde: number; week_start: string } | null
}

interface FtpGeschiedenisPunt {
  ftp: number
  datum: string
}

function labelVoorDuur(sec: number): string {
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.round(sec / 60)}min`
  return `${Math.round(sec / 3600)}u`
}

function TrendIcoon({ trend }: { trend: 'stijgend' | 'stabiel' | 'dalend' }) {
  if (trend === 'stijgend') return <TrendingUp size={14} className="text-green-400" />
  if (trend === 'dalend') return <TrendingDown size={14} className="text-red-400" />
  return <Minus size={14} className="text-slate-400" />
}

export default function PowerCenterPage() {
  const [laden, setLaden] = useState(true)
  const [ftp, setFtp] = useState<number | null>(null)
  const [gewicht, setGewicht] = useState<number | null>(null)
  const [vermogenszones, setVermogenszones] = useState<VermogensZone[] | null>(null)
  const [vermogenscurve, setVermogenscurve] = useState<VermogensCurvePunt[]>([])
  const [records, setRecords] = useState<CyclingRecords | null>(null)
  const [ftpGeschiedenis, setFtpGeschiedenis] = useState<FtpGeschiedenisPunt[]>([])

  useEffect(() => {
    async function laadAlles() {
      setLaden(true)
      try {
        const [profielRes, grafiekenRes, ftpHistRes, algemeenProfielRes] = await Promise.all([
          fetch('/api/specialists/cycling/profile', { credentials: 'include' }),
          fetch('/api/specialists/cycling/grafieken', { credentials: 'include' }),
          fetch('/api/specialists/cycling/ftp-geschiedenis', { credentials: 'include' }),
          fetch('/api/profile', { credentials: 'include' }).catch(() => null),
        ])
        const profielData = await profielRes.json()
        const grafiekenData = await grafiekenRes.json()
        const ftpHistData = await ftpHistRes.json()

        if (profielData?.profiel?.ftp) setFtp(profielData.profiel.ftp)
        setVermogenszones(profielData?.vermogenszones || null)
        setVermogenscurve(grafiekenData?.vermogenscurve || [])
        setRecords(grafiekenData?.records || null)
        setFtpGeschiedenis(ftpHistData?.geschiedenis || [])

        if (algemeenProfielRes) {
          const algemeenData = await algemeenProfielRes.json()
          if (algemeenData?.profile?.weight) setGewicht(algemeenData.profile.weight)
        }
      } catch {
        // Stil falen per sectie is hier niet nodig — elke sectie checkt
        // zelf op aanwezige data en toont anders een lege staat
      } finally {
        setLaden(false)
      }
    }
    laadAlles()
  }, [])

  const wattPerKg = ftp && gewicht ? Math.round((ftp / gewicht) * 100) / 100 : null
  const maxCurveWatt = vermogenscurve.length > 0 ? Math.max(...vermogenscurve.map(p => p.watts)) : 1

  // FTP-trend: vergelijk laatste twee metingen, zelfde patroon als
  // TrendIcoon elders in de Cycling Hub
  let ftpTrend: 'stijgend' | 'stabiel' | 'dalend' | null = null
  if (ftpGeschiedenis.length >= 2) {
    const verschil = ftpGeschiedenis[ftpGeschiedenis.length - 1].ftp - ftpGeschiedenis[ftpGeschiedenis.length - 2].ftp
    ftpTrend = verschil > 0 ? 'stijgend' : verschil < 0 ? 'dalend' : 'stabiel'
  }

  const recordsItems = records ? [
    { label: 'Langste rit', waarde: records.langste_rit_km ? `${records.langste_rit_km.waarde} km` : null, datum: records.langste_rit_km?.datum },
    { label: 'Langste tijd', waarde: records.langste_rit_minuten ? `${records.langste_rit_minuten.waarde} min` : null, datum: records.langste_rit_minuten?.datum },
    { label: 'Meeste hoogtemeters', waarde: records.meeste_hoogtemeters ? `${records.meeste_hoogtemeters.waarde} m` : null, datum: records.meeste_hoogtemeters?.datum },
    { label: 'Hoogste vermogen', waarde: records.hoogste_vermogen ? `${records.hoogste_vermogen.waarde} W` : null, datum: records.hoogste_vermogen?.datum },
    { label: 'Hoogste gem. snelheid', waarde: records.hoogste_gem_snelheid ? `${records.hoogste_gem_snelheid.waarde} km/u` : null, datum: records.hoogste_gem_snelheid?.datum },
    { label: 'Grootste week', waarde: records.grootste_week_km ? `${records.grootste_week_km.waarde} km` : null, datum: records.grootste_week_km?.week_start },
  ].filter((item): item is { label: string; waarde: string; datum: string | undefined } => item.waarde !== null) : []

  const geenDataHelemaal = !laden && !ftp && vermogenscurve.length === 0 && recordsItems.length === 0

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href={'/coach/cycling'} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Power Center</h1>
            <p className="text-xs text-slate-500">FTP, vermogenscurve, records &amp; zones</p>
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
            <p className="text-sm text-slate-400 mb-4">Nog geen FTP ingesteld en geen vermogensdata beschikbaar.</p>
            <Link href={'/settings/cycling-profile'}
              className="px-5 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold">
              FTP instellen
            </Link>
          </Card>
        )}

        {/* 1. Power-overzicht */}
        {!laden && ftp && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Power-overzicht</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">FTP</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-2xl font-bold text-white">{ftp}</p>
                  <span className="text-sm text-slate-500">W</span>
                  {ftpTrend && <TrendIcoon trend={ftpTrend} />}
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">W/kg</p>
                <p className="text-2xl font-bold text-white">
                  {wattPerKg ?? '–'}
                  {!wattPerKg && <span className="text-xs text-slate-600 font-normal block mt-1">gewicht ontbreekt</span>}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* 2. Vermogenscurve */}
        {!laden && vermogenscurve.length > 0 && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Vermogenscurve</p>
            <p className="text-[10px] text-slate-600 mb-4">All-time beste vermogen per duur, over al je Garmin-geïmporteerde ritten (geen terugwerkende kracht voor activiteiten van vóór v2.4.110).</p>
            <div className="flex items-end gap-1" style={{ height: 110 }}>
              {vermogenscurve.map(punt => {
                const barHoogtePx = Math.max(4, Math.round((punt.watts / maxCurveWatt) * 90))
                return (
                  <div key={punt.duration_sec} className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: 110 }}>
                    <span className="text-[9px] text-slate-400 font-medium">{punt.watts}</span>
                    <div className="w-full bg-amber-500/70 rounded-t-sm" style={{ height: barHoogtePx }} />
                    <span className="text-[8px] text-slate-600">{labelVoorDuur(punt.duration_sec)}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* 3. Persoonlijke records (uit de vermogenscurve zelf: elk
            duurpunt IS per definitie het all-time record voor die duur) */}
        {!laden && vermogenscurve.length > 0 && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Persoonlijke records — vermogen per duur</p>
            <div className="flex flex-col gap-2.5">
              {vermogenscurve.map(punt => (
                <div key={punt.duration_sec} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{labelVoorDuur(punt.duration_sec)}</span>
                  <span className="text-sm font-semibold text-white">{punt.watts} W</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 3b. Overige records (afstand/hoogte/snelheid — bestonden al
            op het Grafieken-scherm, horen inhoudelijk ook hier thuis) */}
        {!laden && recordsItems.length > 0 && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Overige records</p>
            <p className="text-[10px] text-slate-600 mb-3">Gebaseerd op wat per rit is opgeslagen.</p>
            <div className="flex flex-col gap-3">
              {recordsItems.map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{item.label}</span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{item.waarde}</p>
                    {item.datum && <p className="text-[10px] text-slate-600">{new Date(item.datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 4. Power Zones */}
        {!laden && vermogenszones && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Power Zones</p>
            <div className="flex flex-col gap-2.5">
              {vermogenszones.map(zone => (
                <div key={zone.zone} className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-slate-300">Z{zone.zone} — {zone.naam}</span>
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {zone.van_watt}{zone.tot_watt !== null ? `–${zone.tot_watt}` : '+'} W
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
        {!laden && !vermogenszones && ftp && (
          <Card className="p-5">
            <p className="text-sm text-slate-400">Power Zones konden niet berekend worden.</p>
          </Card>
        )}

        {/* 5. Ontwikkeling — BEWUST alleen FTP-trend. "Records door de
            tijd" en "beste maand/seizoen" bestaan nog niet als
            berekening (alleen all-time-beste wordt bijgehouden) — zie
            changelog v2.4.118, Fase 2. Geen schijndata tonen. */}
        {!laden && ftpGeschiedenis.length > 0 && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Ontwikkeling — FTP-historie</p>
            {ftpGeschiedenis.length < 2 && (
              <p className="text-[10px] text-slate-600 mb-3">Nog maar 1 meting — een trend wordt zichtbaar zodra je FTP opnieuw instelt.</p>
            )}
            <div className="flex flex-col gap-2 mt-3">
              {ftpGeschiedenis.slice().reverse().map((punt, i) => (
                <div key={`${punt.datum}-${i}`} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{new Date(punt.datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <span className="text-sm font-semibold text-white">{punt.ftp} W</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
