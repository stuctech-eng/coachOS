'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { Bike, Footprints, Waves, Dumbbell, ChevronLeft, Zap } from 'lucide-react'
import { cn } from '@/utils'

interface CoachCallItem {
  id: string
  sport_type: string
  distance_m: number | null
  duration_min: number
  rating: number | null
  status: string
}

interface CoachCall {
  id: string
  date: string
  status: string
  coach_call_items: CoachCallItem[]
}

function getSportIcon(sport: string) {
  if (sport === 'Fietsen') return Bike
  if (sport === 'Hardlopen') return Footprints
  if (sport === 'Roeien') return Waves
  return Dumbbell
}

function formatDistance(m: number | null): string {
  if (!m) return ''
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`
  return `${m} m`
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h > 0) return `${h}u ${m}min`
  return `${m} min`
}

export default function CoachCallPage() {
  const router = useRouter()
  const [call, setCall] = useState<CoachCall | null>(null)
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    fetch('/api/coach-calls', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setCall(data)
          // Pre-fill bestaande ratings
          const existing: Record<string, number> = {}
          for (const item of data.coach_call_items || []) {
            if (item.rating) existing[item.id] = item.rating
          }
          setRatings(existing)
        }
        setLaden(false)
      })
      .catch(() => setLaden(false))
  }, [])

  async function handleQuickFill() {
    if (!call) return
    const filled: Record<string, number> = {}
    for (const item of call.coach_call_items) {
      filled[item.id] = 7
    }
    setRatings(filled)
  }

  async function handleSave() {
    if (!call) return
    setSaving(true)
    try {
      const ratingsList = Object.entries(ratings).map(([item_id, rating]) => ({ item_id, rating }))
      const res = await fetch('/api/coach-calls/rate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratings: ratingsList, coach_call_id: call.id }),
      })
      if (res.ok) router.push('/home')
    } catch { /* */ }
    setSaving(false)
  }

  const pendingItems = call?.coach_call_items.filter(i => !ratings[i.id]) || []
  const allRated = call ? pendingItems.length === 0 : false

  if (laden) return (
    <AppShell>
      <div className="flex items-center justify-center h-40">
        <p className="text-slate-400 text-sm">Laden...</p>
      </div>
    </AppShell>
  )

  if (!call) return (
    <AppShell>
      <Card className="p-5 text-center">
        <p className="text-slate-400 text-sm">Geen openstaande evaluaties.</p>
      </Card>
    </AppShell>
  )

  const dateLabel = new Date(call.date + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <AppShell>
      <div className="flex flex-col gap-4 pb-6">
        {/* Header met terug-knop */}
        <div className="flex items-center gap-3 -mb-1">
          <button onClick={() => router.push('/home')}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10 flex-shrink-0">
            <ChevronLeft size={18} className="text-slate-400" />
          </button>
          <h1 className="text-lg font-bold text-white">Coach Call</h1>
        </div>
        <div>
          <p className="text-slate-400 text-sm mb-1">Training van {dateLabel}</p>
          <p className="text-white font-semibold">Hoe voelden deze trainingen?</p>
          <p className="text-slate-500 text-xs mt-1">Geef een RPE-score (1 = zeer licht, 10 = maximale inspanning)</p>
        </div>

        {/* Quick fill */}
        {!allRated && (
          <button onClick={handleQuickFill}
            className="flex items-center gap-2 text-xs text-primary-400 bg-primary-500/10 px-3 py-2 rounded-lg w-fit active:opacity-70">
            <Zap size={12} />
            Alles voelt ok (7)
          </button>
        )}

        {/* Activiteiten */}
        {call.coach_call_items.map(item => {
          const Icon = getSportIcon(item.sport_type)
          const currentRating = ratings[item.id] ?? null

          return (
            <Card key={item.id} className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary-500/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={18} className="text-primary-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{item.sport_type}</p>
                  <p className="text-slate-400 text-xs">
                    {[formatDistance(item.distance_m), formatDuration(item.duration_min)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {currentRating && (
                  <div className="ml-auto">
                    <span className="text-primary-400 font-bold text-lg">{currentRating}</span>
                    <span className="text-slate-500 text-xs">/10</span>
                  </div>
                )}
              </div>

              {/* 1-10 ratingbalk */}
              <div className="flex gap-1">
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button key={n} onClick={() => setRatings(prev => ({ ...prev, [item.id]: n }))}
                    className={cn(
                      'flex-1 h-9 rounded-lg text-xs font-semibold transition-colors',
                      currentRating === n ? 'bg-primary-500 text-white' : 'bg-slate-800 text-slate-400'
                    )}>
                    {n}
                  </button>
                ))}
              </div>
            </Card>
          )
        })}

        {/* Opslaan */}
        <button
          onClick={handleSave}
          disabled={saving || Object.keys(ratings).length === 0}
          className="w-full py-4 bg-primary-500 text-white rounded-xl font-semibold text-base disabled:opacity-40 active:bg-primary-600">
          {saving ? 'Opslaan...' : allRated ? 'Evaluatie opslaan' : `Opslaan (${Object.keys(ratings).length}/${call.coach_call_items.length})`}
        </button>
      </div>
    </AppShell>
  )
}
