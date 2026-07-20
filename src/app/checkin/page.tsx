'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import { useCoach } from '@/hooks/useCoach'
import { AppShell } from '@/components/layout'
import { Card, ScoreSlider, Button } from '@/components/ui'
import { cn } from '@/utils'

export default function CheckInPage() {
  const router = useRouter()
  const { saveCheckin } = useCoach()
  const [feeling, setFeeling] = useState(7)
  const [energy, setEnergy] = useState(7)
  const [stress, setStress] = useState(5)
  const [motivatie, setMotivatie] = useState(7)
  const [spierpijn, setSpierpijn] = useState(3)
  const [slaapKwaliteit, setSlaapKwaliteit] = useState(7)
  const [hasPain, setHasPain] = useState(false)
  const [painDesc, setPainDesc] = useState('')
  const [notes, setNotes] = useState('')
  const [hrvMs, setHrvMs] = useState('')
  const [hrvOvergeslagen, setHrvOvergeslagen] = useState(false)
  const [hrvBoodschap, setHrvBoodschap] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      await saveCheckin({
        feeling_score: feeling,
        energy_score: energy,
        stress_score: stress,
        motivation_score: motivatie,
        soreness_score: spierpijn,
        sleep_quality: slaapKwaliteit,
        has_pain: hasPain,
        pain_description: hasPain ? painDesc : undefined,
        notes: notes || undefined,
      })

      // HRV is optioneel en volledig los van de check-in zelf — een
      // mislukte HRV-opslag mag de check-in nooit blokkeren
      let boodschapVoorTiming: string | null = null
      if (hrvMs && !hrvOvergeslagen) {
        try {
          const res = await fetch('/api/hrv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hrv_ms: Number(hrvMs) }),
          })
          const data = await res.json()
          if (data.boodschap) {
            boodschapVoorTiming = data.boodschap
            setHrvBoodschap(data.boodschap)
          }
        } catch {
          // Stil falen — check-in zelf is al gelukt
        }
      }

      setDone(true)
      setTimeout(() => router.push('/home'), boodschapVoorTiming ? 2800 : 1500)
    } catch {
      setError('Opslaan mislukt. Probeer opnieuw.')
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
          <CheckCircle size={64} className="text-coach-green animate-fade-in" />
          <p className="text-white font-semibold text-lg">Check-in opgeslagen</p>
          {hrvBoodschap && <p className="text-slate-300 text-sm text-center">{hrvBoodschap}</p>}
          <p className="text-slate-400 text-sm">Terug naar home...</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Goedemorgen</h1>
          <p className="text-slate-400 mt-1 text-sm">Hoe ben je de dag begonnen?</p>
        </div>

        {/* Gevoel & Energie */}
        <Card className="p-5 flex flex-col gap-6">
          <ScoreSlider label="Hoe voel je je?" value={feeling} onChange={setFeeling} />
          <div className="h-px bg-coach-border" />
          <ScoreSlider label="Hoeveel energie heb je?" value={energy} onChange={setEnergy} />
        </Card>

        {/* Slaap & Stress */}
        <Card className="p-5 flex flex-col gap-6">
          <ScoreSlider label="Hoe was je slaap?" value={slaapKwaliteit} onChange={setSlaapKwaliteit} />
          <div className="h-px bg-coach-border" />
          <ScoreSlider label="Stressniveau?" value={stress} onChange={setStress} lowLabel="Laag" highLabel="Hoog" />
        </Card>

        {/* v2.4.137: HRV — optioneel, met expliciete Overslaan-knop.
            Los invulvak i.p.v. een tweede screenshot-flow (HRV-status
            staat in Garmin Connect op een eigen scherm). */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-white font-medium text-sm">Heb je je ochtend-HRV gemeten?</p>
            <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">Optioneel</span>
          </div>
          {!hrvOvergeslagen ? (
            <>
              <p className="text-slate-400 text-xs mb-3">HRV vannacht, uit je Garmin-app</p>
              <div className="flex items-center gap-2">
                <input
                  type="number" inputMode="decimal" placeholder="bijv. 57" value={hrvMs}
                  onChange={e => setHrvMs(e.target.value)}
                  className="flex-1 bg-coach-darker border border-coach-border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-primary-500"
                />
                <span className="text-slate-400 text-sm">ms</span>
              </div>
              <button type="button" onClick={() => { setHrvOvergeslagen(true); setHrvMs('') }}
                className="mt-3 text-xs text-slate-500 underline underline-offset-2">
                Overslaan
              </button>
            </>
          ) : (
            <div className="flex items-center justify-between mt-1">
              <p className="text-slate-500 text-xs">Overgeslagen voor vandaag</p>
              <button type="button" onClick={() => setHrvOvergeslagen(false)} className="text-xs text-primary-400 underline underline-offset-2">
                Toch invullen
              </button>
            </div>
          )}
        </Card>

        {/* Motivatie & Spierpijn */}
        <Card className="p-5 flex flex-col gap-6">
          <ScoreSlider label="Motivatie om te bewegen?" value={motivatie} onChange={setMotivatie} />
          <div className="h-px bg-coach-border" />
          <ScoreSlider label="Spierpijn?" value={spierpijn} onChange={setSpierpijn} lowLabel="Geen" highLabel="Veel" />
        </Card>

        {/* Pijn */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium text-sm">Blessure of klacht?</p>
              <p className="text-slate-400 text-xs mt-0.5">Anders dan normale spierpijn</p>
            </div>
            <button
              type="button"
              onClick={() => setHasPain(!hasPain)}
              className={cn('w-12 h-7 rounded-full transition-all relative', hasPain ? 'bg-coach-orange' : 'bg-coach-border')}
            >
              <span className={cn('absolute top-1 w-5 h-5 rounded-full bg-white transition-all', hasPain ? 'left-6' : 'left-1')} />
            </button>
          </div>
          {hasPain && (
            <textarea
              placeholder="Omschrijf kort wat je voelt..."
              value={painDesc}
              onChange={e => setPainDesc(e.target.value)}
              rows={2}
              className="mt-4 w-full bg-coach-darker border border-coach-border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-primary-500 resize-none"
            />
          )}
        </Card>

        {/* Notitie */}
        <Card className="p-4">
          <p className="text-white font-medium text-sm mb-3">Aanvullende notitie</p>
          <textarea
            placeholder="Optioneel — iets bijzonders vandaag?"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-coach-darker border border-coach-border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-primary-500 resize-none"
          />
        </Card>

        {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-3">{error}</p>}
        <Button onClick={handleSubmit} loading={loading} fullWidth size="lg">Check-in opslaan</Button>
      </div>
    </AppShell>
  )
}
