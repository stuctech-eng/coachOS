'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { OnboardingData } from '@/types'
import { cn } from '@/utils'

const GOALS = [
  { id: 'conditie', label: 'Betere conditie' },
  { id: 'kracht', label: 'Sterker worden' },
  { id: 'afvallen', label: 'Afvallen' },
  { id: 'energie', label: 'Meer energie' },
  { id: 'gezondheid', label: 'Gezond ouder worden' },
  { id: 'slaap', label: 'Beter slapen' },
]

const TIME_OPTIONS = [
  { id: '15min', label: '15 min', desc: 'Kort maar krachtig' },
  { id: '30min', label: '30 min', desc: 'Effectief en haalbaar' },
  { id: '60min', label: '60 min', desc: 'Volledig trainen' },
  { id: 'flexibel', label: 'Flexibel', desc: 'Wisselt per dag' },
]

const ACTIVITIES = [
  'Wandelen', 'Hardlopen', 'Fietsen', 'Kettlebell',
  'Krachttraining', 'Yoga', 'Zwemmen', 'Padel',
  'Tennis', 'Mobiliteit', 'CrossFit', 'Anders',
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<OnboardingData>({
    first_name: '', display_name: '', age: 0, gender: null, goals: [], available_time: null, activities: [],
  })

  const update = (u: Partial<OnboardingData>) => setData(prev => ({ ...prev, ...u }))
  const toggleGoal = (id: string) => update({ goals: data.goals.includes(id) ? data.goals.filter(g => g !== id) : [...data.goals, id] })
  const toggleActivity = (name: string) => update({ activities: data.activities.includes(name) ? data.activities.filter(a => a !== name) : [...data.activities, name] })
  const canNext = () => {
    if (step === 1) return data.first_name.length > 0
    if (step === 2) return data.goals.length > 0
    if (step === 3) return data.available_time !== null
    if (step === 4) return data.activities.length > 0
    return true
  }

  const handleComplete = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, display_name: data.first_name }),
      })
      if (!res.ok) throw new Error('Opslaan mislukt')
      router.push('/home')
    } catch {
      setError('Er ging iets mis. Probeer opnieuw.')
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-coach-dark safe-top">
      <div className="px-6 pt-6 pb-4">
        <div className="flex gap-1.5 mb-6">
          {[1,2,3,4,5].map(i => <div key={i} className={cn('flex-1 h-1 rounded-full transition-all', i <= step ? 'bg-primary-500' : 'bg-coach-border')} />)}
        </div>
        <p className="text-xs text-slate-500">Stap {step} van 5</p>
      </div>

      <div className="flex-1 scroll-area px-6">
        {step === 1 && (
          <div className="flex flex-col gap-6 animate-slide-up">
            <div><h2 className="text-2xl font-bold text-white">Hoe heet je?</h2><p className="text-slate-400 mt-1 text-sm">De coach gebruikt je naam elke dag</p></div>
            <Input label="Voornaam" placeholder="Dick" value={data.first_name} onChange={e => update({ first_name: e.target.value })} autoFocus />
            <Input label="Leeftijd" type="number" inputMode="numeric" placeholder="45" value={data.age || ''} onChange={e => update({ age: parseInt(e.target.value) || 0 })} />
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-300">Geslacht</label>
              <div className="grid grid-cols-2 gap-2">
                {(['man', 'vrouw', 'anders', 'zeg ik liever niet'] as const).map(g => (
                  <button key={g} type="button" onClick={() => update({ gender: g })}
                    className={cn('py-3 px-4 rounded-xl text-sm font-medium capitalize transition-all active:scale-95', data.gender === g ? 'bg-primary-500 text-white' : 'bg-coach-card text-slate-400')}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6 animate-slide-up">
            <div><h2 className="text-2xl font-bold text-white">Wat zijn je doelen?</h2><p className="text-slate-400 mt-1 text-sm">Kies alles wat van toepassing is</p></div>
            <div className="flex flex-col gap-2">
              {GOALS.map(goal => (
                <button key={goal.id} type="button" onClick={() => toggleGoal(goal.id)}
                  className={cn('flex items-center justify-between px-4 py-4 rounded-xl text-left transition-all', data.goals.includes(goal.id) ? 'bg-primary-500/20 border border-primary-500/50 text-white' : 'bg-coach-card text-slate-300 border border-transparent')}>
                  <span className="font-medium">{goal.label}</span>
                  {data.goals.includes(goal.id) && <Check size={18} className="text-primary-400" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6 animate-slide-up">
            <div><h2 className="text-2xl font-bold text-white">Hoeveel tijd heb je?</h2><p className="text-slate-400 mt-1 text-sm">Gemiddeld per training</p></div>
            <div className="flex flex-col gap-2">
              {TIME_OPTIONS.map(opt => (
                <button key={opt.id} type="button" onClick={() => update({ available_time: opt.id as OnboardingData['available_time'] })}
                  className={cn('flex items-center justify-between px-4 py-4 rounded-xl text-left transition-all', data.available_time === opt.id ? 'bg-primary-500/20 border border-primary-500/50 text-white' : 'bg-coach-card text-slate-300 border border-transparent')}>
                  <div><p className="font-semibold">{opt.label}</p><p className="text-sm text-slate-400 mt-0.5">{opt.desc}</p></div>
                  {data.available_time === opt.id && <Check size={18} className="text-primary-400" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-6 animate-slide-up">
            <div><h2 className="text-2xl font-bold text-white">Welke activiteiten doe je?</h2><p className="text-slate-400 mt-1 text-sm">Kies alles wat je doet of wil doen</p></div>
            <div className="grid grid-cols-2 gap-2">
              {ACTIVITIES.map(activity => (
                <button key={activity} type="button" onClick={() => toggleActivity(activity)}
                  className={cn('flex items-center justify-between px-4 py-3.5 rounded-xl text-left transition-all', data.activities.includes(activity) ? 'bg-primary-500/20 border border-primary-500/50 text-white' : 'bg-coach-card text-slate-300 border border-transparent')}>
                  <span className="text-sm font-medium">{activity}</span>
                  {data.activities.includes(activity) && <Check size={14} className="text-primary-400" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col items-center justify-center gap-6 min-h-96 animate-slide-up text-center">
            <div className="w-20 h-20 rounded-full bg-primary-500/20 flex items-center justify-center">
              <Check size={40} className="text-primary-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Welkom, {data.first_name}!</h2>
              <p className="text-slate-400 mt-2 text-sm leading-relaxed max-w-xs">Je coach is klaar. Elke ochtend krijg je een persoonlijk advies op basis van je herstel en doelen.</p>
            </div>
            {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-3 w-full">{error}</p>}
          </div>
        )}
      </div>

      <div className="px-6 pb-8 pt-4 safe-bottom flex gap-3">
        {step > 1 && step < 5 && (
          <Button variant="secondary" onClick={() => setStep(s => s - 1)} className="w-14"><ChevronLeft size={20} /></Button>
        )}
        {step < 5 ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()} fullWidth size="lg">Volgende <ChevronRight size={18} className="ml-1" /></Button>
        ) : (
          <Button onClick={handleComplete} loading={loading} fullWidth size="lg">Start CoachOS</Button>
        )}
      </div>
    </div>
  )
}
