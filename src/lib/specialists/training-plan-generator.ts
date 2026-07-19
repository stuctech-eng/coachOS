// ── Cycling Plan Generator — dunne wrapper om de Training Plan Engine ──
// Bron: overleg 19 juli 2026. De volledige logica staat nu in
// training-plan-engine/core.ts (platformcomponent, sport-onafhankelijk).
// Dit bestand bestaat alleen nog zodat het bestaande aanroeppunt
// (api/specialists/cycling/training-plan/route.ts) ONGEWIJZIGD blijft
// werken — zelfde functienaam, zelfde signatuur, zelfde gedrag.
//
// Herexporteert ook het type en de mesocyclus-helper, voor bestaande
// imports elders (bijv. kalender-scherm) die deze nog gebruiken.

import { genereerTrainingsplanCore, bepaalMesocycli, volgendeDatumVoorDag } from './training-plan-engine/core'
import { cyclingAdapter } from './training-plan-engine/cycling-adapter'
import type { MesocycleType, GegenereerdePlanResultaat } from './training-plan-engine/types'

export type { MesocycleType, GegenereerdePlanResultaat }
export { bepaalMesocycli, volgendeDatumVoorDag }

export async function genereerTrainingsplan(userId: string): Promise<GegenereerdePlanResultaat> {
  return genereerTrainingsplanCore(userId, cyclingAdapter)
}
