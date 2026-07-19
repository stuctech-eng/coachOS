'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { AppShell } from '@/components/layout'

// v2.4.41: dynamic import met ssr:false — Leaflet gebruikt `window` en kan
// niet server-side gerenderd worden. Next.js zou anders bij build/render
// crashen op een ontbrekende `window`.
const ActivityRouteMap = dynamic(() => import('@/components/ActivityRouteMap'), {
  ssr: false,
  loading: () => <div className="w-full h-72 rounded-2xl bg-white/5 border border-white/8 animate-pulse" />,
})

interface ActivityMetrics {
  distance?: number
  avg_hr?: number
  max_hr?: number
  elevation?: number
  elevation_gain?: number
  elevation_loss?: number
  avg_speed?: number
  max_speed?: number
  calories?: number
  avg_cadence?: number
  max_cadence?: number
  avg_watts?: number
  max_watts?: number
  route?: { lat: number; lng: number }[]
}

interface ActivitySession {
  id: string
  date: string
  duration: number
  metrics: ActivityMetrics
  source: string
  notes: string | null
  activities: { name: string } | null
}

// v2.4.106: Ritanalyse, Fase 2f — alleen voor deze specifieke sportnamen
const CYCLING_NAMEN = ['Fietsen', 'Fietsen (buiten)', 'Indoor Fietsen']

function formatDuur(min: number): string {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}u ${m}m` : `${h}u`
}

function formatDatum(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function StatBlok({ label, waarde, sub }: { label: string; waarde: string; sub?: string }) {
  return (
    <div className="bg-white/5 rounded-2xl p-4">
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className="text-xl font-semibold text-white">{waarde}</p>
      {sub && <p className="text-xs text-white/40 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function ActivityDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [session, setSession] = useState<ActivitySession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // v2.4.106: Ritanalyse-state, Fase 2f
  const [analyseBezig, setAnalyseBezig] = useState(false)
  const [evaluatie, setEvaluatie] = useState<string | null>(null)
  const [analyseFout, setAnalyseFout] = useState<string | null>(null)

  async function analyseerDezeRit() {
    if (!session) return
    setAnalyseBezig(true)
    setAnalyseFout(null)
    try {
      const res = await fetch('/api/specialists/cycling/rit-analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: session.id }),
      })
      const data = await res.json()
      if (data.error) setAnalyseFout(data.error)
      else setEvaluatie(data.evaluatie)
    } catch (e) {
      setAnalyseFout((e as Error).message)
    } finally {
      setAnalyseBezig(false)
    }
  }

  useEffect(() => {
    fetch(`/api/activities/${params.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setSession(data.session)
      })
      .catch(() => setError('Kon activiteit niet laden'))
      .finally(() => setLoading(false))
  }, [params.id])

  return (
    <AppShell>
      <div className="text-white px-4 pt-6 pb-10">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/activities')}
            className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center active:bg-white/10">
            <ArrowLeft size={20} className="text-slate-400" />
          </button>
          <h1 className="text-xl font-bold text-white">{session?.activities?.name || 'Activiteit'}</h1>
        </div>

        {loading && (
          <div className="space-y-3">
            <div className="w-full h-72 rounded-2xl bg-white/5 animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />)}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-6 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {session && !loading && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-white/50 -mt-3">{formatDatum(session.date)} · {session.source === 'strava' ? 'Strava' : 'Garmin'}</p>

            <ActivityRouteMap route={session.metrics.route || []} />

            <div className="grid grid-cols-2 gap-3">
              <StatBlok label="Duur" waarde={formatDuur(session.duration)} />
              {session.metrics.distance ? <StatBlok label="Afstand" waarde={`${(session.metrics.distance / 1000).toFixed(2)} km`} /> : null}
              {session.metrics.avg_hr ? <StatBlok label="Hartslag" waarde={`${session.metrics.avg_hr} bpm`} sub={session.metrics.max_hr ? `max ${session.metrics.max_hr}` : undefined} /> : null}
              {session.metrics.calories ? <StatBlok label="Calorieën" waarde={`${session.metrics.calories} kcal`} /> : null}
              {session.metrics.avg_speed ? <StatBlok label="Snelheid" waarde={`${session.metrics.avg_speed} km/u`} sub={session.metrics.max_speed ? `max ${session.metrics.max_speed}` : undefined} /> : null}
              {session.metrics.avg_cadence ? <StatBlok label="Cadans" waarde={`${session.metrics.avg_cadence} spm`} sub={session.metrics.max_cadence ? `max ${session.metrics.max_cadence}` : undefined} /> : null}
              {session.metrics.avg_watts ? <StatBlok label="Watts" waarde={`${session.metrics.avg_watts}W`} sub={session.metrics.max_watts ? `max ${session.metrics.max_watts}W` : undefined} /> : null}
              {(session.metrics.elevation_gain || session.metrics.elevation) ? (
                <StatBlok label="Hoogtemeters" waarde={`↑ ${session.metrics.elevation_gain ?? session.metrics.elevation}m`} sub={session.metrics.elevation_loss ? `↓ ${session.metrics.elevation_loss}m` : undefined} />
              ) : null}
            </div>

            {/* v2.4.106: Ritanalyse, Fase 2f — alleen voor fietsritten */}
            {session.activities?.name && CYCLING_NAMEN.includes(session.activities.name) && (
              <div className="bg-white/5 rounded-2xl p-4">
                {!evaluatie && !analyseFout && (
                  <button onClick={analyseerDezeRit} disabled={analyseBezig}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-primary-400 disabled:opacity-50">
                    <Sparkles size={16} />
                    {analyseBezig ? 'Coach analyseert...' : 'Laat je Cycling Coach deze rit analyseren'}
                  </button>
                )}
                {analyseFout && <p className="text-sm text-red-400">{analyseFout}</p>}
                {evaluatie && (
                  <>
                    <p className="text-xs text-primary-400 uppercase tracking-wider mb-2">Ritanalyse</p>
                    <p className="text-sm text-slate-200 leading-relaxed">{evaluatie}</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
