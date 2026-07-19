'use client'

import { useState, useRef } from 'react'
import { parseTcx, type TcxParsed } from '@/lib/tcx-parser'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrainingEffect {
  primary_benefit: string | null
  aerobic: number | null
  anaerobic: number | null
  exercise_load: number | null
}

interface VisionParsed {
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

interface VisionResult {
  import_id: string
  parsed: VisionParsed
  validation_flags: ValidationFlag[]
  confidence_score: number
  status: 'pending' | 'flagged'
}

interface TcxResult {
  import_id: string
  parsed: TcxParsed
  keuze_nodig: boolean
  suggestie: string
  opties: string[]
}

function formatMinuten(min: number | null): string {
  if (min === null) return '–'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}u ${m}m` : `${m} min`
}

type Methode = 'screenshot' | 'tcx'
type Fase = 'idle' | 'uploading' | 'preview' | 'confirming' | 'done' | 'error'

export default function GarminActivityImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const tcxFileRef = useRef<HTMLInputElement>(null)

  const [methode, setMethode] = useState<Methode>('tcx')
  const [fase, setFase] = useState<Fase>('idle')
  const [visionResult, setVisionResult] = useState<VisionResult | null>(null)
  const [tcxResult, setTcxResult] = useState<TcxResult | null>(null)
  const [gekozenType, setGekozenType] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [wasOverwritten, setWasOverwritten] = useState(false)

  function resetAlles() {
    setFase('idle')
    setVisionResult(null)
    setTcxResult(null)
    setGekozenType(null)
    setErrorMsg(null)
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
    if (tcxFileRef.current) tcxFileRef.current.value = ''
  }

  function wisselMethode(nieuw: Methode) {
    setMethode(nieuw)
    resetAlles()
  }

  // ── Screenshot flow ──────────────────────────────────────────────────────
  async function handleScreenshotSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setFase('uploading')
    setErrorMsg(null)

    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/health/garmin-activity-vision', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error ?? 'Er ging iets mis.'); setFase('error'); return }
      setVisionResult(data)
      setFase('preview')
    } catch {
      setErrorMsg('Verbindingsfout. Probeer opnieuw.')
      setFase('error')
    }
  }

  async function handleScreenshotConfirm() {
    if (!visionResult) return
    setFase('confirming')
    const formData = new FormData()
    formData.append('confirm_id', visionResult.import_id)
    try {
      const res = await fetch('/api/health/garmin-activity-vision', { method: 'POST', body: formData })
      if (!res.ok) throw new Error()
      setFase('done')
    } catch {
      setErrorMsg('Bevestigen mislukt. Probeer opnieuw.')
      setFase('error')
    }
  }

  // ── TCX flow ─────────────────────────────────────────────────────────────
  // v2.4.35 FIX: parsen gebeurt nu volledig in de browser (parseTcx() uit
  // de gedeelde lib), het volledige bestand wordt NIET meer naar de server
  // geüpload — voorkomt 413 FUNCTION_PAYLOAD_TOO_LARGE bij lange
  // activiteiten met veel trackpoints. Alleen het kleine, samengevatte
  // resultaat (parsed) gaat als JSON naar de server.
  async function handleTcxSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFase('uploading')
    setErrorMsg(null)

    try {
      const xmlText = await file.text()
      const parsed = parseTcx(xmlText)

      if (!parsed.duration_min && !parsed.distance_m) {
        setErrorMsg('Geen bruikbare data gevonden in dit bestand')
        setFase('error')
        return
      }

      const res = await fetch('/api/health/garmin-activity-tcx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsed }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error ?? 'Er ging iets mis.'); setFase('error'); return }
      setTcxResult(data)
      setGekozenType(data.suggestie)
      setFase('preview')
    } catch (err) {
      setErrorMsg('Kon het bestand niet lezen. Is het een geldig TCX-bestand? (' + (err as Error).message + ')')
      setFase('error')
    }
  }

  async function handleTcxConfirm() {
    if (!tcxResult) return
    setFase('confirming')
    const formData = new FormData()
    formData.append('confirm_id', tcxResult.import_id)
    formData.append('activity_type', gekozenType || tcxResult.suggestie)
    try {
      const res = await fetch('/api/health/garmin-activity-tcx', { method: 'POST', body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErrorMsg(data.error ?? 'Bevestigen mislukt. Probeer opnieuw.'); setFase('error'); return }
      // v2.4.42: bij hetzelfde TCX-bestand wordt de bestaande activiteit nu
      // overschreven i.p.v. geweigerd — aparte melding in plaats van
      // "Opgeslagen", zodat duidelijk is dat het geen nieuwe activiteit is.
      setWasOverwritten(!!data.overwritten)
      setFase('done')
    } catch {
      setErrorMsg('Bevestigen mislukt. Probeer opnieuw.')
      setFase('error')
    }
  }

  return (
    <div className="h-screen overflow-y-auto bg-[#0a0a0a] text-white">
      {/* v2.4.36 FIX: was min-h-screen zonder eigen scroll-container. Deze
          pagina gebruikt geen AppShell (bewust, geen bottom-nav gewenst
          tijdens de import-flow) — maar de globale app-stijl schakelt
          scrollen op body/html doorgaans uit (voor AppShell's eigen
          scroll-area, zie v2.4.20). Zonder AppShell had deze pagina dus
          NERGENS een scrollbare container: bij content die de hoogte van
          het scherm overschrijdt (zoals een lange TCX-preview met 8
          keuzeknoppen) kon je niet bij de knoppen onderaan komen.
          h-screen + overflow-y-auto geeft deze pagina zijn eigen,
          onafhankelijke scroll-context. */}
      <div className="flex items-center gap-3 px-4 pt-14 pb-6">
        <Link href={'/settings'}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Garmin Activiteit</h1>
          <p className="text-xs text-white/40 mt-0.5">Losse activiteit toevoegen</p>
        </div>
      </div>

      <div className="px-4 space-y-4 pb-10">

        {/* Tabblad-keuze — alleen zichtbaar in idle-fase.
            v2.4.44: volgorde omgedraaid (TCX links, standaard geselecteerd
            — voorkeur van gebruiker, Garmin/TCX wordt vaker gebruikt) */}
        {fase === 'idle' && (
          <div className="flex rounded-2xl bg-white/5 border border-white/8 p-1">
            <button onClick={() => wisselMethode('tcx')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${methode === 'tcx' ? 'bg-blue-500 text-white' : 'text-white/50'}`}>
              TCX-bestand
            </button>
            <button onClick={() => wisselMethode('screenshot')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${methode === 'screenshot' ? 'bg-blue-500 text-white' : 'text-white/50'}`}>
              Screenshot
            </button>
          </div>
        )}

        {/* ── IDLE: Screenshot ──────────────────────────────────────────── */}
        {fase === 'idle' && methode === 'screenshot' && (
          <>
            <div className="rounded-2xl bg-white/5 border border-white/8 p-5 space-y-4">
              <p className="text-sm text-white/50 leading-relaxed">
                Open de activiteit in Garmin Connect → tab &quot;Statistieken&quot; → screenshot → upload hier.
                Bevat Training Effect en Exercise Load (Garmin&apos;s eigen duiding).
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {['Tijd bewogen', 'Hartslag', 'Training Effect', 'Exercise Load', 'Cadans', 'Stappen'].map((label) => (
                  <div key={label} className="rounded-lg bg-white/5 px-2.5 py-2 text-white/60 text-center">{label}</div>
                ))}
              </div>
            </div>
            <button onClick={() => fileRef.current?.click()}
              className="w-full rounded-2xl bg-blue-500 hover:bg-blue-400 active:scale-[0.98] transition-all py-4 text-sm font-semibold flex items-center justify-center gap-2">
              Screenshot uploaden
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleScreenshotSelect} />
          </>
        )}

        {/* ── IDLE: TCX ─────────────────────────────────────────────────── */}
        {fase === 'idle' && methode === 'tcx' && (
          <>
            <div className="rounded-2xl bg-white/5 border border-white/8 p-5 space-y-4">
              <p className="text-sm text-white/50 leading-relaxed">
                Exporteer het .tcx-bestand vanuit Garmin Connect (Activiteit → ⋯ → Exporteren naar TCX) en upload hier.
                Exacte cijfers, geen AI-uitlezing nodig. Bevat geen Training Effect/Exercise Load.
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {['Duur', 'Afstand', 'Hartslag', 'Calorieën', 'Cadans', 'Watts'].map((label) => (
                  <div key={label} className="rounded-lg bg-white/5 px-2.5 py-2 text-white/60 text-center">{label}</div>
                ))}
              </div>
            </div>
            <button onClick={() => tcxFileRef.current?.click()}
              className="w-full rounded-2xl bg-blue-500 hover:bg-blue-400 active:scale-[0.98] transition-all py-4 text-sm font-semibold flex items-center justify-center gap-2">
              TCX-bestand uploaden
            </button>
            <input ref={tcxFileRef} type="file" accept=".tcx,application/xml,text/xml" className="hidden" onChange={handleTcxSelect} />
          </>
        )}

        {/* ── Uploading ─────────────────────────────────────────────────── */}
        {fase === 'uploading' && (
          <div className="rounded-2xl bg-white/5 border border-white/8 p-8 flex flex-col items-center gap-4">
            {preview && <img src={preview} alt="preview" className="w-24 h-24 rounded-xl object-cover opacity-50" />}
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-white/60">{methode === 'screenshot' ? 'Activiteit uitlezen…' : 'Bestand verwerken…'}</p>
            </div>
          </div>
        )}

        {/* ── Preview: Screenshot ───────────────────────────────────────── */}
        {fase === 'preview' && methode === 'screenshot' && visionResult && (
          <>
            <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${
              visionResult.confidence_score >= 80 ? 'bg-green-500/10 border border-green-500/20'
              : visionResult.confidence_score >= 60 ? 'bg-amber-500/10 border border-amber-500/20'
              : 'bg-red-500/10 border border-red-500/20'}`}>
              <div className={`w-2 h-2 rounded-full ${visionResult.confidence_score >= 80 ? 'bg-green-400' : visionResult.confidence_score >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} />
              <p className="text-sm">Betrouwbaarheid: <span className="font-semibold">{visionResult.confidence_score}%</span></p>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/8 divide-y divide-white/5">
              <DataRow label="Activiteit" value={visionResult.parsed.activity_type || '–'} />
              <DataRow label="Tijd bewogen" value={formatMinuten(visionResult.parsed.duration_moved_min)} />
              <DataRow label="Hartslag" value={visionResult.parsed.avg_hr ? `${visionResult.parsed.avg_hr} bpm gem.` : '–'} sub={visionResult.parsed.max_hr ? `max ${visionResult.parsed.max_hr}` : undefined} />
              <DataRow label="Training Effect" value={visionResult.parsed.training_effect.primary_benefit || '–'} sub={visionResult.parsed.training_effect.exercise_load !== null ? `Exercise Load ${visionResult.parsed.training_effect.exercise_load}` : undefined} last />
            </div>
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3">
              <p className="text-xs text-blue-400">Na bevestigen verschijnt deze activiteit als Coach Call op Home.</p>
            </div>
            <button onClick={handleScreenshotConfirm} className="w-full rounded-2xl bg-blue-500 hover:bg-blue-400 active:scale-[0.98] transition-all py-4 text-sm font-semibold">
              Bevestigen & opslaan
            </button>
            <button onClick={resetAlles} className="w-full rounded-xl bg-white/5 hover:bg-white/8 transition-colors py-3 text-sm text-white/50">Opnieuw uploaden</button>
          </>
        )}

        {/* ── Preview: TCX ──────────────────────────────────────────────── */}
        {fase === 'preview' && methode === 'tcx' && tcxResult && (
          <>
            <div className="rounded-2xl bg-white/5 border border-white/8 divide-y divide-white/5">
              <DataRow label="Duur" value={formatMinuten(tcxResult.parsed.duration_min)} />
              <DataRow label="Afstand" value={tcxResult.parsed.distance_m ? `${(tcxResult.parsed.distance_m / 1000).toFixed(2)} km` : '–'} />
              <DataRow label="Hartslag" value={tcxResult.parsed.avg_hr ? `${tcxResult.parsed.avg_hr} bpm gem.` : '–'} sub={tcxResult.parsed.max_hr ? `max ${tcxResult.parsed.max_hr}` : undefined} />
              <DataRow label="Calorieën" value={tcxResult.parsed.calories ? `${tcxResult.parsed.calories} kcal` : '–'} />
              <DataRow label="Cadans" value={tcxResult.parsed.avg_cadence ? `${tcxResult.parsed.avg_cadence} spm gem.` : '–'} sub={tcxResult.parsed.max_cadence ? `max ${tcxResult.parsed.max_cadence}` : undefined} />
              <DataRow label="Watts" value={tcxResult.parsed.avg_watts ? `${tcxResult.parsed.avg_watts}W gem.` : '–'} sub={tcxResult.parsed.max_watts ? `max ${tcxResult.parsed.max_watts}W` : undefined} />
              <DataRow label="Snelheid" value={tcxResult.parsed.avg_speed_kmh ? `${tcxResult.parsed.avg_speed_kmh} km/u gem.` : '–'} sub={tcxResult.parsed.max_speed_kmh ? `max ${tcxResult.parsed.max_speed_kmh} km/u` : undefined} />
              <DataRow label="Hoogtemeters" value={tcxResult.parsed.elevation_gain_m ? `↑ ${tcxResult.parsed.elevation_gain_m}m` : '–'} sub={tcxResult.parsed.elevation_loss_m ? `↓ ${tcxResult.parsed.elevation_loss_m}m` : undefined} last />
            </div>

            {/* Keuzemenu — altijd tonen behalve bij zekere Running-herkenning */}
            {tcxResult.keuze_nodig ? (
              <div className="rounded-2xl bg-amber-500/5 border border-amber-500/15 p-4 space-y-3">
                <p className="text-xs font-medium text-amber-400">Welke activiteit was dit? (Garmin geeft dit niet altijd exact door)</p>
                <div className="grid grid-cols-2 gap-2">
                  {tcxResult.opties.map(optie => (
                    <button key={optie} onClick={() => setGekozenType(optie)}
                      className={`py-2.5 rounded-xl text-xs font-medium transition-colors ${gekozenType === optie ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/60'}`}>
                      {optie}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3">
                <p className="text-xs text-green-400">Herkend als: <span className="font-semibold">{gekozenType}</span></p>
              </div>
            )}

            <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3">
              <p className="text-xs text-blue-400">Na bevestigen verschijnt deze activiteit als Coach Call op Home.</p>
            </div>
            <button onClick={handleTcxConfirm} disabled={!gekozenType}
              className="w-full rounded-2xl bg-blue-500 hover:bg-blue-400 active:scale-[0.98] transition-all py-4 text-sm font-semibold disabled:opacity-40">
              Bevestigen & opslaan
            </button>
            <button onClick={resetAlles} className="w-full rounded-xl bg-white/5 hover:bg-white/8 transition-colors py-3 text-sm text-white/50">Opnieuw uploaden</button>
          </>
        )}

        {fase === 'confirming' && (
          <div className="rounded-2xl bg-white/5 border border-white/8 p-8 flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-white/60">Opslaan…</p>
          </div>
        )}

        {fase === 'done' && (
          <div className="rounded-2xl bg-white/5 border border-white/8 p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="font-semibold">{wasOverwritten ? 'Bijgewerkt' : 'Opgeslagen'}</p>
              <p className="text-sm text-white/50 mt-1">
                {wasOverwritten
                  ? 'Deze activiteit bestond al — de gegevens zijn ververst met de nieuwste data.'
                  : 'Ga naar Home om de evaluatie (Coach Call) in te vullen.'}
              </p>
            </div>
            <div className="flex gap-2 mt-2 w-full">
              <Link href={'/activities'} className="flex-1 rounded-xl bg-white/5 hover:bg-white/10 transition-colors px-6 py-2.5 text-sm font-medium">
                Bekijk activiteiten
              </Link>
              <Link href={'/home'} className="flex-1 rounded-xl bg-white/5 hover:bg-white/10 transition-colors px-6 py-2.5 text-sm font-medium">
                Naar Home
              </Link>
            </div>
          </div>
        )}

        {fase === 'error' && (
          <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-6 space-y-4">
            <p className="text-sm text-red-400">{errorMsg}</p>
            <button onClick={resetAlles} className="w-full rounded-xl bg-white/5 hover:bg-white/8 transition-colors py-3 text-sm text-white/70">Opnieuw proberen</button>
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
