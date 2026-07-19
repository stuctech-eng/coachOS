// ── Cycling Daily Adjustment Layer — dunne wrapper ──────────────────────
// Bron: overleg 19 juli 2026. Volledige logica in
// training-plan-engine/adjuster-core.ts (platformcomponent). Dit bestand
// bestaat alleen nog zodat api/specialists/cycling/training-plan/route.ts
// ONGEWIJZIGD blijft werken.

import { voerDailyAdjustmentUitCore } from './training-plan-engine/adjuster-core'
import { cyclingAdapter } from './training-plan-engine/cycling-adapter'
import type { AanpassingResultaat } from './training-plan-engine/types'

export type { AanpassingResultaat }

export async function voerDailyAdjustmentUit(userId: string, planId: string): Promise<AanpassingResultaat[]> {
  return voerDailyAdjustmentUitCore(userId, planId, cyclingAdapter)
}
