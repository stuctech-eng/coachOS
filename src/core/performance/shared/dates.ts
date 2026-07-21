// ── Performance Intelligence Platform — gedeelde datum-hulpfuncties ────
// Bewust GEEN eigen datum-formattering — hergebruikt isoDatum() uit
// @/utils, dezelfde bron die de rest van de app al gebruikt. Voorkomt
// een derde variant naast isoDatum() en toISOString() (zie de
// inconsistentie die al eerder werd gevonden tussen vision-import.ts
// en debug/recovery/route.ts, v2.4.145).

import { isoDatum } from '@/utils'

export { isoDatum }

/** Aantal dagen tussen twee ISO-datumstrings (yyyy-mm-dd). */
export function dagenTussen(vanaf: string, tot: string): number {
  const msPerDag = 24 * 60 * 60 * 1000
  return Math.round((new Date(tot).getTime() - new Date(vanaf).getTime()) / msPerDag)
}
