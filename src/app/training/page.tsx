'use client'
import { useState, useEffect } from 'react'
import { Dumbbell, Wind, Play, Clock, Zap, ChevronRight } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { Card } from '@/components/ui'
import { cn } from '@/utils'

interface CoachInstruction {
  training_allowed: boolean
  type: string
  intensity: string
  duration: number
  reason: string
  recovery_modules: string[]
}

function getIntensityKleur(intensity: string): string {
  if (intensity === 'high') return 'text-red-400'
  if (intensity === 'medium') return 'text-orange-400'
  return 'text-green-400'
}

function getIntensityLabel(intensity: string): string {
  if (intensity === 'high') return 'Intensief'
  if (intensity === 'medium') return 'Matig'
  return 'Licht'
}

export default function TrainingPage() {
  const [instruction, setInstruction] = useState<CoachInstruction | null>(null)
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    const vandaag = new Date().toISOString().split('T')[0]

    // Check localStorage cache
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

    // Haal instructie op van Coach AI
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

  return (
    <AppShell>
      <div className="px-5 py-6 flex flex-col gap-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Training</h1>
          <p className="text-slate-400 text-sm mt-0.5">Begeleiding door Coach AI</p>
        </div>

        {/* Coach instructie */}
        {laden ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-coach-card animate-pulse" />)}
          </div>
        ) : instruction ? (
          <>
            {/* Vandaag plan */}
            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Vandaag van je coach</p>

              {instruction.training_allowed && (
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-coach-border">
                  <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                    <Dumbbell size={20} className="text-primary-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold capitalize">{instruction.type} training</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock size={12} />
                        {instruction.duration} min
                      </span>
                      <span className={cn('flex items-center gap-1 text-xs', getIntensityKleur(instruction.intensity))}>
                        <Zap size={12} />
                        {getIntensityLabel(instruction.intensity)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {instruction.recovery_modules.length > 0 && instruction.recovery_modules.map((module, i) => (
                <div key={i} className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Wind size={20} className="text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold">{module}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Herstel module</p>
                  </div>
                </div>
              ))}

              <p className="text-slate-400 text-sm leading-relaxed mt-2">{instruction.reason}</p>
            </Card>

            {/* Start knoppen */}
            {instruction.training_allowed && (
              <button
                className="w-full py-4 bg-primary-600 text-white rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 active:bg-primary-700"
                onClick={() => alert('Trainer AI komt binnenkort!')}
              >
                <Play size={22} fill="white" />
                Start training
              </button>
            )}

            {instruction.recovery_modules.length > 0 && (
              <button
                className="w-full py-4 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl font-semibold text-base flex items-center justify-center gap-3 active:bg-blue-600/30"
                onClick={() => alert('Recovery AI komt binnenkort!')}
              >
                <Wind size={20} />
                Start herstel
              </button>
            )}
          </>
        ) : (
          /* Geen instructie — fallback */
          <Card className="p-6 text-center">
            <Dumbbell size={40} className="text-slate-600 mx-auto mb-3" />
            <p className="text-white font-semibold mb-1">Geen plan voor vandaag</p>
            <p className="text-slate-400 text-sm leading-relaxed">
              Doe eerst je check-in op het Home scherm zodat Coach AI een plan kan maken.
            </p>
          </Card>
        )}

        {/* Modules overzicht */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Beschikbare modules</p>
          <div className="flex flex-col gap-2">
            {[
              { icon: Dumbbell, label: 'Kettlebell', sub: 'Swing, Squat, Clean, Press', kleur: 'text-primary-400', bg: 'bg-primary-500/20', soon: true },
              { icon: Wind, label: 'Ademhaling', sub: 'Box, 4-7-8, Coherent', kleur: 'text-blue-400', bg: 'bg-blue-500/20', soon: true },
              { icon: Zap, label: 'Mobiliteit', sub: 'Nek, heupen, rug, full body', kleur: 'text-green-400', bg: 'bg-green-500/20', soon: true },
            ].map(({ icon: Icon, label, sub, kleur, bg, soon }) => (
              <Card key={label} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', bg)}>
                    <Icon size={18} className={kleur} />
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{label}</p>
                    <p className="text-slate-500 text-xs">{sub}</p>
                  </div>
                  {soon ? (
                    <span className="text-xs text-slate-600 bg-slate-800 px-2 py-1 rounded-lg">Binnenkort</span>
                  ) : (
                    <ChevronRight size={16} className="text-slate-500" />
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

      </div>
    </AppShell>
  )
}
