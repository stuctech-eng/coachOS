import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getGreeting(name?: string | null): string {
  const hour = new Date().getHours()
  let greeting = 'Goedendag'
  if (hour < 12) greeting = 'Goedemorgen'
  else if (hour < 18) greeting = 'Goedemiddag'
  else greeting = 'Goedenavond'
  return name ? greeting + ' ' + name : greeting
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function getStatusLabel(color: string | null): string {
  if (color === 'green') return 'Volledig hersteld'
  if (color === 'orange') return 'Gedeeltelijk hersteld'
  if (color === 'red') return 'Niet hersteld'
  return 'Onbekend'
}
