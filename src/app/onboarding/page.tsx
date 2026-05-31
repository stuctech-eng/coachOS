'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { profileService } from '@/services/profile'
import { useUserStore } from '@/store/userStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui'
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
  const { user } = useUserStore()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<OnboardingData>({
    first_name: '',
    display_name: '',
    age: 0,
    gender: null,
    goals: [],
    available_time: null,
    activities: [],
  })

  const totalSteps = 5

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }

  const toggleGoal = (id: string) => {
    const goals = data.goals.includes(id)
      ? data.goals.filter(g => g !== id)
      : [...data.goals, id]
    updateData({ goals })
  }

  const toggleActivity = (name: string) => {
    const activities = data.activities.includes(name)
      ? data.activities.filter(a => a !== name)
      : [...data.activities, name]
    updateData({ activities })
  }

  const handleComplete = async () => {
    if (!user) return
    setLoading(true)
    try {
      await profileService.completeOnboarding(user.id, {
        ...data,
        display_name: data.first_name,
      })
      router.push('/home')
    } catch (err) {
      console.error('Onboarding failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const canNext = () => {
    if (step === 1) return data.first_name.length > 0
    if (step === 2) return data.goals.length > 0
    if (step === 3) return data.available_time !== null
    if (step === 4) return data.activities.length > 0
    return true
  }

  return (
    <div className="h-screen flex flex-col bg-coach-dark safe-top">
      {/* Progress */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex gap-1.5 mb-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 h-1 rounded-full transition-all duration-300',
                i < step ? 'bg-primary-500' : 'bg-coach-border'
              )}
            />
          ))}
        </div>
        <p className="text-xs text-slate-500">Stap {step} van {totalSteps}</p>
      </div>

      {/* Content */}
      <div className="flex-1 scroll-area px-6">

        {/* Step 1: Name */}
        {step === 1 && (
          <div className="flex flex-col gap-6 animate-slide-up">
            <div>
              <h2 className="text-2xl font-bold text-white">Hoe heet je?</h2>
              <p className="text-slate-400 mt-1 text-sm">De coach gebruikt je naam elke dag</p>
            </div>
            <Input
              label="Voornaam"
              placeholder="Dick"
              value={data.first_name}
              onChange={e => updateData({ first_name: e.target.value })}
              autoFocus
            />
            <Input
              label="Leeftijd"
              type="number"
              inputMode="numeric"
              placeholder="45"
              value={data.age || ''}
              onChange={e => updateData({ age: parseInt(e.target.value) || 0 })}
            />
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-300">Geslacht</label>
              <div className="grid grid-cols-2 gap-2">
                {(['man', 'vrouw', 'anders', 'zeg ik liever niet'] as const).map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => updateData({ gender: g })}
                    className={cn(
                      'py-3 px-4 rounded-xl text-sm font-medium capitalize transition-all duration-150 active:scale-95',
                      data.gender === g
                        ? 'bg-primary-500 text-white'
                        : 'bg-coach-card text-slate-400 hover:bg-slate-700'
                    )}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Goals */}
        {step === 2 && (
          <div className="flex flex-col gap-6 animate-slide-up">
            <div>
              <h2 className="text-2xl font-bold text-white">Wat zijn je doelen?</h2>
              <p className="text-slate-400 mt-1 text-sm">Kies alles wat van toepassing is</p>
            </div>
            <div className="flex flex-col gap-2">
              {GOALS.map(goal => (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => toggleGoal(goal.id)}
                  className={cn(
                    'flex items-center justify-between px-4 py-4 rounded-xl text-left transition-all duration-150 active:scale-98',
                    data.goals.includes(goal.id)
                      ? 'bg-primary-500/20 border border-primary-500/50 text-white'
                      : 'bg-coach-card text-slate-300 border border-transparent'
                  )}
                >
                  <span className="font-medium">{goal.label}</span>
                  {data.goals.includes(goal.id) && (
                    <Check size={18} className="text-primary-400 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Time */}
        {step === 3 && (
          <div className="flex flex-col gap-6 animate-slide-up">
            <div>
              <h2 className="text-2xl font-bold text-white">Hoeveel tijd heb je?</h2>
              <p className="text-slate-400 mt-1 text-sm">Gemiddeld per training</p>
            </div>
            <div className="flex flex-col gap-2">
              {TIME_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updateData({ available_time: opt.id as OnboardingData['available_time'] })}
                  className={cn(
                    'flex items-center justify-between px-4 py-4 rounded-xl text-left transition-all duration-150 active:scale-98',
                    data.available_time === opt.id
                      ? 'bg-primary-500/20 border border-primary-500/50 text-white'
                      : 'bg-coach-card text-slate-300 border border-transparent'
                  )}
                >
                  <div>
                    <p className="font-semibold">{opt.label}</p>
                    <p className="text-sm text-slate-400 mt-0.5">{opt.desc}</p>
                  </div>
                  {data.available_time === opt.id && (
                    <Check size={18} className="text-primary-400 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Activities */}
        {step === 4 && (
          <div className="flex flex-col gap-6 animate-slide-up">
            <div>
              <h2 className="text-2xl font-bold text-white">Welke activiteiten doe je?</h2>
              <p className="text-slate-400 mt-1 text-sm">Kies alles wat je doet of wil doen</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ACTIVITIES.map(activity => (
                <button
                  key={activity}
                  type="button"
                  onClick={() => toggleActivity(activity)}
                  className={cn(
                    'flex items-center justify-between px-4 py-3.5 rounded-xl text-left transition-all duration-150 active:scale-95',
                    data.activities.includes(activity)
                      ? 'bg-primary-500/20 border border-primary-500/50 text-white'
                      : 'bg-coach-card text-slate-300 border border-transparent'
                  )}
                >
                  <span className="text-sm font-medium">{activity}</span>
                  {data.activities.includes(activity) && (
                    <Check size={14} className="text-primary-400 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Done */}
        {step === 5 && (
          <div className="flex flex-col items-center justify-center gap-6 min-h-[60vh] animate-slide-up text-center">
            <div className="w-20 h-20 rounded-full bg-primary-500/20 flex items-center justify-center">
              <Check size={40} className="text-primary-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Welkom, {data.first_name}!</h2>
              <p className="text-slate-400 mt-2 text-sm leading-relaxed max-w-xs">
                Je coach is klaar. Elke ochtend krijg je een persoonlijk advies op basis van je herstel en doelen.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="px-6 pb-8 pt-4 safe-bottom flex gap-3">
        {step > 1 && step < 5 && (
          <Button
            variant="secondary"
            onClick={() => setStep(s => s - 1)}
            className="w-14"
          >
            <ChevronLeft size={20} />
          </Button>
        )}

        {step < 5 ? (
          <Button
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext()}
            fullWidth
            size="lg"
          >
            Volgende <ChevronRight size={18} className="ml-1" />
          </Button>
        ) : (
          <Button
            onClick={handleComplete}
            loading={loading}
            fullWidth
            size="lg"
          >
            Start CoachOS
          </Button>
        )}
      </div>
    </div>
  )
}
