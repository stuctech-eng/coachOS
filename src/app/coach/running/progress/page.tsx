'use client'
import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import Link from 'next/link'

// ── Running Progress Center — Fase 2 (Professional) ─────────────────────
// Bron: overleg 22 juli 2026. Spiegelt coach/cycling/progress/page.tsx —
// consolideert bestaande Running-data (Goal Engine, Records, Memory
// Engine, Coach-samenvatting) tot één overzicht. Geen nieuwe
// berekeningen, puur hergebruik van wat al bestaat.
//
// ⚠️ EERLIJK NIET GEBOUWD: "VDOT-ontwikkeling" (trend over tijd) —
// zelfde reden als Cycling's FTP-trend vóór v2.4.108: er wordt alleen
// het huidige race-resultaat opgeslagen, geen VDOT-geschiedenis. Een
// grafiek zou dus één punt tonen — bewust niet gebouwd, geen
// schijngrafiek.

function formatPace(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${min}:${sec.toString().padStart(2, '0')}/km`
}
function formatTijd(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`
}
function afstandLabel(m: number): string {
  if (m >= 1000) return `${(m / 1000).toString().replace('.', ',')} km`
  return `${m} m`
}

interface LeidendDoel { title: string; dagen_resterend: number | null; waarde_kloof: number | null; importance: string }
interface AfstandRecord { afstand_m: number; tijd_sec: number; datum: string }
interface MemoryItem { insight: string; confidence: number; status: string }

// Belangrijkste afstanden om vooraan te tonen — de rest (100m t/m 3km,
// 15km) staat er ook, maar minder prominent
const KERN_AFSTANDEN = [5000, 10000, 21097, 42195]

export default function RunningProgressPage() {
  const [laden, setLaden] = useState(true)
  const [vdot, setVdot] = useState<number | null>(null)
  const [leidendDoel, setLeidendDoel] = useState<LeidendDoel | null>(null)
  const [records, setRecords] = useState<AfstandRecord[]>([])
  const [memoryInzichten, setMemoryInzichten] = useState<MemoryItem[]>([])
  const [coachSamenvatting, setCoachSamenvatting] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/specialists/running/profile', { credentials: 'include' }).then(r => r.json()).catch(() => null),
      fetch('/api/specialists/running/doelvoortgang', { credentials: 'include' }).then(r => r.json()).catch(() => null),
      fetch('/api/specialists/running/grafieken?weken=12', { credentials: 'include' }).then(r => r.json()).catch(() => null),
      fetch('/api/specialists/running/memory', { credentials: 'include' }).then(r => r.json()).catch(() => null),
      fetch('/api/specialists/running/coach', { credentials: 'include' }).then(r => r.json()).catch(() => null),
    ]).then(([profielData, doelData, grafiekenData, memoryData, coachData]) => {
      if (profielData?.vdot) setVdot(profielData.vdot)
      if (doelData?.leidend_doel) setLeidendDoel(doelData.leidend_doel)
      if (grafiekenData?.records) setRecords(grafiekenData.records)
      if (memoryData?.memory) setMemoryInzichten((memoryData.memory as MemoryItem[]).filter(m => m.status === 'active').slice(0, 3))
      if (coachData?.analysis?.samenvatting) setCoachSamenvatting(coachData.analysis.samenvatting)
    }).finally(() => setLaden(false))
  }, [])

  const kernRecords = records.filter(r => KERN_AFSTANDEN.includes(r.afstand_m))

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link href={'/coach/running'} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
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
            {/* VDOT */}
            <Card className="p-4">
              <p className="text-xs text-slate-500 mb-1">VDOT</p>
              <p className="text-xl font-bold text-white">{vdot ?? '–'}</p>
              {!vdot && <p className="text-[10px] text-slate-600">Nog geen race-resultaat ingevuld in je Running Profile</p>}
            </Card>

            {/* Doelvoortgang */}
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
            {kernRecords.length > 0 && (
              <Card className="p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Persoonlijke records</p>
                <div className="flex flex-col gap-2">
                  {kernRecords.map(r => (
                    <div key={r.afstand_m} className="flex justify-between text-sm">
                      <span className="text-slate-400">{afstandLabel(r.afstand_m)}</span>
                      <span className="text-white font-medium">{formatTijd(r.tijd_sec)} ({formatPace(r.tijd_sec / (r.afstand_m / 1000))})</span>
                    </div>
                  ))}
                </div>
                <Link href={'/coach/running/grafieken'} className="text-xs text-primary-400 mt-3 inline-block">
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

            {!vdot && !leidendDoel && kernRecords.length === 0 && memoryInzichten.length === 0 && (
              <Card className="p-6 text-center">
                <p className="text-sm text-slate-400">Nog niet genoeg data voor een overzicht — loop een paar keer en stel je Running Profile in.</p>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
