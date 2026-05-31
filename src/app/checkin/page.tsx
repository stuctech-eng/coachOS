'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import { useUserStore } from '@/store/userStore'
import { useCoachStore } from '@/store/coachStore'
import { checkinService } from '@/services/checkin'
import { AppShell } from '@/components/layout/AppShell'
import { Card } from '@/components/ui'
import { ScoreSlider } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils'

export default function CheckInPage() {
  const router = useRouter()
  const { user } = useUserStore()
  const { setCheckin } = useCoachStore()
  const [feeling, setFeeling] = useState(7)
  const [energy, setEnergy] = useState(7)
  const [hasPain, setHasPain] = useState(false)
  const [painDesc, setPainDesc] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    if (!user) return
    setLoading(true)
    try {
      const checkin = await checkinService.saveCheckin(user.id, {
        feeling_score: feeling,
        energy_score: energy,
        has_pain: hasPain,
        pain_description: hasPain ? painDesc : null,
        notes: notes || null,
      })
      setCheckin(checkin)
      setDone(true)
      setTimeout(() => router.push('/home'), 1500)
    } catch (err) {
      console.error('Check-in failed:', err)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <CheckCircle size={64} className="text-coach-green animate-fade-in" />
          <p className="text-white font-semibold text-lg">Check-in opgeslagen</p>
          <p className="text-slate-400 text-sm">Coach berekent je advies...</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-6">

        <div>
          <h1 className="text-2xl font-bold text-white">Goedemorgen</h1>
          <p className="text-slate-400 mt-1 text-sm">Hoe ben je de dag begonnen?</p>
        </div>

        <Card className="p-5 flex flex-col gap-6">
          <ScoreSlider
            label="Hoe voel je je?"
            value={feeling}
            onChange={setFeeling}
          />
          <div className="h-px bg-coach-border" />
          <ScoreSlider
            label="Hoeveel energie heb je?"
            value={energy}
            onChange={setEnergy}
          />
        </Card>

        {/* Pain toggle */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium text-sm">Pijn of klachten?</p>
              <p className="text-slate-400 text-xs mt-0.5">Spierpijn, blessures, ongemak</p>
            </div>
            <button
              type="button"
              onClick={() => setHasPain(!hasPain)}
              className={cn(
                'w-12 h-7 rounded-full transition-all duration-200 relative',
                hasPain ? 'bg-coach-orange' : 'bg-coach-border'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-5 h-5 rounded-full bg-white transition-all duration-200',
                  hasPain ? 'left-6' : 'left-1'
                )}
              />
            </button>
          </div>

          {hasPain && (
            <textarea
              placeholder="Omschrijf kort wat je voelt..."
              value={painDesc}
              onChange={(e) => setPainDesc(e.target.value)}
              rows={2}
              className="mt-4 w-full bg-coach-darker border border-coach-border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-primary-500 resize-none"
            />
          )}
        </Card>

        {/* Optional notes */}
        <Card className="p-4">
          <p className="text-white font-medium text-sm mb-3">Aanvullende notitie</p>
          <textarea
            placeholder="Optioneel — sliep slecht, gestresst, bijzondere dag..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-coach-darker border border-coach-border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-primary-500 resize-none"
          />
        </Card>

        <Button
          onClick={handleSubmit}
          loading={loading}
          fullWidth
          size="lg"
        >
          Check-in opslaan
        </Button>

      </div>
    </AppShell>
  )
}
