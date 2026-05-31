'use client'
import { StatusColor } from '@/types'
import { cn } from '@/utils'

interface RecoveryStatusProps {
  color: StatusColor | null
  score: number | null
  label: string
}

const colorMap = {
  green: {
    dot: 'bg-coach-green',
    ring: 'ring-coach-green/30',
    text: 'text-coach-green',
    bg: 'bg-coach-green/10',
    label: 'Volledig hersteld',
  },
  orange: {
    dot: 'bg-coach-orange',
    ring: 'ring-coach-orange/30',
    text: 'text-coach-orange',
    bg: 'bg-coach-orange/10',
    label: 'Gedeeltelijk hersteld',
  },
  red: {
    dot: 'bg-coach-red',
    ring: 'ring-coach-red/30',
    text: 'text-coach-red',
    bg: 'bg-coach-red/10',
    label: 'Niet hersteld',
  },
}

export function RecoveryStatus({ color, score, label }: RecoveryStatusProps) {
  const c = color ? colorMap[color] : colorMap.orange

  return (
    <div className={cn('flex items-center gap-3 rounded-xl px-4 py-3', c.bg)}>
      <div className={cn('w-3 h-3 rounded-full flex-shrink-0 animate-pulse-slow', c.dot, `ring-4 ${c.ring}`)} />
      <div className="flex-1">
        <p className={cn('text-sm font-semibold', c.text)}>{label || c.label}</p>
      </div>
      {score !== null && (
        <span className={cn('text-lg font-bold', c.text)}>{score}</span>
      )}
    </div>
  )
}
