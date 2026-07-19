// ── Critical Power-model — Cycling Specialist Roadmap v1.0, Fase 3 ─────
// Bron: overleg 19 juli 2026. VOLLEDIG DETERMINISTISCH — geen AI.
//
// Klassiek 2-parameter Critical Power-model (Monod & Scherrer 1965,
// publiek gedocumenteerd, wijdverspreid gebruikt — niet propriëtair):
//   P(t) = CP + W'/t
// Lineair te maken door P uit te zetten tegen 1/t:
//   P = CP + W' · (1/t)   →   intercept = CP, richtingscoëfficiënt = W'
//
// Client-safe: bevat GEEN server-only imports (geen Supabase). Werkt
// uitsluitend op vermogenscurve-data die al elders is opgehaald — geen
// nieuwe SQL, geen nieuwe API-call.

export interface VermogensCurvePunt {
  duration_sec: number
  watts: number
}

export interface CriticalPowerResultaat {
  cp: number // watt
  w_prime: number // joule (kJ = w_prime / 1000)
  r_kwadraat: number // 0-1, fit-kwaliteit — LAAG bij weinig/inconsistente punten
  gebruikte_punten: VermogensCurvePunt[]
  betrouwbaar: boolean // false bij <3 punten of R² < 0.9 — eerlijke waarschuwing, geen verborgen onzekerheid
}

// Fysiologisch geldig bereik voor het 2-parameter-model: 2-30 minuten.
// Korter: te veel anaerobe/neuromusculaire invloed (vertekent W' fors
// omhoog). Langer: aerobe vermoeidheid zakt onder CP, model overschat
// dan de duurzaamheid. Zie bijv. Vandewalle et al., breed gerepliceerd.
const MIN_DUUR_SEC = 120
const MAX_DUUR_SEC = 1800
const MIN_PUNTEN_VOOR_BEREKENING = 2
const MIN_PUNTEN_VOOR_BETROUWBAAR = 3
const MIN_R_KWADRAAT_VOOR_BETROUWBAAR = 0.9

/**
 * Berekent Critical Power (CP) en W' via lineaire regressie op
 * vermogen vs. 1/duur, voor punten binnen het fysiologisch geldige
 * bereik (2-30 min). Geeft null terug als er te weinig data is —
 * toont dan bewust GEEN schijnzeker getal.
 */
export function berekenCriticalPower(curve: VermogensCurvePunt[]): CriticalPowerResultaat | null {
  const geldigePunten = curve
    .filter(p => p.duration_sec >= MIN_DUUR_SEC && p.duration_sec <= MAX_DUUR_SEC)
    .sort((a, b) => a.duration_sec - b.duration_sec)

  if (geldigePunten.length < MIN_PUNTEN_VOOR_BEREKENING) return null

  // Lineaire regressie: x = 1/duur, y = watt
  const x = geldigePunten.map(p => 1 / p.duration_sec)
  const y = geldigePunten.map(p => p.watts)
  const n = x.length

  const xGem = x.reduce((a, b) => a + b, 0) / n
  const yGem = y.reduce((a, b) => a + b, 0) / n

  let teller = 0
  let noemer = 0
  for (let i = 0; i < n; i++) {
    teller += (x[i] - xGem) * (y[i] - yGem)
    noemer += (x[i] - xGem) ** 2
  }

  // Bij exact gelijke 1/duur-waarden (kan niet met unieke duration_sec,
  // maar defensief) — geen deling door 0
  if (noemer === 0) return null

  const wPrime = teller / noemer // richtingscoëfficiënt
  const cp = yGem - wPrime * xGem // intercept

  // R² — hoeveel van de variatie het model verklaart
  const yVoorspeld = x.map(xi => cp + wPrime * xi)
  const ssRes = y.reduce((som, yi, i) => som + (yi - yVoorspeld[i]) ** 2, 0)
  const ssTot = y.reduce((som, yi) => som + (yi - yGem) ** 2, 0)
  const rKwadraat = ssTot === 0 ? 1 : 1 - ssRes / ssTot

  // Onfysiologische uitkomst (negatieve CP/W') — eerlijk als onbetrouwbaar
  // markeren i.p.v. een absurd getal tonen
  const fysiologischPlausibel = cp > 0 && wPrime > 0

  return {
    cp: Math.round(cp),
    w_prime: Math.round(wPrime),
    r_kwadraat: Math.round(rKwadraat * 1000) / 1000,
    gebruikte_punten: geldigePunten,
    betrouwbaar: fysiologischPlausibel && n >= MIN_PUNTEN_VOOR_BETROUWBAAR && rKwadraat >= MIN_R_KWADRAAT_VOOR_BETROUWBAAR,
  }
}
