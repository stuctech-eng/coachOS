'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { BottomNav } from '@/components/layout'

interface ActivityMetrics {
  distance?: number
  avg_hr?: number
  max_hr?: number
  elevation?: number
  avg_speed?: number
  calories?: number
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

const SPORT_ICONS: Record<string, string> = {
  Hardlopen: '🏃',
  Fietsen: '🚴',
  Wandelen: '🚶',
  Zwemmen: '🏊',
  Krachttraining: '🏋️',
  Yoga: '🧘',
  Roeien: '🚣',
  Padel: '🎾',
  Tennis: '🎾',
  CrossFit: '💪',
  Kettlebell: '🔔',
}

function formatDuur(min: number): string {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}u ${m}m` : `${h}u`
}

function formatAfstand(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`
  return `${m} m`
}

function formatDatum(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function ActiviteitenPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<ActivitySession[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('alle')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    laadActiviteiten()
  }, [])

  async function laadActiviteiten() {
    setLoading(true)
    try {
      const res = await fetch('/api/activities')
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  async function importeerGarmin(file: File) {
    setImporting(true)
    setImportResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/activities', { method: 'POST', body: form })
      const data = await res.json()
      if (data.error) {
        setImportResult('❌ ' + data.error)
      } else {
        setImportResult('✅ ' + data.message)
        await laadActiviteiten()
      }
    } catch {
      setImportResult('❌ Import mislukt')
    } finally {
      setImporting(false)
    }
  }

  // Unieke sporttypes voor filter
  const sporttypes = ['alle', ...Array.from(new Set(sessions.map(s => s.activities?.name || 'Anders')))]

  const gefilterd = filter === 'alle'
    ? sessions
    : sessions.filter(s => (s.activities?.name || 'Anders') === filter)

  // Stats deze week
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekSessions = sessions.filter(s => new Date(s.date) >= weekAgo)
  const weekMinuten = weekSessions.reduce((acc, s) => acc + s.duration, 0)
  const weekKm = weekSessions.reduce((acc, s) => acc + (s.metrics.distance || 0), 0) / 1000

  return (
    <div className="min-h-screen bg-[#0d1117] text-white pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-14 pb-4">
        <button
          onClick={() => router.push('/settings')}
          className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center active:bg-white/10"
        >
          <ArrowLeft size={20} className="text-slate-400" />
        </button>
        <h1 className="text-2xl font-bold text-white">Activiteiten</h1>
      </div>

      {/* Week stats */}
      <div className="px-4 mb-4 grid grid-cols-2 gap-3">
        <div className="bg-[#1c2128] rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-1">Deze week</p>
          <p className="text-2xl font-bold text-white">{weekSessions.length}</p>
          <p className="text-xs text-gray-400">activiteiten</p>
        </div>
        <div className="bg-[#1c2128] rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-1">Tijd</p>
          <p className="text-2xl font-bold text-white">{formatDuur(weekMinuten)}</p>
          {weekKm > 0 && <p className="text-xs text-gray-400">{weekKm.toFixed(1)} km</p>}
        </div>
      </div>

      {/* Garmin import */}
      <div className="px-4 mb-4">
        <div className="bg-[#1c2128] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-white">Garmin importeren</p>
              <p className="text-xs text-gray-400">.gpx of .tcx bestand</p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              {importing ? '...' : 'Importeer'}
            </button>
          </div>
          {importResult && (
            <p className="text-xs text-gray-300 bg-[#0d1117] rounded-xl px-3 py-2">{importResult}</p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".gpx,.tcx"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) importeerGarmin(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {/* Filter tabs */}
      {sporttypes.length > 1 && (
        <div className="px-4 mb-4 overflow-x-auto">
          <div className="flex gap-2 w-max">
            {sporttypes.map(type => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#1c2128] text-gray-400 hover:text-white'
                }`}
              >
                {type === 'alle' ? 'Alle' : `${SPORT_ICONS[type] || '🏅'} ${type}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Activiteiten lijst */}
      <div className="px-4 space-y-3">
        {loading ? (
          // Skeleton loaders
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#1c2128] rounded-2xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2d333b]" />
                <div className="flex-1">
                  <div className="h-4 bg-[#2d333b] rounded w-24 mb-2" />
                  <div className="h-3 bg-[#2d333b] rounded w-16" />
                </div>
              </div>
            </div>
          ))
        ) : gefilterd.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🏅</p>
            <p className="text-gray-400 text-sm">Geen activiteiten gevonden</p>
            <p className="text-gray-500 text-xs mt-1">Synchroniseer Strava of importeer een Garmin bestand</p>
          </div>
        ) : (
          gefilterd.map(session => {
            const naam = session.activities?.name || 'Anders'
            const icoon = SPORT_ICONS[naam] || '🏅'
            const { distance, avg_hr, calories, elevation } = session.metrics

            return (
              <div key={session.id} className="bg-[#1c2128] rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  {/* Icoon */}
                  <div className="w-10 h-10 rounded-xl bg-[#2d333b] flex items-center justify-center text-xl flex-shrink-0">
                    {icoon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-white text-sm">{naam}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        session.source === 'strava' ? 'bg-orange-900/40 text-orange-400' : 'bg-blue-900/40 text-blue-400'
                      }`}>
                        {session.source === 'strava' ? 'Strava' : 'Garmin'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDatum(session.date)}</p>
                  </div>
                </div>

                {/* Metrics */}
                <div className="mt-3 flex gap-4 flex-wrap">
                  <div>
                    <p className="text-xs text-gray-500">Duur</p>
                    <p className="text-sm font-medium text-white">{formatDuur(session.duration)}</p>
                  </div>
                  {distance && distance > 0 && (
                    <div>
                      <p className="text-xs text-gray-500">Afstand</p>
                      <p className="text-sm font-medium text-white">{formatAfstand(distance)}</p>
                    </div>
                  )}
                  {avg_hr && (
                    <div>
                      <p className="text-xs text-gray-500">Hartslag</p>
                      <p className="text-sm font-medium text-white">{avg_hr} bpm</p>
                    </div>
                  )}
                  {calories && (
                    <div>
                      <p className="text-xs text-gray-500">Calorieën</p>
                      <p className="text-sm font-medium text-white">{calories} kcal</p>
                    </div>
                  )}
                  {elevation && elevation > 0 && (
                    <div>
                      <p className="text-xs text-gray-500">Hoogte</p>
                      <p className="text-sm font-medium text-white">+{elevation}m</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <BottomNav />
    </div>
  )
}
