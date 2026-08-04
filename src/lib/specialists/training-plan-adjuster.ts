// ── Cycling Daily Adjustment Layer — dunne wrapper ──────────────────────
// Bron: overleg 19 juli 2026. Volledige logica in
// training-plan-engine/adjuster-core.ts (platformcomponent). Dit bestand
// bestaat alleen nog zodat api/specialists/cycling/training-plan/route.ts
// ONGEWIJZIGD blijft werken.
//
// v2.4.265: return-type uitgebreid met fatigueSignaal (ADR-007).

import { voerDailyAdjustmentUitCore } from './training-plan-engine/adjuster-core'
import { cyclingAdapter } from './training-plan-engine/cycling-adapter'
import type { AanpassingResultaat } from './training-plan-engine/types'
import type { DailyAdjustmentResultaat } from './training-plan-engine/adjuster-core'

export type { AanpassingResultaat, DailyAdjustmentResultaat }

export async function voerDailyAdjustmentUit(userId: string, planId: string): Promise<DailyAdjustmentResultaat> {
  return voerDailyAdjustmentUitCore(userId, planId, cyclingAdapter)
}
