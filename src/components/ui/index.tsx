'use client'
import { HTMLAttributes, InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/utils'

// ============================================
// CARD
// ============================================
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered'
}

export function Card({ className, variant = 'default', ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl',
        {
          'bg-coach-card': variant === 'default',
          'bg-slate-800': variant === 'elevated',
          'bg-transparent border border-coach-border': variant === 'bordered',
        },
        className
      )}
      {...props}
    />
  )
}

// ============================================
// INPUT
// ============================================
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-slate-300">{label}</label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full bg-coach-card border border-coach-border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500',
            'focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500',
            'transition-colors duration-200',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
            className
          )}
          {...props}
        />
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    )
  }
)
Input.displayName = 'Input'

// ============================================
// BADGE
// ============================================
interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'green' | 'orange' | 'red' | 'blue' | 'default'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold',
        {
          'bg-green-500/15 text-green-400': variant === 'green',
          'bg-orange-500/15 text-orange-400': variant === 'orange',
          'bg-red-500/15 text-red-400': variant === 'red',
          'bg-primary-500/15 text-primary-400': variant === 'blue',
          'bg-slate-700 text-slate-300': variant === 'default',
        },
        className
      )}
      {...props}
    />
  )
}

// ============================================
// SCORE SLIDER (for check-in)
// ============================================
interface ScoreSliderProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

export function ScoreSlider({ label, value, onChange, min = 1, max = 10 }: ScoreSliderProps) {
  const scores = Array.from({ length: max - min + 1 }, (_, i) => i + min)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-slate-300">{label}</span>
        <span className="text-2xl font-bold text-white">{value}</span>
      </div>
      <div className="flex gap-1.5">
        {scores.map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            className={cn(
              'flex-1 h-10 rounded-lg text-sm font-medium transition-all duration-150 active:scale-95',
              score === value
                ? 'bg-primary-500 text-white'
                : 'bg-coach-card text-slate-400 hover:bg-slate-700'
            )}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  )
}
