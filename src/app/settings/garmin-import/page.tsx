'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ValidationFlag {
  field: string
  value: number | null
  reason: string
  severity: 'warning' | 'error'
}

interface GarminParsed {
  resting_hr: number | null
  body_battery: { current: number | null; charged: number | null; spent: number | null }
  sleep: { score: number | null; duration_minutes: number | null }
  hrv: { avg_7d_ms: number | null; status: string | null }
  stress: number | null
  breathing: { current_brpm: number | null; avg_awake_brpm: number | null; avg_sleep_brpm: number | null }
}

interface ImportResult {
  import_id: string
  parsed: GarminParsed
  validation_flags: ValidationFlag[]
  confidence_score: number
  status: 'pending' | 'flagged'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(minutes: number | null): string {
  if (!minutes) return '–'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}u ${m}m`
}

function hrvStatusLabel(status: string | null): string {
  if (!status) return '–'
  const map: Record<string, string> = {
    balanced: 'Evenwichtig',
    low: 'Laag',
    high: 'Hoog',
    unbalanced: 'Ongebalanceerd',
  }
  return map[status] ?? status
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GarminImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<'idle' | 'uploading' | 'preview' | 'confirming' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [alreadyConfirmed, setAlreadyConfirmed] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setPhase('uploading')
    setErrorMsg(null)

    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/health/garmin-vision', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (res.status === 409 && data.already_confirmed) {
        setAlreadyConfirmed(true)
        setPhase('done')
        return
      }

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
      const res = await fetch('/api/health/garmin-vision', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error()
      // Herbereken Coach Score met nieuwe Garmin data
      fetch('/api/status', { method: 'POST', credentials: 'include' }).catch(() => {})
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
    setAlreadyConfirmed(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-14 pb-6">
        <button
          onClick={() => router.push('/settings')}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Garmin Import</h1>
          <p className="text-xs text-white/40 mt-0.5">Dagelijkse data via screenshot</p>
        </div>
      </div>

      <div className="px-4 space-y-4 pb-10">

        {/* ── Idle ────────────────────────────────────────────────────── */}
        {phase === 'idle' && (
          <>
            <div className="rounded-2xl bg-white/5 border border-white/8 p-5 space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Hoe werkt het</p>
                <p className="text-sm text-white/50 leading-relaxed">
                  Open Garmin Connect → &quot;In één oogopslag&quot; → screenshot → upload hier.
                  Coach AI leest automatisch je herstel- en activiteitsdata uit.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                {['Rusthartslag', 'Body Battery', 'Slaap', 'HRV (7d gem.)', 'Stress', 'Ademhaling'].map((label) => (
                  <div key={label} className="rounded-lg bg-white/5 px-2.5 py-2 text-white/60 text-center">
                    {label}
                  </div>
                ))}
              </div>

              <p className="text-xs text-white/30">
                📸 Best moment: 07:30–08:00 na Garmin sync
              </p>
            </div>

            <button
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-2xl bg-blue-500 hover:bg-blue-400 active:scale-[0.98] transition-all py-4 text-sm font-semibold flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Screenshot uploaden
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </>
        )}

        {/* ── Uploading ───────────────────────────────────────────────── */}
        {phase === 'uploading' && (
          <div className="rounded-2xl bg-white/5 border border-white/8 p-8 flex flex-col items-center gap-4">
            {preview && (
              <img src={preview} alt="preview" className="w-24 h-24 rounded-xl object-cover opacity-50" />
            )}
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-white/60">Garmin data uitlezen…</p>
            </div>
          </div>
        )}

        {/* ── Preview ─────────────────────────────────────────────────── */}
        {phase === 'preview' && result && (
          <>
            <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${
              result.confidence_score >= 80
                ? 'bg-green-500/10 border border-green-500/20'
                : result.confidence_score >= 60
                ? 'bg-amber-500/10 border border-amber-500/20'
                : 'bg-red-500/10 border border-red-500/20'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                result.confidence_score >= 80 ? 'bg-green-400' :
                result.confidence_score >= 60 ? 'bg-amber-400' : 'bg-red-400'
              }`} />
              <p className="text-sm">
                Betrouwbaarheid: <span className="font-semibold">{result.confidence_score}%</span>
                {result.status === 'flagged' && (
                  <span className="text-amber-400 ml-2">— controleer gemarkeerde waarden</span>
                )}
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/8 divide-y divide-white/5">
              <DataRow
                label="Rusthartslag"
                value={result.parsed.resting_hr ? `${result.parsed.resting_hr} bpm` : '–'}
                flagged={result.validation_flags.some(f => f.field === 'resting_hr')}
              />
              <DataRow
                label="Body Battery"
                value={result.parsed.body_battery.current !== null ? `${result.parsed.body_battery.current}` : '–'}
                sub={result.parsed.body_battery.charged !== null
                  ? `+${result.parsed.body_battery.charged} opgeladen · -${result.parsed.body_battery.spent} verbruikt`
                  : undefined}
                flagged={result.validation_flags.some(f => f.field.startsWith('body_battery'))}
              />
              <DataRow
                label="Slaap"
                value={result.parsed.sleep.score !== null ? `Score ${result.parsed.sleep.score}` : '–'}
                sub={formatDuration(result.parsed.sleep.duration_minutes)}
                flagged={result.validation_flags.some(f => f.field.startsWith('sleep'))}
              />
              <DataRow
                label="HRV (7d gem.)"
                value={result.parsed.hrv.avg_7d_ms !== null ? `${result.parsed.hrv.avg_7d_ms} ms` : '–'}
                sub={hrvStatusLabel(result.parsed.hrv.status)}
                flagged={result.validation_flags.some(f => f.field === 'hrv.avg_7d_ms')}
              />
              <DataRow
                label="Stress"
                value={result.parsed.stress !== null ? `${result.parsed.stress}` : '–'}
                sub={result.parsed.stress !== null ? (result.parsed.stress <= 25 ? 'Laag' : result.parsed.stress <= 50 ? 'Licht' : result.parsed.stress <= 75 ? 'Matig' : 'Hoog') : undefined}
                flagged={result.validation_flags.some(f => f.field === 'stress')}
              />
              <DataRow
                label="Ademhaling"
                value={result.parsed.breathing.current_brpm !== null ? `${result.parsed.breathing.current_brpm} brpm` : '–'}
                sub={result.parsed.breathing.avg_sleep_brpm !== null ? `slaap: ${result.parsed.breathing.avg_sleep_brpm} brpm` : undefined}
                flagged={result.validation_flags.some(f => f.field.startsWith('breathing'))}
                last
              />
            </div>

            {result.validation_flags.length > 0 && (
              <div className="rounded-2xl bg-amber-500/5 border border-amber-500/15 p-4 space-y-2">
                <p className="text-xs font-medium text-amber-400">Opmerkingen</p>
                {result.validation_flags.map((flag, i) => (
                  <p key={i} className="text-xs text-white/50">
                    <span className="text-white/70">{flag.field}:</span> {flag.reason}
                  </p>
                ))}
              </div>
            )}

            <button
              onClick={handleConfirm}
              className="w-full rounded-2xl bg-blue-500 hover:bg-blue-400 active:scale-[0.98] transition-all py-4 text-sm font-semibold"
            >
              Bevestigen & opslaan
            </button>

            <button
              onClick={handleRetry}
              className="w-full rounded-xl bg-white/5 hover:bg-white/8 transition-colors py-3 text-sm text-white/50"
            >
              Opnieuw uploaden
            </button>
          </>
        )}

        {/* ── Confirming ──────────────────────────────────────────────── */}
        {phase === 'confirming' && (
          <div className="rounded-2xl bg-white/5 border border-white/8 p-8 flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-white/60">Opslaan…</p>
          </div>
        )}

        {/* ── Done ────────────────────────────────────────────────────── */}
        {phase === 'done' && (
          <div className="rounded-2xl bg-white/5 border border-white/8 p-8 flex flex-col items-center gap-4 text-center">
            {alreadyConfirmed ? (
              <>
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold">Al geïmporteerd vandaag</p>
                  <p className="text-sm text-white/50 mt-1">Je Garmin data van vandaag is al opgeslagen.</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold">Opgeslagen</p>
                  <p className="text-sm text-white/50 mt-1">Coach AI gebruikt deze data voor je dagplan.</p>
                </div>
              </>
            )}
            <button
              onClick={() => router.push('/home')}
              className="mt-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors px-6 py-2.5 text-sm font-medium"
            >
              Naar Home
            </button>
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────── */}
        {phase === 'error' && (
          <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-6 space-y-4">
            <p className="text-sm text-red-400">{errorMsg}</p>
            <button
              onClick={handleRetry}
              className="w-full rounded-xl bg-white/5 hover:bg-white/8 transition-colors py-3 text-sm text-white/70"
            >
              Opnieuw proberen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── DataRow ──────────────────────────────────────────────────────────────────

function DataRow({
  label,
  value,
  sub,
  flagged = false,
  last = false,
}: {
  label: string
  value: string
  sub?: string
  flagged?: boolean
  last?: boolean
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-3.5 ${last ? '' : ''}`}>
      <div className="flex items-center gap-2">
        {flagged && (
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
        )}
        <span className={`text-sm ${flagged ? 'text-white/70' : 'text-white/50'}`}>{label}</span>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium">{value}</p>
        {sub && <p className="text-xs text-white/35 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
