'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dumbbell, Wind, Footprints, Zap, Play, RefreshCw, Clock, ChevronRight, BookOpen } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { cn } from '@/utils'

interface RecoveryModule {
  type: 'breathing' | 'mobility' | 'walk' | 'relaxation'
  subtype: string
  duration: number
  label: string
}

interface TrainingInstruction {
  training_allowed: boolean
  training_type: string | null
  intensity: 'light' | 'medium' | 'heavy' | null
  duration: number | null
  recovery_modules: RecoveryModule[]
  reason: string
  coach_message: string
}

function getIntensityLabel(intensity: string | null): string {
  if (intensity === 'heavy') return 'Intensief'
  if (intensity === 'medium') return 'Matig'
  if (intensity === 'light') return 'Licht'
  return ''
}

function getIntensityKleur(intensity: string | null): string {
  if (intensity === 'heavy') return 'text-red-400'
  if (intensity === 'medium') return 'text-orange-400'
  return 'text-green-400'
}

function getModuleIcon(type: string) {
  if (type === 'breathing') return Wind
  if (type === 'mobility') return Zap
  if (type === 'walk') return Footprints
  return Wind
}

function getModuleKleur(type: string): string {
  if (type === 'breathing') return 'text-blue-400'
  if (type === 'mobility') return 'text-green-400'
  if (type === 'walk') return 'text-teal-400'
  return 'text-purple-400'
}

function getModuleBg(type: string): string {
  if (type === 'breathing') return 'bg-blue-500/20'
  if (type === 'mobility') return 'bg-green-500/20'
  if (type === 'walk') return 'bg-teal-500/20'
  return 'bg-purple-500/20'
}

function getModuleRoute(module: RecoveryModule): string {
  if (module.type === 'breathing') return `/training/recovery/breathing?subtype=${module.subtype}&duration=${module.duration}&label=${encodeURIComponent(module.label)}`
  if (module.type === 'mobility') return `/training/recovery/mobility?subtype=${module.subtype}&duration=${module.duration}&label=${encodeURIComponent(module.label)}`
  if (module.type === 'walk') return `/training/recovery/walk?duration=${module.duration}`
  return '/training'
}

const BIBLIOTHEEK = [
  { type: 'breathing' as const, subtype: 'box_breathing', label: 'Box Breathing', sub: '4-4-4-4 ritme', duration: 6 },
  { type: 'breathing' as const, subtype: 'breathing_478', label: '4-7-8 Ademhaling', sub: 'ontspanning', duration: 8 },
  { type: 'breathing' as const, subtype: 'coherent_breathing', label: 'Coherent Breathing', sub: 'hartritmevariabiliteit', duration: 10 },
  { type: 'breathing' as const, subtype: 'stress_reset', label: 'Stress Reset', sub: 'snel kalmeren', duration: 5 },
  { type: 'mobility' as const, subtype: 'neck_shoulders', label: 'Nek & Schouders', sub: 'bureaumobiliteit', duration: 8 },
  { type: 'mobility' as const, subtype: 'hips', label: 'Heup mobiliteit', sub: 'herstel & flexibiliteit', duration: 10 },
  { type: 'mobility' as const, subtype: 'full_body', label: 'Full Body', sub: 'ochtend of avond routine', duration: 12 },
  { type: 'walk' as const, subtype: 'recovery_walk', label: 'Herstelwandeling', sub: 'lage intensiteit', duration: 20 },
]

export default function TrainingPage() {
  const router = useRouter()
  const [instruction, setInstruction] = useState<TrainingInstruction | null>(null)
  const [laden, setLaden] = useState(true)
  const [genereren, setGenereren] = useState(false)
  const [showBibliotheek, setShowBibliotheek] = useState(false)
  const vandaag = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const cachedDatum = window.localStorage.getItem('training_instructie_datum')
        const cachedData = window.localStorage.getItem('training_instructie_data')
        if (cachedDatum === vandaag && cachedData) {
          setInstruction(JSON.parse(cachedData))
          setLaden(false)
          return
        }
      } catch { /* */ }
    }
    fetch('/api/training/today')
      .then(r => r.json())
      .then(data => {
        if (data.instruction) {
          setInstruction(data.instruction)
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('training_instructie_data', JSON.stringify(data.instruction))
            window.localStorage.setItem('training_instructie_datum', vandaag)
          }
        }
      })
      .catch(() => {})
      .finally(() => setLaden(false))
  }, [])

  async function genereerPlan() {
    setGenereren(true)
    try {
      const res = await fetch('/api/training/today', { method: 'POST' })
      const data = await res.json()
      if (data.instruction) {
        setInstruction(data.instruction)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('training_instructie_data', JSON.stringify(data.instruction))
          window.localStorage.setItem('training_instructie_datum', vandaag)
        }
      }
    } catch { /* */ } finally { setGenereren(false) }
  }

  function startKettlebell() {
    if (!instruction) return
    const intensity = instruction.intensity || 'medium'
    const duration = instruction.duration || 30
    router.push(`/training/kettlebell?intensity=${intensity}&duration=${duration}`)
  }

  const isKettlebell = instruction?.training_allowed && instruction?.training_type === 'kettlebell'

  const totaalDuur = instruction ? (
    (instruction.training_allowed && instruction.duration ? instruction.duration : 0) +
    instruction.recovery_modules.reduce((s, m) => s + m.duration, 0)
  ) : 0

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Training</h1>
            <p className="text-slate-400 text-sm mt-0.5">Begeleiding door Coach AI</p>
          </div>
          <button onClick={genereerPlan} disabled={genereren}
            className="w-10 h-10 rounded-xl bg-coach-card flex items-center justify-center active:bg-slate-700 disabled:opacity-50">
            <RefreshCw size={18} className={cn('text-slate-400', genereren && 'animate-spin')} />
          </button>
        </div>

        {laden || genereren ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-coach-card animate-pulse" />)}
          </div>
        ) : instruction ? (
          <>
            {/* Coach bericht */}
            <Card className="p-5 border border-primary-500/20 bg-primary-500/5">
              <p className="text-white text-sm leading-relaxed">{instruction.coach_message}</p>
              {totaalDuur > 0 && (
                <div className="flex items-center gap-1.5 mt-3">
                  <Clock size={13} className="text-slate-500" />
                  <p className="text-xs text-slate-500">Totaal ~{totaalDuur} minuten</p>
                </div>
              )}
            </Card>

            {/* Vandaag plan */}
            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Vandaag voor jou</p>

              {/* Kettlebell training */}
              {instruction.training_allowed && instruction.training_type && (
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-coach-border">
                  <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                    <Dumbbell size={20} className="text-primary-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold capitalize">{instruction.training_type} training</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock size={11} /> {instruction.duration} min
                      </span>
                      {instruction.intensity && (
                        <span className={cn('text-xs flex items-center gap-1', getIntensityKleur(instruction.intensity))}>
                          <Zap size={11} /> {getIntensityLabel(instruction.intensity)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Recovery modules */}
              {instruction.recovery_modules.map((module, i) => {
                const Icon = getModuleIcon(module.type)
                const route = getModuleRoute(module)
                return (
                  <button key={i} onClick={() => router.push(route)}
                    className="flex items-center gap-3 w-full mb-2 last:mb-0 active:opacity-70">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', getModuleBg(module.type))}>
                      <Icon size={20} className={getModuleKleur(module.type)} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-white font-medium text-sm">{module.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{module.duration} minuten</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-600" />
                  </button>
                )
              })}
            </Card>

            {/* START knop — kettlebell of recovery */}
            {isKettlebell ? (
              <button
                onClick={startKettlebell}
                className="w-full py-4 bg-primary-600 text-white rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 active:bg-primary-700"
              >
                <Play size={22} fill="white" />
                Start kettlebell training
              </button>
            ) : instruction.recovery_modules.length > 0 ? (
              <button
                onClick={() => router.push(getModuleRoute(instruction.recovery_modules[0]))}
                className="w-full py-4 bg-primary-600 text-white rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 active:bg-primary-700"
              >
                <Play size={22} fill="white" />
                Start
              </button>
            ) : null}

            {!instruction.training_allowed && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
                <p className="text-xs text-blue-400">{instruction.reason}</p>
              </div>
            )}
          </>
        ) : (
          <Card className="p-6 text-center">
            <Dumbbell size={40} className="text-slate-600 mx-auto mb-3" />
            <p className="text-white font-semibold mb-1">Geen plan voor vandaag</p>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              Doe eerst je check-in zodat Coach AI een plan kan maken.
            </p>
            <button onClick={genereerPlan} disabled={genereren}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm active:bg-primary-700 disabled:opacity-50">
              {genereren ? 'Bezig...' : 'Genereer plan'}
            </button>
          </Card>
        )}

        {/* Herstelbibliotheek */}
        <div>
          <button onClick={() => setShowBibliotheek(!showBibliotheek)}
            className="flex items-center gap-2 text-slate-400 text-sm mb-3">
            <BookOpen size={16} />
            <span>Herstelbibliotheek</span>
            <ChevronRight size={14} className={cn('transition-transform', showBibliotheek && 'rotate-90')} />
          </button>

          {showBibliotheek && (
            <div className="flex flex-col gap-2">
              {BIBLIOTHEEK.map((item, i) => {
                const Icon = getModuleIcon(item.type)
                const route = getModuleRoute(item)
                return (
                  <button key={i} onClick={() => router.push(route)}
                    className="w-full active:opacity-70 text-left">
                    <div className="p-3 flex items-center gap-3 w-full bg-coach-card rounded-2xl border border-coach-border">
                      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', getModuleBg(item.type))}>
                        <Icon size={18} className={getModuleKleur(item.type)} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-white text-sm font-medium">{item.label}</p>
                        <p className="text-slate-500 text-xs">{item.sub} · {item.duration} min</p>
                      </div>
                      <ChevronRight size={14} className="text-slate-600" />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>


      </div>
    </AppShell>
  )
}
