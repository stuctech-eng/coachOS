// ── Performance Intelligence Platform — gedeelde validatie ──────────────

/** Type guard: is dit een geldig, niet-null getal (geen NaN)? */
export function isGeldigGetal(waarde: unknown): waarde is number {
  return typeof waarde === 'number' && !Number.isNaN(waarde)
}
