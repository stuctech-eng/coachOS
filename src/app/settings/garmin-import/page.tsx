'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

// ── Garmin Import — twee screenshots, één upload ─────────────────────────
// Bron: overleg 20 juli 2026. Vervangt de oude single-photo-flow met een
// bevestig-stap door een eenvoudigere directe-opslag-flow met twee
// foto-vakken. De oude route (/api/health/garmin-vision) blijft
// ongewijzigd bestaan — deze pagina praat nu met de nieuwe
// /api/health/vision-import.

interface ValidationFlag { field: string; value: number | null; reason: string; severity: 'warning' | 'error' }

interface HealthParsed {
  resting_hr: number | null
  body_battery: { current: number | null; charged: number | null; spent: number | null }
  sleep: { score: number | null; duration_minutes: number | null }
  hrv: { avg_7d_ms: number | null; status: string | null }
  stress: number | null
  breathing: { current_brpm: number | null }
}
interface PerformanceParsed {
  training_readiness: number | null
  training_readiness_label: string | null
  acute_load: number | null
  chronic_load: number | null
  load_ratio: number | null
  training_status_label: string | null
  load_focus_low: number | null
  load_focus_moderate: number | null
  load_focus_high: number | null
  vo2max: number | null
  endurance_score: number | null
}

interface VisionResultaat<T> { parsed?: T; confidence?: number; flags?: ValidationFlag[]; error?: string }
interface ImportResponse { health?: VisionResultaat<HealthParsed>; performance?: VisionResultaat<PerformanceParsed> }

function formatDuration(minutes: number | null): string {
  if (!minutes) return '–'
  return `${Math.floor(minutes / 60)}u ${minutes % 60}m`
}

function UploadVak({ titel, beschrijving, velden, bestand, onKies, inputRef }: {
  titel: string; beschrijving: string; velden: string[]
  bestand: File | null; onKies: (f: File) => void; inputRef: React.RefObject<HTMLInputElement>
}) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/8 p-4 space-y-3">
      <div>
        <p className="text-sm font-medium">{titel}</p>
        <p className="text-xs text-white/40 mt-0.5">{beschrijving}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {velden.map(v => <span key={v} className="text-[10px] rounded-full bg-white/5 px-2 py-1 text-white/50">{v}</span>)}
      </div>
      <button
        onClick={() => inputRef.current?.click()}
        className={`w-full rounded-xl py-3 text-sm font-medium transition-colors ${bestand ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-white/5 hover:bg-white/10 text-white/70'}`}
      >
        {bestand ? `✓ ${bestand.name}` : 'Screenshot kiezen'}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onKies(f) }} />
    </div>
  )
}

export default function GarminImportPage() {
  const healthRef = useRef<HTMLInputElement>(null)
  const performanceRef = useRef<HTMLInputElement>(null)

  const [healthFile, setHealthFile] = useState<File | null>(null)
  const [performanceFile, setPerformanceFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [resultaat, setResultaat] = useState<ImportResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function verwerk() {
    if (!healthFile && !performanceFile) return
    setPhase('uploading')
    setErrorMsg(null)

    const formData = new FormData()
    if (healthFile) formData.append('health_image', healthFile)
    if (performanceFile) formData.append('performance_image', performanceFile)

    try {
      const res = await fetch('/api/health/vision-import', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Er ging iets mis.')
        setPhase('error')
        return
      }
      setResultaat(data)
      setPhase('done')
      fetch('/api/status', { method: 'POST', credentials: 'include' }).catch(() => {})
    } catch {
      setErrorMsg('Verbindingsfout. Probeer opnieuw.')
      setPhase('error')
    }
  }

  function reset() {
    setPhase('idle')
    setResultaat(null)
    setErrorMsg(null)
    setHealthFile(null)
    setPerformanceFile(null)
    if (healthRef.current) healthRef.current.value = ''
    if (performanceRef.current) performanceRef.current.value = ''
  }

  return (
    <div className="h-screen overflow-y-auto scroll-area bg-[#0a0a0a] text-white">
      <div className="flex items-center gap-3 px-4 pt-14 pb-6">
        <Link href={'/settings'} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Garmin Import</h1>
          <p className="text-xs text-white/40 mt-0.5">Dagelijkse data via screenshots</p>
        </div>
      </div>

      <div className="px-4 space-y-4 pb-10 safe-bottom">
        {phase === 'idle' && (
          <>
            <p className="text-xs text-white/30 px-1">📸 Best moment: 07:30–08:00 na Garmin sync. Beide foto&apos;s zijn optioneel — upload wat je hebt.</p>

            <UploadVak
              titel="Health Snapshot" beschrijving='Garmin Connect → "In één oogopslag" (Health-widgets)'
              velden={['Rusthartslag', 'Body Battery', 'Slaap', 'HRV (7d gem.)', 'Stress', 'Ademhaling']}
              bestand={healthFile} onKies={setHealthFile} inputRef={healthRef}
            />
            <UploadVak
              titel="Performance Snapshot" beschrijving='Garmin Connect → "In één oogopslag" (Performance-widgets)'
              velden={['Training Readiness', 'Trainingslast', 'Trainingsstatus', 'Focus lading', 'VO2max', 'Endurance Score']}
              bestand={performanceFile} onKies={setPerformanceFile} inputRef={performanceRef}
            />

            <button
              onClick={verwerk}
              disabled={!healthFile && !performanceFile}
              className="w-full rounded-2xl bg-blue-500 hover:bg-blue-400 active:scale-[0.98] disabled:opacity-30 disabled:active:scale-100 transition-all py-4 text-sm font-semibold"
            >
              Verwerken
            </button>
          </>
        )}

        {phase === 'uploading' && (
          <div className="rounded-2xl bg-white/5 border border-white/8 p-8 flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-white/60">Garmin data uitlezen…</p>
            </div>
          </div>
        )}

        {phase === 'done' && resultaat && (
          <>
            {resultaat.health && !resultaat.health.error && (
              <div className="rounded-2xl bg-white/5 border border-white/8 divide-y divide-white/5">
                <p className="text-xs font-medium text-white/50 px-4 py-3">Health — betrouwbaarheid {resultaat.health.confidence}%</p>
                <DataRow label="Rusthartslag" value={resultaat.health.parsed?.resting_hr ? `${resultaat.health.parsed.resting_hr} bpm` : '–'} />
                <DataRow label="Body Battery" value={resultaat.health.parsed?.body_battery.current !== null && resultaat.health.parsed?.body_battery.current !== undefined ? `${resultaat.health.parsed.body_battery.current}` : '–'} />
                <DataRow label="Slaap" value={resultaat.health.parsed?.sleep.score !== null && resultaat.health.parsed?.sleep.score !== undefined ? `Score ${resultaat.health.parsed.sleep.score}` : '–'} sub={formatDuration(resultaat.health.parsed?.sleep.duration_minutes ?? null)} />
                <DataRow label="HRV (7d gem.)" value={resultaat.health.parsed?.hrv.avg_7d_ms ? `${resultaat.health.parsed.hrv.avg_7d_ms} ms` : '–'} />
                <DataRow label="Stress" value={resultaat.health.parsed?.stress !== null && resultaat.health.parsed?.stress !== undefined ? `${resultaat.health.parsed.stress}` : '–'} last />
              </div>
            )}
            {resultaat.health?.error && (
              <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-4">
                <p className="text-sm text-red-400">Health-foto: {resultaat.health.error}</p>
              </div>
            )}

            {resultaat.performance && !resultaat.performance.error && (
              <div className="rounded-2xl bg-white/5 border border-white/8 divide-y divide-white/5">
                <p className="text-xs font-medium text-white/50 px-4 py-3">Performance — betrouwbaarheid {resultaat.performance.confidence}%</p>
                <DataRow label="Training Readiness" value={resultaat.performance.parsed?.training_readiness !== null && resultaat.performance.parsed?.training_readiness !== undefined ? `${resultaat.performance.parsed.training_readiness}` : '–'} sub={resultaat.performance.parsed?.training_readiness_label ?? undefined} />
                <DataRow label="Trainingslast" value={resultaat.performance.parsed?.acute_load !== null && resultaat.performance.parsed?.acute_load !== undefined ? `${resultaat.performance.parsed.acute_load}/${resultaat.performance.parsed.chronic_load}` : '–'} sub={resultaat.performance.parsed?.load_ratio !== null && resultaat.performance.parsed?.load_ratio !== undefined ? `verhouding ${resultaat.performance.parsed.load_ratio}` : undefined} />
                <DataRow label="Trainingsstatus" value={resultaat.performance.parsed?.training_status_label ?? '–'} />
                <DataRow label="Focus lading" value={resultaat.performance.parsed && (resultaat.performance.parsed.load_focus_low !== null || resultaat.performance.parsed.load_focus_moderate !== null || resultaat.performance.parsed.load_focus_high !== null) ? `${resultaat.performance.parsed.load_focus_low ?? '–'} / ${resultaat.performance.parsed.load_focus_moderate ?? '–'} / ${resultaat.performance.parsed.load_focus_high ?? '–'}` : '–'} sub="laag / gemiddeld / hoog" />
                <DataRow label="VO2max" value={resultaat.performance.parsed?.vo2max !== null && resultaat.performance.parsed?.vo2max !== undefined ? `${resultaat.performance.parsed.vo2max}` : '–'} />
                <DataRow label="Endurance Score" value={resultaat.performance.parsed?.endurance_score !== null && resultaat.performance.parsed?.endurance_score !== undefined ? `${resultaat.performance.parsed.endurance_score}` : '–'} last />
              </div>
            )}
            {resultaat.performance?.error && (
              <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-4">
                <p className="text-sm text-red-400">Performance-foto: {resultaat.performance.error}</p>
              </div>
            )}

            <div className="rounded-2xl bg-green-500/5 border border-green-500/20 p-4 text-center">
              <p className="text-sm text-green-400">Opgeslagen — Coach AI gebruikt deze data.</p>
            </div>

            <button onClick={reset} className="w-full rounded-xl bg-white/5 hover:bg-white/8 transition-colors py-3 text-sm text-white/50">
              Nog een screenshot
            </button>
            <Link href={'/home'} className="block w-full text-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors py-3 text-sm font-medium">
              Naar Home
            </Link>
          </>
        )}

        {phase === 'error' && (
          <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-6 space-y-4">
            <p className="text-sm text-red-400">{errorMsg}</p>
            <button onClick={reset} className="w-full rounded-xl bg-white/5 hover:bg-white/8 transition-colors py-3 text-sm text-white/70">
              Opnieuw proberen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function DataRow({ label, value, sub, last = false }: { label: string; value: string; sub?: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3.5 ${last ? '' : ''}`}>
      <span className="text-sm text-white/50">{label}</span>
      <div className="text-right">
        <p className="text-sm font-medium">{value}</p>
        {sub && <p className="text-xs text-white/35 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
