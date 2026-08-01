'use client'
import { useState, useEffect } from 'react'
import { ArrowLeft, Waves, Settings } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import Link from 'next/link'

// ── Rowing Coach — Fase 1, stap 1 (basisstructuur) ───────────────────────
// Bron: Rowing Platform Master Vision, vastgelegd 1 augustus 2026.
// Device Adapter Layer-architectuur: deze pagina praat NOOIT
// rechtstreeks met hardware. Vandaag (Fase 1, PWA): leest wat via
// bestaande paden binnenkomt (handmatige invoer/Strava/TCX). Concept2-
// OAuth-koppeling volgt als aparte stap, zodra developer-sleutels
// beschikbaar zijn. Live BLE naar de PM5 (Fase 2) is technisch niet
// haalbaar binnen een iOS-PWA (Safari heeft geen Web Bluetooth) — blijft
// bewust een apart, toekomstig Native-traject.
//
// Bewuste keuze deze stap: eerlijke lege staat i.p.v. een dashboard dat
// doet alsof er al een Rowing Engine bestaat — die komt in een latere
// stap (Training Plan Engine, Workout Builder, Analyse-engine).

interface RowingActiviteit {
  id: string
  date: string
  duration: number
  metrics: Record<string, number> | null
  source: string
}

export default function RowingPage() {
  const [laden, setLaden] = useState(true)
  const [activiteiten, setActiviteiten] = useState<RowingActiviteit[]>([])
  const [fout, setFout] = useState<string | null>(null)
  // v2.4.218: Concept2-koppelingsstatus
  const [concept2Verbonden, setConcept2Verbonden] = useState<boolean | null>(null)
  const [urlMelding, setUrlMelding] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/specialists/rowing/data')
      .then(r => r.json())
      .then(d => { if (d.error) setFout(d.error); else setActiviteiten(d.activiteiten || []) })
      .catch(() => setFout('Kon Rowing-data niet ophalen'))
      .finally(() => setLaden(false))

    fetch('/api/specialists/rowing/concept2/status')
      .then(r => r.json())
      .then(d => setConcept2Verbonden(!!d.verbonden))
      .catch(() => setConcept2Verbonden(false))

    // Melding tonen na terugkomst van de OAuth-flow
    const params = new URLSearchParams(window.location.search)
    if (params.get('concept2_verbonden')) {
      setUrlMelding('Concept2 succesvol gekoppeld!')
      setConcept2Verbonden(true)
      window.history.replaceState({}, '', '/coach/rowing')
    } else if (params.get('concept2_error')) {
      setUrlMelding('Koppelen mislukt: ' + params.get('concept2_error'))
      window.history.replaceState({}, '', '/coach/rowing')
    }
  }, [])

  const heeftData = activiteiten.length > 0

  return (
    <AppShell showNav={false}>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href="/specialisten" className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
            <ArrowLeft size={20} className="text-slate-400" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Rowing Coach</h1>
            <p className="text-xs text-slate-500">Nieuw — basisstructuur</p>
          </div>
          <Link href="/settings/equipment" className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center">
            <Settings size={18} className="text-slate-400" />
          </Link>
        </div>

        {laden && <div className="h-40 bg-slate-800/50 rounded-2xl animate-pulse" />}

        {urlMelding && (
          <Card className={`p-3 text-sm ${urlMelding.startsWith('Concept2 succesvol') ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
            {urlMelding}
          </Card>
        )}

        {/* v2.4.218: Concept2-koppelingskaart — enige plek die de OAuth-
            flow triggert, altijd zichtbaar zodra de status bekend is */}
        {concept2Verbonden !== null && (
          <Card className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Concept2 Logbook</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {concept2Verbonden ? '✓ Gekoppeld' : 'Nog niet gekoppeld'}
              </p>
            </div>
            {!concept2Verbonden && (
              <a href="/api/specialists/rowing/concept2/authorize"
                className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold active:bg-primary-700">
                Verbind
              </a>
            )}
          </Card>
        )}

        {!laden && fout && (
          <Card className="p-6 text-center">
            <p className="text-sm text-slate-400">{fout}</p>
          </Card>
        )}

        {!laden && !fout && !heeftData && (
          <Card className="p-6 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
              <Waves size={28} className="text-cyan-400" />
            </div>
            <div>
              <p className="text-white font-semibold">Nog geen roeidata</p>
              <p className="text-sm text-slate-400 mt-1">
                Rowing Coach is net gestart. Zodra je een roeisessie logt
                (handmatig, via Strava, of straks via Concept2), verschijnt
                hier je dashboard.
              </p>
            </div>
            <div className="w-full pt-3 mt-1 border-t border-coach-border flex flex-col gap-2 text-left">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Binnenkort</p>
              <p className="text-sm text-slate-400">🔗 Directe Concept2-koppeling (wacht op API-sleutels)</p>
              <p className="text-sm text-slate-400">📋 Trainingsplan met periodisering</p>
              <p className="text-sm text-slate-400">📊 Analyse na elke sessie</p>
            </div>
          </Card>
        )}

        {!laden && !fout && heeftData && (
          <Card className="p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Recente sessies</p>
            <div className="flex flex-col gap-2">
              {activiteiten.slice(0, 10).map(a => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-coach-border last:border-0">
                  <div>
                    <p className="text-sm text-white">{new Date(a.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</p>
                    <p className="text-xs text-slate-500">{a.source}</p>
                  </div>
                  {/* v2.4.217-FIX: duration staat al in MINUTEN
                      (zie strava-activity-processor.ts: moving_time/60
                      bij opslag) — de extra /60 hier rondde elke
                      normale sessie af naar 0 min */}
                  <p className="text-sm text-slate-300">{a.duration} min</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-4">
              Uitgebreid dashboard (records/grafieken/trainingsbelasting)
              volgt in een volgende stap.
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
