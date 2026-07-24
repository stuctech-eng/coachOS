// ── Nederlandse feestdagen — gedeelde berekening ────────────────────────
// Bron: overleg 22 juli 2026, Coach Agenda Fase 2, eerste stap. Was
// alleen aanwezig in life-events/page.tsx als puur visuele decoratie —
// de Coach wist er niets van. Nu naar een gedeeld bestand, zodat zowel
// de UI als de Context Resolver dezelfde berekening gebruiken (één
// bron van waarheid, geen twee losse implementaties die uit de pas
// kunnen lopen).
//
// Puur wiskundig (Gauss' paasformule) — geen externe API nodig.

export interface HolidayEvent {
  date: string
  name: string
  icon: string
}

export function getNederlandseFeestdagen(jaar: number): HolidayEvent[] {
  const a = jaar % 19, b = Math.floor(jaar / 100), c = jaar % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const maand = Math.floor((h + l - 7 * m + 114) / 31)
  const dag = ((h + l - 7 * m + 114) % 31) + 1
  const pasen = new Date(jaar, maand - 1, dag)
  const add = (dt: Date, n: number) => { const r = new Date(dt); r.setDate(dt.getDate() + n); return r }
  const s = (dt: Date) => dt.toISOString().split('T')[0]
  return [
    { date: `${jaar}-01-01`, name: 'Nieuwjaarsdag', icon: '🎆' },
    { date: s(add(pasen, -2)), name: 'Goede Vrijdag', icon: '✝️' },
    { date: s(pasen), name: 'Eerste Paasdag', icon: '🐣' },
    { date: s(add(pasen, 1)), name: 'Tweede Paasdag', icon: '🐣' },
    { date: `${jaar}-04-27`, name: 'Koningsdag', icon: '👑' },
    { date: `${jaar}-05-05`, name: 'Bevrijdingsdag', icon: '🕊️' },
    { date: s(add(pasen, 39)), name: 'Hemelvaartsdag', icon: '☁️' },
    { date: s(add(pasen, 49)), name: 'Eerste Pinksterdag', icon: '🕊️' },
    { date: s(add(pasen, 50)), name: 'Tweede Pinksterdag', icon: '🕊️' },
    { date: `${jaar}-12-25`, name: 'Eerste Kerstdag', icon: '🎄' },
    { date: `${jaar}-12-26`, name: 'Tweede Kerstdag', icon: '🎄' },
  ]
}

/** Is een gegeven datum (yyyy-mm-dd) een Nederlandse feestdag? */
export function isFeestdag(dagStr: string): HolidayEvent | null {
  const jaar = parseInt(dagStr.split('-')[0], 10)
  const feestdagen = getNederlandseFeestdagen(jaar)
  return feestdagen.find(f => f.date === dagStr) || null
}
