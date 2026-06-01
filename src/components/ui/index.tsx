'use client'
import { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, fullWidth, children, disabled, ...props }, ref) => (
    <button ref={ref} disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed select-none',
        variant === 'primary' && 'bg-primary-500 text-white hover:bg-primary-600',
        variant === 'secondary' && 'bg-coach-card text-slate-200 hover:bg-slate-700 border border-coach-border',
        variant === 'ghost' && 'bg-transparent text-slate-300 hover:text-white hover:bg-slate-800',
        variant === 'danger' && 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30',
        size === 'sm' && 'px-3 py-2 text-sm',
        size === 'md' && 'px-4 py-3 text-base',
        size === 'lg' && 'px-6 py-4 text-lg',
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {children}
        </span>
      ) : children}
    </button>
  )
)
Button.displayName = 'Button'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl bg-coach-card', className)} {...props} />
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-slate-300">{label}</label>}
      <input ref={ref}
        className={cn('w-full bg-coach-card border border-coach-border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors', error && 'border-red-500', className)}
        {...props}
      />
      {error && <span className="text-sm text-red-400">{error}</span>}
    </div>
  )
)
Input.displayName = 'Input'

export function ScoreSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-slate-300">{label}</span>
        <span className="text-2xl font-bold text-white">{value}</span>
      </div>
      <div className="flex gap-1.5">
        {[1,2,3,4,5,6,7,8,9,10].map(score => (
          <button key={score} type="button" onClick={() => onChange(score)}
            className={cn('flex-1 h-10 rounded-lg text-sm font-medium transition-all active:scale-95', score === value ? 'bg-primary-500 text-white' : 'bg-coach-card text-slate-400')}>
            {score}
          </button>
        ))}
      </div>
    </div>
  )
}
