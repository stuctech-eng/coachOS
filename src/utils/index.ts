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

// ── v2.4.101: tijdzone-veilige datum-naar-string ────────────────────────
// Bug gevonden: `d.toISOString().split('T')[0]` converteert naar UTC —
// voor gebruikers in een tijdzone vóór op UTC (bijv. Nederland, UTC+2 in
// de zomer) verschuift dit lokale-middernacht-datums een dag terug.
// Deze functie gebruikt uitsluitend lokale datumcomponenten
// (getFullYear/getMonth/getDate), nooit een UTC-conversie — dus geen
// verschuiving, ongeacht tijdzone.
export function isoDatum(d: Date): string {
  const jaar = d.getFullYear()
  const maand = String(d.getMonth() + 1).padStart(2, '0')
  const dag = String(d.getDate()).padStart(2, '0')
  return `${jaar}-${maand}-${dag}`
}
