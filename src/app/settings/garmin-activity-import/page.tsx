'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface TrainingEffect {
  primary_benefit: string | null
  aerobic: number | null
  anaerobic: number | null
  exercise_load: number | null
}

interface GarminActivityParsed {
  activity_type: string | null
  duration_total_min: number | null
  duration_moved_min: number | null
  avg_hr: number | null
  max_hr: number | null
  training_effect: TrainingEffect
  avg_pace_per_km: string | null
  avg_speed_kmh: number | null
  cadence_avg: number | null
  steps: number | null
}

interface ValidationFlag {
  field: string
  value: number | string | null
  reason: string
  severity: 'warning' | 'error'
}

interface ImportResult {
  import_id: string
  parsed: GarminActivityParsed
  validation_flags: ValidationFlag[]
  confidence_score: number
  status: 'pending' | 'flagged'
}

function formatMinuten(min: number | null): string {
  if (min === null) return '–'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}u ${m}m` : `${m} min`
}

export default function GarminActivityImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<'idle' | 'uploading' | 'preview' | 'confirming' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setPreview(URL.createObjectURL(file))
    setPhase('uploading')
    setErrorMsg(null)

    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/health/garmin-activity-vision', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? 'Er ging iets mis.')
        setPhase('error')
        return
      }

      setResult(data)
      setPhase('preview')
    } catch {
      setErrorMsg('Verbindingsfout. Probeer opnieuw.')
      setPhase('error')
    }
  }

  async function handleConfirm() {
    if (!result) return
    setPhase('confirming')

    const formData = new FormData()
    formData.append('confirm_id', result.import_id)

    try {
      const res = await fetch('/api/health/garmin-activity-vision', { method: 'POST', body: formData })
      if (!res.ok) throw new Error()
      setPhase('done')
    } catch {
      setErrorMsg('Bevestigen mislukt. Probeer opnieuw.')
      setPhase('error')
    }
  }

  function handleRetry() {
    setPhase('idle')
    setResult(null)
    setErrorMsg(null)
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="flex items-center gap-3 px-4 pt-14 pb-6">
        <button onClick={() => router.push('/settings')}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Garmin Activiteit</h1>
          <p className="text-xs text-white/40 mt-0.5">Losse activiteit via screenshot</p>
        </div>
      </div>

      <div className="px-4 space-y-4 pb-10">

        {phase === 'idle' && (
          <>
            <div className="rounded-2xl bg-white/5 border border-white/8 p-5 space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Hoe werkt het</p>
                <p className="text-sm text-white/50 leading-relaxed">
                  Open de activiteit in Garmin Connect → tab &quot;Statistieken&quot; → screenshot → upload hier.
                  Deze telt mee voor je herstel en triggert een Coach Call, net als een Strava-activiteit.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {['Tijd bewogen', 'Hartslag', 'Training Effect', 'Exercise Load', 'Cadans', 'Stappen'].map((label) => (
                  <div key={label} className="rounded-lg bg-white/5 px-2.5 py-2 text-white/60 text-center">{label}</div>
                ))}
              </div>
            </div>

            <button onClick={() => fileRef.current?.click()}
              className="w-full rounded-2xl bg-blue-500 hover:bg-blue-400 active:scale-[0.98] transition-all py-4 text-sm font-semibold flex items-center justify-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Screenshot uploaden
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          </>
        )}

        {phase === 'uploading' && (
          <div className="rounded-2xl bg-white/5 border border-white/8 p-8 flex flex-col items-center gap-4">
            {preview && <img src={preview} alt="preview" className="w-24 h-24 rounded-xl object-cover opacity-50" />}
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-white/60">Activiteit uitlezen…</p>
            </div>
          </div>
        )}

        {phase === 'preview' && result && (
          <>
            <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${
              result.confidence_score >= 80 ? 'bg-green-500/10 border border-green-500/20'
              : result.confidence_score >= 60 ? 'bg-amber-500/10 border border-amber-500/20'
              : 'bg-red-500/10 border border-red-500/20'
            }`}>
              <div className={`w-2 h-2 rounded-full ${result.confidence_score >= 80 ? 'bg-green-400' : result.confidence_score >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} />
              <p className="text-sm">
                Betrouwbaarheid: <span className="font-semibold">{result.confidence_score}%</span>
                {result.status === 'flagged' && <span className="text-amber-400 ml-2">— controleer gemarkeerde waarden</span>}
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/8 divide-y divide-white/5">
              <DataRow label="Activiteit" value={result.parsed.activity_type || '–'} />
              <DataRow label="Tijd bewogen" value={formatMinuten(result.parsed.duration_moved_min)}
                sub={result.parsed.duration_total_min ? `totaal: ${formatMinuten(result.parsed.duration_total_min)}` : undefined} />
              <DataRow label="Hartslag" value={result.parsed.avg_hr ? `${result.parsed.avg_hr} bpm gem.` : '–'}
                sub={result.parsed.max_hr ? `max ${result.parsed.max_hr} bpm` : undefined}
                flagged={result.validation_flags.some(f => f.field === 'avg_hr')} />
              <DataRow label="Training Effect" value={result.parsed.training_effect.primary_benefit || '–'}
                sub={result.parsed.training_effect.exercise_load !== null ? `Exercise Load ${result.parsed.training_effect.exercise_load}` : undefined}
                flagged={result.validation_flags.some(f => f.field.startsWith('training_effect'))} />
              <DataRow label="Tempo" value={result.parsed.avg_pace_per_km ? `${result.parsed.avg_pace_per_km}/km` : '–'}
                sub={result.parsed.avg_speed_kmh ? `${result.parsed.avg_speed_kmh} km/u` : undefined} />
              <DataRow label="Cadans / Stappen" value={result.parsed.cadence_avg ? `${result.parsed.cadence_avg} spm` : '–'}
                sub={result.parsed.steps ? `${result.parsed.steps} stappen` : undefined} last />
            </div>

            {result.validation_flags.length > 0 && (
              <div className="rounded-2xl bg-amber-500/5 border border-amber-500/15 p-4 space-y-2">
                <p className="text-xs font-medium text-amber-400">Opmerkingen</p>
                {result.validation_flags.map((flag, i) => (
                  <p key={i} className="text-xs text-white/50"><span className="text-white/70">{flag.field}:</span> {flag.reason}</p>
                ))}
              </div>
            )}

            <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3">
              <p className="text-xs text-blue-400">Na bevestigen verschijnt deze activiteit als Coach Call op Home — vul daar RPE en mood in.</p>
            </div>

            <button onClick={handleConfirm}
              className="w-full rounded-2xl bg-blue-500 hover:bg-blue-400 active:scale-[0.98] transition-all py-4 text-sm font-semibold">
              Bevestigen & opslaan
            </button>
            <button onClick={handleRetry}
              className="w-full rounded-xl bg-white/5 hover:bg-white/8 transition-colors py-3 text-sm text-white/50">
              Opnieuw uploaden
            </button>
          </>
        )}

        {phase === 'confirming' && (
          <div className="rounded-2xl bg-white/5 border border-white/8 p-8 flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-white/60">Opslaan…</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="rounded-2xl bg-white/5 border border-white/8 p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="font-semibold">Opgeslagen</p>
              <p className="text-sm text-white/50 mt-1">Ga naar Home om de evaluatie (Coach Call) in te vullen.</p>
            </div>
            <button onClick={() => router.push('/home')}
              className="mt-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors px-6 py-2.5 text-sm font-medium">
              Naar Home
            </button>
          </div>
        )}

        {phase === 'error' && (
          <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-6 space-y-4">
            <p className="text-sm text-red-400">{errorMsg}</p>
            <button onClick={handleRetry} className="w-full rounded-xl bg-white/5 hover:bg-white/8 transition-colors py-3 text-sm text-white/70">
              Opnieuw proberen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function DataRow({ label, value, sub, flagged = false, last = false }: {
  label: string; value: string; sub?: string; flagged?: boolean; last?: boolean
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-3.5 ${last ? '' : ''}`}>
      <div className="flex items-center gap-2">
        {flagged && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
        <span className={`text-sm ${flagged ? 'text-white/70' : 'text-white/50'}`}>{label}</span>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium">{value}</p>
        {sub && <p className="text-xs text-white/35 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
