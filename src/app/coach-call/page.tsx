'use client'
import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { Bike, Footprints, Waves, Dumbbell, ChevronLeft, Sparkles } from 'lucide-react'
import { cn } from '@/utils'
import Link from 'next/link'

interface CoachCallItem {
  id: string
  sport_type: string
  distance_m: number | null
  duration_min: number
  rating: number | null
  mood: number | null
  notes: string | null
  coach_response: string | null
  status: string
}

interface CoachCall {
  id: string
  date: string
  status: string
  coach_call_items: CoachCallItem[]
}

const MOOD_OPTIONS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Slecht' },
  { value: 2, emoji: '😐', label: 'Matig' },
  { value: 3, emoji: '🙂', label: 'Prima' },
  { value: 4, emoji: '😃', label: 'Goed' },
  { value: 5, emoji: '🔥', label: 'Geweldig' },
]

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
  const [call, setCall] = useState<CoachCall | null>(null)
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [moods, setMoods] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [reactions, setReactions] = useState<Record<string, string>>({})
  const [savingItem, setSavingItem] = useState<string | null>(null)
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    fetch('/api/coach-calls', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setCall(data)
          const existingRatings: Record<string, number> = {}
          const existingMoods: Record<string, number> = {}
          const existingNotes: Record<string, string> = {}
          const existingReactions: Record<string, string> = {}
          for (const item of data.coach_call_items || []) {
            if (item.rating) existingRatings[item.id] = item.rating
            if (item.mood) existingMoods[item.id] = item.mood
            if (item.notes) existingNotes[item.id] = item.notes
            if (item.coach_response) existingReactions[item.id] = item.coach_response
          }
          setRatings(existingRatings)
          setMoods(existingMoods)
          setNotes(existingNotes)
          setReactions(existingReactions)
        }
        setLaden(false)
      })
      .catch(() => setLaden(false))
  }, [])

  async function handleSaveItem(itemId: string) {
    if (!call) return
    const rating = ratings[itemId]
    const mood = moods[itemId]
    if (!rating || !mood) return

    setSavingItem(itemId)
    try {
      const res = await fetch('/api/coach-calls/rate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratings: [{ item_id: itemId, rating, mood, notes: notes[itemId] || undefined }],
          coach_call_id: call.id,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const reaction = data.reactions?.[itemId]
        if (reaction?.coach_reactie) {
          setReactions(prev => ({ ...prev, [itemId]: reaction.coach_reactie }))
        }
        setCall(prev => prev ? {
          ...prev,
          coach_call_items: prev.coach_call_items.map(i =>
            i.id === itemId ? { ...i, status: 'done' } : i
          ),
        } : prev)
      }
    } catch { /* */ }
    setSavingItem(null)
  }

  // v2.4.114: expliciete lege-staat — voorheen leunde "allDone" op
  // every() op call.coach_call_items, wat bij een LEGE lijst altijd
  // "waar" teruggeeft (vacuous truth). Dat kon gebeuren als alle items
  // van een Coach Call inmiddels gewist zijn (bijv. via het wissen van
  // de onderliggende activiteit, zie activities/[id]/route.ts). Resultaat
  // was een verwarrende lege pagina, geen duidelijke boodschap.
  const heeftItems = call ? call.coach_call_items.length > 0 : false
  const allDone = call && heeftItems ? call.coach_call_items.every(i => i.status === 'done') : false

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

  // v2.4.114: nette boodschap i.p.v. een lege pagina, als de Coach Call
  // wel bestaat maar (inmiddels) geen items meer heeft
  if (!heeftItems) return (
    <AppShell>
      <Card className="p-5 text-center">
        <p className="text-slate-400 text-sm">Niets meer om te evalueren voor deze Coach Call.</p>
        <Link href={'/home'} className="mt-4 text-primary-400 text-sm font-medium">
          Terug naar Home
        </Link>
      </Card>
    </AppShell>
  )

  const dateLabel = new Date(call.date + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <AppShell>
      <div className="flex flex-col gap-4 pb-6">
        {/* Header met terug-knop */}
        <div className="flex items-center gap-3 -mb-1">
          <Link href={'/home'}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 active:bg-white/10 flex-shrink-0">
            <ChevronLeft size={18} className="text-slate-400" />
          </Link>
          <h1 className="text-lg font-bold text-white">Coach Call</h1>
        </div>
        <div>
          <p className="text-slate-400 text-sm mb-1">Training van {dateLabel}</p>
          <p className="text-white font-semibold">Hoe voelden deze trainingen?</p>
        </div>

        {/* Activiteiten */}
        {call.coach_call_items.map(item => {
          const Icon = getSportIcon(item.sport_type)
          const currentRating = ratings[item.id] ?? null
          const currentMood = moods[item.id] ?? null
          const reaction = reactions[item.id]
          const isDone = item.status === 'done'
          const isSaving = savingItem === item.id

          return (
            <Card key={item.id} className="p-4 flex flex-col gap-4">
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
              </div>

              {/* RPE 1-10 */}
              <div>
                <p className="text-xs text-slate-500 mb-2">Hoe zwaar voelde het? (1 licht — 10 maximaal)</p>
                <div className="flex gap-1">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button key={n} disabled={isDone}
                      onClick={() => setRatings(prev => ({ ...prev, [item.id]: n }))}
                      className={cn(
                        'flex-1 h-9 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60',
                        currentRating === n ? 'bg-primary-500 text-white' : 'bg-slate-800 text-slate-400'
                      )}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood */}
              <div>
                <p className="text-xs text-slate-500 mb-2">Hoe voelde je je erbij?</p>
                <div className="flex gap-2">
                  {MOOD_OPTIONS.map(({ value, emoji, label }) => (
                    <button key={value} disabled={isDone}
                      onClick={() => setMoods(prev => ({ ...prev, [item.id]: value }))}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-colors disabled:opacity-60',
                        currentMood === value ? 'bg-primary-500/20 border border-primary-500/40' : 'bg-slate-800'
                      )}>
                      <span className="text-xl">{emoji}</span>
                      <span className="text-[10px] text-slate-400">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Optionele notitie */}
              {!isDone && (
                <textarea
                  value={notes[item.id] || ''}
                  onChange={e => setNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder="Nog iets kwijt over deze training? (optioneel)"
                  rows={2}
                  className="w-full bg-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 resize-none"
                />
              )}

              {/* Coach reactie */}
              {reaction && (
                <div className="flex items-start gap-2 bg-primary-500/5 border border-primary-500/20 rounded-xl px-3 py-3">
                  <Sparkles size={14} className="text-primary-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-200 leading-relaxed">{reaction}</p>
                </div>
              )}

              {/* Opslaan per item */}
              {!isDone && (
                <button
                  onClick={() => handleSaveItem(item.id)}
                  disabled={isSaving || !currentRating || !currentMood}
                  className="w-full py-3 bg-primary-500 text-white rounded-xl font-semibold text-sm disabled:opacity-40 active:bg-primary-600">
                  {isSaving ? 'Coach denkt na...' : 'Evaluatie versturen'}
                </button>
              )}
            </Card>
          )
        })}

        {allDone && (
          <Link href={'/home'}
            className="w-full py-4 bg-slate-800 text-slate-300 rounded-xl font-semibold text-base active:bg-slate-700">
            Klaar
          </Link>
        )}
      </div>
    </AppShell>
  )
}
