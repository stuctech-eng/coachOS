// ── Vision Engine — generiek contract ───────────────────────────────────
// Bron: overleg 20 juli 2026. Platformcomponent, geen Garmin-specifieke
// code — dat zit uitsluitend in de losse parsers
// (garmin-health-parser.ts, garmin-performance-parser.ts, later evt.
// apple-health-parser.ts etc.). Zelfde principe als de Training Plan
// Engine Core+Adapter-architectuur: Core kent geen brand, alleen het
// contract.
//
// AI DOET ALLEEN OCR — een parser-prompt vraagt uitsluitend om de kale
// cijfers uit het screenshot, nooit om interpretatie ("je bent
// vermoeid"). Die interpretatie is het werk van de Health Analysis
// Engine (leest de opgeslagen ruwe data, berekent trend/status) en
// uiteindelijk de Coach — niet van deze laag.

export interface ValidationFlag {
  field: string
  value: number | null
  reason: string
  severity: 'warning' | 'error'
}

export interface VisionParseResult<T> {
  parsed: T
  raw_response: Record<string, unknown>
  confidence: number
  flags: ValidationFlag[]
}

export interface VisionParser<T> {
  naam: string
  /** Beschrijft het scherm + het exacte JSON-schema — puur OCR-instructie, geen interpretatie gevraagd */
  prompt: string
  normalize(raw: Record<string, unknown>): T
  validate(data: T): { flags: ValidationFlag[]; confidence: number }
}
