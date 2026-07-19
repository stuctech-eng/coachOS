'use client'
import { useState, useEffect } from 'react'
import { ArrowLeft, Info } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import Link from 'next/link'

// ── Progress Center — Cycling Specialist Roadmap v1.0, Fase 2i ─────────
// "Het feitelijke hart van de Cycling Hub" — consolideert bestaande data
// uit meerdere al-gebouwde bronnen tot één overzicht. Bewust GEEN nieuwe
// berekeningen — puur hergebruik van wat al bestaat:
// - Doelvoortgang: /api/specialists/cycling/doelvoortgang (Fase 2c)
// - Records: /api/specialists/cycling/grafieken (Fase 2e)
// - Memory-inzichten: /api/specialists/cycling/memory (Memory Engine)
// - Coach-samenvatting: /api/specialists/cycling/coach (Fase 3, bestaand)
// - W/kg: FTP (Cycling Profile) / gewicht (/api/profile, bestaand)
//
// ⚠️ EERLIJK NIET GEBOUWD: "FTP-ontwikkeling" (trend over tijd) — er
// wordt alleen een huidig FTP-getal opgeslagen, geen geschiedenis. Een
// grafiek zou dus één punt tonen, geen trend. Vergt eerst FTP-historie
// bijhouden (nieuwe kolom/tabel) — bewust niet nu toegevoegd, om geen
// schijngrafiek te tonen.

interface LeidendDoel {
  title: string
  dagen_resterend: number | null
  waarde_kloof: number | null
  importance: string
}

interface Records {
  langste_rit_km: { waarde: number; datum: string } | null
  grootste_week_km: { waarde: number; week_start: string } | null
  hoogste_vermogen: { waarde: number; datum: string } | null
}

interface MemoryItem {
  insight: string
  confidence: number
  status: string
}

export default function ProgressCenterPage() {
  const [laden, setLaden] = useState(true)
  const [ftp, setFtp] = useState<number | null>(null)
  const [gewicht, setGewicht] = useState<number | null>(null)
  const [leidendDoel, setLeidendDoel] = useState<LeidendDoel | null>(null)
  const [records, setRecords] = useState<Records | null>(null)
  const [memoryInzichten, setMemoryInzichten] = useState<MemoryItem[]>([])
  const [coachSamenvatting, setCoachSamenvatting] = useState<string | null>(null)
  const [ftpGeschiedenis, setFtpGeschiedenis] = useState<{ ftp: number; datum: string }[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/specialists/cycling/profile', { credentials: 'include' }).then(r => r.json()).catch(() => null),
      fetch('/api/profile', { credentials: 'include' }).then(r => r.json()).catch(() => null),
      fetch('/api/specialists/cycling/doelvoortgang', { credentials: 'include' }).then(r => r.json()).catch(() => null),
      fetch('/api/specialists/cycling/grafieken?weken=12', { credentials: 'include' }).then(r => r.json()).catch(() => null),
      fetch('/api/specialists/cycling/memory', { credentials: 'include' }).then(r => r.json()).catch(() => null),
      fetch('/api/specialists/cycling/coach', { credentials: 'include' }).then(r => r.json()).catch(() => null),
      fetch('/api/specialists/cycling/ftp-geschiedenis', { credentials: 'include' }).then(r => r.json()).catch(() => null),
    ]).then(([profielData, algemeenProfiel, doelData, grafiekenData, memoryData, coachData, ftpGeschiedenisData]) => {
      if (profielData?.profiel?.ftp) setFtp(profielData.profiel.ftp)
      if (algemeenProfiel?.profile?.weight) setGewicht(algemeenProfiel.profile.weight)
      if (doelData?.leidend_doel) setLeidendDoel(doelData.leidend_doel)
      if (grafiekenData?.records) setRecords(grafiekenData.records)
      if (memoryData?.memory) setMemoryInzichten((memoryData.memory as MemoryItem[]).filter(m => m.status === 'active').slice(0, 3))
      if (coachData?.analysis?.samenvatting) setCoachSamenvatting(coachData.analysis.samenvatting)
      if (ftpGeschiedenisData?.geschiedenis) setFtpGeschiedenis(ftpGeschiedenisData.geschiedenis)
    }).finally(() => setLaden(false))
  }, [])

  const wattPerKg = ftp && gewicht ? Math.round((ftp / gewicht) * 100) / 100 : null

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link href={'/coach/cycling'} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Progress Center</h1>
            <p className="text-xs text-slate-500">Hoe je je ontwikkelt, in één overzicht</p>
          </div>
        </div>

        {laden && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-800/50 rounded-2xl animate-pulse" />)}
          </div>
        )}

        {!laden && (
          <>
            {/* FTP + W/kg */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4">
                <p className="text-xs text-slate-500 mb-1">FTP</p>
                <p className="text-xl font-bold text-white">{ftp ? `${ftp}W` : '–'}</p>
                {!ftp && <p className="text-[10px] text-slate-600">Nog niet ingesteld</p>}
              </Card>
              <Card className="p-4">
                <p className="text-xs text-slate-500 mb-1">W/kg</p>
                <p className="text-xl font-bold text-white">{wattPerKg ?? '–'}</p>
                {!wattPerKg && <p className="text-[10px] text-slate-600">FTP of gewicht ontbreekt</p>}
              </Card>
            </div>

            {/* v2.4.108: FTP-geschiedenis wordt nu bijgehouden — eerlijke
                tussenstap: bij <2 punten is er nog geen trend te tonen,
                wel al data die aan het verzamelen is */}
            {ftpGeschiedenis.length >= 2 ? (
              <Card className="p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">FTP-ontwikkeling</p>
                <div className="flex items-end gap-1.5" style={{ height: 60 }}>
                  {ftpGeschiedenis.map((punt, i) => {
                    const maxFtp = Math.max(...ftpGeschiedenis.map(p => p.ftp))
                    const minFtp = Math.min(...ftpGeschiedenis.map(p => p.ftp))
                    const bereik = maxFtp - minFtp || 1
                    const hoogtePx = Math.max(4, Math.round(((punt.ftp - minFtp) / bereik) * 56))
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: 60 }}>
                        <div className="w-full bg-amber-500/70 rounded-t-sm" style={{ height: hoogtePx }} />
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-slate-600">{new Date(ftpGeschiedenis[0].datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} · {ftpGeschiedenis[0].ftp}W</span>
                  <span className="text-[10px] text-slate-600">{new Date(ftpGeschiedenis[ftpGeschiedenis.length - 1].datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} · {ftpGeschiedenis[ftpGeschiedenis.length - 1].ftp}W</span>
                </div>
              </Card>
            ) : (
              <div className="flex items-start gap-1.5 px-1">
                <Info size={11} className="text-slate-600 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  {ftpGeschiedenis.length === 1
                    ? 'FTP-geschiedenis wordt vanaf nu bijgehouden — bij de volgende wijziging verschijnt hier een trend.'
                    : 'FTP-ontwikkeling over tijd verschijnt hier zodra je FTP minstens één keer is bijgewerkt na vandaag.'}
                </p>
              </div>
            )}            {/* Doelvoortgang */}
            {leidendDoel && (
              <Card className="p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Doel</p>
                <p className="text-sm font-semibold text-white">{leidendDoel.title}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {leidendDoel.dagen_resterend !== null ? `Nog ${leidendDoel.dagen_resterend} dagen` : 'Geen deadline'}
                  {leidendDoel.waarde_kloof !== null ? ` · nog ${Math.abs(leidendDoel.waarde_kloof)} te overbruggen` : ''}
                </p>
              </Card>
            )}

            {/* Records-samenvatting */}
            {records && (records.langste_rit_km || records.hoogste_vermogen || records.grootste_week_km) && (
              <Card className="p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Persoonlijke records</p>
                <div className="flex flex-col gap-2">
                  {records.langste_rit_km && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Langste rit</span>
                      <span className="text-white font-medium">{records.langste_rit_km.waarde} km</span>
                    </div>
                  )}
                  {records.hoogste_vermogen && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Hoogste vermogen</span>
                      <span className="text-white font-medium">{records.hoogste_vermogen.waarde} W</span>
                    </div>
                  )}
                  {records.grootste_week_km && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Grootste week</span>
                      <span className="text-white font-medium">{records.grootste_week_km.waarde} km</span>
                    </div>
                  )}
                </div>
                <Link href={'/coach/cycling/grafieken'} className="text-xs text-primary-400 mt-3">
                  Alle records bekijken →
                </Link>
              </Card>
            )}

            {/* Memory-inzichten */}
            {memoryInzichten.length > 0 && (
              <Card className="p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Wat je coach over je heeft geleerd</p>
                <div className="flex flex-col gap-2">
                  {memoryInzichten.map((m, i) => (
                    <p key={i} className="text-sm text-slate-300 leading-relaxed">• {m.insight}</p>
                  ))}
                </div>
              </Card>
            )}

            {/* Coach-samenvatting */}
            {coachSamenvatting && (
              <Card className="p-4 bg-primary-500/10 border-primary-500/20">
                <p className="text-xs text-primary-400 uppercase tracking-wider mb-2">Coach-samenvatting</p>
                <p className="text-sm text-slate-200 leading-relaxed">{coachSamenvatting}</p>
              </Card>
            )}

            {!ftp && !leidendDoel && !records && memoryInzichten.length === 0 && (
              <Card className="p-6 text-center">
                <p className="text-sm text-slate-400">Nog niet genoeg data voor een overzicht — fiets een paar keer en stel je Cycling Profile in.</p>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
