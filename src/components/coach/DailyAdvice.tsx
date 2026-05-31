'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { CoachRecommendation } from '@/types'
import { Card } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils'

interface DailyAdviceProps {
  recommendation: CoachRecommendation | null
  isGenerating: boolean
  onGenerate: () => void
  hasCheckin: boolean
}

export function DailyAdvice({ recommendation, isGenerating, onGenerate, hasCheckin }: DailyAdviceProps) {
  const [showReasoning, setShowReasoning] = useState(false)

  if (!recommendation) {
    return (
      <Card className="p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Sparkles size={18} />
            <span className="text-sm">Coaching advies</span>
          </div>
          {!hasCheckin ? (
            <div>
              <p className="text-slate-300 text-sm">Doe eerst je ochtend check-in voor een persoonlijk advies.</p>
            </div>
          ) : (
            <Button
              onClick={onGenerate}
              loading={isGenerating}
              fullWidth
            >
              {isGenerating ? 'Coach denkt na...' : 'Genereer advies'}
            </Button>
          )}
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-5 animate-slide-up">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-primary-400">
          <Sparkles size={18} />
          <span className="text-sm font-medium">Advies voor vandaag</span>
        </div>

        <p className="text-xl font-semibold text-white leading-snug">
          {recommendation.recommendation}
        </p>

        <button
          onClick={() => setShowReasoning(!showReasoning)}
          className={cn(
            'flex items-center gap-2 text-sm text-primary-400 self-start',
            'active:opacity-70 transition-opacity'
          )}
        >
          {showReasoning ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          Waarom?
        </button>

        {showReasoning && recommendation.reasoning && (
          <div className="bg-slate-800/50 rounded-xl p-4 animate-fade-in">
            <p className="text-slate-300 text-sm leading-relaxed">
              {recommendation.reasoning}
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
